/* services/eventService.js
   ─────────────────────────────────────────────────────────────────────────
   MIGRATION NOTE — read this before wiring the frontend.

   In the old system, the frontend called Firestore's addDoc() directly on
   alerts / notifications / parentRequests, and three separate Cloud
   Functions (onAlertCreated, onNotificationCreated, onParentRequestCreated)
   fired automatically as Firestore *triggers* the instant that document
   was created. Express has no equivalent to a Firestore trigger — it only
   runs when an HTTP request hits it.

   So each function below does the Firestore write AND the push send in a
   single request/response cycle. To the end user this is indistinguishable
   from before (still one action, alert appears, push goes out) — but the
   frontend must now call these via fetch() (see FRONTEND MIGRATION GUIDE)
   instead of writing to Firestore directly for these 3 collections only.
   Every other collection (students, behaviorLogs, ieps, etc.) is untouched
   and keeps writing directly through the Firestore Web SDK, exactly as
   today, governed by firestore.rules.
   ───────────────────────────────────────────────────────────────────────── */

const { db, admin } = require('../config/firebase');
const push = require('./pushService');

// Writes a doc using the client-supplied numeric `id` as the Firestore doc
// ID when present (the original app's convention — e.g. admin.html's
// sendNotification() and teacher_portal.html's slPushAlert()/slPushNotification()
// generate their own numeric id and use it as BOTH the doc ID and an `id`
// field, so other screens can look records up by that id). Falls back to
// Firestore auto-generating one if no id was supplied.
async function writeWithOptionalId(collectionName, data) {
  if (data.id !== undefined && data.id !== null) {
    const ref = db.collection(collectionName).doc(String(data.id));
    await ref.set(data);
    return ref.id;
  }
  const ref = await db.collection(collectionName).add(data);
  return ref.id;
}

// Mirrors onAlertCreated
async function createAlert(alertData, callerUid) {
  const docId = await writeWithOptionalId('alerts', {
    ...alertData,
    createdBy: callerUid,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  const [teacherTokens, admins, parents] = await Promise.all([
    push.tokensForUids([alertData.teacherId]),
    push.adminTokens(),
    push.parentTokensForStudent(alertData.sid)
  ]);

  const recipients = [...teacherTokens, ...admins, ...parents];
  if (recipients.length) {
    await push.sendPushToRecipients(recipients, {
      title: alertData.title || 'SNED-LINK+ Critical Alert',
      body: alertData.desc || 'A new alert needs your attention.',
      data: { sid: alertData.sid ? String(alertData.sid) : '', severity: alertData.severity || 'Moderate' },
      critical: true
    });
  }

  return { id: docId };
}

// Mirrors onNotificationCreated
async function createNotification(n, callerUid) {
  const docId = await writeWithOptionalId('notifications', {
    ...n,
    createdBy: callerUid,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  // category:'minor' notifications are saved for the in-app bell but
  // skipped for push, same as before.
  if (n.category !== 'minor') {
    let teacherRecipients = [];
    if (n.teacherId) {
      teacherRecipients = await push.tokensForUids([n.teacherId]);
    } else {
      teacherRecipients = await push.teacherTokens();
    }

    const [admins, parents] = await Promise.all([
      push.adminTokens(),
      n.forParents ? push.parentTokensForStudent(n.sid) : Promise.resolve([])
    ]);

    const recipients = [...teacherRecipients, ...admins, ...parents];
    if (recipients.length) {
      await push.sendPushToRecipients(recipients, {
        title: n.title || 'SNED-LINK+',
        body: n.desc || '',
        data: { sid: n.sid ? String(n.sid) : '' },
        critical: false
      });
    }
  }

  return { id: docId };
}

// Mirrors onParentRequestCreated — parent_portal.html always uses
// Firestore's auto-generated ID for these (no client-supplied id), so this
// one always calls .add() directly, same as before.
async function createParentRequest(r, callerUid) {
  const docRef = await db.collection('parentRequests').add({
    ...r,
    createdBy: callerUid,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  const admins = await push.adminTokens();
  if (admins.length) {
    await push.sendPushToRecipients(admins, {
      title: 'New Parent Request',
      body: `${r.parentName || 'A parent'}: ${(r.message || '').slice(0, 120)}`,
      data: { sid: r.studentId ? String(r.studentId) : '' },
      critical: true
    });
  }

  return { id: docRef.id };
}

module.exports = { createAlert, createNotification, createParentRequest };
