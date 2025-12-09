// src/lib/firestore/notes.ts
import { db, auth } from "@/lib/firebase";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  limit as fbLimit,
} from "firebase/firestore";

const DEFAULT_LIMIT = 100;

/**
 * Subscribe to lead notes
 */
export function listenLeadNotes(
  leadId: string | undefined | null,
  cb: (notes: any[]) => void,
  opts?: { limit?: number }
) {
  if (!leadId) {
    cb([]);
    return () => {};
  }

  const limitTo = Math.min(opts?.limit ?? DEFAULT_LIMIT, 300); // hard cap

  const ref = collection(db, "leads", leadId, "notes");
  const q = query(ref, orderBy("createdAt", "asc"), fbLimit(limitTo));

  const unsub = onSnapshot(
    q,
    (snap) => {
      const notes = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      cb(notes);
    },
    (err) => {
      console.error("listenLeadNotes error:", err);
      cb([]);
    }
  );

  return () => unsub?.();
}

/**
 * Add a note to a lead
 */
export async function addLeadNote(leadId: string, text: string) {
  if (!leadId) throw new Error("leadId required");
  if (!auth.currentUser) throw new Error("Not authenticated");

  const ref = collection(db, "leads", leadId, "notes");

  return addDoc(ref, {
    text,
    by: auth.currentUser.uid,
    createdAt: serverTimestamp(),
  });
}