// src/lib/firestore/attendance.ts
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
  Timestamp,
} from "firebase/firestore";

// 🔹 Normalize date inputs
const toTimestamp = (value: any) => {
  if (!value) return null;
  if (value instanceof Date) return Timestamp.fromDate(value);
  if (typeof value === "string") return Timestamp.fromDate(new Date(value));
  return value;
};

// 🔹 Fetch Attendance with optional date range
export const fetchAttendance = async (
  startDate?: Date,
  endDate?: Date
) => {
  let q: any = query(
    collection(db, "attendance"),
    orderBy("punch_in_time", "desc")
  );

  if (startDate && endDate) {
    q = query(
      collection(db, "attendance"),
      where("punch_in_time", ">=", toTimestamp(startDate)),
      where("punch_in_time", "<=", toTimestamp(endDate)),
      orderBy("punch_in_time", "desc")
    );
  }

  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
};

// 🔹 Add Attendance (for CRM manual entry)
export const addAttendance = async (record: any) => {
  return await addDoc(collection(db, "attendance"), {
    ...record,
    punch_in_time: toTimestamp(record.punchInTime || record.date),
    punch_out_time: record.punchOutTime
      ? toTimestamp(record.punchOutTime)
      : null,
    created_at: Timestamp.now(),
  });
};

// 🔹 Update attendance
export const updateAttendance = async (id: string, record: any) => {
  return await updateDoc(doc(db, "attendance", id), {
    ...record,
    updated_at: Timestamp.now(),
  });
};

// 🔹 Delete attendance
export const deleteAttendanceRecord = async (id: string) => {
  return await deleteDoc(doc(db, "attendance", id));
};

// 🔹 Real-time listener (used by CRM)
export const listenAttendance = (
  callback: (records: any[]) => void,
  startDate?: Date,
  endDate?: Date
) => {
  let q: any = query(
    collection(db, "attendance"),
    orderBy("punch_in_time", "desc")
  );

  if (startDate && endDate) {
    q = query(
      collection(db, "attendance"),
      where("punch_in_time", ">=", toTimestamp(startDate)),
      where("punch_in_time", "<=", toTimestamp(endDate)),
      orderBy("punch_in_time", "desc")
    );
  }

  return onSnapshot(q, (snapshot) => {
    const records = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));
    callback(records);
  });
};