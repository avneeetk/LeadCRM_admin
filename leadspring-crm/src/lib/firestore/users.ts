import { db } from "@/lib/firebase";
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  getDocs,
  query,
  where,
  deleteDoc
} from "firebase/firestore";

const usersRef = collection(db, "users");

export interface Agent {
  id?: string;
  name: string;
  email: string;
  password?: string;
  phone: string;
  role: "admin" | "subuser";
  dateOfBirth?: string;
  gender?: string;
  address?: string;
  created_at?: any;
  updated_at?: any;
  assignedLeads?: number;
  closedDeals?: number;
  punchedIn?: boolean;
}

/**
 * Real-time fetch helper (left untouched)
 */
export function fetchAgents(callback: (agents: Agent[]) => void) {
  return onSnapshot(usersRef, (snapshot) => {
    const agents = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Agent[];
    callback(agents);
  });
}

/**
 * Add agent with duplicate checks (email or phone).
 * Throws an Error with a readable message if a duplicate exists.
 */
export async function addAgent(agentData: {
  name: string;
  email: string;
  password: string;
  phone: string;
  role: "admin" | "subuser";
  dateOfBirth?: string;
  gender?: string;
  address?: string;
}) {
  // Check duplicates by email or phone
  try {
    const qEmail = query(usersRef, where("email", "==", agentData.email));
    const qPhone = query(usersRef, where("phone", "==", agentData.phone));

    const [emailSnap, phoneSnap] = await Promise.all([getDocs(qEmail), getDocs(qPhone)]);

    if (!emailSnap.empty) {
      throw new Error("An agent with this email already exists");
    }
    if (!phoneSnap.empty) {
      throw new Error("An agent with this phone number already exists");
    }

    const agent: Omit<Agent, "id"> = {
      name: agentData.name,
      email: agentData.email,
      password: agentData.password,
      phone: agentData.phone,
      role: agentData.role,
      dateOfBirth: agentData.dateOfBirth,
      gender: agentData.gender,
      address: agentData.address,
      created_at: serverTimestamp(),
      assignedLeads: 0,
      closedDeals: 0,
      punchedIn: false,
    };

    const docRef = await addDoc(usersRef, agent);
    return { id: docRef.id, ...agent };
  } catch (err: any) {
    // Re-throw known errors (duplicate) or wrap others
    throw new Error(err?.message || "Failed to create agent");
  }
}

/**
 * Update agent doc (partial allowed)
 */
export async function updateAgent(agentId: string, agentData: Partial<Agent>) {
  const cleaned: Partial<Agent> = { updated_at: serverTimestamp() };
  if (agentData.name !== undefined) cleaned.name = agentData.name;
  if (agentData.email !== undefined) cleaned.email = agentData.email;
  if (agentData.phone !== undefined) cleaned.phone = agentData.phone;
  if (agentData.role !== undefined) cleaned.role = agentData.role;
  if (agentData.dateOfBirth !== undefined) cleaned.dateOfBirth = agentData.dateOfBirth;
  if (agentData.gender !== undefined) cleaned.gender = agentData.gender;
  if (agentData.address !== undefined) cleaned.address = agentData.address;
  if (agentData.password !== undefined && agentData.password !== "") cleaned.password = agentData.password;

  await updateDoc(doc(db, "users", agentId), cleaned);
}

/**
 * Delete an agent document
 */
export async function deleteAgent(agentId: string) {
  await deleteDoc(doc(db, "users", agentId));
}