/* services/accountService.js
   Direct port of createTeacherAccount / createParentAccount from the old
   functions/index.js — PLUS a real fix for the teacher activation flow,
   which was previously dead code end-to-end (admin.html generated tokens
   nothing ever consumed; teacher_portal.html called an endpoint that
   didn't exist). See createTeacherAccount + activateTeacherAccount below. */

const crypto = require('crypto');
const { db, auth, admin } = require('../config/firebase');
const { AppError } = require('../utils/AppError');

function genTempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 12; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

// 32-char hex token — same format admin.html's own (previously unused)
// genToken() already produced, so any existing QR/link-building code in
// admin.html keeps working unchanged.
function genActivationToken() {
  return crypto.randomBytes(16).toString('hex');
}

function expiresIn24h() {
  return new Date(Date.now() + 24 * 3600 * 1000).toISOString();
}

// Wraps auth.createUser() so the admin gets a clear, actionable 409 instead
// of a generic 500 when the email is already registered — Firebase Auth
// emails are unique project-wide (shared by teacher/parent/admin accounts),
// so this is a routine, expected failure mode, not a server error.
async function createAuthUser({ email, password, displayName }) {
  try {
    return await auth.createUser({ email, password, displayName });
  } catch (err) {
    if (err && err.code === 'auth/email-already-exists') {
      throw new AppError(409, 'already-exists',
        `${email} is already registered to another account in this project (teacher, parent, or admin). Use a different email, or remove the existing account first.`);
    }
    throw err;
  }
}

// If a step AFTER auth.createUser() fails, the Auth user would otherwise be
// stranded — permanently blocking that email from ever being used again,
// with no corresponding record anywhere in Firestore to show it exists.
// Call this from a catch block wrapping every step after user creation.
async function rollbackAuthUser(uid) {
  if (!uid) return;
  await auth.deleteUser(uid).catch(() => {
    // Best-effort — if this also fails, it'll surface as a future
    // email-already-exists and need manual cleanup in the Firebase console.
  });
}

/* ── createTeacherAccount ──────────────────────────────────────────────
   FIX: this used to take an admin-chosen `password` and activate the
   account immediately — no activation step ever happened, even though
   the Teacher Portal's login screen (and admin.html's whole "Access &
   Activation" panel) assumes one exists. Now:
     1. Firebase Auth user is created with a random, unusable placeholder
        password (nobody is ever told this — it only exists because
        Auth requires *some* password at creation time).
     2. users/{uid} is created with status:'inactive' — cannot sign in
        (middleware/auth.js's verifyToken rejects non-'active' status).
     3. A single-use teacherActivations doc is created with a token good
        for 24h. The admin shares that token/link/QR with the teacher.
     4. The teacher visits the Activate screen, sets their OWN real
        password via activateTeacherAccount() below — that's the only
        thing that flips status to 'active' and burns the token. ── */
