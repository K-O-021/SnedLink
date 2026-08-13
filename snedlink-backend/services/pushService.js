/* services/pushService.js
   ─────────────────────────────────────────────────────────────────────────
   Direct port of the push-sending logic from the old functions/index.js
   (sendPushToRecipients / tokensForUids / adminTokens / parentTokensForStudent).
   Behavior is unchanged — same message shape, same dead-token cleanup,
   same android/apns/webpush options — only the trigger mechanism changed
   (Firestore onDocumentCreated -> called directly from a route handler
   right after the Firestore write, so the net effect to end users is
   identical: create the alert/notification, then it pushes).
   ───────────────────────────────────────────────────────────────────────── */

const { db, messaging, admin } = require('../config/firebase');
const logger = require('../utils/logger');

async function sendPushToRecipients(recipients, { title, body, data, critical, portal }) {
  // recipients: [{ uid, token, portal }]
  if (!recipients.length) return;

  const responses = await Promise.all(recipients.map(r => {
    const message = {
      token: r.token,
      notification: { title, body },
      data: Object.assign({}, data, { portal: r.portal || portal || 'teacher' }),
      android: {
        priority: 'high',
        notification: { sound: 'default', channelId: 'sned_link_alerts' }
      },
      apns: { payload: { aps: { sound: 'default', 'content-available': 1 } } },
      webpush: { headers: { Urgency: critical ? 'high' : 'normal' }, fcmOptions: { link: '/' } }
    };
    return messaging.send(message).then(() => ({ ok: true, r })).catch(err => ({ ok: false, r, err }));
  }));

  // Clean up tokens FCM says are no longer valid.
  const byUid = {};
  responses.forEach(res => {
    if (!res.ok) {
      const code = res.err && res.err.code;
      if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') {
        (byUid[res.r.uid] = byUid[res.r.uid] || []).push(res.r.token);
      } else {
        logger.warn(`Push send failed for uid ${res.r.uid}: ${res.err && res.err.message}`);
      }
    }
  });
  await Promise.all(Object.keys(byUid).map(uid =>
    db.collection('users').doc(uid).update({
      fcmTokens: admin.firestore.FieldValue.arrayRemove(...byUid[uid])
    }).catch(() => {})
  ));
}

async function tokensForUids(uids) {
  const unique = [...new Set((uids || []).filter(Boolean))];
  if (!unique.length) return [];
  const snaps = await Promise.all(unique.map(uid => db.collection('users').doc(uid).get()));
  const out = [];
  snaps.forEach(snap => {
    if (!snap.exists) return;
    const d = snap.data();
    (d.fcmTokens || []).forEach(token => out.push({ uid: snap.id, token, portal: d.role }));
  });
  return out;
}

async function adminTokens() {
  const snap = await db.collection('users').where('role', '==', 'admin').get();
  const out = [];
  snap.forEach(d => { (d.data().fcmTokens || []).forEach(token => out.push({ uid: d.id, token, portal: 'admin' })); });
  return out;
}

async function teacherTokens() {
  const snap = await db.collection('users').where('role', '==', 'teacher').where('status', '==', 'active').get();
  const out = [];
  snap.forEach(d => (d.data().fcmTokens || []).forEach(token => out.push({ uid: d.id, token, portal: 'teacher' })));
  return out;
}

async function parentTokensForStudent(sid) {
  if (!sid) return [];
  const studentSnap = await db.collection('students').doc(String(sid)).get();
  if (!studentSnap.exists) return [];
  const parentUids = studentSnap.data().parentUids || [];
  return tokensForUids(parentUids);
}

module.exports = {
  sendPushToRecipients,
  tokensForUids,
  adminTokens,
  teacherTokens,
  parentTokensForStudent
};
