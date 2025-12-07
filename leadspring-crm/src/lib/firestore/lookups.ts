import { db } from "@/lib/firebase";
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot } from "firebase/firestore";

// SOURCES
export const listenSources = (callback: any) => {
  return onSnapshot(collection(db, "lead_sources"), (snap) => {
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(data);
  });
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
  return onSnapshot(collection(db, "lead_purposes"), (snap) => {
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(data);
  });
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