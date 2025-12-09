import { db } from "@/lib/firebase";
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs } from "firebase/firestore";

// SOURCES
export const listenSources = (callback: any) => {
  getDocs(collection(db, "lead_sources"))
    .then((snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      callback(data);
    })
    .catch(() => callback([]));
  return () => {};
};

export const addSource = (name: string) => {
  return addDoc(collection(db, "lead_sources"), { name });
};

export const updateSource = (id: string, name: string) => {
  return updateDoc(doc(db, "lead_sources", id), { name });
};

export const deleteSource = (id: string) => {
  return deleteDoc(doc(db, "lead_sources", id));
};

// PURPOSES
export const listenPurposes = (callback: any) => {
  getDocs(collection(db, "lead_purposes"))
    .then((snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      callback(data);
    })
    .catch(() => callback([]));
  return () => {};
};

export const addPurpose = (name: string) => {
  return addDoc(collection(db, "lead_purposes"), { name });
};

export const updatePurpose = (id: string, name: string) => {
  return updateDoc(doc(db, "lead_purposes", id), { name });
};

export const deletePurpose = (id: string) => {
  return deleteDoc(doc(db, "lead_purposes", id));
};