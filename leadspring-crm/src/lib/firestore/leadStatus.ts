// src/lib/firestore/leadStatus.ts

import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";

/**
 * 🔒 System-defined status
 * This status is FIXED and should not be deleted
 */
export const SYSTEM_LEAD_STATUS = "New";

/**
 * 📌 Firestore collection reference
 */
const STATUS_COLLECTION = "lead_statuses";

/**
 * 🔹 Listen to Lead Statuses (Realtime)
 * Returns ONLY admin-defined statuses (excludes "New")
 */
export function listenLeadStatuses(
  cb: (statuses: { id: string; name: string }[]) => void
) {
  const ref = collection(db, STATUS_COLLECTION);

  return onSnapshot(ref, (snap) => {
    const statuses = snap.docs
      .map((d) => ({
        id: d.id,
        name: d.data()?.name,
      }))
      .filter((s) => s.name);

    cb(statuses);
  });
}

/**
 * 🔹 Get Lead Statuses (One-time fetch)
 */
export async function getLeadStatuses() {
  const snap = await getDocs(collection(db, STATUS_COLLECTION));

  return snap.docs
    .map((d) => ({
      id: d.id,
      name: d.data()?.name,
    }))
    .filter((s) => s.name);
}

/**
 * ➕ Add new Lead Status (Admin only)
 */
export async function addLeadStatus(name: string) {
  if (!name || !name.trim()) return;

  if (name.trim().toLowerCase() === SYSTEM_LEAD_STATUS.toLowerCase()) {
    throw new Error(`"${SYSTEM_LEAD_STATUS}" is a system status`);
  }

  await addDoc(collection(db, STATUS_COLLECTION), {
    name: name.trim(),
    createdAt: serverTimestamp(),
  });
}

/**
 * ❌ Delete Lead Status (Admin only)
 * Does NOT affect existing leads
 */
export async function deleteLeadStatus(name: string) {
  if (!name) return;

  const q = query(
    collection(db, STATUS_COLLECTION),
    where("name", "==", name)
  );

  const snap = await getDocs(q);

  snap.forEach((doc) => {
    deleteDoc(doc.ref);
  });
}

/**
 * 🧠 Utility
 * Returns final list of statuses with "New" always on top
 */
export function buildLeadStatusList(customStatuses: string[]) {
  return [SYSTEM_LEAD_STATUS, ...customStatuses];
}