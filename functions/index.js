/**
 * LeadCRM Backend - Firebase Functions (Local Emulator Ready)
 * Version: 1.0.0
 * Author: Avneet
 */

import { onRequest } from "firebase-functions/v2/https";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import admin from "firebase-admin";

// ✅ Initialize Firebase Admin SDK only once
try {
  admin.initializeApp();
  logger.info("Firebase Admin initialized successfully.");
} catch (e) {
  logger.warn("Firebase Admin already initialized.");
}

const db = admin.firestore();

/* -------------------------------------------------------------------------- */
/*                        🔐  HTTP TEST FUNCTIONS                             */
/* -------------------------------------------------------------------------- */

/**
 * 1️⃣ Register Session (Simulates device session registration)
 * Called during login to check allowed IP/device.
 */
export const registerSession = onRequest((req, res) => {
  logger.info("registerSession called:", req.body);

  // Basic local test response
  res.status(200).json({
    status: "success",
    message: "Session registered (local test).",
    received: req.body || {},
  });
});

/**
 * 2️⃣ Punch In (Simulates attendance punch-in)
 * Used to test attendance record creation locally.
 */
export const punchIn = onRequest((req, res) => {
  logger.info("punchIn called:", req.body);

  res.status(200).json({
    status: "success",
    message: "Punch-in simulated (local test).",
    received: req.body || {},
  });
});

/* -------------------------------------------------------------------------- */
/*                       🧩  FIRESTORE EVENT TRIGGER                           */
/* -------------------------------------------------------------------------- */

/**
 * 3️⃣ Lead Assigned Trigger
 * Fires whenever a lead document's `assigned_to` field is updated.
 * Useful for sending notifications or logging reassignment.
 */
export const onLeadAssigned = onDocumentUpdated("leads/{leadId}", (event) => {
  const before = event.data?.before?.data();
  const after = event.data?.after?.data();

  if (!before || !after) return;

  if (before.assigned_to !== after.assigned_to) {
    logger.info(
      `📢 Lead [${event.params.leadId}] reassigned from ${before.assigned_to} → ${after.assigned_to}`
    );

    // (Optional) Example future logic:
    // await db.collection('notifications').add({
    //   target_user: after.assigned_to,
    //   message: `You’ve been assigned a new lead: ${after.name}`,
    //   timestamp: new Date().toISOString(),
    // });

  } else {
    logger.debug(`No change in assigned_to for lead ${event.params.leadId}`);
  }

  return null;
});

export const getUserRole = onRequest(async (req, res) => {
  try {
    const uid = req.query.uid;
    if (!uid) return res.status(400).json({ error: "Missing UID" });

    const userDoc = await admin.firestore().collection("users").doc(uid).get();
    if (!userDoc.exists) return res.status(404).json({ error: "User not found" });

    const data = userDoc.data();
    res.status(200).json({ uid: uid, role: data.role, name: data.name });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* -------------------------------------------------------------------------- */
/*                            ✅ EXPORT CHECK                                 */
/* -------------------------------------------------------------------------- */

logger.info("LeadCRM Firebase Functions loaded successfully.");