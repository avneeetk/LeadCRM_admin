import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

/**
 * Generic paginated fetch
 */
async function paginatedFetch(ref: any, cursor: any = null, pageSize = 200) {
  let q = query(ref, orderBy("createdAt", "desc"), limit(pageSize));

  if (cursor) {
    q = query(ref, orderBy("createdAt", "desc"), startAfter(cursor), limit(pageSize));
  }

  const snap = await getDocs(q);
  const last = snap.docs[snap.docs.length - 1];

  return {
    data: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
    cursor: last,
  };
}

/**
 * Leads Report (safe for Spark)
 */
export const fetchLeadsReport = async (cursor?: any) => {
  return paginatedFetch(collection(db, "leads"), cursor, 200);
};

/**
 * Attendance Report
 */
export const fetchAttendanceReport = async (cursor?: any) => {
  const ref = collection(db, "attendance");
  let q = query(ref, orderBy("punch_in_time", "desc"), limit(200));

  if (cursor) {
    q = query(
      ref,
      orderBy("punch_in_time", "desc"),
      startAfter(cursor),
      limit(200)
    );
  }

  const snap = await getDocs(q);
  const last = snap.docs[snap.docs.length - 1];

  return {
    data: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
    cursor: last,
  };
};

/**
 * Invoices Report
 */
export const fetchInvoicesReport = async (cursor?: any) => {
  return paginatedFetch(collection(db, "invoices"), cursor, 200);
};

/**
 * Lead Stats Aggregator (local only, no Firestore cost)
 */
export const getLeadStats = (leads: any[]) => {
  const total = leads.length;

  const stats = {
    total,
    contacted: 0,
    converted: 0,
    newLeads: 0,
    followups: 0,
    lost: 0,
    conversionRate: "0",
  };

  leads.forEach((l) => {
    const s = l.status?.toLowerCase();
    if (s === "contacted") stats.contacted++;
    else if (s === "converted" || s === "closed") stats.converted++;
    else if (s === "new") stats.newLeads++;
    else if (s === "follow-up") stats.followups++;
    else if (s === "lost") stats.lost++;
  });

  stats.conversionRate = total
    ? ((stats.converted / total) * 100).toFixed(1)
    : "0";

  return stats;
};