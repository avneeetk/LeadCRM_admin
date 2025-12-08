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
 * Robust agent stats listener.
 * - computes assignedLeads, closedDeals, hotLeads, followUpLeads, lostLeads, inProgressLeads
 * - computes a statusBreakdown object
 * - writes only these fields to users/{agentId} to minimize permission surface
 * - handles permission errors gracefully (logs & stops spam)
 */

export const setupLeadListeners = (agentId: string) => {
  if (!agentId) return () => {};

  try {
    const qAssigned = query(collection(db, "leads"), where("assignedTo", "==", agentId));

    const unsub = onSnapshot(
      qAssigned,
      async (snapshot) => {
        try {
          const leads = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as any[];

          const assignedLeads = leads.length;
          const closedDeals = leads.filter((l) => (l.status || "").toString().toLowerCase() === "closed").length;
          const hotLeads = leads.filter((l) => (l.status || "").toString().toLowerCase() === "hot").length;
          const followUpLeads = leads.filter((l) => (l.status || "").toString().toLowerCase() === "follow-up" || (l.status || "").toString().toLowerCase() === "followup").length;
          const lostLeads = leads.filter((l) => (l.status || "").toString().toLowerCase() === "lost").length;
          const inProgressLeads = leads.filter((l) => ["new", "contacted", "in-progress", "in progress"].includes((l.status || "").toString().toLowerCase())).length;

          const statusBreakdown: Record<string, number> = {};
          leads.forEach((l) => {
            const s = (l.status || "unknown").toString();
            statusBreakdown[s] = (statusBreakdown[s] || 0) + 1;
          });

          // Prepare payload keeping keys minimal (to match rules)
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

          try {
            await updateDoc(doc(db, "users", agentId), payload);
          } catch (writeErr: any) {
            // Permission denied is expected if rules prevent client writes.
            // Log and stop throwing so UI won't spam console with repeated errors.
            if (writeErr?.code === "permission-denied" || (writeErr?.message || "").toLowerCase().includes("permission")) {
              console.warn(`agentStats: permission denied writing stats for ${agentId}. Ensure rules allow this write or move this logic to a trusted server.`, writeErr.message || writeErr);
              // NOTE: if client is not allowed to write, do not retry here.
              return;
            }
            console.error("agentStats: unexpected write error:", writeErr);
          }
        } catch (err) {
          console.error("agentStats: processing error:", err);
        }
      },
      (err) => {
        console.error("agentStats: lead query error for", agentId, err);
      }
    );

    return () => {
      try { unsub(); } catch {}
    };
  } catch (err) {
    console.error("agentStats: setup error:", err);
    return () => {};
  }
};

/**
 * subscribeToAgentStats: convenience to subscribe to users/{agentId} doc
 */
export const subscribeToAgentStats = (agentId: string, cb: (agent: Agent | null) => void) => {
  if (!agentId) return () => {};
  const ref = doc(db, "users", agentId);
  return onSnapshot(ref, (snap) => {
    if (!snap.exists()) return cb(null);
    cb({ id: snap.id, ...snap.data() } as Agent);
  }, (err) => {
    console.error("subscribeToAgentStats error:", err);
    cb(null);
  });
};