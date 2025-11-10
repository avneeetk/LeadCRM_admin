import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, Plus, Search, Eye, Edit, Trash2, Calendar as CalendarIcon, Clock } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { addAttendance, updateAttendance, deleteAttendanceRecord } from "@/lib/firestore/attendance";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

interface AttendanceRecord {
  id?: string;
  name: string;
  date: string;
  punchIn: string;
  punchOut?: string;
  location: string;
  status: string;
}

export default function Attendance() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<AttendanceRecord | null>(null);
  const [deleteRecordId, setDeleteRecordId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    date: new Date(),
    punchIn: "",
    punchOut: "",
    location: "",
    status: "present",
  });

  // 🔹 Live Firestore Sync
  useEffect(() => {
    const q = query(collection(db, "attendance"), orderBy("date", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as AttendanceRecord[];
      setRecords(data);
    });
    return () => unsubscribe();
  }, []);

  // 🔹 Filtered view
  const filtered = records.filter((r) => {
    const matchSearch = r.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = statusFilter === "all" || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // 🔹 Add new record
  const handleAdd = async () => {
    if (!form.name || !form.punchIn || !form.location) {
      toast.error("Please fill all required fields");
      return;
    }

    try {
      await addAttendance({
        ...form,
        date: format(form.date, "yyyy-MM-dd"),
      });
      toast.success("Attendance added successfully");
      setAddModalOpen(false);
      setForm({
        name: "",
        date: new Date(),
        punchIn: "",
        punchOut: "",
        location: "",
        status: "present",
      });
    } catch (err) {
      toast.error("Failed to add attendance");
    }
  };

  const handleEdit = async () => {
    if (!editRecord?.id) return;
    try {
      await updateAttendance(editRecord.id, editRecord);
      toast.success("Attendance updated successfully");
      setEditRecord(null);
    } catch (err) {
      toast.error("Failed to update record");
    }
  };

  const handleDelete = async () => {
    if (!deleteRecordId) return;
    try {
      await deleteAttendanceRecord(deleteRecordId);
      toast.success("Record deleted");
      setDeleteRecordId(null);
    } catch (err) {
      toast.error("Failed to delete record");
    }
  };

  const handleExportXLS = () => {
    const sheet = XLSX.utils.json_to_sheet(filtered);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Attendance");
    const buf = XLSX.write(book, { type: "array", bookType: "xlsx" });
    saveAs(new Blob([buf], { type: "application/octet-stream" }), `attendance_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, "default" | "secondary" | "destructive"> = {
      present: "default",
      absent: "destructive",
      "on-break": "secondary",
    };
    return <Badge variant={map[status] || "default"}>{status}</Badge>;
  };

  // 🔹 Time Picker (simple)
  const handleTimeSelect = (type: "punchIn" | "punchOut") => {
    const time = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    setForm({ ...form, [type]: time });
  };

  return (
    <DashboardLayout title="Attendance Dashboard">
      <Tabs defaultValue="records" className="space-y-4">
        <TabsList>
          <TabsTrigger value="records">Attendance Records</TabsTrigger>
          <TabsTrigger value="manual">Manual Entry</TabsTrigger>
        </TabsList>

        {/* 🔹 Attendance Table */}
        <TabsContent value="records">
          <Card className="p-6">
            <div className="flex justify-between items-center mb-6">
              <div className="flex gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search employee..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 w-64"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="present">Present</SelectItem>
                    <SelectItem value="absent">Absent</SelectItem>
                    <SelectItem value="on-break">On Break</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" onClick={handleExportXLS}>
                <Download className="mr-2 h-4 w-4" /> Export XLS
              </Button>
            </div>

            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Punch In</TableHead>
                    <TableHead>Punch Out</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.name}</TableCell>
                      <TableCell>{r.date}</TableCell>
                      <TableCell>{r.punchIn}</TableCell>
                      <TableCell>{r.punchOut || "—"}</TableCell>
                      <TableCell>{r.location}</TableCell>
                      <TableCell>{getStatusBadge(r.status)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="icon" onClick={() => setEditRecord(r)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteRecordId(r.id!)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* 🔹 Manual Entry */}
        <TabsContent value="manual">
          <Card className="p-6">
            <div className="flex justify-end">
              <Button onClick={() => setAddModalOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Add Manual Attendance
              </Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Modal */}
      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Attendance</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <Label>Employee Name *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />

            <Label>Date *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-start">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(form.date, "PPP")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0">
                <Calendar mode="single" selected={form.date} onSelect={(d) => d && setForm({ ...form, date: d })} />
              </PopoverContent>
            </Popover>

            <Label>Punch In *</Label>
            <Button variant="outline" onClick={() => handleTimeSelect("punchIn")}>
              <Clock className="mr-2 h-4 w-4" /> {form.punchIn || "Select time"}
            </Button>

            <Label>Punch Out</Label>
            <Button variant="outline" onClick={() => handleTimeSelect("punchOut")}>
              <Clock className="mr-2 h-4 w-4" /> {form.punchOut || "Select time"}
            </Button>

            <Label>Work Location *</Label>
            <Select value={form.location} onValueChange={(v) => setForm({ ...form, location: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Select location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="office">Office</SelectItem>
                <SelectItem value="remote">Remote</SelectItem>
                <SelectItem value="client">Client Site</SelectItem>
              </SelectContent>
            </Select>

            <Label>Status *</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="present">Present</SelectItem>
                <SelectItem value="absent">Absent</SelectItem>
                <SelectItem value="on-break">On Break</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddModalOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd}>Save Attendance</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={!!editRecord} onOpenChange={() => setEditRecord(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Attendance</DialogTitle></DialogHeader>
          {editRecord && (
            <div className="grid gap-3 py-2">
              <Label>Name</Label>
              <Input value={editRecord.name} onChange={(e) => setEditRecord({ ...editRecord, name: e.target.value })} />
              <Label>Punch In</Label>
              <Input value={editRecord.punchIn} onChange={(e) => setEditRecord({ ...editRecord, punchIn: e.target.value })} />
              <Label>Punch Out</Label>
              <Input value={editRecord.punchOut} onChange={(e) => setEditRecord({ ...editRecord, punchOut: e.target.value })} />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRecord(null)}>Cancel</Button>
            <Button onClick={handleEdit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteRecordId} onOpenChange={() => setDeleteRecordId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Record</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}