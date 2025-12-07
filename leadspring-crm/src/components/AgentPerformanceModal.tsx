// src/components/AgentPerformanceModal.tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { TrendingUp, Users, Target, Clock, CheckCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface AgentMinimal {
  id?: string;
  name?: string;
  assignedLeads?: number;
  closedDeals?: number;
  hotLeads?: number;
  followUpLeads?: number;
  lostLeads?: number;
  inProgressLeads?: number;
  statusBreakdown?: Record<string, number>;
}

interface Lead {
  id: string;
  status?: string;
  createdAt?: any;
  assignedTo?: string;
  updatedAt?: any;
  [k: string]: any;
}

interface Attendance {
  id: string;
  userId?: string;
  date?: any;
  status?: string;
  punchIn?: any;
  punchOut?: any;
}

interface AgentPerformanceModalProps {
  agent: AgentMinimal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const COLORS = ['#2563EB', '#EAB308', '#10B981', '#EF4444', '#8B5CF6'];

export function AgentPerformanceModal({ agent, open, onOpenChange }: AgentPerformanceModalProps) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!agent?.id) {
      setLeads([]);
      setAttendance([]);
      return;
    }

    setLoading(true);

    // Leads assigned to this agent
    const qLeads = query(collection(db, "leads"), where("assignedTo", "==", agent.id), orderBy("createdAt", "desc"));
    const unsubLeads = onSnapshot(qLeads, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Lead[];
      setLeads(docs);
      setLoading(false);
    }, (err) => {
      console.error("AgentPerformanceModal leads snapshot error:", err);
      setLeads([]);
      setLoading(false);
    });

    // Attendance for this agent (this month)
    const qAttendance = query(collection(db, "attendance"), where("userId", "==", agent.id), orderBy("date", "desc"));
    const unsubAttendance = onSnapshot(qAttendance, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Attendance[];
      setAttendance(docs);
    }, (err) => {
      console.error("AgentPerformanceModal attendance snapshot error:", err);
      setAttendance([]);
    });

    return () => {
      try { unsubLeads(); } catch {}
      try { unsubAttendance(); } catch {}
    };
  }, [agent?.id]);

  // Derived metrics
  const assignedLeads = agent?.assignedLeads || 0;
  const closedDeals = agent?.closedDeals || 0;
  const hotLeads = agent?.hotLeads || 0;
  const conversionRate = assignedLeads > 0 ? Math.round((closedDeals / assignedLeads) * 100) : 0;

  // Status breakdown
  const statusData = useMemo(() => {
    if (agent?.statusBreakdown) {
      return Object.entries(agent.statusBreakdown).map(([name, value]) => ({ name, value }));
    }
    return [];
  }, [agent?.statusBreakdown]);

  // Monthly data
  const monthlyData = [
    { month: "Assigned", leads: assignedLeads, converted: closedDeals },
  ];

  // Attendance summary (this month)
  const attendanceSummary = useMemo(() => {
    if (!attendance || attendance.length === 0) return { presentDays: 0, totalDays: 0, avgPunchIn: null, avgHours: null };
    const now = new Date();
    const currentMonth = now.getMonth();
    const monthRecords = attendance.filter(a => {
      const d = a.date && (typeof a.date.toDate === "function" ? a.date.toDate() : (a.date.seconds ? new Date(a.date.seconds * 1000) : new Date(a.date)));
      return d && d.getMonth() === currentMonth && d.getFullYear() === now.getFullYear();
    });

    const presentDays = monthRecords.filter(r => (r.status || "").toLowerCase() === "present").length;
    const totalDays = monthRecords.length;

    // Calculate average punch-in time and hours
    let totalPunchInMinutes = 0;
    let totalHours = 0;
    let punchCount = 0;

    monthRecords.forEach(r => {
      if (r.punchIn && r.punchOut) {
        const inDate = r.punchIn.toDate ? r.punchIn.toDate() : (r.punchIn.seconds ? new Date(r.punchIn.seconds * 1000) : new Date(r.punchIn));
        const outDate = r.punchOut.toDate ? r.punchOut.toDate() : (r.punchOut.seconds ? new Date(r.punchOut.seconds * 1000) : new Date(r.punchOut));
        
        if (inDate && outDate) {
          totalPunchInMinutes += inDate.getHours() * 60 + inDate.getMinutes();
          totalHours += (outDate.getTime() - inDate.getTime()) / (1000 * 60 * 60);
          punchCount++;
        }
      }
    });

    const avgPunchIn = punchCount > 0 
      ? new Date(0, 0, 0, Math.floor(totalPunchInMinutes / punchCount / 60), Math.round((totalPunchInMinutes / punchCount) % 60))
          .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : null;

    const avgHours = punchCount > 0 ? (totalHours / punchCount).toFixed(1) : null;

    return { presentDays, totalDays, avgPunchIn, avgHours };
  }, [attendance]);

  if (!agent) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Performance Overview - {agent.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* KEY METRICS */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row justify-between pb-2">
                <CardTitle className="text-sm">Total Assigned</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{assignedLeads}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row justify-between pb-2">
                <CardTitle className="text-sm">Closed Deals</CardTitle>
                <CheckCircle className="h-4 w-4 text-success" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-success">{closedDeals}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row justify-between pb-2">
                <CardTitle className="text-sm">Conversion Rate</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{conversionRate}%</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row justify-between pb-2">
                <CardTitle className="text-sm">Hot Leads</CardTitle>
                <TrendingUp className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{hotLeads}</div>
              </CardContent>
            </Card>
          </div>

          {/* STATUS BREAKDOWN PIE */}
          <Card>
            <CardHeader>
              <CardTitle>Lead Status Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={100}
                  >
                    {statusData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* PERFORMANCE TREND */}
          <Card>
            <CardHeader>
              <CardTitle>Performance Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="leads" fill="#2563EB" name="Assigned Leads" />
                  <Bar dataKey="converted" fill="#10B981" name="Closed Deals" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* ATTENDANCE SUMMARY */}
          <Card>
            <CardHeader>
              <CardTitle>Attendance Summary (This Month)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <p className="text-sm text-muted-foreground">Days Present</p>
                  <p className="text-2xl font-bold">
                    {attendanceSummary.presentDays} / {attendanceSummary.totalDays || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Avg Punch-in Time</p>
                  <p className="text-2xl font-bold">{attendanceSummary.avgPunchIn || "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Avg Daily Hours</p>
                  <p className="text-2xl font-bold">{attendanceSummary.avgHours || "—"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}