import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  where,
  onSnapshot,
  limit as fbLimit,
  startAfter,
  serverTimestamp,
  DocumentData,
  QueryDocumentSnapshot
} from "firebase/firestore";

/**
 * Fetch leads (paginated). Returns { data, cursor } where cursor is the last doc snapshot (pass back to fetch next page).
 * - status optional filter (exact match)
 * - since we want Spark-friendly usage, default pageSize = 100
 */
export async function fetchLeadsPaged({
  status,
  pageSize = 100,
  cursor,
}: {
  status?: string;
  pageSize?: number;
  cursor?: QueryDocumentSnapshot<DocumentData> | null;
}) {
  const ref = collection(db, "leads");

  // Build base query
  let baseQuery = status
    ? query(ref, where("status", "==", status), orderBy("createdAt", "desc"))
    : query(ref, orderBy("createdAt", "desc"));

  // Apply pagination
  let q = cursor
    ? query(baseQuery, startAfter(cursor), fbLimit(pageSize))
    : query(baseQuery, fbLimit(pageSize));

  const snap = await getDocs(q);
  const last = snap.docs[snap.docs.length - 1] || null;
  return {
    data: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
    cursor: last,
  };
}

/**
 * Add a lead (serverTimestamp for createdAt)
 */
export async function addLead(lead: any) {
  return await addDoc(collection(db, "leads"), {
    ...lead,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Update existing lead (serverTimestamp for updatedAt)
 * Note: pass only fields you intend to update; security rules restrict which fields agents can update.
 */
export async function updateLead(id: string, lead: Partial<any>) {
  return await updateDoc(doc(db, "leads", id), {
    ...lead,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Update lead STATUS with history (ADMIN ONLY)
 * This ensures status changes always appear in lead history.
 */
export async function updateLeadStatusWithHistory({
  leadId,
  oldStatus,
  newStatus,
  adminUid,
  adminName,
}: {
  leadId: string;
  oldStatus: string;
  newStatus: string;
  adminUid: string;
  adminName: string;
}) {
  const leadRef = doc(db, "leads", leadId);

  // 1. Update lead status
  await updateDoc(leadRef, {
    status: newStatus,
    statusChangedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // 2. Write history entry
  await addDoc(collection(leadRef, "history"), {
    type: "STATUS_CHANGE",
    oldValue: oldStatus,
    newValue: newStatus,
    byUid: adminUid,
    byName: adminName,
    createdAt: serverTimestamp(),
  });
}

/**
 * Delete a lead
 */
export async function deleteLead(id: string) {
  return await deleteDoc(doc(db, "leads", id));
}

/**
 * Optional realtime listener (opt-in). By default realtime = false (one-time fetch).
 * If realtime === true, it returns the unsubscribe function from onSnapshot.
 * If realtime === false, it performs a one-time getDocs and returns a no-op unsubscribe.
 *
 * WARNING: Use realtime sparingly on Spark. Keep pageSize small.
 */
export async function listenLeads(
  cb: (rows: any[]) => void,
  opts?: { realtime?: boolean; pageSize?: number }
) {
  const { realtime = false, pageSize = 100 } = opts || {};

  if (!realtime) {
    const res = await fetchLeadsPaged({ pageSize });
    cb(res.data);
    return () => {};
  }

  const q = query(collection(db, "leads"), orderBy("createdAt", "desc"), fbLimit(pageSize));
  const unsub = onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
  return unsub;
}