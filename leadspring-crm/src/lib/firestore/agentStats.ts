// src/lib/firestore/agentStats.ts
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import type { Agent } from "./users";

/**
 * Tracks full real-time metrics per agent:
 * - assignedLeads
 * - closedDeals
 * - hotLeads
 * - followUpLeads
 * - lostLeads
 * - inProgressLeads
 * - statusBreakdown (object)
 */
export const setupLeadListeners = (agentId: string) => {
  if (!agentId) return () => {};

  try {
    const qAssigned = query(collection(db, "leads"), where("assignedTo", "==", agentId));

    const unsubscribe = onSnapshot(
      qAssigned,
      async (snapshot) => {
        const leads = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];

        // Count calculations
        const assignedLeads = leads.length;
        const closedDeals = leads.filter((l) => l.status?.toLowerCase() === "closed").length;
        const hotLeads = leads.filter((l) => l.status?.toLowerCase() === "hot").length;
        const followUpLeads = leads.filter((l) => l.status?.toLowerCase() === "follow-up").length;
        const lostLeads = leads.filter((l) => l.status?.toLowerCase() === "lost").length;

        const inProgressLeads = leads.filter((l) =>
          ["new", "contacted"].includes(l.status?.toLowerCase())
        ).length;

        // Full status breakdown
        const statusBreakdown: Record<string, number> = {};
        leads.forEach((l) => {
          const s = (l.status || "Unknown").toString();
          statusBreakdown[s] = (statusBreakdown[s] || 0) + 1;
        });

        // Write to Firestore (user doc)
        try {
          await updateDoc(doc(db, "users", agentId), {
            assignedLeads,
            closedDeals,
            hotLeads,
            followUpLeads,
            lostLeads,
            inProgressLeads,
            statusBreakdown,
            updated_at: serverTimestamp(),
          });
        } catch (err) {
          console.debug("Failed to update agent stats:", err);
        }
      },
      (err) => {
        console.error("Lead listener error for agent:", agentId, err);
      }
    );

    return () => {
      try { unsubscribe(); } catch {}
    };
  } catch (err) {
    console.error("setupLeadListeners fatal error:", err);
    return () => {};
  }
};

/**
 * Subscribe to the finalized user stats (Team & Dashboard use this)
 */
export const subscribeToAgentStats = (
  agentId: string,
  cb: (agent: Agent | null) => void
) => {
  if (!agentId) return () => {};

  const ref = doc(db, "users", agentId);

  const unsub = onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) return cb(null);
      cb({ id: snap.id, ...snap.data() } as Agent);
    },
    (err) => {
      console.error("subscribeToAgentStats error:", err);
      cb(null);
    }
  );

  return unsub;
};