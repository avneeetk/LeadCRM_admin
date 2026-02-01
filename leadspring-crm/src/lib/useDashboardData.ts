import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  Timestamp,
} from "firebase/firestore";

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

type FireTs = Timestamp | Date | string | null | undefined;

interface Lead {
  id: string;
  name?: string;
  phone?: string;
  status?: string;
  source?: string;
  assignedTo?: string[]; // IMPORTANT: array
  followUpDate?: string; // yyyy-mm-dd
  createdAt?: FireTs;
}

interface User {
  id: string;
  name?: string;
  role?: string;
}

/* -------------------------------------------------------------------------- */
/*                              TIME NORMALIZER                               */
/* -------------------------------------------------------------------------- */

function toDate(ts?: FireTs): Date | null {
  if (!ts) return null;
  if (ts instanceof Date) return ts;
  if (typeof ts === "string") {
    const d = new Date(ts);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof (ts as any)?.toDate === "function") return (ts as any).toDate();
  if ((ts as any)?.seconds) return new Date((ts as any).seconds * 1000);
  return null;
}

function normalizeStatus(status?: string) {
  return status?.trim().toLowerCase() || "unknown";
}

function formatStatusLabel(status: string) {
  return status
    .split(" ")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/* -------------------------------------------------------------------------- */
/*                                   HOOK                                     */
/* -------------------------------------------------------------------------- */

export function useDashboardData() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const getAgentName = (uid?: string) => {
    if (!uid) return "Unassigned";
    return users.find((u) => u.id === uid)?.name || "Unknown";
  };

  /* ----------------------------- FETCH ONCE ----------------------------- */

  useEffect(() => {
    (async () => {
      setLoading(true);

      const [leadsSnap, usersSnap] = await Promise.all([
        getDocs(collection(db, "leads")),
        getDocs(collection(db, "users")),
      ]);

      setLeads(
        leadsSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Lead[]
      );

      setUsers(
        usersSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as User[]
      );

      setLoading(false);
    })();
  }, []);

  /* -------------------------------------------------------------------------- */
  /*                                    KPI                                     */
  /* -------------------------------------------------------------------------- */

  const kpiData = useMemo(() => {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);

    const totalLeads = leads.length;

    const newLeads7Days = leads.filter((l) => {
      const c = toDate(l.createdAt);
      return c && c >= sevenDaysAgo;
    }).length;

    const followUpsToday = leads.filter(
      (l) =>
        l.followUpDate === todayStr &&
        l.status?.toLowerCase() !== "closed"
    ).length;

    const overdueFollowUps = leads.filter(
      (l) =>
        l.followUpDate &&
        l.followUpDate < todayStr &&
        l.status?.toLowerCase() !== "closed"
    ).length;

    const closedDeals = leads.filter(
      (l) => l.status?.toLowerCase() === "closed"
    ).length;

    const lostLeads = leads.filter(
      (l) => l.status?.toLowerCase() === "lost"
    ).length;

    const activeAgents = users.filter(
      (u) => u.role && (u.role === 'admin' || u.role === 'subuser') && u.active !== false
    ).length;

    const conversionRate =
      totalLeads > 0 ? Math.round((closedDeals / totalLeads) * 100) : 0;

    return {
      totalLeads,
      newLeads7Days,
      followUpsToday,
      overdueFollowUps,
      closedDeals,
      lostLeads,
      activeAgents,
      conversionRate,
    };
  }, [leads]);

  /* -------------------------------------------------------------------------- */
  /*                                CHART DATA                                  */
  /* -------------------------------------------------------------------------- */

  const leadsByStatus = useMemo(() => {
    const map: Record<string, number> = {};

    leads.forEach((l) => {
      const key = normalizeStatus(l.status);
      map[key] = (map[key] || 0) + 1;
    });

    return Object.entries(map).map(([status, count]) => ({
      status: formatStatusLabel(status),
      count,
    }));
  }, [leads]);

  const leadsByAgent = useMemo(() => {
  if (!Array.isArray(leads) || leads.length === 0) return [];

  const map: Record<string, number> = {};

  leads.forEach((l) => {
    let assigned: string[] = [];

    if (Array.isArray(l.assignedTo)) {
      assigned = l.assignedTo;
    } else if (typeof l.assignedTo === "string" && l.assignedTo.trim()) {
      assigned = [l.assignedTo];
    } else {
      assigned = ["Unassigned"];
    }

    assigned.forEach((uid) => {
      const key = uid || "Unassigned";
      map[key] = (map[key] || 0) + 1;
    });
  });

  return Object.entries(map).map(([uid, count]) => ({
    agent: uid === "Unassigned" ? "Unassigned" : getAgentName(uid),
    leads: count,
  }));
}, [leads, users]);

  /* -------------------------------------------------------------------------- */
  /*                               RECENT LEADS                                 */
  /* -------------------------------------------------------------------------- */

  const recentLeads = useMemo(() => {
    return [...leads]
      .sort((a, b) => {
        const ta = toDate(a.createdAt)?.getTime() || 0;
        const tb = toDate(b.createdAt)?.getTime() || 0;
        return tb - ta;
      })
      .slice(0, 20)
      .map((l) => {
        let assignedIds: string[] = [];

        if (Array.isArray(l.assignedTo)) {
          assignedIds = l.assignedTo;
        } else if (typeof l.assignedTo === "string" && l.assignedTo.trim()) {
          assignedIds = [l.assignedTo];
        }

        return {
          ...l,
          assignedToName:
            assignedIds.length > 0
              ? assignedIds
                  .map(
                    (id) => users.find((u) => u.id === id)?.name || "Unknown"
                  )
                  .join(", ")
              : "Unassigned",
          _createdAt: toDate(l.createdAt),
        };
      });
  }, [leads, users]);

  return {
    loading,
    kpiData,
    leadsByStatus,
    leadsByAgent,
    recentLeads,
  };
}