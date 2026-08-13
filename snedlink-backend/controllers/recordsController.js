/* controllers/recordsController.js
   ─────────────────────────────────────────────────────────────────────────
   OPTIONAL layer. behaviorLogs, ieps, assessments, and reports never went
   through a Cloud Function in the original app — the frontend reads/writes
   them directly via the Firestore Web SDK, protected by firestore.rules.
   Nothing forces you to migrate them off that path, and per the "do not
   redesign" instruction, the safest move is to leave them exactly as they
   are today.

   This file exists so you HAVE the option to route them through Express
   instead (e.g. if you later want server-side validation, audit logging,
   or to eventually retire direct Firestore access from the client). It's
   a small generic CRUD factory rather than 4 near-identical files.
   ───────────────────────────────────────────────────────────────────────── */

const { db, admin } = require('../config/firebase');
const { AppError } = require('../utils/AppError');

function makeCrudController(collectionName) {
  return {
    async list(req, res) {
      let q = db.collection(collectionName).orderBy('createdAt', 'desc').limit(500);
      if (req.query.sid) q = q.where('sid', '==', req.query.sid);
      if (req.query.teacherId) q = q.where('teacherId', '==', req.query.teacherId);
      const snap = await q.get();
      res.json({ [collectionName]: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
    },

    async get(req, res) {
      const snap = await db.collection(collectionName).doc(req.params.id).get();
      if (!snap.exists) throw new AppError(404, 'not-found', 'Record not found.');
      res.json({ id: snap.id, ...snap.data() });
    },

    async create(req, res) {
      const docRef = await db.collection(collectionName).add({
        ...req.body,
        createdBy: req.user.uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      res.status(201).json({ id: docRef.id });
    },

    async update(req, res) {
      await db.collection(collectionName).doc(req.params.id).update({
        ...req.body,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: req.user.uid
      });
      res.json({ ok: true });
    },

    async remove(req, res) {
      await db.collection(collectionName).doc(req.params.id).delete();
      res.json({ ok: true });
    }
  };
}

module.exports = { makeCrudController };
