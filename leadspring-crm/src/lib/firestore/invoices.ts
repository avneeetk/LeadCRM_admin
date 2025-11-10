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
  serverTimestamp,
} from "firebase/firestore";

const invoicesRef = collection(db, "invoices");

export const listenInvoices = (callback: (data: any[]) => void) => {
  const q = query(invoicesRef, orderBy("issuedDate", "desc"));
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback(data);
  });
};

export const fetchInvoices = async () => {
  const q = query(invoicesRef, orderBy("issuedDate", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const addInvoice = async (invoice: any) => {
  return await addDoc(invoicesRef, {
    ...invoice,
    createdAt: serverTimestamp(),
  });
};

export const updateInvoice = async (id: string, data: any) => {
  const docRef = doc(db, "invoices", id);
  return await updateDoc(docRef, data);
};

export const deleteInvoice = async (id: string) => {
  const docRef = doc(db, "invoices", id);
  return await deleteDoc(docRef);
};