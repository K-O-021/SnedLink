const { db, auth, admin } = require('../config/firebase');
const accountService = require('../services/accountService');
const { AppError } = require('../utils/AppError');

/* ── createTeacherAccount ─────────────────────────────────────────────── */
// POST /api/admin/teachers  { name, email }
// (no password: this now creates a PENDING account + activation token —
// see services/accountService.js. Response includes activationToken so
// admin.html can show/share it with the teacher.)
async function createTeacherAccount(req, res) {
  const { name, email, section, phone } = req.body;
  const result = await accountService.createTeacherAccount({ name, email, section, phone }, req.user.uid);
  res.status(201).json(result);
}

/* ── createParentAccount ──────────────────────────────────────────────── */
// POST /api/admin/parents  { name, email, studentId, relationship? }
// (no password: creates a PENDING account + activation token, same as
// teachers — see services/accountService.js. Response includes
// activationToken so admin.html can show/share it with the parent.)
async function createParentAccount(req, res) {
  const { name, email, studentId, relationship } = req.body;
  const result = await accountService.createParentAccount({ name, email, studentId, relationship }, req.user.uid);
  res.status(201).json(result);
}

// POST /api/admin/parents/:uid/reset-password
async function resetParentPassword(req, res) {
  const result = await accountService.resetParentPassword({ uid: req.params.uid });
  res.json(result);
}

/* ── Manage teachers ──────────────────────────────────────────────────── */
// GET /api/admin/teachers
async function listTeachers(req, res) {
  const snap = await db.collection('users').where('role', '==', 'teacher').get();
  res.json({ teachers: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
}

// PATCH /api/admin/teachers/:uid  { name?, status? }
async function updateTeacher(req, res) {
  const allowed = ['name', 'status'];
  const updates = {};
  allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
  await db.collection('users').doc(req.params.uid).update(updates);
  if (updates.status === 'disabled') await auth.updateUser(req.params.uid, { disabled: true });
  if (updates.status === 'active') await auth.updateUser(req.params.uid, { disabled: false });
  res.json({ ok: true });
}

// DELETE /api/admin/teachers/:uid
async function deleteTeacher(req, res) {
  await auth.deleteUser(req.params.uid);
  await db.collection('users').doc(req.params.uid).delete();
  res.json({ ok: true });
}

/* ── Manage parents ───────────────────────────────────────────────────── */
// GET /api/admin/parents
async function listParents(req, res) {
  const snap = await db.collection('users').where('role', '==', 'parent').get();
  res.json({ parents: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
}

// DELETE /api/admin/parents/:uid
async function deleteParent(req, res) {
  await auth.deleteUser(req.params.uid);
  await db.collection('users').doc(req.params.uid).delete();
  res.json({ ok: true });
}

/* ── Manage students ──────────────────────────────────────────────────── */
// GET /api/admin/students
async function listStudents(req, res) {
  const snap = await db.collection('students').get();
  res.json({ students: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
}

// POST /api/admin/students  { ...studentFields, teacherId }
async function createStudent(req, res) {
  const docRef = await db.collection('students').add({
    ...req.body,
    parentUids: [],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: req.user.uid
  });
  res.status(201).json({ id: docRef.id });
}

// PATCH /api/admin/students/:sid
async function updateStudent(req, res) {
  await db.collection('students').doc(req.params.sid).update(req.body);
  res.json({ ok: true });
}

// DELETE /api/admin/students/:sid
async function deleteStudent(req, res) {
  await db.collection('students').doc(req.params.sid).delete();
  res.json({ ok: true });
}

module.exports = {
  createTeacherAccount, createParentAccount, resetParentPassword,
  listTeachers, updateTeacher, deleteTeacher,
  listParents, deleteParent,
  listStudents, createStudent, updateStudent, deleteStudent
};
