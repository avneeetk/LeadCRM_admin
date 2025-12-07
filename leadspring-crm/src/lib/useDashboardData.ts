// src/lib/useDashboardData.ts
import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  Timestamp,
  DocumentData,
} from "firebase/firestore";

type FireTimestamp =
  | Timestamp
  | { seconds: number; nanoseconds: number }
  | string
  | Date
  | undefined;

interface Lead {
  id: string;
  name?: string;
  phone?: string;
  email?: string;
  source?: string;
  status?: string;
  assignedTo?: string; // userId reference
  createdAt?: FireTimestamp;
  updatedAt?: FireTimestamp;
  [k: string]: any;
}

interface Attendance {
  id: string;
  userId?: string;
  name?: string;
  status?: string;
  date?: FireTimestamp;
  [k: string]: any;
}

interface User {
  id: string;
  name?: string;
  email?: string;
  role?: string;
  [k: string]: any;
}

/** Normalize Firestore timestamp-ish values to JS Date or null */
function normalizeTimestamp(ts?: FireTimestamp): Date | null {
  if (!ts) return null;
  // Firestore Timestamp
  if ((ts as any)?.toDate && typeof (ts as any).toDate === "function") {
    try {
      return (ts as any).toDate();
    } catch {
      return null;
    }
  }
  // Plain object with seconds/nanoseconds
  if (typeof ts === "object" && "seconds" in (ts as any)) {
    const s = (ts as any).seconds;
    if (typeof s === "number") return new Date(s * 1000);
  }
  // ISO string
  if (typeof ts === "string") {
    const d = new Date(ts);
    if (!isNaN(d.getTime())) return d;
    return null;
  }
  // Date instance
  if (ts instanceof Date) return ts;
  return null;
}

