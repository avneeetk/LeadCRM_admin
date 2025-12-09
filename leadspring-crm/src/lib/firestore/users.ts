import { db, auth } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  serverTimestamp,
  deleteDoc,
  setDoc,
  getDoc,
} from "firebase/firestore";

import { getFunctions, httpsCallable } from "firebase/functions";
const functions = getFunctions();

const usersRef = collection(db, "users");

const createUserFn = httpsCallable(functions, "adminCreateUser");
const deleteUserFn = httpsCallable(functions, "adminDeleteUser");
const setPasswordFn = httpsCallable(functions, "adminSetUserPassword");

export interface Agent {
  id?: string;
  name: string;
  email: string;
  phone: string;
  role: "admin" | "subuser";
  dateOfBirth?: string;
  gender?: string;
  address?: string;
  created_at?: any;
  updated_at?: any;
  assignedLeads?: number;
  closedDeals?: number;
  active?: boolean;
}

/**
 * Fetch all agents (NO real-time — Spark safe)
 */
export async function fetchAgentsOnce(): Promise<Agent[]> {
  const snap = await getDocs(usersRef);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Agent[];
}

/**
 * Small helper: wait for Firestore doc created by Cloud Function to appear.
 * Polls until timeout and returns snapshot data or null.
 */
async function waitForUserDoc(uid: string, timeoutMs = 8000, intervalMs = 300) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const userSnap = await getDoc(doc(db, "users", uid));
      if (userSnap.exists()) return userSnap.data();
    } catch (err) {
      // ignore transient read errors and retry
      console.warn("waitForUserDoc - read attempt failed, retrying", err);
    }
    await new Promise((res) => setTimeout(res, intervalMs));
  }
  return null;
}

/**
 * Add an agent with Firestore + Auth sync (via Cloud Function)
 *
 * IMPORTANT: Cloud Function (adminCreateUser) is responsible for creating the Auth user
 * and writing the canonical users/{uid} document. The client will poll briefly for the
 * Firestore doc to appear and will not overwrite the doc itself — this avoids races and
 * rules/permission problems.
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
  // Duplicate checks
  const emailQ = query(usersRef, where("email", "==", agentData.email));
  const phoneQ = query(usersRef, where("phone", "==", agentData.phone));

  const [emailSnap, phoneSnap] = await Promise.all([getDocs(emailQ), getDocs(phoneQ)]);

  if (!emailSnap.empty) throw new Error("Email already exists.");
  if (!phoneSnap.empty) throw new Error("Phone number already exists.");

  // Call Cloud Function to create the Auth user (must be an admin function)
  let uid: string;
  try {
    const result: any = await createUserFn({
      email: agentData.email,
      password: agentData.password,
      name: agentData.name,
      phone: agentData.phone,
      role: agentData.role,
      dateOfBirth: agentData.dateOfBirth || null,
      gender: agentData.gender || null,
      address: agentData.address || null,
    });
    uid = result?.data?.uid;
    if (!uid) throw new Error("Cloud function did not return a uid");
  } catch (err: any) {
    console.error("addAgent: adminCreateUser failed:", err);
    // Surface friendly error to caller
    throw new Error(err?.message || "Failed to create auth user (admin function)");
  }

  // Wait for Cloud Function to create the Firestore user doc
  const createdDoc = await waitForUserDoc(uid, 10000, 400); // 10s timeout, 400ms interval
  if (!createdDoc) {
    // Attempt cleanup to avoid orphaned auth user, then surface error
    try {
      await deleteUserFn({ uid });
    } catch (cleanupErr) {
      console.error("addAgent: cleanup after missing user doc failed", cleanupErr);
    }
    throw new Error("User created in Auth but Firestore user doc not found. Check Cloud Functions logs.");
  }

  // Return the canonical Firestore doc as the new agent representation
  return { id: uid, ...(createdDoc as any) } as Agent;
}

/**
 * Update agent data (upserts safe fields). Password changes go via admin function.
 */
export async function updateAgent(
  agentId: string,
  agentData: Partial<Agent & { password?: string }>
) {
  // Prepare safe update object
  const cleaned: any = { updated_at: serverTimestamp() };

  for (const key of [
    "name",
    "email",
    "phone",
    "role",
    "gender",
    "address",
    "dateOfBirth",
    "active",
  ]) {
    if ((agentData as any)[key] !== undefined) cleaned[key] = (agentData as any)[key];
  }

  // Handle password (must be set by admin via Cloud Function)
  if ((agentData as any).password) {
    try {
      await setPasswordFn({ uid: agentId, password: (agentData as any).password });
    } catch (err) {
      console.error("Password update failed (requires admin privileges):", err);
      // continue — don't fail the whole update because password change failed
    }
  }

  // Use setDoc with merge to avoid "No document to update" errors and to make the operation idempotent
  try {
    await setDoc(doc(db, "users", agentId), cleaned, { merge: true });
  } catch (err) {
    console.error("updateAgent: failed to write user doc:", err);
    throw new Error("Failed to update agent");
  }
}

/**
 * Delete agent (Auth via Cloud Function + Firestore doc). Ensures Auth removal first to avoid orphaned credentials.
 */
export async function deleteAgent(agentId: string) {
  // Call cloud function to delete auth user first (gives clearer permission errors)
  try {
    await deleteUserFn({ uid: agentId });
  } catch (err: any) {
    console.error("Auth deletion failed (requires admin privileges):", err);
    // Surface friendly error
    throw new Error(err?.message || "Failed to delete auth user (admin function)");
  }

  // Then delete Firestore record
  try {
    await deleteDoc(doc(db, "users", agentId));
  } catch (err) {
    console.error("deleteAgent: failed to delete Firestore doc after auth deletion:", err);
    // Not fatal — caller can retry deleting the Firestore doc separately
    throw new Error("Auth user deleted but failed to delete Firestore user doc");
  }
}