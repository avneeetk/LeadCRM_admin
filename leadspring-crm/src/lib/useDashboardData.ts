// src/lib/useDashboardData.ts
import { useEffect, useMemo, useState } from "react";
import { db, auth } from "@/lib/firebase";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  Timestamp,
  DocumentData,
  getDocs,
  limit
} from "firebase/firestore";

// -----------------------------
// Types
// -----------------------------
type FireTimestamp =
  | Timestamp
  | { seconds: number; nanoseconds: number }
  | string
  | Date
  | null
  | undefined;

interface Lead {
  id: string;
  name?: string;
  phone?: string;
  email?: string;
  status?: string;
  assignedTo?: string;
  createdAt?: FireTimestamp;
  updatedAt?: FireTimestamp;
  [k: string]: any;
}

interface Attendance {
  id: string;
  userId?: string;
  status?: string;
  punch_in_time?: FireTimestamp;
  punch_out_time?: FireTimestamp;
  [k: string]: any;
}

interface User {
  id: string;
  name?: string;
  email?: string;
  role?: string;
}

// -----------------------------
// Timestamp Normalizer
// -----------------------------
function normalizeTimestamp(ts?: FireTimestamp): Date | null {
  if (!ts) return null;

  if (typeof (ts as any)?.toDate === "function") return (ts as any).toDate();
  if (typeof ts === "string") {
    const d = new Date(ts);
    return isNaN(d.getTime()) ? null : d;
  }
  if (ts instanceof Date) return ts;
  if (typeof ts === "object" && "seconds" in (ts as any)) {
    return new Date((ts as any).seconds * 1000);
  }

  return null;
}

// -----------------------------
// Hook
// -----------------------------
export function useDashboardData(timeRangeDays = 0) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const cutoffDate =
    timeRangeDays > 0
      ? new Date(Date.now() - timeRangeDays * 24 * 60 * 60 * 1000)
      : null;

  useEffect(() => {
    if (!auth.currentUser) return; // 👈 prevents permission-denied

    setLoading(true);

    // Leads (one-time fetch to reduce reads)
    getDocs(query(collection(db, "leads"), orderBy("createdAt", "desc"), limit(100)))
      .then((snap) => {
        const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Lead[];

        const filtered = cutoffDate
          ? arr.filter((l) => {
              const created = normalizeTimestamp(l.createdAt);
              return created ? created >= cutoffDate : true;
            })
          : arr;

        setLeads(filtered);
      });

    // Attendance (FIXED: correct field)
    getDocs(query(collection(db, "attendance"), orderBy("punch_in_time", "desc"), limit(200)))
      .then((snap) => {
        const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Attendance[];
        setAttendance(arr);
      });

    // Users
    getDocs(collection(db, "users")).then((snap) => {
      const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as User[];
      setUsers(arr);
      setLoading(false);
    });

    return () => {};
  }, [timeRangeDays]);

  // -----------------------------
  // KPI Data
  // -----------------------------
  const kpiData = useMemo(() => {
    const totalLeads = leads.length;
    const activeLeads = leads.filter((l) =>
      ["new", "contacted", "follow-up", "hot"].includes(
        (l.status || "").toLowerCase()
      )
    ).length;

    const closedDeals = leads.filter(
      (l) => (l.status || "").toLowerCase() === "closed"
    ).length;

    const lostLeads = leads.filter(
      (l) => (l.status || "").toLowerCase() === "lost"
    ).length;

    const employeesPresent = attendance.filter(
      (a) => (a.status || "").toLowerCase() === "present"
    ).length;

    const qualifiedLeads = leads.filter(
      (l) => (l.status || "").toLowerCase() === "hot"
    ).length;

    const conversionRate =
      totalLeads > 0 ? (closedDeals / totalLeads) * 100 : 0;

    const followUpRate =
      totalLeads > 0 ? (activeLeads / totalLeads) * 100 : 0;

    // Avg conversion time
    const closedWithDates = leads.filter(
      (l) =>
        l.createdAt &&
        l.updatedAt &&
        (l.status || "").toLowerCase() === "closed"
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

  // -----------------------------
  // Helper: Get agent name
  // -----------------------------
  const getAgentName = (id?: string) => {
    if (!id) return "Unassigned";
    return users.find((u) => u.id === id)?.name || "Unknown";
  };

  // -----------------------------
  // Leads by status chart
  // -----------------------------
  const leadsByStatus = useMemo(() => {
    const map: Record<string, number> = {};
    leads.forEach((l) => {
      const s = (l.status || "Unknown").toString();
      map[s] = (map[s] || 0) + 1;
    });
    return Object.entries(map).map(([status, count]) => ({ status, count }));
  }, [leads]);

  // -----------------------------
  // Leads by agent chart
  // -----------------------------
  const leadsByAgent = useMemo(() => {
    const map: Record<string, number> = {};

    leads.forEach((l) => {
      const key = l.assignedTo || "Unassigned";
      map[key] = (map[key] || 0) + 1;
    });

    const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

    return Object.keys(map).map((id, idx) => ({
      agent: getAgentName(id === "Unassigned" ? undefined : id),
      leads: map[id],
      fill: colors[idx % colors.length],
    }));
  }, [leads, users]);

  // -----------------------------
  // Recent Leads
  // -----------------------------
  const recentLeads = useMemo(() => {
    return leads
      .map((l) => ({
        ...l,
        assignedToName: getAgentName(l.assignedTo),
        _createdAt: normalizeTimestamp(l.createdAt),
      }))
      .sort((a, b) => {
        const ta = a._createdAt?.getTime() || 0;
        const tb = b._createdAt?.getTime() || 0;
        return tb - ta;
      });
  }, [leads, users]);

  return {
    kpiData,
    leadsByStatus,
    leadsByAgent,
    recentLeads,
    loading,
  };
}