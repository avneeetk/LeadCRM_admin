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

// 🚀 HARD FAIL LOG (boot confirmation)
logger.info("🚀 Notification system booted");

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

// --------------------------------------------------------------------------
// 🔔 Reusable helper for admin notifications
// --------------------------------------------------------------------------
async function createAdminNotification({ title, message, type, refId }) {
  await db.collection("admin_notifications").add({
    title,
    message,
    type,
    refId: refId || null,
    read: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
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

// --------------------------------------------------------------------------
// 🔔 TEST: Admin notification write (debug only)
// --------------------------------------------------------------------------
export const testAdminNotification = onRequest(
  { region: "us-central1" },
  async (req, res) => {
    try {
      await createAdminNotification({
        title: "Test Notification",
        message: "Admin notification write test",
        type: "test",
        refId: null,
      });

      res.status(200).json({ success: true });
    } catch (err) {
      logger.error("testAdminNotification error:", err);
      res.status(500).json({ error: "Failed to write admin notification" });
    }
  }
);

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

      // Delete Firestore user FIRST to avoid trigger re-creation
      await db.collection("users").doc(uid).delete();

      // Then delete Auth user
      await admin.auth().deleteUser(uid);

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

function diffNewAssignees(beforeList = [], afterList = []) {
  const beforeSet = new Set(
    Array.isArray(beforeList) ? beforeList.filter(v => typeof v === "string") : []
  );
  return (Array.isArray(afterList) ? afterList : []).filter(
    v => typeof v === "string" && !beforeSet.has(v)
  );
}

export const notifyAgentOnLeadAssigned = onDocumentUpdated(
  {
    region: "us-central1",
    document: "leads/{leadId}",
  },
  async (event) => {
    try {
      const before = event.data?.before?.data();
      const after = event.data?.after?.data();
      if (!before || !after) return null;

      const newAssignees = diffNewAssignees(
        before.assignedTo,
        after.assignedTo
      );

      if (newAssignees.length === 0) {
        logger.info("No new assignees detected");
        return null;
      }

      for (const uid of newAssignees) {
        const userSnap = await db.collection("users").doc(uid).get();
        if (!userSnap.exists) continue;

        const fcmToken = userSnap.data()?.fcmToken;
        if (!fcmToken) {
          logger.info("User has no FCM token:", uid);
          continue;
        }

        await admin.messaging().send({
          token: fcmToken,
          android: {
            priority: "high",
            notification: {
              channelId: "lead_assignments",
              sound: "default",
            },
          },
          notification: {
            title: "New Lead Assigned",
            body: `You have been assigned a new lead: ${after.name || "Lead"}`,
          },
          data: {
            type: "lead_assigned",
            leadId: event.params.leadId,
          },
        });

        await db.collection("users").doc(uid).collection("notifications").add({
          type: "lead_assigned",
          title: "New Lead Assigned",
          message: `You have been assigned a new lead`,
          refId: event.params.leadId,
          read: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        logger.info("Lead assignment push sent to:", uid);
      }

      return null;
    } catch (err) {
      logger.error("notifyAgentOnLeadAssigned error:", err);
      return null;
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

      // --- FIX: assignedTo is an array, must pick first string UID ---
      const assignedTo = leadSnap.data()?.assignedTo;
      if (!Array.isArray(assignedTo) || assignedTo.length === 0) return;

      const agentUid = assignedTo[0];
      if (typeof agentUid !== "string") return;

      // 3️⃣ Fetch agent FCM token
      const agentSnap = await admin
        .firestore()
        .collection("users")
        .doc(agentUid)
        .get();

      if (!agentSnap.exists) {
        logger.warn("Agent deleted, skipping admin note notification:", agentUid);
        return;
      }

      const fcmToken = agentSnap.data()?.fcmToken;
      if (!fcmToken) {
        logger.info("No FCM token for agent:", agentUid);
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

      // Write admin notification
      await createAdminNotification({
        title: "Admin Note Added",
        message: "Admin added a note on a lead",
        type: "admin_note",
        refId: event.params.leadId,
      });

      logger.info("Notification sent to agent:", agentUid);
    } catch (err) {
      logger.error("notifyAgentOnAdminNote error:", err);
    }
  }
);

// --------------------------------------------------------------------------
// 🔔 Admin notification for attendance creation (punch-in/leave apply)
// --------------------------------------------------------------------------
export const notifyAdminOnAttendanceCreated = onDocumentCreated(
  {
    region: "us-central1",
    document: "attendance/{attendanceId}",
  },
  async (event) => {
    try {
      const data = event.data?.data();
      if (!data) return;

      // FIX: support both attendance_status and status
      const status = data.attendance_status || data.status;
      if (!status) return;

      const userId = data.user_id;
      let userName = "User";
      if (userId) {
        const userSnap = await db.collection("users").doc(userId).get();
        userName = userSnap.data()?.name || "User";
      }

      if (status === "present") {
        await createAdminNotification({
          title: "Punch In",
          message: `${userName} punched in`,
          type: "punch_in",
          refId: event.params.attendanceId,
        });
      }

      if (status === "leave" || status === "half_day") {
        await createAdminNotification({
          title: "Leave Applied",
          message: `${userName} applied for ${status}`,
          type: "leave_applied",
          refId: event.params.attendanceId,
        });
      }
    } catch (err) {
      logger.error("notifyAdminOnAttendanceCreated error:", err);
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
      if (!before || !after) return null;

      if (before.approval_status === after.approval_status) return null;
      if (!["approved", "rejected"].includes(after.approval_status)) return null;

      const userId = after.user_id;
      if (!userId) return null;

      const userSnap = await db.collection("users").doc(userId).get();
      if (!userSnap.exists) return null;

      const fcmToken = userSnap.data()?.fcmToken;
      if (!fcmToken) return null;

      const decisionText =
        after.approval_status === "approved" ? "approved" : "rejected";

      await admin.messaging().send({
        token: fcmToken,
        android: {
          priority: "high",
        },
        notification: {
          title: "Leave Request Update",
          body: `Your ${after.attendance_status || "leave"} request was ${decisionText}`,
        },
        data: {
          type: "leave_decision",
          attendanceId: event.params.attendanceId,
        },
      });

      await db.collection("users").doc(userId).collection("notifications").add({
        type: "leave_decision",
        title: "Leave Request Update",
        message: `Your leave request was ${decisionText}`,
        refId: event.params.attendanceId,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      await createAdminNotification({
        title: "Leave Decision",
        message: `Leave ${decisionText} for ${userSnap.data()?.name || "user"}`,
        type: "leave_decision",
        refId: event.params.attendanceId,
      });

      logger.info("Leave decision notification sent:", userId);
      return null;
    } catch (err) {
      logger.error("notifyAgentOnLeaveDecision error:", err);
      return null;
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


// --------------------------------------------------------------------------
// 🔔 Admin notification when a NEW LEAD is created (new source / webhook / manual)
// --------------------------------------------------------------------------
export const notifyAdminOnNewLeadCreated = onDocumentCreated(
  {
    region: "us-central1",
    document: "leads/{leadId}",
  },
  async (event) => {
    try {
      const lead = event.data?.data();
      if (!lead) return;

      // Skip manual/admin-created leads
      if (!lead.source || lead.source === "manual") {
        return;
      }

      // Guard to prevent duplicate writes
      if (lead._adminNotified === true) return;

      await createAdminNotification({
        title: "New Lead Created",
        message: `New lead received${lead.source ? ` from ${lead.source}` : ""}`,
        type: "lead_created",
        refId: event.params.leadId,
      });

      // Mark as notified to prevent duplicates
      await event.data.ref.update({ _adminNotified: true });
    } catch (err) {
      logger.error("notifyAdminOnNewLeadCreated error:", err);
    }
  }
);

// --------------------------------------------------------------------------
// 🔔 Admin notification when LEAD STATUS changes
// --------------------------------------------------------------------------
export const notifyAdminOnLeadStatusChange = onDocumentUpdated(
  {
    region: "us-central1",
    document: "leads/{leadId}",
  },
  async (event) => {
    try {
      const before = event.data?.before?.data();
      const after = event.data?.after?.data();
      if (!before || !after) return;

      const followUpChanged =
        before.followUpDate !== after.followUpDate ||
        before.followUpTime !== after.followUpTime;

      if (followUpChanged) {
        await createAdminNotification({
          title: "Follow-up Updated",
          message: `${after.name || "Lead"} follow-up updated`,
          type: "follow_up_updated",
          refId: event.params.leadId,
        });
      }

      const statusChanged =
        before.status !== after.status ||
        (before.statusChangedAt?.toMillis?.() !== after.statusChangedAt?.toMillis?.());

      if (!statusChanged) return;

      await createAdminNotification({
        title: "Lead Status Updated",
        message: `${after.name || "Lead"} status changed from ${before.status} to ${after.status}`,
        type: "lead_status_change",
        refId: event.params.leadId,
      });
    } catch (err) {
      logger.error("notifyAdminOnLeadStatusChange error:", err);
    }
  }
);

// --------------------------------------------------------------------------
// 🔔 Admin notification when SUB-USER punches OUT
// --------------------------------------------------------------------------
export const notifyAdminOnPunchOut = onDocumentUpdated(
  {
    region: "us-central1",
    document: "attendance/{attendanceId}",
  },
  async (event) => {
    try {
      const before = event.data?.before?.data();
      const after = event.data?.after?.data();
      if (!before || !after) return;

      if (!before.punchedOutAt && after.punchedOutAt) {
        const userId = after.user_id;
        let userName = "User";
        if (userId) {
          const userSnap = await db.collection("users").doc(userId).get();
          if (!userSnap.exists) {
            logger.warn("User deleted, skipping punch-out notification:", userId);
            return;
          }
          userName = userSnap.data()?.name || "User";
        }
        await createAdminNotification({
          title: "Punch Out",
          message: `${userName} punched out`,
          type: "punch_out",
          refId: event.params.attendanceId,
        });
      }
    } catch (err) {
      logger.error("notifyAdminOnPunchOut error:", err);
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

      // // 🔒 DUPLICATE PREVENTION (Magicbricks)
      // const phone = payload.phone || null;

      // if (phone) {
      //   const existingSnap = await db
      //     .collection("leads")
      //     .where("phone", "==", phone)
      //     .where("raw_source", "==", "magicbricks")
      //     .limit(1)
      //     .get();

      //   if (!existingSnap.empty) {
      //     logger.warn("Duplicate Magicbricks lead ignored", { phone });
      //     return res.status(200).json({
      //       success: true,
      //       message: "Duplicate lead ignored",
      //     });
      //   }
      // }

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
        assignedTo: [],

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