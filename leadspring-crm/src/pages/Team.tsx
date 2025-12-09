// src/pages/Team.tsx
import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { AgentPerformanceModal } from "@/components/AgentPerformanceModal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Mail, Phone, TrendingUp, Pencil, Trash2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { addAgent, updateAgent, deleteAgent, Agent } from "@/lib/firestore/users";
import { computeAgentStatsOnce, setupLeadListenersRealtime } from "@/lib/firestore/agentStats";
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
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";

export default function Team() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [isPerformanceOpen, setIsPerformanceOpen] = useState(false);
  const [isAddAgentOpen, setIsAddAgentOpen] = useState(false);
  const [isEditAgentOpen, setIsEditAgentOpen] = useState(false);
  const [editAgent, setEditAgent] = useState<Partial<Agent> | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const [newAgent, setNewAgent] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    role: "subuser",
    dateOfBirth: "",
    gender: "",
    address: "",
    active: true,
  });

  // --------------------- REALTIME AGENT + STATS LISTENERS ----------------------------
  useEffect(() => {
    // store unsub functions so we can cleanup properly
    const agentLeadUnsubs: Record<string, () => void> = {};
    const agentDocUnsubs: Record<string, () => void> = {};

    // single users snapshot (no duplicate subscriptions)
    const usersUnsub = onSnapshot(collection(db, "users"), (snap) => {
      const users = snap.docs.map((d) => ({
        id: d.id,
        assignedLeads: 0,
        closedDeals: 0,
        ...d.data(),
      })) as Agent[];

      setAgents(users);

      // cleanup any previous per-agent listeners before re-creating
      Object.values(agentLeadUnsubs).forEach((u) => { try { u(); } catch {} });
      Object.values(agentDocUnsubs).forEach((u) => { try { u(); } catch {} });

      users.forEach((agent) => {
        if (!agent.id) return;

        // setup realtime minimal listener for leads assigned to this agent
        try {
          const leadUnsub = setupLeadListenersRealtime(agent.id);
          agentLeadUnsubs[agent.id] = typeof leadUnsub === "function" ? leadUnsub : () => {};
        } catch (err) {
          console.warn("setupLeadListenersRealtime failed for", agent.id, err);
          agentLeadUnsubs[agent.id] = () => {};
        }

        // compute agent stats once (cheap, one-time) and update UI if changed
        computeAgentStatsOnce(agent.id).then((updated) => {
          if (!updated) return;
          setAgents((prev) => prev.map((a) => (a.id === agent.id ? { ...a, ...updated } : a)));
        }).catch((err) => {
          console.warn("computeAgentStatsOnce error for", agent.id, err);
        });

        // placeholder unsub for doc-level subscription; we don't create an extra onSnapshot here
        agentDocUnsubs[agent.id] = () => {};
      });
    }, (err) => {
      console.error("users snapshot error:", err);
      toast.error("Failed to load agents (permissions?)");
    });

    return () => {
      try { usersUnsub(); } catch {}
      Object.values(agentLeadUnsubs).forEach((u) => { try { u(); } catch {} });
      Object.values(agentDocUnsubs).forEach((u) => { try { u(); } catch {} });
    };
  }, []);

  // --------------------- PASSWORD GENERATOR ----------------------------
  const generatePassword = () => {
    const length = 10;
    const charset =
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < length; i++) {
      password += charset[Math.floor(Math.random() * charset.length)];
    }
    return password;
  };

  // --------------------- ADD AGENT ----------------------------
  const handleAddAgent = async () => {
    if (!newAgent.name || !newAgent.email || !newAgent.phone || !newAgent.password) {
      toast.error("Please fill all required fields");
      return;
    }

    setSubmitting(true);
    // safety timeout: auto-close modal if operation stalls for too long
    const stallTimeout = setTimeout(() => {
      toast.warning("Saving is taking longer than expected — closing modal. Check the user list to confirm the new agent.");
      setSubmitting(false);
      setIsAddAgentOpen(false);
    }, 15000);

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

      clearTimeout(stallTimeout);
      toast.success("Agent added successfully");
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
        active: true,
      });
    } catch (err: any) {
      clearTimeout(stallTimeout);
      const msg = err?.message || "Failed to add agent";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // --------------------- SAVE EDIT AGENT ----------------------------
  const handleSaveEditAgent = async () => {
    if (!editAgent?.id) return;
    setSubmitting(true);
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
        active: editAgent.active,
      });
      toast.success("Agent updated successfully");
      setIsEditAgentOpen(false);
    } catch (err) {
      console.error("updateAgent error:", err);
      toast.error("Failed to update agent (permissions?)");
    } finally {
      setSubmitting(false);
    }
  };

  // --------------------- TOGGLE ACTIVE / INACTIVE --------------------
  const handleToggleActive = async (agentId: string, newValue: boolean) => {
  // optimistic UI update so toggle feels instant
  try {
    // update local UI immediately
    setAgents(prev => prev.map(a => a.id === agentId ? { ...a, active: newValue } : a));

    // persist change
    await updateAgent(agentId, { active: newValue });

    toast.success(`Agent ${newValue ? "activated" : "deactivated"}`);
  } catch (err) {
    console.error("toggle active error:", err);
    toast.error("Failed to change status (permissions?)");

    // rollback optimistic update on failure
    setAgents(prev => prev.map(a => a.id === agentId ? { ...a, active: !newValue } : a));
  }
};

  // --------------------- DELETE AGENT ----------------------------
  const [deleting, setDeleting] = useState(false);

  const handleDeleteAgent = async () => {
    if (!deleteTarget) return;

    // Use safe deletion (no optimistic UI remove) so we don't lose the Firestore record
    // if the Auth cloud-function fails. Disable the button while in-flight.
    setDeleting(true);

    try {
      // Attempt server-side deletion (Cloud Function will remove auth user)
      await deleteAgent(deleteTarget);

      // Remove from local state only after server confirms deletion
      setAgents((prev) => prev.filter((a) => a.id !== deleteTarget));

      toast.success("Agent deleted");
      setDeleteTarget(null);
    } catch (err: any) {
      console.error("deleteAgent error:", err);

      // Provide a clearer error message for common cases
      const code = err?.code || (err?.message && err.message.toLowerCase()) || "unknown_error";
      if (String(code).toLowerCase().includes("permission") || String(code).toLowerCase().includes("permission-denied")) {
        toast.error("Permission denied: you don’t have rights to delete this agent.");
      } else if (String(code).toLowerCase().includes("internal") || String(code).toLowerCase().includes("internal-error")) {
        toast.error("Server error while deleting agent. Try again in a moment.");
      } else {
        toast.error(err?.message || "Failed to delete agent");
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <DashboardLayout
      title="Team"
      actions={
        <Dialog open={isAddAgentOpen} onOpenChange={(open) => setIsAddAgentOpen(open)}>
          <DialogTrigger asChild>
            <Button>
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
                  <Button variant="outline" onClick={() => {
                    const p = generatePassword();
                    setNewAgent({ ...newAgent, password: p });
                    toast.success("Password Generated");
                  }}>
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

              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Label>Role</Label>
                  <Select value={newAgent.role} onValueChange={(value) => setNewAgent({ ...newAgent, role: value })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="subuser">Subuser</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <Label>Active</Label>
                  <Switch checked={newAgent.active} onCheckedChange={(v) => setNewAgent({ ...newAgent, active: v })} />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddAgentOpen(false)}>Cancel</Button>
              <Button onClick={handleAddAgent} disabled={submitting}>
                {submitting ? "Saving..." : "Save Agent"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      {/* ----------------------- AGENT CARDS ----------------------- */}
      <div className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <Card key={agent.id} className="overflow-hidden">
              <CardHeader className="pb-4">
                <div className="flex items-start gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={agent.avatar} />
                    <AvatarFallback>{(agent.name || "U").split(" ").map(n => n[0]).join("")}</AvatarFallback>
                  </Avatar>

                  <div className="flex-1">
                    <CardTitle className="text-lg">{agent.name}</CardTitle>
                    <div className="text-xs text-muted-foreground">{agent.email}</div>
                    <div className="text-xs text-muted-foreground">{agent.phone}</div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-2">
                      <Switch checked={Boolean(agent.active)} onCheckedChange={(v) => handleToggleActive(agent.id!, Boolean(v))} />
<span className="text-xs">{Boolean(agent.active) ? "Active" : "Inactive"}</span>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => { setDeleteTarget(agent.id!); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
      <Dialog open={isEditAgentOpen} onOpenChange={setIsEditAgentOpen}>
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

              <div className="flex items-center justify-between">
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

                <div className="flex items-center gap-2">
                  <Label>Active</Label>
                  <Switch checked={Boolean(editAgent.active)} onCheckedChange={(v) => setEditAgent({ ...editAgent, active: Boolean(v) })} />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditAgentOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveEditAgent} disabled={submitting}>{submitting ? "Saving..." : "Save Changes"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Agent</AlertDialogTitle>
            <AlertDialogDescription>Are you sure? This will remove the agent permanently.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAgent} disabled={deleting}>{deleting ? 'Deleting...' : 'Delete'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AgentPerformanceModal agent={selectedAgent} open={isPerformanceOpen} onOpenChange={setIsPerformanceOpen} />
    </DashboardLayout>
  );
}