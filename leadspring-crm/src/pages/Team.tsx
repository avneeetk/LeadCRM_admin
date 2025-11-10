import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { AgentPerformanceModal } from "@/components/AgentPerformanceModal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Mail,
  Phone,
  TrendingUp,
  Download,
  Clock,
  CheckCircle,
  Pencil,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, updateDoc, doc } from "firebase/firestore";
import type { Agent, AttendanceRecord } from "@/lib/mockData";
import { addAgent, toggleAgentStatus } from "@/lib/firestore/users";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Team() {
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [isPerformanceOpen, setIsPerformanceOpen] = useState(false);
  const [isAddAgentOpen, setIsAddAgentOpen] = useState(false);
  const [isEditAgentOpen, setIsEditAgentOpen] = useState(false);
  const [editAgent, setEditAgent] = useState<Agent | null>(null);

  const [newAgent, setNewAgent] = useState({
    name: "",
    email: "",
    phone: "",
    role: "subuser",
  });

  // 🔹 Real-time Firestore sync for Agents & Attendance
  useEffect(() => {
    const unsubAgents = onSnapshot(collection(db, "users"), (snap) => {
      const data = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Agent[];
      setAgents(data);
    });

    const unsubAttendance = onSnapshot(collection(db, "attendance"), (snap) => {
      const data = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as AttendanceRecord[];
      setTodayAttendance(data);
    });

    return () => {
      unsubAgents();
      unsubAttendance();
    };
  }, []);

  // 🔹 Export Attendance to XLS
  const handleExportAttendance = () => {
    try {
      if (!todayAttendance.length) {
        toast.error("No attendance data available for export");
        return;
      }

      const exportData = todayAttendance.map((record) => ({
        Name: record.name || "Unknown",
        Status: record.status || "N/A",
        PunchIn: record.punchIn || "N/A",
        PunchOut: record.punchOut || "N/A",
        Duration: record.duration || "N/A",
        Date: record.date || new Date().toLocaleDateString(),
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance");

      const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
      saveAs(blob, `attendance_${new Date().toISOString().split("T")[0]}.xlsx`);

      toast.success("Attendance exported successfully");
    } catch (err) {
      console.error("Error exporting XLS:", err);
      toast.error("Failed to export attendance");
    }
  };

  // 🔹 Add Agent
  const handleAddAgent = async () => {
    if (!newAgent.name || !newAgent.email || !newAgent.phone) {
      toast.error("Please fill in all required fields");
      return;
    }
    try {
      await addAgent(newAgent);
      toast.success("Agent added successfully");
      setIsAddAgentOpen(false);
      setNewAgent({ name: "", email: "", phone: "", role: "subuser" });
    } catch (err) {
      console.error(err);
      toast.error("Failed to add agent");
    }
  };

  // 🔹 Edit Agent Save
  const handleSaveEditAgent = async () => {
    if (!editAgent) return;
    try {
      const ref = doc(db, "users", editAgent.id);
      await updateDoc(ref, {
        name: editAgent.name,
        email: editAgent.email,
        phone: editAgent.phone,
        role: editAgent.role,
      });
      toast.success("Agent updated successfully");
      setIsEditAgentOpen(false);
    } catch (err) {
      console.error("Failed to update agent:", err);
      toast.error("Error updating agent");
    }
  };

  const handleViewPerformance = (agent: Agent) => {
    setSelectedAgent(agent);
    setIsPerformanceOpen(true);
  };

  return (
    <DashboardLayout
      title="Team"
      actions={
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportAttendance}>
            <Download className="mr-2 h-4 w-4" />
            Export Attendance
          </Button>
          <Dialog open={isAddAgentOpen} onOpenChange={setIsAddAgentOpen}>
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
                <div className="grid gap-2">
                  <Label>Name *</Label>
                  <Input
                    value={newAgent.name}
                    onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Email *</Label>
                  <Input
                    type="email"
                    value={newAgent.email}
                    onChange={(e) => setNewAgent({ ...newAgent, email: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Phone *</Label>
                  <Input
                    value={newAgent.phone}
                    onChange={(e) => setNewAgent({ ...newAgent, phone: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Role</Label>
                  <Select
                    value={newAgent.role}
                    onValueChange={(value) => setNewAgent({ ...newAgent, role: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="subuser">Subuser</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddAgentOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddAgent}>Save Agent</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      }
    >
      <div className="space-y-6">
        {/* 🔹 Attendance Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Today's Attendance</CardTitle>
          </CardHeader>
          <CardContent>
            {todayAttendance.length ? (
              <div className="space-y-4">
                {todayAttendance.map((record) => (
                  <div
                    key={record.userId}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant={record.status === "present" ? "default" : "secondary"}>
                        {record.status === "present" && (
                          <CheckCircle className="h-3 w-3 mr-1" />
                        )}
                        {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                      </Badge>
                      <span className="font-medium">{record.name}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      {record.punchIn && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>In: {record.punchIn}</span>
                        </div>
                      )}
                      {record.punchOut && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>Out: {record.punchOut}</span>
                        </div>
                      )}
                      {record.duration && (
                        <span className="font-medium text-success">{record.duration}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No attendance data available today.</p>
            )}
          </CardContent>
        </Card>

        {/* 🔹 Team Members */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <Card key={agent.id} className="overflow-hidden">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16">
                      <AvatarImage src={agent.avatar} />
                      <AvatarFallback>
                        {agent.name.split(" ").map((n) => n[0]).join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-lg">{agent.name}</CardTitle>
                      <Badge variant="outline" className="mt-1">
                        {agent.active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </div>
                  <Switch
                    checked={agent.active}
                    onCheckedChange={async (value) => {
                      try {
                        await toggleAgentStatus(agent.id, value);
                        toast.success(`Agent ${value ? "activated" : "deactivated"}`);
                      } catch (err) {
                        console.error("Failed to update agent status:", err);
                        toast.error("Error updating agent status");
                      }
                    }}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <span>{agent.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    <span>{agent.phone}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div>
                    <p className="text-2xl font-bold">{agent.assignedLeads}</p>
                    <p className="text-xs text-muted-foreground">Assigned Leads</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-success">{agent.closedDeals}</p>
                    <p className="text-xs text-muted-foreground">Closed Deals</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <TrendingUp className="h-4 w-4 text-success" />
                  <span className="text-sm text-muted-foreground">
                    {Math.round(
                      (agent.closedDeals / Math.max(agent.assignedLeads, 1)) * 100
                    )}
                    % conversion rate
                  </span>
                </div>

                <div className="pt-3 border-t mt-3">
                  <p className="text-xs text-muted-foreground mb-2">Today's Status</p>
                  <Badge
                    variant={agent.punchedIn ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {agent.punchedIn ? "Present" : "Absent"}
                  </Badge>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => handleViewPerformance(agent)}
                  >
                    View Performance
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setEditAgent(agent);
                      setIsEditAgentOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* 🔹 Edit Agent Dialog */}
      <Dialog open={isEditAgentOpen} onOpenChange={setIsEditAgentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Agent</DialogTitle>
            <DialogDescription>Update agent details below</DialogDescription>
          </DialogHeader>
          {editAgent && (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Name</Label>
                <Input
                  value={editAgent.name}
                  onChange={(e) => setEditAgent({ ...editAgent, name: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Email</Label>
                <Input
                  value={editAgent.email}
                  onChange={(e) => setEditAgent({ ...editAgent, email: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Phone</Label>
                <Input
                  value={editAgent.phone}
                  onChange={(e) => setEditAgent({ ...editAgent, phone: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Role</Label>
                <Select
                  value={editAgent.role}
                  onValueChange={(value) => setEditAgent({ ...editAgent, role: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="subuser">Subuser</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditAgentOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEditAgent}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AgentPerformanceModal
        agent={selectedAgent}
        open={isPerformanceOpen}
        onOpenChange={setIsPerformanceOpen}
      />
    </DashboardLayout>
  );
}