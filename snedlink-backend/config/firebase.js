/* config/firebase.js
   ─────────────────────────────────────────────────────────────────────────
   Initializes the Firebase Admin SDK exactly once for the whole process.
   Two supported ways to supply credentials (pick ONE, via .env):

   1) FIREBASE_SERVICE_ACCOUNT_JSON — the full service account JSON as a
      single-line string (recommended for most Node hosts: Render, Railway,
      Fly.io, a VPS, etc. — paste it as one environment variable).

   2) GOOGLE_APPLICATION_CREDENTIALS — a filesystem path to the service
      account .json file (works well if your host lets you upload a file
      alongside the app, or for local development).

   Get the service account file from:
   Firebase Console → Project Settings → Service Accounts → Generate new
   private key. Treat it as a secret — never commit it, never expose it to
   the frontend (it is server-only, unlike the public web apiKey).
   ───────────────────────────────────────────────────────────────────────── */

const admin = require('firebase-admin');

let credential;

if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  credential = admin.credential.cert(serviceAccount);
} else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  // admin.initializeApp() below will pick this up automatically from the
  // environment variable, so no explicit credential object is needed.
  credential = admin.credential.applicationDefault();
} else {
  throw new Error(
    'Missing Firebase credentials. Set FIREBASE_SERVICE_ACCOUNT_JSON (the full ' +
    'service account JSON as one line) or GOOGLE_APPLICATION_CREDENTIALS ' +
    '(a path to the service account file) in your .env.'
  );
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential,
    // Only needed if you use Firebase Storage from the backend (e.g. for
    // moving student photos off Firestore per the README's known-limitations
    // note). Safe to leave set even if unused.
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || undefined
  });
}

const db = admin.firestore();
const auth = admin.auth();
const messaging = admin.messaging();
const storage = admin.storage();

module.exports = { admin, db, auth, messaging, storage };
