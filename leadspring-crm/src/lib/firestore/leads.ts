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
  serverTimestamp,
} from "firebase/firestore";

// 🔹 Fetch all leads (one-time)
export const fetchLeads = async (status?: string) => {
  let q = query(collection(db, "leads"), orderBy("createdAt", "desc"));
  if (status) {
    q = query(collection(db, "leads"), where("status", "==", status), orderBy("createdAt", "desc"));
  }
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

// 🔹 Add a new lead
export const addLead = async (lead: any) => {
  return await addDoc(collection(db, "leads"), {
    ...lead,
    createdAt: serverTimestamp(),
  });
};

// 🔹 Update existing lead
export const updateLead = async (id: string, lead: any) => {
  return await updateDoc(doc(db, "leads", id), {
    ...lead,
    updatedAt: serverTimestamp(),
  });
};

// 🔹 Delete a lead
export const deleteLead = async (id: string) => {
  return await deleteDoc(doc(db, "leads", id));
};

// 🔹 Real-time listener (used by Reports)
export const listenLeads = (setLeads: (data: any[]) => void) => {
  const q = query(collection(db, "leads"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    setLeads(data);
  });
};