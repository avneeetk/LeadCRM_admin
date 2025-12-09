/**
 * LeadCRM Backend - Firebase Functions (Production-ready, FINAL PATCHED)
 * Version: 1.0.2
 * Author: Avneet (stable release)
 */

import { onRequest, onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import admin from "firebase-admin";

// Initialize Admin SDK safely (avoid re-init errors)
if (!admin.apps.length) {
  admin.initializeApp();
  logger.info("Firebase Admin initialized.");
} else {
  logger.info("Firebase Admin already initialized.");
}

const db = admin.firestore();

/* -------------------------------------------------------------------------- */
/*                         ⚙️ Helper Error Wrappers                           */
/* -------------------------------------------------------------------------- */

function deny(msg = "Permission denied") {
  throw new HttpsError("permission-denied", msg);
}

function invalid(msg = "Invalid argument") {
  throw new HttpsError("invalid-argument", msg);
}

function fail(msg = "Internal server error") {
  logger.error("InternalError:", msg);
  throw new HttpsError("internal", msg);
}

/* -------------------------------------------------------------------------- */
/*                        🔐  HTTP TEST FUNCTIONS                             */
/* -------------------------------------------------------------------------- */

export const registerSession = onRequest(async (req, res) => {
  try {
    logger.info("registerSession called");
    res.status(200).json({ status: "success", message: "Session registered", received: req.body || {} });
  } catch (err) {
    logger.error("registerSession error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

export const punchIn = onRequest(async (req, res) => {
  try {
    logger.info("punchIn called");
    res.status(200).json({ status: "success", message: "Punch-in simulated", received: req.body || {} });
  } catch (err) {
    logger.error("punchIn error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

/* -------------------------------------------------------------------------- */
/*                       🧩  FIRESTORE EVENT TRIGGER                           */
/* -------------------------------------------------------------------------- */

// Using region "us-central1" because nam5 is NOT available for Cloud Functions
export const onLeadAssigned = onDocumentUpdated(
  {
    region: "us-central1",
    database: "(default)",
    document: "leads/{leadId}",
  },
  async (event) => {
    try {
      const before = event.data?.before?.data();
      const after = event.data?.after?.data();
      if (!before || !after) return null;

      const beforeAssigned = before.assignedTo ?? before.assigned_to ?? null;
      const afterAssigned = after.assignedTo ?? after.assigned_to ?? null;

      if (beforeAssigned !== afterAssigned) {
        logger.info(`Lead ${event.params.leadId}: reassigned ${beforeAssigned} → ${afterAssigned}`);
      }
      return null;
    } catch (err) {
      logger.error("onLeadAssigned error:", err);
      return null;
    }
  }
);

/* -------------------------------------------------------------------------- */
/*                      🔐 ADMIN AUTH CONTROL FUNCTIONS                       */
/* -------------------------------------------------------------------------- */

/**
 * FINAL FIXED VERSION
 * - No destructuring crash
 * - Proper HttpsError responses
 * - Correct custom claims
 * - Fully validated inputs
 */

export const adminCreateUser = onCall(
  { cors: true, region: "us-central1" },
  async (request) => {
    try {
      const auth = request.auth;
      if (!auth) deny("Unauthenticated request");
      if (auth.token.role !== "admin") deny("Only admins can create users");

      const data = request.data || {};

      const email = data.email;
      const password = data.password;
      const name = data.name;
      const role = data.role;
      const phone = data.phone || null;
      const dateOfBirth = data.dateOfBirth || null;
      const gender = data.gender || null;
      const address = data.address || null;

      if (!email || !password || !name || !role) {
        invalid("Missing required fields: email, password, name, role");
      }

      const userRecord = await admin.auth().createUser({
        email,
        password,
        displayName: name,
        phoneNumber: undefined,
      });

      await admin.auth().setCustomUserClaims(userRecord.uid, { role });

      await db.collection("users").doc(userRecord.uid).set({
        name,
        email,
        role,
        phone,
        dateOfBirth,
        gender,
        address,
        active: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        assignedLeads: 0,
        closedDeals: 0,
      });

      logger.info("User created:", { uid: userRecord.uid });

      return { success: true, uid: userRecord.uid };
    } catch (err) {
      logger.error("adminCreateUser error:", err);
      if (err instanceof HttpsError) throw err;
      if (err?.code === "auth/email-already-exists") {
        throw new HttpsError("already-exists", "Email already exists");
      }
      fail(err?.message || "Failed to create user");
    }
  }
);

export const adminSetUserPassword = onCall(
  { cors: true, region: "us-central1" },
  async (request) => {
    try {
      const auth = request.auth;
      if (!auth) deny("Unauthenticated request");
      if (auth.token.role !== "admin") deny("Only admins can update passwords");

      const { uid, password } = request.data || {};
      if (!uid || !password) invalid("Missing uid or password");

      await admin.auth().updateUser(uid, { password });
      return { success: true };
    } catch (err) {
      logger.error("adminSetUserPassword error:", err);
      if (err instanceof HttpsError) throw err;
      fail(err?.message || "Failed to update password");
    }
  }
);

// export const setAdmin = onRequest(async (req, res) => {
//   try {
//     await admin.auth().setCustomUserClaims("P5U8zpZj6CTbWT0aim3CbLpbnRi1", { role: "admin" });
//     res.send("Admin claim set!");
//   } catch (e) {
//     res.status(500).send(e.message);
//   }
// });

export const adminDeleteUser = onCall(
  { cors: true, region: "us-central1" },
  async (request) => {
    try {
      const auth = request.auth;
      if (!auth) deny("Unauthenticated request");
      if (auth.token.role !== "admin") deny("Only admins can delete users");

      const { uid } = request.data || {};
      if (!uid) invalid("Missing uid");

      await admin.auth().deleteUser(uid);
      await db.collection("users").doc(uid).delete();

      return { success: true };
    } catch (err) {
      logger.error("adminDeleteUser error:", err);
      if (err instanceof HttpsError) throw err;
      if (err?.code === "auth/user-not-found") {
        throw new HttpsError("not-found", "User not found");
      }
      fail(err?.message || "Failed to delete user");
    }
  }
);

/* -------------------------------------------------------------------------- */
/*                             ✔ EXPORT CHECK                                 */
/* -------------------------------------------------------------------------- */

logger.info("LeadCRM Firebase Functions loaded (FINAL PATCHED).");