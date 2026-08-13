# SNED-LINK+ — Full Project (Organized)

Two independently-deployed pieces, matching your original repo split:

```
sned-link-project/
├── backend/     → Node/Express API (deploy to Render/Railway/Fly/etc.)
└── frontend/    → static HTML portals (deploy to Cloudflare Pages/Firebase Hosting/etc.)
```

## ⚠️ Before you do anything else

1. **Rotate your Firebase service account key.** The key you uploaded earlier
   in this conversation should be treated as compromised — go to Firebase
   Console → Project Settings → Service Accounts, revoke the old one, and
   generate a fresh one. It is **deliberately not included** in this package.
   Paste the new key into `backend/.env` (copy from `.env.example` first) —
   never into a chat, never into a committed file.
2. **Change the hardcoded admin password** in `backend/bootstrap-admin.js`
   and `backend/set-admin-password.js` before deploying — `admin.07@gmail.com`
   / `admin@07` is currently public knowledge if this repo is ever pushed
   anywhere.

## What's in each folder

### `backend/`
Every file matches the structure documented in its own `backend/README.md`.
Recently changed, relative to what you originally uploaded:
- **`services/accountService.js`** — `createParentAccount` now defers
  activation (token/QR self-service, no admin-visible temp password) instead
  of creating the account immediately, mirroring `createTeacherAccount`
  exactly. New `verifyParentActivation` + `activateParentAccount` functions.
- **`controllers/activationController.js`**, **`routes/activationRoutes.js`**
  — added the two new parent-activation endpoints.
- **`controllers/adminController.js`** — updated to match the new
  `createParentAccount` response shape.
- **`server.js`**, **`validators/index.js`** — wired up the new routes/rules.

Everything else (`config/`, `middleware/`, other `controllers/`, `services/`,
`routes/`, `utils/`) is unchanged from what you uploaded.

Not included, on purpose: `.env` (only `.env.example`), the service account
JSON key, and `node_modules/` — install with `npm install` after copying
`.env.example` to `.env` and filling it in.

### `frontend/`
The three portals plus their supporting files. Recently changed:
- **`admin.html`, `teacher_portal.html`, `parent_portal.html`** — grade
  levels are now 7–12 throughout; account creation, activation, alerts, and
  notifications all call the real backend above (`slApiCall`) instead of
  writing to Firestore directly, so pushes/emails/activation actually work
  once the backend is deployed and reachable.
- **`firestore.rules`** — unchanged from your original admin-only model for
  `teachers/`, `parents/`, `teacherActivations/`, `parentActivations/`, etc.
  (an earlier draft of this session briefly loosened these rules to work
  around what looked like a dead backend; that's been fully reverted now
  that the real backend — with Admin SDK access, which correctly bypasses
  these rules server-side — is back in the loop).

## Deploy order

1. Deploy `backend/` first, confirm `GET /health` returns `200`.
2. Update `BACKEND_URL` inside `admin.html`, `teacher_portal.html`, and
   `parent_portal.html` if your backend's URL differs from
   `https://snedlink-backend.onrender.com`.
3. Deploy `frontend/` (static hosting).
4. Publish `frontend/firestore.rules` via Firebase Console →
   Firestore Database → Rules.
5. Add your frontend's deployed URL to the backend's `CORS_ORIGINS` env var
   and redeploy the backend.

Full detail on env vars, API reference, and troubleshooting is in
`backend/README.md`.
