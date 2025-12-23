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

    // BASIC
    name: data.name || data.employeeName || "",
    email: data.email || "",

    // TIMES
    punchInTime: data.punch_in_time || null,
    punchOutTime: data.punch_out_time || null,

    punchInAddress: data.punch_in_address || "",
    punchOutAddress: data.punch_out_address || "",

    // STATUS
    attendanceStatus: data.attendance_status || "present",
    approvalStatus: data.approval_status || "none",

    // RECORD TYPE (attendance vs leave)
    recordType:
      data.record_type ??
      ((data.attendance_status === "leave" ||
        data.attendance_status === "half_day")
        ? "leave"
        : "attendance"),

    // PHASE 3 — LEAVE DATE RANGE (CRITICAL FIX)
    startDate: data.start_date
      ? data.start_date.toDate()
      : data.day_start
      ? data.day_start.toDate()
      : null,

    endDate: data.end_date
      ? data.end_date.toDate()
      : data.day_end
      ? data.day_end.toDate()
      : null,

    // HALF DAY TIME RANGE (string-based)
    halfDayStart: data.half_day_start ?? null,
    halfDayEnd: data.half_day_end ?? null,

    // META
    createdAt: data.created_at || null,
    updatedAt: data.updated_at || null,

    selfieBase64: data.selfie_base64 || null,

    __raw: data,
  };
}
/**
 * Paginated attendance fetch (one-time)
 * 🔧 FIX: order by created_at so leave records are included
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

  let baseQuery;

  if (startDate && endDate) {
    baseQuery = query(
      ref,
      orderBy("created_at", "desc"),
      where("created_at", ">=", toTimestamp(startDate)),
      where("created_at", "<=", toTimestamp(endDate))
    );
  } else {
    baseQuery = query(ref, orderBy("created_at", "desc"));
  }

  const q = cursor
    ? query(baseQuery, startAfter(cursor), fbLimit(pageSize))
    : query(baseQuery, fbLimit(pageSize));

  const snap = await getDocs(q);
  const last = snap.docs[snap.docs.length - 1] || null;

  return {
    data: snap.docs.map(normalizeRecord),
    cursor: last,
  };
}

/**
 * Add Attendance (manual / admin use)
 * ❌ untouched logic
 */
export async function addAttendance(record: any) {
  return await addDoc(collection(db, "attendance"), {
    ...record,
    punch_in_time: toTimestamp(record.punchInTime || record.date),
    punch_out_time: record.punchOutTime
      ? toTimestamp(record.punchOutTime)
      : null,
    created_at: serverTimestamp(),
  });
}

/**
 * Update attendance or leave record
 * ❌ untouched logic
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
 * Optional realtime listener
 * 🔧 FIX: order by created_at so leave records stream correctly
 */
export function listenAttendance(
  cb: (rows: any[]) => void,
  opts: {
    realtime?: boolean;
    startDate?: Date;
    endDate?: Date;
    pageSize?: number;
  } = { realtime: true }
) {
  const { realtime = true, pageSize = 200, startDate, endDate } = opts || {};
  let active = true;

  if (!realtime) {
    (async () => {
      try {
        const res = await fetchAttendancePaged({
          startDate,
          endDate,
          pageSize,
        });
        if (active) cb(res.data);
      } catch (err) {
        console.error("listenAttendance fetch error:", err);
      }
    })();

    return () => {
      active = false;
    };
  }

  let unsub: (() => void) | null = null;

  try {
    const ref = collection(db, "attendance");

    let q;
    if (startDate && endDate) {
      q = query(
        ref,
        orderBy("created_at", "desc"),
        where("created_at", ">=", toTimestamp(startDate)),
        where("created_at", "<=", toTimestamp(endDate)),
        fbLimit(pageSize)
      );
    } else {
      q = query(ref, orderBy("created_at", "desc"), fbLimit(pageSize));
    }

    unsub = onSnapshot(q, (snap) => {
      if (!active) return;
      cb(snap.docs.map(normalizeRecord));
    });
  } catch (err) {
    console.error("listenAttendance realtime error:", err);
  }

  return () => {
    active = false;
    if (typeof unsub === "function") unsub();
  };
}