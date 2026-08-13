const { db } = require('../config/firebase');
const eventService = require('../services/eventService');

/* ── Alerts (was onAlertCreated) ──────────────────────────────────────── */
// POST /api/alerts  { title, desc, teacherId, sid, severity }
async function createAlert(req, res) {
  const result = await eventService.createAlert(req.body, req.user.uid);
  res.status(201).json(result);
}

// GET /api/alerts?sid=&teacherId=
async function listAlerts(req, res) {
  let q = db.collection('alerts').orderBy('createdAt', 'desc').limit(200);
  if (req.query.sid) q = q.where('sid', '==', req.query.sid);
  if (req.query.teacherId) q = q.where('teacherId', '==', req.query.teacherId);
  const snap = await q.get();
  res.json({ alerts: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
}

/* ── Notifications (was onNotificationCreated) ────────────────────────── */
// POST /api/notifications  { title, desc, teacherId?, forParents?, sid?, category? }
async function createNotification(req, res) {
  const result = await eventService.createNotification(req.body, req.user.uid);
  res.status(201).json(result);
}

// GET /api/notifications?teacherId=
async function listNotifications(req, res) {
  let q = db.collection('notifications').orderBy('createdAt', 'desc').limit(200);
  if (req.query.teacherId) q = q.where('teacherId', '==', req.query.teacherId);
  const snap = await q.get();
  res.json({ notifications: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
}

/* ── Parent requests (was onParentRequestCreated) ─────────────────────── */
// POST /api/parent-requests  { parentName, message, studentId }
async function createParentRequest(req, res) {
  const result = await eventService.createParentRequest(req.body, req.user.uid);
  res.status(201).json(result);
}

// GET /api/parent-requests
async function listParentRequests(req, res) {
  const snap = await db.collection('parentRequests').orderBy('createdAt', 'desc').limit(200).get();
  res.json({ requests: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
}

module.exports = {
  createAlert, listAlerts,
  createNotification, listNotifications,
  createParentRequest, listParentRequests
};
