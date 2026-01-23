import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import { Timestamp } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "@/lib/firebase";
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

import { EditAttendanceModal } from "@/components/AttendanceEditModal.tsx";

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
    setDateRange(prev => {
      // If both dates are set, ensure 'from' is before 'to'
      let from = prev.tempFrom;
      let to = prev.tempTo;
      
      if (from && to && from > to) {
        // Swap dates if they're in the wrong order
        [from, to] = [to, from];
      }
      
      return {
        ...prev,
        from,
        to,
        tempFrom: from, // Update temp values to match
        tempTo: to,     // Update temp values to match
        isOpen: false
      };
    });
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
  const [editAttendance, setEditAttendance] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Manual form
  const [form, setForm] = useState({
    name: "",
    date: new Date(),          // used for present
    fromDate: new Date(),      // used for leave
    toDate: new Date(),        // used for leave
    punchIn: "",
    punchOut: "",
    location: "",
    status: "present",
  });

  // Agents list and selected agent for manual attendance
  const [agents, setAgents] = useState<any[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<any>(null);
  // Fetch agents for admin selection
  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const snap = await getDocs(collection(db, "users"));
        const list = snap.docs.map(d => ({
          id: d.id,
          ...d.data(),
        }));
        setAgents(list);
      } catch (e) {
        console.error("Failed to fetch agents", e);
      }
    };
    fetchAgents();
  }, []);

  // REALTIME ATTENDANCE
  useEffect(() => {
    const unsub = listenAttendance(
      (data) => {
        // normalize incoming records to a consistent shape (camelCase fields)
        const resolveNames = async () => {
          const resolved = await Promise.all(
            data.map(async (d: any) => {
              const userId =
                d.user_id ||
                d.userId ||
                d.__raw?.user_id ||
                d.__raw?.userId ||
                "";

              let name =
                d.name ||
                d.employeeName ||
                d.employee_name ||
                d.userName ||
                d.user_name ||
                "";

              let email = "";

              if (!name && userId) {
                try {
                  const userSnap = await getDoc(doc(db, "users", userId));
                  const userData = userSnap.data();
                  name = userData?.name || "Unknown";
                  email = userData?.email || "";
                } catch {
                  name = "Unknown";
                  email = "";
                }
              }

              const punchIn =
                d.punch_in_time ||
                d.punchInTime ||
                d.punchIn ||
                d.punch_in ||
                null;

              const punchOut =
                d.punch_out_time ||
                d.punchOutTime ||
                d.punchOut ||
                d.punch_out ||
                null;

              // Ensure we have a proper Date object for filtering
              let date = null;

              const startDate =
                d.startDate ||
                d.start_date ||
                d.__raw?.start_date ||
                d.__raw?.day_start ||
                null;

              const endDate =
                d.endDate ||
                d.end_date ||
                d.__raw?.end_date ||
                d.__raw?.day_end ||
                null;

              if (punchIn) {
                date = punchIn.toDate
                  ? punchIn.toDate()
                  : new Date(punchIn);
              } else if (startDate) {
                date = startDate.toDate
                  ? startDate.toDate()
                  : new Date(startDate);
              }

              let status = "present";

              const attendanceStatus =
                d.attendance_status ??
                d.attendanceStatus ??
                d.status ??
                "present";

              const approvalStatus =
                d.approval_status ||
                d.approvalStatus ||
                "none";

              const recordType =
                d.record_type ||
                d.recordType ||
                (attendanceStatus === "leave" || attendanceStatus === "half_day"
                  ? "leave"
                  : "attendance");

              // Approval status logic for visible status
              if (approvalStatus === "pending") {
                status = "pending";
              } else if (approvalStatus === "approved") {
                status = attendanceStatus; // leave / half_day
              } else if (approvalStatus === "rejected") {
                status = "rejected";
              } else {
                status = attendanceStatus || "present";
              }

              return {
                id: d.__raw?.id || d.id || d.docId || "",
                name,
                email,
                punchInTime: punchIn,
                punchOutTime: punchOut,
                date,
                startDate,
                endDate,
                punchInLocation: d.__raw?.punch_in_address || "—",
                punchOutLocation: d.__raw?.punch_out_address || "—",
                status,
                selfie_base64: d.selfie_base64 || d.selfieBase64 || d.selfie || null,
                attendance_status: attendanceStatus,
                approval_status: approvalStatus,
                record_type: recordType,
                recordType,
                hasPendingApproval:
                  approvalStatus === "pending" &&
                  (attendanceStatus === "leave" || attendanceStatus === "half_day"),
                __raw: d,
              };
            })
          );

          setRecords(resolved);
        };

        resolveNames();
      },
      { 
        realtime: true,
        startDate: dateRange.from,
        endDate: dateRange.to
      }
    );

    return () => unsub();
  }, [dateRange.from, dateRange.to]); // Add dateRange dependency

  // Filter logic
  const filtered = records.filter((r) => {
    const matchSearch = r.name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || r.status === statusFilter;
    
    // Date filtering logic
    let matchDate = true;
    if (dateRange.from || dateRange.to) {
      const recordDate = r.date?.toDate ? r.date.toDate() : r.date;
      
      if (dateRange.from && recordDate) {
        const fromDate = new Date(dateRange.from);
        fromDate.setHours(0, 0, 0, 0);
        matchDate = matchDate && recordDate >= fromDate;
      }
      
      if (dateRange.to && recordDate) {
        const toDate = new Date(dateRange.to);
        toDate.setHours(23, 59, 59, 999);
        matchDate = matchDate && recordDate <= toDate;
      }
    }
    
    return matchSearch && matchStatus && matchDate;
  });

  // Pagination
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  // Present-today stats
  const todayPresent = records.filter((r) => {
    const punchIn =
      r.punchInTime?.toDate?.() ||
      (r.punchInTime instanceof Date ? r.punchInTime : null) ||
      (r.date instanceof Date ? r.date : null);

    if (!punchIn) return false;

    const status = r.status?.toString().trim().toLowerCase();

    return isSameDay(punchIn, new Date()) && status === "present";
  }).length;

  // Selfie
  const getSelfie = (r: any) => {
    const b64 = r.selfie_base64 || r.selfieBase64 || r.selfie;
    if (!b64) return null;
    return `data:image/jpeg;base64,${b64}`;
  };

  // Export XLS
