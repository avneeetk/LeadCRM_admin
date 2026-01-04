/**
 * LeadCRM Backend - Firebase Functions (Production-ready, FINAL PATCHED)
 * Version: 1.0.2
 * Author: Avneet (stable release)
 */

import { onRequest, onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentUpdated, onDocumentCreated } from "firebase-functions/v2/firestore";
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
/*                          🔔 NOTIFICATION TRIGGERS                          */
/* -------------------------------------------------------------------------- */

export const notifyAgentOnLeadAssigned = onDocumentUpdated(
  {
    region: "us-central1",
    document: "leads/{leadId}",
  },
  async (event) => {
    try {
      const before = event.data?.before?.data();
      const after = event.data?.after?.data();

      if (!before || !after) return;

      const beforeAssigned = before.assignedTo;
      const afterAssigned = after.assignedTo;

      // Only trigger if assignment actually changed
      if (!afterAssigned || beforeAssigned === afterAssigned) {
        return;
      }

      // Fetch agent
      const agentSnap = await admin
        .firestore()
        .collection("users")
        .doc(afterAssigned)
        .get();

      const fcmToken = agentSnap.data()?.fcmToken;
      if (!fcmToken) {
        logger.info("No FCM token for agent:", afterAssigned);
        return;
      }

      await admin.messaging().send({
        token: fcmToken,
        notification: {
          title: "New Lead Assigned",
          body: `You have been assigned a new lead: ${after.name || "New Lead"}`,
        },
        data: {
          leadId: event.params.leadId,
          type: "lead_assigned",
        },
      });

      logger.info("Lead assignment notification sent:", afterAssigned);
    } catch (err) {
      logger.error("notifyAgentOnLeadAssigned error:", err);
    }
  }
);

export const notifyAgentOnAdminNote = onDocumentCreated(
  {
    region: "us-central1",
    document: "leads/{leadId}/notes/{noteId}",
  },
  async (event) => {
    try {
      const note = event.data?.data();
      if (!note) return;

      const noteBy = note.by;
      if (!noteBy) return;

      // 1️⃣ Check note author role
      const authorSnap = await admin
        .firestore()
        .collection("users")
        .doc(noteBy)
        .get();

      const authorRole = authorSnap.data()?.role;
      if (authorRole !== "admin") {
        // Only notify when ADMIN writes note
        return;
      }

      // 2️⃣ Fetch lead
      const leadSnap = await admin
        .firestore()
        .collection("leads")
        .doc(event.params.leadId)
        .get();

      const assignedTo = leadSnap.data()?.assignedTo;
      if (!assignedTo) return;

      // 3️⃣ Fetch agent FCM token
      const agentSnap = await admin
        .firestore()
        .collection("users")
        .doc(assignedTo)
        .get();

      const fcmToken = agentSnap.data()?.fcmToken;
      if (!fcmToken) {
        logger.info("No FCM token for agent:", assignedTo);
        return;
      }

      // 4️⃣ Send push notification
      await admin.messaging().send({
        token: fcmToken,
        notification: {
          title: "New note from Admin",
          body: note.text || "You have a new message",
        },
        data: {
          leadId: event.params.leadId,
          type: "admin_note",
        },
      });

      logger.info("Notification sent to agent:", assignedTo);
    } catch (err) {
      logger.error("notifyAgentOnAdminNote error:", err);
    }
  }
);

/* -------------------------------------------------------------------------- */
/*                          📱 PUSH NOTIFICATIONS                             */
/* -------------------------------------------------------------------------- */

export const notifyAgentOnLeaveDecision = onDocumentUpdated(
  {
    region: "us-central1",
    document: "attendance/{attendanceId}",
  },
  async (event) => {
    try {
      const before = event.data?.before?.data();
      const after = event.data?.after?.data();

      if (!before || !after) return;

      // Trigger ONLY when approval_status changes
      if (before.approval_status === after.approval_status) return;

      if (!["approved", "rejected"].includes(after.approval_status)) return;

      const userId = after.user_id;
      if (!userId) return;

      // Fetch agent
      const userSnap = await admin.firestore()
        .collection("users")
        .doc(userId)
        .get();

      const fcmToken = userSnap.data()?.fcmToken;
      if (!fcmToken) return;

      const statusText =
        after.approval_status === "approved"
          ? "approved"
          : "rejected";

      await admin.messaging().send({
        token: fcmToken,
        notification: {
          title: "Leave Request Update",
          body: `Your ${after.attendance_status} request has been ${statusText}.`,
        },
        data: {
          type: "attendance_approval",
          attendanceId: event.params.attendanceId,
        },
      });

    } catch (err) {
      logger.error("notifyAgentOnLeaveDecision error:", err);
    }
  }
);