async function createTeacherAccount({ name, email, section, phone }, callerUid) {
  const userRecord = await createAuthUser({ email, password: genTempPassword(), displayName: name });

  try {
    await db.collection('users').doc(userRecord.uid).set({
      name, email, role: 'teacher', status: 'inactive',
      fcmTokens: [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: callerUid
    });
    // Mirrored into teachers/{uid} too — admin.html's Teacher Management
    // table reads this richer collection (section/phone) directly; users/{uid}
    // stays the lean login/role profile. Same uid links them.
    await db.collection('teachers').doc(userRecord.uid).set({
      name, email, section: section || '—', phone: phone || '',
      status: 'Pending Activation', hasRealLogin: true, lastLogin: null,
      createdAt: new Date().toISOString()
    });

    // Human-readable display IDs — same TCH-####/EMP-#### shape admin.html's
    // (previously dead) createActivationForTeacher() already used, so the
    // existing Access & Activation table/detail view/QR code work exactly as
    // designed once fed real data, instead of showing "undefined" for every
    // field that function used to populate.
    const countSnap = await db.collection('teacherActivations').count().get();
    const seq = countSnap.data().count + 1;
    const displayTeacherId = 'TCH-' + String(seq).padStart(4, '0');
    const employeeId = 'EMP-' + String(1000 + seq).slice(1);

    const token = genActivationToken();
    const activationExpires = expiresIn24h();
    const activationRef = await db.collection('teacherActivations').add({
      teacherRecordId: userRecord.uid,
      teacherId: displayTeacherId,
      employeeId,
      name, email, section: section || '—', phone: phone || '—',
      accountStatus: 'Pending Activation',
      activationStatus: 'Pending',
      activationMethod: '—',
      token,
      qrVersion: 1,
      activationExpires,
      emailSent: false,
      emailSentAt: null,
      failedAttempts: 0,
      lastLogin: null,
      device: '—', browser: '—', ip: '—', sessionActive: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: callerUid
    });

    return { uid: userRecord.uid, activationId: activationRef.id, activationToken: token, activationExpires };
  } catch (err) {
    // Don't strand an Auth user with no Firestore record behind it — that
    // would permanently block this email with email-already-exists on every
    // future retry, with nothing in Firestore to explain why.
    await rollbackAuthUser(userRecord.uid);
    throw err;
  }
}

/* ── activateTeacherAccount ───────────────────────────────────────────
   PUBLIC endpoint (see routes/activationRoutes.js) — the teacher has no
   Firebase session yet at this point, so the single-use token itself IS
   the credential being checked here, not a Bearer ID token. */
async function activateTeacherAccount({ token, password }) {
  if (!token || typeof token !== 'string') {
    throw new AppError(400, 'invalid-argument', 'Missing activation token.');
  }
  if (!password || typeof password !== 'string' || password.length < 8) {
    throw new AppError(400, 'invalid-argument', 'Password must be at least 8 characters.');
  }

  const snap = await db.collection('teacherActivations').where('token', '==', token).limit(1).get();
  if (snap.empty) {
    throw new AppError(404, 'not-found', 'This activation link is invalid. Ask your administrator for a new one.');
  }
  const activationDoc = snap.docs[0];
  const a = activationDoc.data();

  if (a.activationStatus === 'Used') {
    throw new AppError(409, 'invalid-argument', 'This activation link has already been used. Sign in with your password, or ask your administrator to reset it.');
  }
  if (a.activationExpires && new Date(a.activationExpires).getTime() < Date.now()) {
    await activationDoc.ref.update({ activationStatus: 'Expired' });
    throw new AppError(410, 'invalid-argument', 'This activation link has expired. Ask your administrator to generate a new one.');
  }

  await auth.updateUser(a.teacherRecordId, { password });
  await db.collection('users').doc(a.teacherRecordId).update({ status: 'active' });
  await db.collection('teachers').doc(a.teacherRecordId).update({ status: 'Active', lastLogin: new Date().toISOString() }).catch(() => {});

  // Single-use: flip status AND null out the token, so a leaked/cached
  // link can't be replayed even if something ever skipped the status check.
  await activationDoc.ref.update({
    activationStatus: 'Used',
    accountStatus: 'Active',
    token: null,
    usedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  return { email: a.email };
}

/* ── createParentAccount ───────────────────────────────────────────────
   FIX: previously created the Firebase Auth account immediately with an
   admin-visible temp password (a real, if minor, security smell — a temp
   password an admin can see is a temp password that can leak in Slack, a
   screenshot, a support ticket, etc.). Now mirrors createTeacherAccount
   exactly: Auth user created with a random, nobody-ever-sees-it placeholder
   password; users/{uid} starts 'inactive'; a single-use parentActivations
   token (good for 7 days — parents are typically less immediately reachable
   than a teacher on-site) is generated for admin.html to turn into a
   link/QR. The parent sets their OWN real password via
   activateParentAccount() below, which is also the moment parentUids
   actually gets linked. */
async function createParentAccount({ name, email, studentId, relationship }, callerUid) {
  const studentRef = db.collection('students').doc(String(studentId));
  const studentSnap = await studentRef.get();
  if (!studentSnap.exists) throw new AppError(404, 'not-found', 'That student record was not found.');

  const userRecord = await createAuthUser({ email, password: genTempPassword(), displayName: name });

  try {
    await db.collection('users').doc(userRecord.uid).set({
      name, email, role: 'parent', status: 'inactive',
      fcmTokens: [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: callerUid
    });
    // Mirrored into parents/{uid} too — admin.html's Parent Management table
    // and the "children" list read this richer collection directly.
    await db.collection('parents').doc(userRecord.uid).set({
      name, email, phone: '', children: [studentSnap.data().name || ''],
      relationship: relationship || 'Guardian', status: 'Pending Activation', lastLogin: null
    });

    const countSnap = await db.collection('parentActivations').count().get();
    const seq = countSnap.data().count + 1;
    const displayParentId = 'PAR-' + String(seq).padStart(4, '0');

    const token = genActivationToken();
    const activationExpires = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
    const activationRef = await db.collection('parentActivations').add({
      parentRecordId: userRecord.uid,
      parentId: displayParentId,
      name, email,
      linkedStudentId: String(studentId),
      linkedStudent: studentSnap.data().name || '—',
      relationship: relationship || 'Guardian',
      primaryGuardian: false,
      emergencyContact: false,
      accountStatus: 'Pending Activation',
      activationStatus: 'Pending',
      activationMethod: '—',
      token,
      qrVersion: 1,
      activationExpires,
      emailSent: false,
      emailSentAt: null,
      failedAttempts: 0,
      lastLogin: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: callerUid
    });

    return { uid: userRecord.uid, activationId: activationRef.id, activationToken: token, activationExpires };
  } catch (err) {
    await rollbackAuthUser(userRecord.uid);
    throw err;
  }
}

/* ── verifyParentActivation ───────────────────────────────────────────
   PUBLIC — read-only pre-check so parent_portal.html's 2-step "Activate my
   account" screen (details, then password) can show a clear error before
   asking for a password, without yet creating anything or burning the
   token. Matches by token first (it's the real credential), then confirms
   the email/studentId the parent typed actually match the record — mostly
   a UX sanity check against fat-fingered input, since the token is already
   effectively proof of possession of the link. */
async function verifyParentActivation({ email, studentId, token }) {
  if (!token || typeof token !== 'string') {
    throw new AppError(400, 'invalid-argument', 'Missing activation code.');
  }
  const snap = await db.collection('parentActivations').where('token', '==', token).limit(1).get();
  if (snap.empty) {
    throw new AppError(404, 'not-found', 'Those details don\u2019t match an active activation record. Double-check them or contact the school administrator for a new activation code.');
  }
  const a = snap.docs[0].data();

  const emailMatches = !email || (a.email || '').trim().toLowerCase() === String(email).trim().toLowerCase();
  const studentMatches = !studentId || String(a.linkedStudentId) === String(studentId);
  if (!emailMatches || !studentMatches) {
    throw new AppError(404, 'not-found', 'Those details don\u2019t match an active activation record. Double-check them or contact the school administrator for a new activation code.');
  }
  if (a.activationStatus === 'Used') {
    throw new AppError(409, 'invalid-argument', 'This activation code has already been used. Ask the Administrator for a new one.');
  }
  if (a.activationExpires && new Date(a.activationExpires).getTime() < Date.now()) {
    throw new AppError(410, 'invalid-argument', 'This activation code has expired. Ask the Administrator for a new one.');
  }

  return { valid: true, email: a.email };
}

/* ── activateParentAccount ────────────────────────────────────────────
   PUBLIC — same shape as activateTeacherAccount. This is also the ONLY
   place students/{sid}.parentUids gets written for a self-activating
   parent: done here, server-side with the Admin SDK, specifically because
   firestore.rules correctly refuses to let a client (even the parent
   themselves) write that field directly — only an admin path should be
   able to link a parent to a student's record. */
async function activateParentAccount({ token, password }) {
  if (!token || typeof token !== 'string') {
    throw new AppError(400, 'invalid-argument', 'Missing activation token.');
  }
  if (!password || typeof password !== 'string' || password.length < 8) {
    throw new AppError(400, 'invalid-argument', 'Password must be at least 8 characters.');
  }

  const snap = await db.collection('parentActivations').where('token', '==', token).limit(1).get();
  if (snap.empty) {
    throw new AppError(404, 'not-found', 'This activation code is invalid, expired, or has already been used.');
  }
  const activationDoc = snap.docs[0];
  const a = activationDoc.data();

  if (a.activationStatus === 'Used') {
    throw new AppError(409, 'invalid-argument', 'This activation code has already been used.');
  }
  if (a.activationExpires && new Date(a.activationExpires).getTime() < Date.now()) {
    await activationDoc.ref.update({ activationStatus: 'Expired' });
    throw new AppError(410, 'invalid-argument', 'This activation code has expired.');
  }

  await auth.updateUser(a.parentRecordId, { password });
  await db.collection('users').doc(a.parentRecordId).update({ status: 'active' });
  await db.collection('parents').doc(a.parentRecordId).update({ status: 'Active', lastLogin: new Date().toISOString() }).catch(() => {});

  if (a.linkedStudentId) {
    await db.collection('students').doc(String(a.linkedStudentId)).update({
      parentUids: admin.firestore.FieldValue.arrayUnion(a.parentRecordId)
    });
  }

  await activationDoc.ref.update({
    activationStatus: 'Used',
    accountStatus: 'Active',
    token: null,
    usedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  return { email: a.email };
}

/* New (not in the original 5 functions, but implied by "Reset parent
   password" in the requested Admin API surface) — reuses the same temp
   password mechanism as createParentAccount's "already existed" branch. */
async function resetParentPassword({ uid }) {
  const profileSnap = await db.collection('users').doc(uid).get();
  if (!profileSnap.exists || profileSnap.data().role !== 'parent') {
    throw new AppError(404, 'not-found', 'That parent account was not found.');
  }
  const tempPassword = genTempPassword();
  await auth.updateUser(uid, { password: tempPassword });
  return { uid, tempPassword };
}

module.exports = {
  createTeacherAccount, activateTeacherAccount,
  createParentAccount, verifyParentActivation, activateParentAccount,
  resetParentPassword, genTempPassword
};