const exportXLS = () => {
  if (!filtered.length) {
    toast.error("No records to export");
    return;
  }

  const rows = filtered.map((r) => {
    const date =
      r.date instanceof Date
        ? r.date
        : r.punchInTime?.toDate
        ? r.punchInTime.toDate()
        : null;

    return {
      "Attendance Date": date ? format(date, "yyyy-MM-dd") : "",
      "Sub User Name": r.name || "",
      "Email ID": r.email || "",
      "Punch IN":
        r.punchInTime?.seconds
          ? format(new Date(r.punchInTime.seconds * 1000), "HH:mm")
          : "",
      "Punch Out":
        r.punchOutTime?.seconds
          ? format(new Date(r.punchOutTime.seconds * 1000), "HH:mm")
          : "",
      "Punch IN Location": String(r.punchInLocation || "").slice(0, 200),
      "Punch Out Location": String(r.punchOutLocation || "").slice(0, 200),
      Status: r.status || "present",
    };
  });

  const sheet = XLSX.utils.json_to_sheet(rows);

  // 🎨 Column widths
  sheet["!cols"] = [
    { wch: 14 }, // Date
    { wch: 18 }, // Name
    { wch: 26 }, // Email
    { wch: 10 }, // Punch In
    { wch: 10 }, // Punch Out
    { wch: 30 }, // In Location
    { wch: 30 }, // Out Location
    { wch: 12 }, // Status
  ];

  // 🎨 Header styling
  const range = XLSX.utils.decode_range(sheet["!ref"]!);
  for (let C = range.s.c; C <= range.e.c; ++C) {
    const cell = sheet[XLSX.utils.encode_cell({ r: 0, c: C })];
    if (!cell) continue;

    cell.s = {
      font: { bold: true, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: "1976D2" } }, // Blue header
      alignment: { horizontal: "center" },
    };
  }

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Attendance");

  XLSX.writeFile(
    book,
    `attendance_${format(new Date(), "yyyyMMdd_HHmm")}.xlsx`
  );
};

  // Add manual CRM entry (aligned with Firestore expectations)
  const handleAdd = async () => {
    if (!selectedAgent) {
      toast.error("Please select an agent");
      return;
    }

    if (form.status === "present") {
      if (!form.punchIn || !form.location) {
        toast.error("Punch in time and location are required for present attendance");
        return;
      }
    }

    // In handleAdd, add this validation after the leave validation
    if (form.status === "absent" && !form.date) {
      toast.error("Date is required for absent");
      return;
    }

    if (form.status === "leave") {
      if (!form.fromDate || !form.toDate) {
        toast.error("Leave start and end dates are required");
        return;
      }
    }

    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) {
      toast.error("Not logged in");
      return;
    }

    try {
      // Build proper DateTime objects
      let punchInDateTime: Date | null = null;
      let punchOutDateTime: Date | null = null;

      if (form.status === "present") {
        punchInDateTime = new Date(
          `${format(form.date, "yyyy-MM-dd")} ${form.punchIn}`
        );

        punchOutDateTime = form.punchOut
          ? new Date(`${format(form.date, "yyyy-MM-dd")} ${form.punchOut}`)
          : null;
      }

      // Admin-created leave is auto-approved by design
      await addAttendance({
        userId: selectedAgent.id,
        name: selectedAgent.name || form.name,
        created_by: user.uid,

        punchInTime: punchInDateTime
          ? Timestamp.fromDate(punchInDateTime)
          : null,
        punchOutTime: punchOutDateTime
          ? Timestamp.fromDate(punchOutDateTime)
          : null,

        start_date:
          form.status === "leave"
            ? Timestamp.fromDate(form.fromDate)
            : form.status === "absent"
              ? Timestamp.fromDate(form.date)
              : null,
        end_date:
          form.status === "leave"
            ? Timestamp.fromDate(form.toDate)
            : form.status === "absent"
              ? Timestamp.fromDate(form.date)
              : null,

        punch_in_address:
          form.status === "present" ? form.location : null,

        attendance_status: form.status,

        approval_status:
          form.status === "leave"
            ? "approved"
            : "none",

        record_type: form.status === "leave" ? "leave" : "attendance",
      });

      toast.success("Attendance added");
      setAddModal(false);

      setForm({
        name: "",
        date: new Date(),
        fromDate: new Date(),
        toDate: new Date(),
        punchIn: "",
        punchOut: "",
        location: "",
        status: "present",
      });
      setSelectedAgent(null);
    } catch (e) {
      console.error("Manual attendance add failed:", e);
      toast.error("Failed to add record");
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
                    {/* <SelectItem value="all">All</SelectItem> */}
                    <SelectItem value="present">Present</SelectItem>
                    <SelectItem value="absent">Absent</SelectItem> 
                    <SelectItem value="leave">Leave</SelectItem>
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
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Selfie</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Punch In</TableHead>
                  <TableHead>Punch Out</TableHead>
                  <TableHead>Punch In Location</TableHead>
                  <TableHead>Punch Out Location</TableHead>
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
                        {r.startDate && r.endDate ? (
                          r.startDate.toDate && r.endDate.toDate ? (
                            `${format(r.startDate.toDate(), "PPP")} – ${format(
                              r.endDate.toDate(),
                              "PPP"
                            )}`
                          ) : (
                            `${format(new Date(r.startDate), "PPP")} – ${format(
                              new Date(r.endDate),
                              "PPP"
                            )}`
                          )
                        ) : r.date instanceof Date ? (
                          format(r.date, "PPP")
                        ) : (
                          "—"
                        )}
                      </TableCell>

                      <TableCell>
                        {r.punchInTime?.seconds
                          ? format(new Date(r.punchInTime.seconds * 1000), "p")
                          : r.punchInTime instanceof Date
                            ? format(r.punchInTime, "p")
                            : r.punchIn || "—"}
                      </TableCell>

                      <TableCell>
                        {r.punchOutTime?.seconds
                          ? format(new Date(r.punchOutTime.seconds * 1000), "p")
                          : r.punchOutTime instanceof Date
                            ? format(r.punchOutTime, "p")
                            : r.punchOut || "—"}
                      </TableCell>

                      <TableCell>{r.punchInLocation || "—"}</TableCell>
                      <TableCell>{r.punchOutLocation || "—"}</TableCell>

                      <TableCell>
                        <Badge
                          className={`px-3 py-1 text-xs font-medium rounded-full capitalize
    ${r.status === "present" ? "bg-green-500 text-white" : ""}
    ${r.status === "leave" ? "bg-purple-500 text-white" : ""}
    ${r.status === "half_day" || r.status === "half-day" ? "bg-orange-500 text-white" : ""}
    ${r.status === "pending" ? "bg-blue-500 text-white animate-pulse" : ""}
    ${r.status === "rejected" ? "bg-red-500 text-white" : ""}
  `}
                        >
                          {r.status || "present"}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <div className="flex gap-2">
                          <div className="relative">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setEditAttendance(r)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            {r.hasPendingApproval && (
                              <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteId(r.id || r.__raw?.id || "")}
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
            </div>

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
            <Label>Agent *</Label>
            <Select
              value={selectedAgent?.id || ""}
              onValueChange={(id) => {
                const agent = agents.find(a => a.id === id);
                setSelectedAgent(agent);
                setForm(prev => ({
                  ...prev,
                  name: agent?.name || "",
                }));
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select agent" />
              </SelectTrigger>
              <SelectContent>
                {agents.map(agent => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name} ({agent.email})
                  </SelectItem>
                ))}
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
                <SelectItem value="leave">Leave</SelectItem>
              </SelectContent>
            </Select>

            {(form.status === "present" || form.status === "absent") && (
              <>
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

                {form.status === "present" && (
                  <>
                    <Label>Punch In *</Label>
                    <Input
                      type="time"
                      value={form.punchIn}
                      onChange={(e) =>
                        setForm({ ...form, punchIn: e.target.value })
                      }
                    />

                    <Label>Punch Out</Label>
                    <Input
                      type="time"
                      value={form.punchOut}
                      onChange={(e) =>
                        setForm({ ...form, punchOut: e.target.value })
                      }
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
                  </>
                )}
              </>
            )}

            {form.status === "leave" && (
              <>
                <Label>Leave From *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline">
                      <CalendarIcon className="mr-2" />
                      {format(form.fromDate, "PPP")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent>
                    <Calendar
                      mode="single"
                      selected={form.fromDate}
                      onSelect={(d) =>
                        d && setForm({ ...form, fromDate: d })
                      }
                    />
                  </PopoverContent>
                </Popover>

                <Label>Leave To *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline">
                      <CalendarIcon className="mr-2" />
                      {format(form.toDate, "PPP")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent>
                    <Calendar
                      mode="single"
                      selected={form.toDate}
                      disabled={(date) => date < form.fromDate}
                      onSelect={(d) =>
                        d && setForm({ ...form, toDate: d })
                      }
                    />
                  </PopoverContent>
                </Popover>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      <EditAttendanceModal
        open={!!editAttendance}
        attendance={editAttendance}
        onOpenChange={() => setEditAttendance(null)}
      />

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