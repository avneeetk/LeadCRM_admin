import { db } from "@/lib/firebase";
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  QuerySnapshot,
  DocumentData,
} from "firebase/firestore";

const usersRef = collection(db, "users");

export function fetchAgents(callback: (agents: any[]) => void) {
  const unsubscribe = onSnapshot(collection(db, "users"), (snapshot: QuerySnapshot<DocumentData>) => {
    const agents = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback(agents);
  });
  return unsubscribe;
}

export async function addAgent(agentData) {
  return await addDoc(usersRef, {
    ...agentData,
    created_at: serverTimestamp(),
    active: true,
    assignedLeads: 0,
    closedDeals: 0,
    punchedIn: false,
  });
}

export async function toggleAgentStatus(agentId, active) {
  const agentRef = doc(db, "users", agentId);
  await updateDoc(agentRef, { active });
}

