// src/lib/firestore/agentStats.ts
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  setDoc,
  getDoc,
  getDocs,
  serverTimestamp,
  limit as fbLimit,
  QueryDocumentSnapshot,
  DocumentData,
} from "firebase/firestore";
import type { Agent } from "./users";

/**
 * computeAgentStatsOnce(agentId):
 * - One-shot computation of agent stats (recommended on Spark).
 * - Returns the computed payload; attempts to update users/{agentId} with the minimal set.
 */
export async function computeAgentStatsOnce(agentId: string) {
  if (!agentId) return null;

  try {
    const qAssigned = query(collection(db, "leads"), where("assignedTo", "==", agentId), fbLimit(500));
    const snap = await getDocs(qAssigned);
    const leads = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as any[];

    const assignedLeads = leads.length;
    const closedDeals = leads.filter((l) => (l.status || "").toString().toLowerCase() === "closed").length;
    const hotLeads = leads.filter((l) => (l.status || "").toString().toLowerCase() === "hot").length;
    const followUpLeads = leads.filter((l) => {
      const s = (l.status || "").toString().toLowerCase();
      return s === "follow-up" || s === "followup";
    }).length;
    const lostLeads = leads.filter((l) => (l.status || "").toString().toLowerCase() === "lost").length;
    const inProgressLeads = leads.filter((l) => ["new", "contacted", "in-progress", "in progress"].includes((l.status || "").toString().toLowerCase())).length;

    const statusBreakdown: Record<string, number> = {};
    leads.forEach((l) => {
      const s = (l.status || "unknown").toString();
      statusBreakdown[s] = (statusBreakdown[s] || 0) + 1;
    });

    const payload: Partial<Agent> = {
      assignedLeads,
      closedDeals,
      hotLeads,
      followUpLeads,
      lostLeads,
      inProgressLeads,
      statusBreakdown,
      updated_at: serverTimestamp(),
    };

    // ⚠️ Client-side writes disabled for cost control — returning computed stats only
    return payload;
  } catch (err) {
    console.error("agentStats: compute error:", err);
    return null;
  }
}

/**
 * setupLeadListenersRealtime(agentId, opts)
 * - Optional realtime listener that batches updates with a debounce to reduce write frequency.
 * - Use sparingly on Spark (prefer computeAgentStatsOnce).
 * - Returns unsubscribe function for the listener.
 */
export const setupLeadListenersRealtime = (agentId: string, opts?: { debounceMs?: number; pageSize?: number }) => {
  if (!agentId) return () => {};
  const { debounceMs = 1000, pageSize = 200 } = opts || {};

  const qAssigned = query(collection(db, "leads"), where("assignedTo", "==", agentId), fbLimit(pageSize));

  let timeoutHandle: any = null;
  let latestSnapshot: QueryDocumentSnapshot<DocumentData>[] | null = null;

  const sendUpdate = async () => {
    if (!latestSnapshot) return;
    try {
      const leads = latestSnapshot.map((d) => ({ id: d.id, ...(d.data() as any) })) as any[];

      const assignedLeads = leads.length;
      const closedDeals = leads.filter((l) => (l.status || "").toString().toLowerCase() === "closed").length;
      const hotLeads = leads.filter((l) => (l.status || "").toString().toLowerCase() === "hot").length;
      const followUpLeads = leads.filter((l) => {
        const s = (l.status || "").toString().toLowerCase();
        return s === "follow-up" || s === "followup";
      }).length;
      const lostLeads = leads.filter((l) => (l.status || "").toString().toLowerCase() === "lost").length;
      const inProgressLeads = leads.filter((l) => ["new", "contacted", "in-progress", "in progress"].includes((l.status || "").toString().toLowerCase())).length;

      const statusBreakdown: Record<string, number> = {};
      leads.forEach((l) => {
        const s = (l.status || "unknown").toString();
        statusBreakdown[s] = (statusBreakdown[s] || 0) + 1;
      });

      const payload: Partial<Agent> = {
        assignedLeads,
        closedDeals,
        hotLeads,
        followUpLeads,
        lostLeads,
        inProgressLeads,
        statusBreakdown,
        updated_at: serverTimestamp(),
      };

      // ⚠️ Client-side writes disabled — stats computed only for UI, not saved
      return;
    } catch (err) {
      console.error("agentStats: sendUpdate error:", err);
    } finally {
      latestSnapshot = null;
    }
  };

  const unsub = onSnapshot(qAssigned, (snapshot) => {
    latestSnapshot = snapshot.docs;
    if (timeoutHandle) clearTimeout(timeoutHandle);
    timeoutHandle = setTimeout(() => {
      sendUpdate();
      timeoutHandle = null;
    }, debounceMs);
  }, (err) => {
    console.error("agentStats: lead query error:", err);
  });

  return () => {
    try {
      unsub();
    } catch {}
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
      timeoutHandle = null;
    }
  };
};

// ------- Compatibility wrappers (exports used by UI components) -------
export const setupLeadListeners = (agentId: string, opts?: { debounceMs?: number; pageSize?: number }) => {
  return setupLeadListenersRealtime(agentId, opts);
};

export function subscribeToAgentStats(agentId: string, cb: (payload: any | null) => void) {
  if (!agentId) return () => {};
  try {
    const userRef = doc(db, "users", agentId);
    const unsub = onSnapshot(
      userRef,
      (snap) => {
        if (!snap.exists()) {
          cb(null);
          return;
        }
        const data = { id: snap.id, ...snap.data() } as any;
        cb(data);
      },
      (err) => {
        console.error("subscribeToAgentStats - snapshot error:", err);
        cb(null);
      }
    );
    return unsub;
  } catch (err) {
    console.error("subscribeToAgentStats error:", err);
    return () => {};
  }
}