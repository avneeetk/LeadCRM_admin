import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  onSnapshot,
} from "firebase/firestore";

// 🔹 Fetch attendance (one-time)
export const fetchAttendance = async (startDate?: string, endDate?: string, status?: string) => {
  let q = query(collection(db, "attendance"), orderBy("date", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
};

// 🔹 Add attendance
export const addAttendance = async (record: any) => {
  return await addDoc(collection(db, "attendance"), {
    ...record,
    createdAt: new Date().toISOString(),
  });
};

// 🔹 Update attendance
export const updateAttendance = async (id: string, record: any) => {
  return await updateDoc(doc(db, "attendance", id), record);
};

// 🔹 Delete attendance
export const deleteAttendanceRecord = async (id: string) => {
  return await deleteDoc(doc(db, "attendance", id));
};

// 🔹 Real-time listener (used by Reports page)
export const listenAttendance = (setData: (data: any[]) => void) => {
  const q = query(collection(db, "attendance"), orderBy("date", "desc"));
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    setData(data);
  });
};