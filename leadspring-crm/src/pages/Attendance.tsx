// src/pages/Attendance.tsx
import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import {
  Tabs, TabsContent, TabsList, TabsTrigger
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Download, Plus, Search, Edit, Trash2,
  Calendar as CalendarIcon
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";

import { listenAttendance, addAttendance, updateAttendance, deleteAttendanceRecord } from "@/lib/firestore/attendance";

import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, isSameDay } from "date-fns";

import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

// -------------------------------------------------------

export default function Attendance() {
  const [records, setRecords] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Date-range filters
  const [dateRange, setDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
    tempFrom: Date | undefined;
    tempTo: Date | undefined;
    isOpen: boolean;
  }>({
    from: undefined,
    to: undefined,
    tempFrom: undefined,
    tempTo: undefined,
    isOpen: false,
  });

  // Apply date range filter
  const applyDateRange = () => {
    setDateRange(prev => ({
      ...prev,
      from: prev.tempFrom,
      to: prev.tempTo,
      isOpen: false
    }));
  };

  // Reset date range filter
  const resetDateRange = () => {
    setDateRange({
      from: undefined,
      to: undefined,
      tempFrom: undefined,
      tempTo: undefined,
      isOpen: false
    });
  };

  // Pagination
  const pageSize = 10;
  const [page, setPage] = useState(1);

  // Modals
  const [addModal, setAddModal] = useState(false);
  const [editRecord, setEditRecord] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Manual form
  const [form, setForm] = useState({
    name: "",
    date: new Date(),
    punchIn: "",
    punchOut: "",
    location: "",
    status: "present",
  });

  // REALTIME ATTENDANCE
  useEffect(() => {
    const unsub = listenAttendance(
      (data) => {
        setRecords(data);
      },
      dateRange.from,
      dateRange.to
    );

    return () => unsub();
  }, [dateRange.from, dateRange.to]);

  // Filter logic
  const filtered = records.filter((r) => {
    const matchSearch = r.name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // Pagination
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  // Present-today stats
  const todayPresent = records.filter((r) => {
    if (!r.punch_in_time) return false;
    const d = r.punch_in_time.toDate ? r.punch_in_time.toDate() : new Date(r.date);
    return isSameDay(d, new Date());
  }).length;

  // Selfie
  const getSelfie = (r: any) => {
    if (!r.selfie_base64) return null;
    return `data:image/jpeg;base64,${r.selfie_base64}`;
  };

  // Export XLS
  const exportXLS = () => {
    const sheet = XLSX.utils.json_to_sheet(filtered);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Attendance");
    const buf = XLSX.write(book, { type: "array", bookType: "xlsx" });
    saveAs(new Blob([buf], { type: "application/octet-stream" }), "attendance.xlsx");
  };

  // Add manual CRM entry
  const handleAdd = async () => {
    if (!form.name || !form.punchIn || !form.location) {
      toast.error("Please fill required fields");
      return;
    }

    try {
      await addAttendance({
        name: form.name,
        punchInTime: form.date,
        punchOutTime: form.punchOut ? new Date(`${format(form.date, "yyyy-MM-dd")} ${form.punchOut}`) : null,
        location: form.location,
        status: form.status,
      });

      toast.success("Attendance added");
      setAddModal(false);
      setForm({
        name: "",
        date: new Date(),
        punchIn: "",
        punchOut: "",
        location: "",
        status: "present",
      });
    } catch {
      toast.error("Failed to add record");
    }
  };

  // Update attendance
  const handleEdit = async () => {
    if (!editRecord?.id) return;

    try {
      await updateAttendance(editRecord.id, editRecord);
      toast.success("Updated successfully");
      setEditRecord(null);
    } catch {
      toast.error("Failed to update");
    }
  };

  // Delete
  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteAttendanceRecord(deleteId);
      toast.success("Record deleted");
      setDeleteId(null);
    } catch {
      toast.error("Failed to delete");
    }
  };

  return (
    <DashboardLayout title="Attendance Dashboard">
      <Tabs defaultValue="records" className="space-y-4">
        <TabsList>
          <TabsTrigger value="records">Attendance Records</TabsTrigger>
          <TabsTrigger value="manual">Manual Entry</TabsTrigger>
        </TabsList>

        {/* METRIC BOX */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="p-4 text-center">
            <p className="text-sm text-muted-foreground">Present Today</p>
            <p className="text-2xl font-bold">{todayPresent}</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-sm text-muted-foreground">Total Records</p>
            <p className="text-2xl font-bold">{records.length}</p>
          </Card>
        </div>

        {/* RECORDS TABLE */}
        <TabsContent value="records">
          <Card className="p-6 space-y-6">
            <div className="flex justify-between">
              <div className="flex gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 w-64"
                  />
                </div>

                {/* STATUS FILTER */}
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Filter status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="present">Present</SelectItem>
                    <SelectItem value="absent">Absent</SelectItem>
                    <SelectItem value="on-break">On Break</SelectItem>
                  </SelectContent>
                </Select>

                {/* DATE RANGE */}
                <Popover open={dateRange.isOpen} onOpenChange={(open) => 
                  setDateRange(prev => ({
                    ...prev,
                    isOpen: open,
                    tempFrom: open ? prev.from : prev.tempFrom,
                    tempTo: open ? prev.to : prev.tempTo
                  }))
                }>
                  <PopoverTrigger asChild>
                    <Button variant="outline">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRange.from && dateRange.to ? (
                        `${format(dateRange.from, 'MMM d')} - ${format(dateRange.to, 'MMM d, yyyy')}`
                      ) : 'Filter by date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-4" align="end">
                    <div className="flex flex-col space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>From</Label>
                          <Calendar
                            mode="single"
                            selected={dateRange.tempFrom}
                            onSelect={(date) => 
                              setDateRange(prev => ({
                                ...prev,
                                tempFrom: date,
                                // Auto-set end date if it's before the new start date
                                tempTo: date && prev.tempTo && date > prev.tempTo ? date : prev.tempTo
                              }))
                            }
                            className="rounded-md border"
                            initialFocus
                          />
                        </div>
                        <div>
                          <Label>To</Label>
                          <Calendar
                            mode="single"
                            selected={dateRange.tempTo}
                            onSelect={(date) => 
                              setDateRange(prev => ({
                                ...prev,
                                tempTo: date,
                                // Auto-set start date if it's after the new end date
                                tempFrom: date && prev.tempFrom && date < prev.tempFrom ? date : prev.tempFrom
                              }))
                            }
                            disabled={(date) => 
                              dateRange.tempFrom ? date < dateRange.tempFrom! : false
                            }
                            className="rounded-md border"
                          />
                        </div>
                      </div>
                      <div className="flex justify-between pt-2">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={resetDateRange}
                        >
                          Clear
                        </Button>
                        <div className="space-x-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => setDateRange(prev => ({...prev, isOpen: false}))}
                          >
                            Cancel
                          </Button>
                          <Button 
                            size="sm" 
                            onClick={applyDateRange}
                            disabled={!dateRange.tempFrom || !dateRange.tempTo}
                          >
                            Apply
                          </Button>
                        </div>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              <Button variant="outline" onClick={exportXLS}>
                <Download className="mr-2" /> Export XLS
              </Button>
            </div>

            {/* TABLE */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Selfie</TableHead>
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
                {paginated.map((r) => {
                  const selfie = getSelfie(r);

                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        {selfie ? (
                          <img
                            src={selfie}
                            className="h-12 w-12 rounded-md object-cover shadow"
                          />
                        ) : (
                          <div className="h-12 w-12 bg-gray-200 rounded-md flex items-center justify-center text-xs">
                            N/A
                          </div>
                        )}
                      </TableCell>

                      <TableCell>{r.name}</TableCell>

                      <TableCell>
                        {r.punch_in_time?.seconds
                          ? format(new Date(r.punch_in_time.seconds * 1000), "PPP")
                          : r.date}
                      </TableCell>

                      <TableCell>
                        {r.punch_in_time?.seconds
                          ? format(new Date(r.punch_in_time.seconds * 1000), "p")
                          : r.punchIn}
                      </TableCell>

                      <TableCell>
                        {r.punch_out_time?.seconds
                          ? format(new Date(r.punch_out_time.seconds * 1000), "p")
                          : r.punchOut || "—"}
                      </TableCell>

                      <TableCell>{r.location || "—"}</TableCell>

                      <TableCell>
                        <Badge>{r.status || "present"}</Badge>
                      </TableCell>

                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditRecord(r)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteId(r.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {/* Pagination controls */}
            <div className="flex justify-end gap-2 mt-4">
              <Button disabled={page === 1} onClick={() => setPage(page - 1)}>
                Previous
              </Button>
              <Button
                disabled={page * pageSize >= filtered.length}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* MANUAL ENTRY */}
        <TabsContent value="manual">
          <Card className="p-6">
            <Button onClick={() => setAddModal(true)}>
              <Plus className="mr-2" /> Add Manual Attendance
            </Button>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Modal */}
      <Dialog open={addModal} onOpenChange={setAddModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Attendance</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <Label>Employee Name *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />

            <Label>Date *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline">
                  <CalendarIcon className="mr-2" />
                  {format(form.date, "PPP")}
                </Button>
              </PopoverTrigger>
              <PopoverContent>
                <Calendar
                  mode="single"
                  selected={form.date}
                  onSelect={(d) => d && setForm({ ...form, date: d })}
                />
              </PopoverContent>
            </Popover>

            <Label>Punch In *</Label>
            <Input
              value={form.punchIn}
              onChange={(e) => setForm({ ...form, punchIn: e.target.value })}
              placeholder="HH:MM"
            />

            <Label>Punch Out</Label>
            <Input
              value={form.punchOut}
              onChange={(e) => setForm({ ...form, punchOut: e.target.value })}
              placeholder="HH:MM"
            />

            <Label>Location *</Label>
            <Select
              value={form.location}
              onValueChange={(v) => setForm({ ...form, location: v })}
            >
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
            <Select
              value={form.status}
              onValueChange={(v) => setForm({ ...form, status: v })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="present">Present</SelectItem>
                <SelectItem value="absent">Absent</SelectItem>
                <SelectItem value="on-break">On Break</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={!!editRecord} onOpenChange={() => setEditRecord(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Attendance</DialogTitle></DialogHeader>

          {editRecord && (
            <div className="grid gap-3 py-4">
              <Label>Name</Label>
              <Input
                value={editRecord.name}
                onChange={(e) => setEditRecord({ ...editRecord, name: e.target.value })}
              />

              <Label>Punch In</Label>
              <Input
                value={editRecord.punchIn}
                onChange={(e) => setEditRecord({ ...editRecord, punchIn: e.target.value })}
              />

              <Label>Punch Out</Label>
              <Input
                value={editRecord.punchOut}
                onChange={(e) => setEditRecord({ ...editRecord, punchOut: e.target.value })}
              />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRecord(null)}>
              Cancel
            </Button>
            <Button onClick={handleEdit}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Record?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </DashboardLayout>
  );
}