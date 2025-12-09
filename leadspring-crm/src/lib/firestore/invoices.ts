import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  orderBy,
  onSnapshot,
  limit as fbLimit,
  startAfter,
  DocumentData,
  QueryDocumentSnapshot,
  serverTimestamp,
} from "firebase/firestore";

const invoicesRef = collection(db, "invoices");

/**
 * Paginated invoices fetch (one-time)
 */
export async function fetchInvoicesPaged({
  pageSize = 100,
  cursor,
}: {
  pageSize?: number;
  cursor?: QueryDocumentSnapshot<DocumentData> | null;
}) {
  let q = query(invoicesRef, orderBy("issuedDate", "desc"), fbLimit(pageSize));
  if (cursor) {
    q = query(invoicesRef, orderBy("issuedDate", "desc"), startAfter(cursor), fbLimit(pageSize));
  }
  const snap = await getDocs(q);
  const last = snap.docs[snap.docs.length - 1] || null;
  return { data: snap.docs.map((d) => ({ id: d.id, ...d.data() })), cursor: last };
}

/**
 * Optional realtime invoice listener (opt-in). Default: do not use realtime on Spark.
 */
export async function listenInvoices(
  cb: (rows: any[]) => void,
  opts?: { realtime?: boolean; pageSize?: number }
) {
  const { realtime = false, pageSize = 100 } = opts || {};
  if (!realtime) {
    const res = await fetchInvoicesPaged({ pageSize });
    cb(res.data);
    return () => {};
  }
  const q = query(invoicesRef, orderBy("issuedDate", "desc"), fbLimit(pageSize));
  const unsub = onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
  return unsub;
}

/**
 * Add invoice
 */
export async function addInvoice(invoice: any) {
  return await addDoc(invoicesRef, {
    ...invoice,
    createdAt: serverTimestamp(),
  });
}

/**
 * Update invoice
 */
export async function updateInvoice(id: string, data: any) {
  return await updateDoc(doc(db, "invoices", id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete invoice
 */
export async function deleteInvoice(id: string) {
  return await deleteDoc(doc(db, "invoices", id));
}