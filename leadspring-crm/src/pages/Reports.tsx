"use client";

import { useEffect, useState, useMemo } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { Download } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { toast } from "sonner";
import { downloadCSV } from "@/lib/csvExport";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";

// 🧠 Utility function for aggregations
const getLeadStats = (leads: any[]) => {
  const total = leads.length;
  const contacted = leads.filter((l) => l.status === "contacted").length;
  const converted = leads.filter((l) => l.status === "closed" || l.status === "converted").length;
  const newLeads = leads.filter((l) => l.status === "new").length;
  const followups = leads.filter((l) => l.status === "follow-up").length;
  const lost = leads.filter((l) => l.status === "lost").length;
  const conversionRate = total ? ((converted / total) * 100).toFixed(1) : "0.0";
  return { total, contacted, converted, newLeads, followups, lost, conversionRate };
};

export default function Reports() {
  const [activeTab, setActiveTab] = useState("overview");
  const [leads, setLeads] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [leadStats, setLeadStats] = useState<any>({});
  const [loading, setLoading] = useState(true);

  // Pagination states
  const [leadPage, setLeadPage] = useState(1);
  const [attendancePage, setAttendancePage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [leadsSnap, attendanceSnap, invoicesSnap] = await Promise.all([
          getDocs(collection(db, "leads")),
          getDocs(collection(db, "attendance")),
          getDocs(collection(db, "invoices")),
        ]);

        const parseTimestamps = (docs: any[]) =>
          docs.map((d) => {
            const data = d.data();
            const parsedData: any = {};
            for (const key in data) {
              const value = data[key];
              if (value && typeof value === "object" && "seconds" in value) {
                parsedData[key] = new Date(value.seconds * 1000);
              } else parsedData[key] = value;
            }
            return { id: d.id, ...parsedData };
          });

        const leadsData = parseTimestamps(leadsSnap.docs);
        const attendanceData = parseTimestamps(attendanceSnap.docs);
        const invoicesData = parseTimestamps(invoicesSnap.docs);

        setLeads(leadsData);
        setAttendance(attendanceData);
        setInvoices(invoicesData);
        setLeadStats(getLeadStats(leadsData));
      } catch (err) {
        console.error(err);
        toast.error("Failed to fetch reports data");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Pagination logic
  const paginatedLeads = useMemo(() => {
    const start = (leadPage - 1) * pageSize;
    return leads.slice(start, start + pageSize);
  }, [leads, leadPage]);

  const paginatedAttendance = useMemo(() => {
    const start = (attendancePage - 1) * pageSize;
    return attendance.slice(start, start + pageSize);
  }, [attendance, attendancePage]);

  // Chart data
  const statusWiseData = [
    { status: "New", count: leadStats.newLeads || 0 },
    { status: "Contacted", count: leadStats.contacted || 0 },
    { status: "Follow-Up", count: leadStats.followups || 0 },
    { status: "Converted", count: leadStats.converted || 0 },
    { status: "Lost", count: leadStats.lost || 0 },
  ];

  const handleExportLeads = () => {
    if (!leads.length) return toast.info("No lead data to export");
    downloadCSV(leads, "lead_report");
    toast.success("Lead report exported successfully");
  };

  const handleExportAttendance = () => {
    if (!attendance.length) return toast.info("No attendance data to export");
    downloadCSV(attendance, "attendance_report");
    toast.success("Attendance report exported successfully");
  };

  const handleExportStatusWise = () => {
    downloadCSV(statusWiseData, "status_wise_report");
    toast.success("Status-wise report exported successfully");
  };

  if (loading)
    return (
      <DashboardLayout title="Reports">
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          Loading reports...
        </div>
      </DashboardLayout>
    );

  return (
    <DashboardLayout title="Reports">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="leads">Leads</TabsTrigger>
          <TabsTrigger value="status">Status-Wise</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <Card><CardHeader><CardTitle>Leads Generated</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">{leadStats.total}</p></CardContent></Card>
            <Card><CardHeader><CardTitle>Leads Contacted</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">{leadStats.contacted}</p></CardContent></Card>
            <Card><CardHeader><CardTitle>Converted</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">{leadStats.converted}</p></CardContent></Card>
            <Card><CardHeader><CardTitle>Conversion Rate</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">{leadStats.conversionRate}%</p></CardContent></Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Status Distribution</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={statusWiseData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="status" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Attendance */}
        <TabsContent value="attendance" className="space-y-6">
          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle>Attendance Report</CardTitle>
              <Button onClick={handleExportAttendance}>
                <Download className="mr-2 h-4 w-4" /> Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agent</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Punch In</TableHead>
                    <TableHead>Punch Out</TableHead>
                    <TableHead>Duration</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedAttendance.map((rec) => (
                    <TableRow key={rec.id}>
                      <TableCell>{rec.name}</TableCell>
                      <TableCell>{rec.date instanceof Date ? rec.date.toLocaleDateString() : rec.date}</TableCell>
                      <TableCell>{rec.punchIn || "-"}</TableCell>
                      <TableCell>{rec.punchOut || "-"}</TableCell>
                      <TableCell>{rec.duration || "In progress"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination Controls */}
              <div className="flex justify-between items-center mt-4">
                <Button
                  variant="outline"
                  disabled={attendancePage === 1}
                  onClick={() => setAttendancePage((p) => p - 1)}
                >
                  Previous
                </Button>
                <span className="text-sm">
                  Page {attendancePage} of {Math.ceil(attendance.length / pageSize)}
                </span>
                <Button
                  variant="outline"
                  disabled={attendancePage >= Math.ceil(attendance.length / pageSize)}
                  onClick={() => setAttendancePage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Leads */}
        <TabsContent value="leads" className="space-y-6">
          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle>Lead Report</CardTitle>
              <Button onClick={handleExportLeads}>
                <Download className="mr-2 h-4 w-4" /> Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lead ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Budget</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedLeads.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell>{lead.id}</TableCell>
                      <TableCell>{lead.name}</TableCell>
                      <TableCell>{lead.phone}</TableCell>
                      <TableCell>{lead.email}</TableCell>
                      <TableCell>{lead.source}</TableCell>
                      <TableCell>{lead.dealPrice || "-"}</TableCell>
                      <TableCell><StatusBadge status={lead.status} /></TableCell>
                      <TableCell>{lead.assignedTo || "-"}</TableCell>
                      <TableCell>
                        {lead.createdAt instanceof Date
                          ? lead.createdAt.toLocaleDateString()
                          : lead.createdAt || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination Controls */}
              <div className="flex justify-between items-center mt-4">
                <Button
                  variant="outline"
                  disabled={leadPage === 1}
                  onClick={() => setLeadPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <span className="text-sm">
                  Page {leadPage} of {Math.ceil(leads.length / pageSize)}
                </span>
                <Button
                  variant="outline"
                  disabled={leadPage >= Math.ceil(leads.length / pageSize)}
                  onClick={() => setLeadPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Status-wise */}
        <TabsContent value="status" className="space-y-6">
          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle>Status-Wise Distribution</CardTitle>
              <Button onClick={handleExportStatusWise}>
                <Download className="mr-2 h-4 w-4" /> Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={statusWiseData}
                    dataKey="count"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ status, count }) => `${status}: ${count}`}
                  >
                    {statusWiseData.map((_, i) => (
                      <Cell key={i} fill={`hsl(${i * 60}, 70%, 50%)`} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}