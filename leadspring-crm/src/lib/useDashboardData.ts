import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  onSnapshot,
  query,
  Timestamp,
} from "firebase/firestore";

// ---------- Types ----------
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
  [key: string]: any;
}

interface Attendance {
  id: string;
  userId?: string;
  name?: string;
  status?: string;
  date?: FireTimestamp;
  [key: string]: any;
}

interface User {
  id: string;
  name?: string;
  email?: string;
  role?: string;
}

// ---------- Helper ----------
function normalizeTimestamp(ts?: FireTimestamp): Date | null {
  if (!ts) return null;
  if ((ts as any)?.toDate && typeof (ts as any).toDate === "function") {
    return (ts as any).toDate();
  }
  if (typeof ts === "object" && "seconds" in (ts as any)) {
    return new Date((ts as any).seconds * 1000);
  }
  if (typeof ts === "string") {
    const d = new Date(ts);
    return isNaN(d.getTime()) ? null : d;
  }
  if (ts instanceof Date) return ts;
  return null;
}

// ---------- Hook ----------
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

    try {
      // 🔹 Leads snapshot
      const unsubLeads = onSnapshot(
        query(collection(db, "leads")),
        (snap) => {
          const data = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Lead[];
          const filtered = cutoffDate
            ? data.filter((l) => {
                const created = normalizeTimestamp(l.createdAt);
                return created ? created >= cutoffDate : true;
              })
            : data;
          filtered.sort((a, b) => {
            const tA = normalizeTimestamp(a.createdAt)?.getTime() || 0;
            const tB = normalizeTimestamp(b.createdAt)?.getTime() || 0;
            return tB - tA;
          });
          setLeads(filtered);
          setLoading(false);
          console.debug("[useDashboardData] leads snapshot", filtered.length);
        },
        (err) => {
          console.error("Leads snapshot error:", err);
          setError("Failed to subscribe to leads");
          setLoading(false);
        }
      );

      // 🔹 Attendance snapshot
      const unsubAttendance = onSnapshot(
        query(collection(db, "attendance")),
        (snap) => {
          const docs = snap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          })) as Attendance[];
          setAttendance(docs);
          console.debug("[useDashboardData] attendance snapshot", docs.length);
        },
        (err) => {
          console.error("Attendance snapshot error:", err);
          setError("Failed to subscribe to attendance");
        }
      );

      // 🔹 Users snapshot
      const unsubUsers = onSnapshot(
        query(collection(db, "users")),
        (snap) => {
          const docs = snap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          })) as User[];
          setUsers(docs);
          console.debug("[useDashboardData] users snapshot", docs.length);
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
    } catch (err: any) {
      console.error("useDashboardData init error:", err);
      setError(err?.message || "Unknown error");
      setLoading(false);
    }
  }, [timeRangeDays]);

  // ---------- Derived KPI metrics ----------
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

  // ---------- Chart + Table data ----------
  const getAgentName = (id?: string) => {
    if (!id) return "Unassigned";
    const user = users.find((u) => u.id === id);
    return user?.name || "Unassigned";
  };

  const leadsByStatus = useMemo(() => {
    const map: Record<string, number> = {};
    leads.forEach((l) => {
      const s = (l.status || "Unknown").toString();
      map[s] = (map[s] || 0) + 1;
    });
    return Object.entries(map).map(([status, count]) => ({ status, count }));
  }, [leads]);

  const leadsByAgent = useMemo(() => {
    const map: Record<string, number> = {};
    leads.forEach((l) => {
      const agentId = l.assignedTo || "Unassigned";
      map[agentId] = (map[agentId] || 0) + 1;
    });

    const colors = [
      "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4",
    ];
    return Object.keys(map).map((id, i) => ({
      agent: getAgentName(id),
      leads: map[id],
      fill: colors[i % colors.length],
    }));
  }, [leads, users]);

  const recentLeads = useMemo(() => {
    return leads
      .map((l) => ({
        ...l,
        assignedToName: getAgentName(l.assignedTo),
        _createdAt: normalizeTimestamp(l.createdAt),
      }))
      .sort(
        (a, b) =>
          (b._createdAt?.getTime() || 0) - (a._createdAt?.getTime() || 0)
      );
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