export const notifyOnLeaveApproval = onDocumentUpdated(
  {
    region: "us-central1",
    document: "attendance/{id}",
  },
  async (event) => {
    try {
      const before = event.data?.before?.data() || {};
      const after = event.data?.after?.data() || {};

      if (
        before?.approval_status === "pending" &&
        after?.approval_status === "approved" &&
        after?.user_id
      ) {
        const userSnap = await db.collection("users").doc(after.user_id).get();
        const token = userSnap.data()?.fcmToken;
        
        if (token) {
          await admin.messaging().send({
            token,
            notification: {
              title: "Leave Approved",
              body: `Your ${after.attendance_status || 'leave'} request has been approved`,
            },
            data: {
              type: "leave_approval",
              attendanceId: event.params.id,
            },
          });
          logger.info(`Leave approval notification sent to user ${after.user_id}`);
        }
      }
    } catch (error) {
      logger.error("Error in notifyOnLeaveApproval:", error);
    }
  }
);

export const adminApproveAttendance = onCall(
  { cors: true, region: "us-central1" },
  async (request) => {
    try {
      const auth = request.auth;
      if (!auth) deny("Unauthenticated");
      if (auth.token.role !== "admin") deny("Only admin can approve attendance");

      const { attendanceId, action } = request.data || {};

      if (!attendanceId || !["approved", "rejected"].includes(action)) {
        invalid("attendanceId and valid action required");
      }

      const ref = db.collection("attendance").doc(attendanceId);
      const snap = await ref.get();

      if (!snap.exists) {
        throw new HttpsError("not-found", "Attendance record not found");
      }

      const record = snap.data();

      if (record.approval_status !== "pending") {
        invalid("Only pending requests can be processed");
      }

      const update = {
        approval_status: action,
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      };

      // If rejected, revert to present
      if (action === "rejected") {
        update.attendance_status = "present";
      }

      await ref.update(update);

      logger.info("Attendance approval updated", {
        attendanceId,
        action,
      });

      return { success: true };

    } catch (err) {
      logger.error("adminApproveAttendance error:", err);
      if (err instanceof HttpsError) throw err;
      fail(err?.message || "Approval failed");
    }
  }
);

export const notifyAgentOnAttendanceApproval = onDocumentUpdated(
  {
    region: "us-central1",
    document: "attendance/{attendanceId}",
  },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after) return;

    // Trigger only when pending → approved/rejected
    if (
      before.approval_status === "pending" &&
      ["approved", "rejected"].includes(after.approval_status)
    ) {
      const userId = after.user_id;

      const userSnap = await admin.firestore().collection("users").doc(userId).get();
      const token = userSnap.data()?.fcmToken;
      if (!token) return;

      await admin.messaging().send({
        token,
        notification: {
          title: "Attendance Update",
          body: `Your ${after.attendance_status} request was ${after.approval_status}`,
        },
        data: {
          type: "attendance_approval",
          attendanceId: event.params.attendanceId,
        },
      });
    }
  }
);

/* -------------------------------------------------------------------------- */
/*                             ✔ EXPORT CHECK                                 */
/* -------------------------------------------------------------------------- */

logger.info("LeadCRM Firebase Functions loaded (FINAL PATCHED).");


/* -------------------------------------------------------------------------- */
/*                 🔗 MAGICBRICKS LEAD WEBHOOK (PHASE 1 – FIXED)               */
/* -------------------------------------------------------------------------- */

export const magicbricksLeadWebhook = onRequest(
  { region: "us-central1" },
  async (req, res) => {
    try {
      if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
      }

      const payload = req.body || {};

      logger.info("Magicbricks lead received", payload);

      // ✅ MINIMUM REQUIRED MAPPING FOR ADMIN UI
      const leadDoc = {
        // Core lead fields
        name: payload.name || "",
        phone: payload.phone || "",
        email: payload.email || "",
        city: payload.city || "",
        project: payload.project || "",

        // System fields
        source: payload.source || "Magicbricks",
        status: "new",
        assignedTo: null,

        // Timestamps
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),

        // Debug & safety
        raw_source: "magicbricks",
        raw_payload: payload,
      };

      await db.collection("leads").add(leadDoc);

      return res.status(200).json({
        success: true,
        message: "Lead received successfully",
      });
    } catch (err) {
      logger.error("Magicbricks webhook error", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);