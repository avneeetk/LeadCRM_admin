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
  limit as fbLimit,
  startAfter,
  Timestamp,
  DocumentData,
  QueryDocumentSnapshot,
  serverTimestamp,
} from "firebase/firestore";

/** normalize to Firestore Timestamp or return null */
const toTimestamp = (value: any): Timestamp | null => {
  if (!value) return null;
  if (value instanceof Timestamp) return value;
  if (value instanceof Date) return Timestamp.fromDate(value);
  if (typeof value === "string") return Timestamp.fromDate(new Date(value));
  return null;
};

function normalizeRecord(d) {
  const data = d.data();
  return {
    id: d.id,
    name: data.name || data.employeeName || "",
    punchInTime: data.punch_in_time || data.punchInTime || null,
    punchOutTime: data.punch_out_time || data.punchOutTime || null,
    location: data.location || data.place || "",
    status: data.status || "present",
    selfie_base64: data.selfie_base64 || data.selfieBase64 || data.selfie || null,
    __raw: data
  };
}

/**
 * Paginated attendance fetch (one-time)
 */
export async function fetchAttendancePaged({
  startDate,
  endDate,
  pageSize = 200,
  cursor,
}: {
  startDate?: Date;
  endDate?: Date;
  pageSize?: number;
  cursor?: QueryDocumentSnapshot<DocumentData> | null;
}) {
  const ref = collection(db, "attendance");

  // Build base query without limit
  let baseQuery;
  if (startDate && endDate) {
    baseQuery = query(
      ref,
      orderBy("punch_in_time", "desc"),
      where("punch_in_time", ">=", toTimestamp(startDate)),
      where("punch_in_time", "<=", toTimestamp(endDate))
    );
  } else {
    baseQuery = query(ref, orderBy("punch_in_time", "desc"));
  }

  // Apply pagination correctly
  const q = cursor
    ? query(baseQuery, startAfter(cursor), fbLimit(pageSize))
    : query(baseQuery, fbLimit(pageSize));

  const snap = await getDocs(q);
  const last = snap.docs[snap.docs.length - 1] || null;
  return { data: snap.docs.map(normalizeRecord), cursor: last };
}

/**
 * Add Attendance
 */
export async function addAttendance(record: any) {
  return await addDoc(collection(db, "attendance"), {
    ...record,
    punch_in_time: toTimestamp(record.punchInTime || record.date),
    punch_out_time: record.punchOutTime ? toTimestamp(record.punchOutTime) : null,
    created_at: serverTimestamp(),
  });
}

/**
 * Update attendance
 */
export async function updateAttendance(id: string, record: any) {
  return await updateDoc(doc(db, "attendance", id), {
    ...record,
    updated_at: serverTimestamp(),
  });
}

/**
 * Delete attendance
 */
export async function deleteAttendanceRecord(id: string) {
  return await deleteDoc(doc(db, "attendance", id));
}

/**
 * Optional realtime listener (opt-in). Default non-realtime (one-time fetch).
 */
export function listenAttendance(
  cb: (rows: any[]) => void,
  opts?: { realtime?: boolean; startDate?: Date; endDate?: Date; pageSize?: number }
) {
  const { realtime = false, pageSize = 200, startDate, endDate } = opts || {};

  // Always return an unsubscribe function immediately
  let active = true;

  // Non-realtime mode -> Fetch once and stop
  if (!realtime) {
    (async () => {
      try {
        const res = await fetchAttendancePaged({ startDate, endDate, pageSize });
        // fetchAttendancePaged already returns normalized records, do not re-run normalizeRecord
        if (active) cb(res.data);
      } catch (err) {
        console.error("listenAttendance (fetch once) error:", err);
      }
    })();

    return () => {
      active = false;
    };
  }

  // Realtime mode
  let unsub: (() => void) | null = null;

  try {
    const ref = collection(db, "attendance");

    let q;
    if (startDate && endDate) {
      q = query(
        ref,
        orderBy("punch_in_time", "desc"),
        where("punch_in_time", ">=", toTimestamp(startDate)),
        where("punch_in_time", "<=", toTimestamp(endDate)),
        fbLimit(pageSize)
      );
    } else {
      q = query(ref, orderBy("punch_in_time", "desc"), fbLimit(pageSize));
    }

    unsub = onSnapshot(q, (snap) => {
      if (!active) return;
      cb(snap.docs.map(normalizeRecord));
    });

  } catch (err) {
    console.error("listenAttendance (realtime) error:", err);
  }

  return () => {
    active = false;
    if (typeof unsub === "function") unsub();
  };
}