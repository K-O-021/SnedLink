/* middleware/auth.js
   ─────────────────────────────────────────────────────────────────────────
   Replaces what `request.auth.uid` gave you for free inside a Firebase
   Cloud Function `onCall`. The frontend must now attach a Firebase ID
   token itself:

     const token = await firebase.auth().currentUser.getIdToken();
     fetch(url, { headers: { Authorization: `Bearer ${token}` } });

   verifyToken checks that token, loads the caller's users/{uid} profile
   (for role + status), and attaches both to req.user / req.userProfile.
   requireRole(...) then gates specific routes the same way requireAdmin()
   did in the old functions/index.js.
   ───────────────────────────────────────────────────────────────────────── */

const { auth, db } = require('../config/firebase');
const { AppError } = require('../utils/AppError');

async function verifyToken(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const match = header.match(/^Bearer (.+)$/);
    if (!match) {
      throw new AppError(401, 'unauthenticated', 'Missing or malformed Authorization header.');
    }

    const decoded = await auth.verifyIdToken(match[1]);
    const profileSnap = await db.collection('users').doc(decoded.uid).get();

    if (!profileSnap.exists) {
      throw new AppError(403, 'no-profile', 'No user profile found for this account.');
    }

    const profile = profileSnap.data();
    if (profile.status && profile.status !== 'active') {
      throw new AppError(403, 'account-disabled', 'This account is not active.');
    }

    req.user = { uid: decoded.uid, email: decoded.email };
    req.userProfile = { id: profileSnap.id, ...profile };
    next();
  } catch (err) {
    if (err instanceof AppError) return next(err);
    next(new AppError(401, 'invalid-token', 'Your session is invalid or has expired. Please sign in again.'));
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.userProfile || !roles.includes(req.userProfile.role)) {
      return next(new AppError(403, 'permission-denied', `This action requires one of: ${roles.join(', ')}.`));
    }
    next();
  };
}

module.exports = { verifyToken, requireRole };
