import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { AgentPerformanceModal } from "@/components/AgentPerformanceModal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Plus, Mail, Phone, TrendingUp, Pencil, Trash2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { addAgent, updateAgent, deleteAgent, Agent } from "@/lib/firestore/users";
import { setupLeadListeners, subscribeToAgentStats } from "@/lib/firestore/agentStats";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

/**
 * Team page
 * - Realtime users snapshot
 * - Per-agent listeners for assigned/closed counts (setupLeadListeners handles counts)
 * - Add / Edit / Delete agent
 *
 * Notes:
 * - Delete button is a trash icon on each card (top-right)
 * - Add modal auto-closes, prevents duplicates, shows toasts
 */

export default function Team() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [isPerformanceOpen, setIsPerformanceOpen] = useState(false);
  const [isAddAgentOpen, setIsAddAgentOpen] = useState(false);
  const [isEditAgentOpen, setIsEditAgentOpen] = useState(false);
  const [editAgent, setEditAgent] = useState<Partial<Agent> | null>(null);

  const [isAdding, setIsAdding] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isDeleting, setIsDeleting] = useState<Record<string, boolean>>({});

  const [newAgent, setNewAgent] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    role: "subuser",
    dateOfBirth: "",
    gender: "",
    address: "",
  });

  // Realtime users collection snapshot + setup per-agent listeners and per-doc subscribers
  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, "users"), (snap) => {
      const usersData = snap.docs.map((d) => ({
        id: d.id,
        assignedLeads: 0,
        closedDeals: 0,
        ...d.data(),
      })) as Agent[];
      setAgents(usersData);
    }, (err) => {
      console.error("users snapshot error:", err);
      toast.error("Failed to load agents");
    });

    const agentLeadUnsubs: Record<string, () => void> = {};
    const agentDocUnsubs: Record<string, () => void> = {};

    // helper to (re)install listeners for a set of agents
    const setupAll = (currentAgents: Agent[]) => {
      // cleanup previous
      Object.values(agentLeadUnsubs).forEach(u => u && u());
      Object.values(agentDocUnsubs).forEach(u => u && u());

      currentAgents.forEach((agent) => {
        if (!agent.id) return;

        // install lead listeners that will keep user doc counts updated
        agentLeadUnsubs[agent.id] = setupLeadListeners(agent.id);

        // subscribe to user doc changes to keep UI fresh
        agentDocUnsubs[agent.id] = subscribeToAgentStats(agent.id, (updated) => {
          if (!updated) return;
          setAgents(prev => prev.map(a => a.id === updated.id ? { ...a, ...updated } : a));
        });
      });
    };

    // initial installation and re-install whenever users collection changes
    const unsubUsersForLeads = onSnapshot(collection(db, "users"), (snap) => {
      const usersData = snap.docs.map((d) => ({
        id: d.id,
        assignedLeads: 0,
        closedDeals: 0,
        ...d.data(),
      })) as Agent[];
      setupAll(usersData);
    });

    return () => {
      unsubUsers();
      unsubUsersForLeads();
      Object.values(agentLeadUnsubs).forEach(u => u && u());
      Object.values(agentDocUnsubs).forEach(u => u && u());
    };
  }, []);

  // Password generator (UI helper)
  const generatePassword = () => {
    const length = 10;
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let pw = "";
    for (let i = 0; i < length; i++) pw += charset[Math.floor(Math.random() * charset.length)];
    return pw;
  };

  // Add agent (prevents duplicates via server-side check inside addAgent helper)
  const handleAddAgent = async () => {
    if (!newAgent.name || !newAgent.email || !newAgent.phone || !newAgent.password) {
      toast.error("Please fill all required fields");
      return;
    }
    setIsAdding(true);

    try {
      await addAgent({
        name: newAgent.name,
        email: newAgent.email,
        phone: newAgent.phone,
        password: newAgent.password,
        role: newAgent.role as "admin" | "subuser",
        dateOfBirth: newAgent.dateOfBirth,
        gender: newAgent.gender,
        address: newAgent.address,
      });

      // success: close modal, reset form, show toast
      setIsAddAgentOpen(false);
      setNewAgent({
        name: "",
        email: "",
        password: "",
        phone: "",
        role: "subuser",
        dateOfBirth: "",
        gender: "",
        address: "",
      });
      toast.success("Agent created successfully");
    } catch (err: any) {
      // addAgent throws with a message for duplicates or other errors
      console.error("addAgent error:", err);
      const msg = err?.message || "Failed to add agent";
      toast.error(msg);
    } finally {
      setIsAdding(false);
    }
  };

  // Save agent edit
  const handleSaveEditAgent = async () => {
    if (!editAgent?.id) return;
    setIsSavingEdit(true);
    try {
      await updateAgent(editAgent.id, {
        name: editAgent.name,
        email: editAgent.email,
        phone: editAgent.phone,
        role: editAgent.role,
        password: editAgent.password,
        dateOfBirth: editAgent.dateOfBirth,
        gender: editAgent.gender,
        address: editAgent.address,
      });
      toast.success("Agent updated successfully");
      setIsEditAgentOpen(false);
    } catch (err) {
      console.error("updateAgent error:", err);
      toast.error("Failed to update agent");
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Delete agent (trash icon on card). Confirmation dialog via window.confirm for simplicity.
  const handleDeleteAgent = async (agentId?: string, agentName?: string) => {
    if (!agentId) return;
    const ok = window.confirm(`Delete agent "${agentName || agentId}"? This cannot be undone.`);
    if (!ok) return;

    setIsDeleting(prev => ({ ...prev, [agentId]: true }));
    try {
      await deleteAgent(agentId);
      toast.success("Agent deleted");
      // users snapshot will update UI automatically
    } catch (err) {
      console.error("deleteAgent error:", err);
      toast.error("Failed to delete agent");
    } finally {
      setIsDeleting(prev => ({ ...prev, [agentId]: false }));
    }
  };

  return (
    <DashboardLayout
      title="Team"
      actions={
        <Dialog open={isAddAgentOpen} onOpenChange={(open) => setIsAddAgentOpen(open)}>
          <DialogTrigger asChild>
            <Button onClick={() => setIsAddAgentOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Agent
            </Button>
          </DialogTrigger>

          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Agent</DialogTitle>
              <DialogDescription>Add a new team member</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div>
                <Label>Name *</Label>
                <Input value={newAgent.name} onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })} />
              </div>

              <div>
                <Label>Email *</Label>
                <Input type="email" value={newAgent.email} onChange={(e) => setNewAgent({ ...newAgent, email: e.target.value })} />
              </div>

              <div>
                <Label>Phone *</Label>
                <Input value={newAgent.phone} onChange={(e) => setNewAgent({ ...newAgent, phone: e.target.value })} />
              </div>

              <div>
                <Label>Password *</Label>
                <div className="flex gap-2">
                  <Input type="text" value={newAgent.password} onChange={(e) => setNewAgent({ ...newAgent, password: e.target.value })} placeholder="Enter password" />
                  <Button variant="outline" onClick={() => { const p = generatePassword(); setNewAgent({ ...newAgent, password: p }); toast.success("Password Generated"); }}>
                    Generate
                  </Button>
                </div>
              </div>

              <div>
                <Label>Date of Birth</Label>
                <Input type="date" value={newAgent.dateOfBirth} onChange={(e) => setNewAgent({ ...newAgent, dateOfBirth: e.target.value })} />
              </div>

              <div>
                <Label>Gender</Label>
                <Select value={newAgent.gender} onValueChange={(v) => setNewAgent({ ...newAgent, gender: v })}>
                  <SelectTrigger><SelectValue placeholder="Select Gender" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Address</Label>
                <Textarea value={newAgent.address} onChange={(e) => setNewAgent({ ...newAgent, address: e.target.value })} />
              </div>

              <div>
                <Label>Role</Label>
                <Select value={newAgent.role} onValueChange={(value) => setNewAgent({ ...newAgent, role: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="subuser">Subuser</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddAgentOpen(false)}>Cancel</Button>
              <Button onClick={handleAddAgent} disabled={isAdding}>{isAdding ? "Saving..." : "Save Agent"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <Card key={agent.id} className="overflow-hidden relative">
              {/* Trash icon (delete) placed top-right */}
              <div className="absolute right-3 top-3 z-10">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDeleteAgent(agent.id, agent.name)}
                  disabled={!!isDeleting[agent.id]}
                  title="Delete agent"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <CardHeader className="pb-4">
                <div className="flex items-start gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={agent.avatar} />
                    <AvatarFallback>{(agent.name || "U").split(" ").map(n => n[0]).join("")}</AvatarFallback>
                  </Avatar>

                  <div>
                    <CardTitle className="text-lg">{agent.name}</CardTitle>
                    <div className="text-xs text-muted-foreground">{agent.email}</div>
                    <div className="text-xs text-muted-foreground">{agent.phone}</div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div>
                    <p className="text-2xl font-bold">{agent.assignedLeads ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Assigned Leads</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-success">{agent.closedDeals ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Closed Deals</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <TrendingUp className="h-4 w-4 text-success" />
                  <span className="text-sm text-muted-foreground">
                    {Math.round(((agent.closedDeals ?? 0) / Math.max(agent.assignedLeads ?? 1, 1)) * 100)}% conversion rate
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-3">
                  <Button variant="outline" onClick={() => { setSelectedAgent(agent); setIsPerformanceOpen(true); }}>
                    View Performance
                  </Button>

                  <Button variant="ghost" size="icon" onClick={() => { setEditAgent(agent); setIsEditAgentOpen(true); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Edit Agent */}
      <Dialog open={isEditAgentOpen} onOpenChange={(open) => setIsEditAgentOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Agent</DialogTitle>
            <DialogDescription>Update agent details below</DialogDescription>
          </DialogHeader>

          {editAgent && (
            <div className="grid gap-4 py-4">
              <div>
                <Label>Name</Label>
                <Input value={editAgent.name || ""} onChange={(e) => setEditAgent({ ...editAgent, name: e.target.value })} />
              </div>

              <div>
                <Label>Email</Label>
                <Input value={editAgent.email || ""} onChange={(e) => setEditAgent({ ...editAgent, email: e.target.value })} />
              </div>

              <div>
                <Label>Phone</Label>
                <Input value={editAgent.phone || ""} onChange={(e) => setEditAgent({ ...editAgent, phone: e.target.value })} />
              </div>

              <div>
                <Label>Password</Label>
                <div className="flex gap-2">
                  <Input type="text" value={editAgent.password || ""} onChange={(e) => setEditAgent({ ...editAgent, password: e.target.value })} placeholder="Leave blank to keep unchanged" />
                  <Button variant="outline" onClick={() => { const p = generatePassword(); setEditAgent({ ...editAgent, password: p }); toast.success("Password Generated"); }}>
                    Generate
                  </Button>
                </div>
              </div>

              <div>
                <Label>Date of Birth</Label>
                <Input type="date" value={editAgent.dateOfBirth || ""} onChange={(e) => setEditAgent({ ...editAgent, dateOfBirth: e.target.value })} />
              </div>

              <div>
                <Label>Gender</Label>
                <Select value={editAgent.gender || ""} onValueChange={(v) => setEditAgent({ ...editAgent, gender: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Address</Label>
                <Textarea value={editAgent.address || ""} onChange={(e) => setEditAgent({ ...editAgent, address: e.target.value })} />
              </div>

              <div>
                <Label>Role</Label>
                <Select value={editAgent.role || "subuser"} onValueChange={(value) => setEditAgent({ ...editAgent, role: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="subuser">Subuser</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditAgentOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveEditAgent} disabled={isSavingEdit}>{isSavingEdit ? "Saving..." : "Save Changes"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AgentPerformanceModal agent={selectedAgent} open={isPerformanceOpen} onOpenChange={setIsPerformanceOpen} />
    </DashboardLayout>
  );
}