export function useDashboardData(timeRangeDays = 0) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cutoffDate =
    timeRangeDays > 0
      ? new Date(Date.now() - timeRangeDays * 24 * 60 * 60 * 1000)
      : null;

  useEffect(() => {
    setLoading(true);
    setError(null);

    // queries
    const leadsQ = query(collection(db, "leads"), orderBy("createdAt", "desc"));
    const attendanceQ = query(collection(db, "attendance"), orderBy("date", "desc"));
    const usersQ = query(collection(db, "users"));

    const unsubLeads = onSnapshot(
      leadsQ,
      (snap) => {
        try {
          const data = snap.docs.map((d) => ({ id: d.id, ...(d.data() as DocumentData) })) as Lead[];
          // filter by cutoff if requested
          const filtered = cutoffDate
            ? data.filter((l) => {
                const created = normalizeTimestamp(l.createdAt);
                return created ? created >= cutoffDate : true;
              })
            : data;

          // sort latest first (defensive)
          filtered.sort((a, b) => {
            const ta = normalizeTimestamp(a.createdAt)?.getTime() || 0;
            const tb = normalizeTimestamp(b.createdAt)?.getTime() || 0;
            return tb - ta;
          });

          setLeads(filtered);
          setLoading(false);
          // debug
          // console.debug("[useDashboardData] leads snapshot:", filtered.length);
        } catch (e: any) {
          console.error("Error parsing leads snapshot:", e);
          setError("Failed to parse leads");
          setLoading(false);
        }
      },
      (err) => {
        console.error("Leads snapshot error:", err);
        setError("Failed to subscribe to leads");
        setLoading(false);
      }
    );

    const unsubAttendance = onSnapshot(
      attendanceQ,
      (snap) => {
        try {
          const data = snap.docs.map((d) => ({ id: d.id, ...(d.data() as DocumentData) })) as Attendance[];
          setAttendance(data);
          // console.debug("[useDashboardData] attendance snapshot:", data.length);
        } catch (e) {
          console.error("Error parsing attendance snapshot:", e);
          setError("Failed to parse attendance");
        }
      },
      (err) => {
        console.error("Attendance snapshot error:", err);
        setError("Failed to subscribe to attendance");
      }
    );

    const unsubUsers = onSnapshot(
      usersQ,
      (snap) => {
        try {
          const data = snap.docs.map((d) => ({ id: d.id, ...(d.data() as DocumentData) })) as User[];
          setUsers(data);
          // console.debug("[useDashboardData] users snapshot:", data.length);
        } catch (e) {
          console.error("Error parsing users snapshot:", e);
          setError("Failed to parse users");
        }
      },
      (err) => {
        console.error("Users snapshot error:", err);
        setError("Failed to subscribe to users");
      }
    );

    return () => {
      unsubLeads();
      unsubAttendance();
      unsubUsers();
    };
  }, [timeRangeDays]);

  // Derived KPIs
  const kpiData = useMemo(() => {
    const totalLeads = leads.length;
    const activeLeads = leads.filter((l) =>
      ["new", "contacted", "follow-up", "hot"].includes((l.status || "").toString().toLowerCase())
    ).length;
    const closedDeals = leads.filter((l) => (l.status || "").toString().toLowerCase() === "closed").length;
    const lostLeads = leads.filter((l) => (l.status || "").toString().toLowerCase() === "lost").length;
    const employeesPresent = attendance.filter((a) => (a.status || "").toString().toLowerCase() === "present").length;
    const qualifiedLeads = leads.filter((l) => (l.status || "").toString().toLowerCase() === "hot").length;

    const conversionRate = totalLeads > 0 ? (closedDeals / totalLeads) * 100 : 0;
    const followUpRate = totalLeads > 0 ? (activeLeads / totalLeads) * 100 : 0;

    // avg time to conversion (days) for leads that have both createdAt and updatedAt and are closed
    const closedWithDates = leads.filter(
      (l) =>
        l.createdAt &&
        l.updatedAt &&
        (l.status || "").toString().toLowerCase() === "closed"
    );
    const avgTimeToConversion =
      closedWithDates.length > 0
        ? Math.round(
            closedWithDates.reduce((acc, l) => {
              const created = normalizeTimestamp(l.createdAt)?.getTime() || 0;
              const updated = normalizeTimestamp(l.updatedAt)?.getTime() || 0;
              return acc + (updated - created) / (1000 * 60 * 60 * 24);
            }, 0) / closedWithDates.length
          )
        : 0;

    return {
      totalLeads,
      activeLeads,
      closedDeals,
      lostLeads,
      employeesPresent,
      conversionRate: Math.round(conversionRate * 10) / 10,
      qualifiedLeads,
      followUpRate: Math.round(followUpRate * 10) / 10,
      avgTimeToConversion,
    };
  }, [leads, attendance]);

  // helper to map agent id => name
  const getAgentName = (id?: string) => {
    if (!id) return "Unassigned";
    const u = users.find((x) => x.id === id);
    return u?.name || id;
  };

  // leads by status for chart
  const leadsByStatus = useMemo(() => {
    const map: Record<string, number> = {};
    leads.forEach((l) => {
      const s = (l.status || "Unknown").toString();
      map[s] = (map[s] || 0) + 1;
    });
    return Object.entries(map).map(([status, count]) => ({ status, count }));
  }, [leads]);

  // leads by agent (shows agent name)
  const leadsByAgent = useMemo(() => {
    const map: Record<string, number> = {};
    leads.forEach((l) => {
      const agentId = l.assignedTo || "Unassigned";
      map[agentId] = (map[agentId] || 0) + 1;
    });
    const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];
    return Object.keys(map).map((id, idx) => ({
      agent: getAgentName(id === "Unassigned" ? undefined : id),
      leads: map[id],
      fill: colors[idx % colors.length],
      id,
    }));
  }, [leads, users]);

  // recent leads (sorted)
  const recentLeads = useMemo(() => {
    return leads
      .map((l) => ({
        ...l,
        assignedToName: getAgentName(l.assignedTo),
        _createdAt: normalizeTimestamp(l.createdAt),
      }))
      .sort((a, b) => (b._createdAt?.getTime() || 0) - (a._createdAt?.getTime() || 0));
  }, [leads, users]);

  return {
    kpiData,
    leadsByStatus,
    leadsByAgent,
    recentLeads,
    loading,
    error,
  } as const;
}