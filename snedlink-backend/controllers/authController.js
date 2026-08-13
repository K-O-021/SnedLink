const { db } = require('../config/firebase');

// GET /api/auth/me — replaces reading users/{uid} client-side after login.
async function getCurrentUser(req, res) {
  res.json({ user: req.user, profile: req.userProfile });
}

// PATCH /api/auth/me — self-service profile edits (name, notification prefs).
// Deliberately does NOT allow role/status changes — only an admin route can.
async function updateOwnProfile(req, res) {
  const allowed = ['name', 'notificationPrefs', 'photoUrl'];
  const updates = {};
  allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

  await db.collection('users').doc(req.user.uid).update(updates);
  const snap = await db.collection('users').doc(req.user.uid).get();
  res.json({ profile: { id: snap.id, ...snap.data() } });
}

module.exports = { getCurrentUser, updateOwnProfile };
