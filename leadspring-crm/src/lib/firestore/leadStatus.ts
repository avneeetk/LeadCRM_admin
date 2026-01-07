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
  updateDoc,
  doc,
} from "firebase/firestore";

/**
 * 🔒 System-defined status
 * This status is FIXED and should not be deleted or auto-hidden
 */
export const SYSTEM_LEAD_STATUS = "New";

/**
 * 📌 Firestore collection reference
 */
const STATUS_COLLECTION = "lead_statuses";

/**
 * 🔹 Status type
 */
export interface LeadStatus {
  id: string;
  name: string;
  autoHide: boolean;
  autoHideAfterHours?: number;
}

/**
 * 🔹 Listen to Lead Statuses (Realtime)
 */
export function listenLeadStatuses(
  cb: (statuses: LeadStatus[]) => void
) {
  const ref = collection(db, STATUS_COLLECTION);

  return onSnapshot(ref, (snap) => {
    const statuses: LeadStatus[] = snap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          name: data?.name,
          autoHide: data?.autoHide ?? false,
          autoHideAfterHours: data?.autoHideAfterHours ?? 48,
        };
      })
      .filter((s) => s.name);

    cb(statuses);
  });
}

/**
 * 🔹 Get Lead Statuses (One-time fetch)
 */
export async function getLeadStatuses(): Promise<LeadStatus[]> {
  const snap = await getDocs(collection(db, STATUS_COLLECTION));

  return snap.docs
    .map((d) => {
      const data = d.data();
      return {
        id: d.id,
        name: data?.name,
        autoHide: data?.autoHide ?? false,
        autoHideAfterHours: data?.autoHideAfterHours ?? 48,
      };
    })
    .filter((s) => s.name);
}

/**
 * ➕ Add new Lead Status (Admin only)
 */
export async function addLeadStatus(params: {
  name: string;
  autoHide?: boolean;
  autoHideAfterHours?: number;
}) {
  const { name, autoHide = false, autoHideAfterHours = 48 } = params;

  if (!name || !name.trim()) return;

  if (name.trim().toLowerCase() === SYSTEM_LEAD_STATUS.toLowerCase()) {
    throw new Error(`"${SYSTEM_LEAD_STATUS}" is a system status`);
  }

  await addDoc(collection(db, STATUS_COLLECTION), {
    name: name.trim(),
    autoHide,
    autoHideAfterHours: autoHide ? autoHideAfterHours : null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * ✏️ Update Lead Status (Admin only)
 */
export async function updateLeadStatus(
  id: string,
  data: {
    name?: string;
    autoHide?: boolean;
    autoHideAfterHours?: number;
  }
) {
  const ref = doc(db, STATUS_COLLECTION, id);

  await updateDoc(ref, {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

/**
 * ❌ Delete Lead Status (Admin only)
 * Does NOT affect existing leads
 */
export async function deleteLeadStatus(id: string, name: string) {
  if (!id) return;

  if (name.toLowerCase() === SYSTEM_LEAD_STATUS.toLowerCase()) {
    throw new Error(`"${SYSTEM_LEAD_STATUS}" cannot be deleted`);
  }

  await deleteDoc(doc(db, STATUS_COLLECTION, id));
}

/**
 * 🧠 Utility
 * Returns final list of statuses with "New" always on top
 */
export function buildLeadStatusList(customStatuses: string[]) {
  return [SYSTEM_LEAD_STATUS, ...customStatuses];
}