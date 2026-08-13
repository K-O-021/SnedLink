# SNED-LINK+ Backend (Express.js)

Replaces Firebase Cloud Functions with a standalone Express.js API. Firestore,
Firebase Authentication, and (optionally) Firebase Storage are unchanged —
only *where the server-side code runs* has changed.

## What actually moved, and what didn't

Before writing any code, the frontend was checked for what actually calls a
Cloud Function today:

- **`createTeacherAccount`** and **`createParentAccount`** were called via
  `httpsCallable()` from `admin.html`. → now `POST /api/admin/teachers` and
  `POST /api/admin/parents`.
- **`onAlertCreated`, `onNotificationCreated`, `onParentRequestCreated`**
  were Firestore *triggers* — the frontend wrote directly to the `alerts` /
  `notifications` / `parentRequests` collections via the client SDK, and
  Firebase reacted automatically. Express can't react to a client-side
  Firestore write, so these became **`POST /api/alerts`, `POST
  /api/notifications`, `POST /api/parent-requests`** — each does the
  Firestore write *and* sends the push in one request. Net effect for users
  is identical; the frontend just needs to call `fetch()` instead of
  `addDoc()` for these 3 collections specifically (see Frontend Migration
  Guide below).
- **Everything else — students, behavior logs, IEPs, assessments, reports,
  dashboards — was never behind a Cloud Function.** The frontend reads/writes
  those directly via the Firestore Web SDK, protected by `firestore.rules`.
  Nothing about that requires Express, so per "do not redesign," it's left
  untouched. Optional passthrough routes exist for those 4 collections
  (`/api/behavior-logs`, `/api/ieps`, `/api/assessments`, `/api/reports`) if
  you want to eventually move them behind the API too, but adopting them is
  not required for the migration to work.
- **AI recommendations / IEP-insight scoring** are computed client-side from
  existing Firestore data today (per the original `SETUP_README.md`'s "Known
  limitations" section) — that logic wasn't touched, since connecting it to
  a real backend model is a separate project, not part of this migration.

## Project structure

```
server.js                  app entry point
config/
  firebase.js               Admin SDK init
  env.js                     env var loading
middleware/
  auth.js                    verifyToken, requireRole
  rateLimiter.js              global + account-creation limiters
  errorHandler.js            404 + centralized error handler
controllers/
  authController.js
  adminController.js
  eventController.js         alerts / notifications / parentRequests
  recordsController.js       generic CRUD factory (optional collections)
  healthController.js
services/
  accountService.js          createTeacherAccount / createParentAccount / resetParentPassword
  eventService.js             Firestore write + push, replacing the 3 triggers
  pushService.js               FCM sending + dead-token cleanup (ported as-is)
routes/
  authRoutes.js, adminRoutes.js, eventRoutes.js, recordsRoutes.js, healthRoutes.js
validators/
  index.js                    express-validator rule sets
utils/
  AppError.js, asyncHandler.js, logger.js
logs/
  error.log                   written at runtime
.env.example
```

## Install & run locally

```bash
npm install
cp .env.example .env
# edit .env: paste your service account JSON into FIREBASE_SERVICE_ACCOUNT_JSON
npm run dev        # nodemon, auto-restart
# or
npm start
```

Visit `http://localhost:8080/health` — you should see `{ "status": "ok" }`.

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `NODE_ENV` | no | `development` or `production` |
| `PORT` | no | defaults to 8080 |
| `CORS_ORIGINS` | yes in production | comma-separated allowed frontend origins |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | one of these two | full service account JSON, one line |
| `GOOGLE_APPLICATION_CREDENTIALS` | one of these two | path to service account file |
| `FIREBASE_STORAGE_BUCKET` | no | only if using Storage |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX` | no | global API rate limit |
| `LOG_LEVEL` | no | morgan format string |

## Security

- **Firebase ID Token verification** on every protected route (`middleware/auth.js`)
  — the frontend sends `Authorization: Bearer <idToken>`.
- **Role-based authorization** via `requireRole('admin')` etc., mirroring the
  old `requireAdmin()` check.
- **Helmet** for HTTP security headers.
- **CORS** locked to your explicit `CORS_ORIGINS` list in production.
- **express-validator** on every write endpoint that takes user input.
- **Rate limiting**: a global limiter on all `/api` routes, plus a tighter
  limiter specifically on account-creation endpoints.
- **Centralized error handling** — internal error details are logged
  server-side (`logs/error.log`) but never leaked to the client; client
  errors return a short, consistent `{ error: { code, message } }` shape.
- Firebase Admin credentials are never exposed to the frontend — only the
  public web `apiKey`/config stays client-side, same as before.

## API reference

All endpoints are prefixed with your deployed backend URL. All `/api/*`
routes except none require `Authorization: Bearer <Firebase ID token>`.

### Health

| Method | Path | Auth | Body |
|---|---|---|---|
| GET | `/health` | none | — |

### Auth

| Method | Path | Auth | Body |
|---|---|---|---|
| GET | `/api/auth/me` | any signed-in user | — |
| PATCH | `/api/auth/me` | any signed-in user | `{ name?, notificationPrefs?, photoUrl? }` |

### Admin (all require role `admin`)

| Method | Path | Body |
|---|---|---|
| POST | `/api/admin/teachers` | `{ name, email, password }` |
| GET | `/api/admin/teachers` | — |
| PATCH | `/api/admin/teachers/:uid` | `{ name?, status? }` |
| DELETE | `/api/admin/teachers/:uid` | — |
| POST | `/api/admin/parents` | `{ name, email, studentId }` |
| POST | `/api/admin/parents/:uid/reset-password` | — |
| GET | `/api/admin/parents` | — |
| DELETE | `/api/admin/parents/:uid` | — |
| GET | `/api/admin/students` | — |
| POST | `/api/admin/students` | `{ ...studentFields, teacherId }` |
| PATCH | `/api/admin/students/:sid` | `{ ...fields }` |
| DELETE | `/api/admin/students/:sid` | — |

### Alerts / Notifications / Parent Requests

| Method | Path | Auth | Body |
|---|---|---|---|
| POST | `/api/alerts` | teacher or admin | `{ title, desc, teacherId, sid, severity }` |
| GET | `/api/alerts?sid=&teacherId=` | any signed-in user | — |
| POST | `/api/notifications` | teacher or admin | `{ title, desc, teacherId?, forParents?, sid?, category? }` |
| GET | `/api/notifications?teacherId=` | any signed-in user | — |
| POST | `/api/parent-requests` | parent | `{ message, studentId, parentName }` |
| GET | `/api/parent-requests` | admin | — |

### Optional records passthrough (behavior logs / IEPs / assessments / reports)

Same shape for all four — replace `:collection` with `behavior-logs`, `ieps`,
`assessments`, or `reports`:

| Method | Path | Auth |
|---|---|---|
| GET | `/api/:collection?sid=&teacherId=` | any signed-in user |
| GET | `/api/:collection/:id` | any signed-in user |
| POST | `/api/:collection` | teacher or admin |
| PATCH | `/api/:collection/:id` | teacher or admin |
| DELETE | `/api/:collection/:id` | teacher or admin |

### Error codes

| HTTP status | `code` | Meaning |
|---|---|---|
| 400 | `invalid-argument` | Validation failed — see `message` |
| 401 | `unauthenticated` / `invalid-token` | Missing/expired/invalid Firebase ID token |
| 403 | `permission-denied` / `account-disabled` / `no-profile` | Signed in, but not authorized |
| 404 | `not-found` | Resource doesn't exist |
| 429 | `rate-limited` | Too many requests |
| 500 | `internal` | Unexpected server error (details logged server-side only) |

## Frontend migration guide

Two changes are needed in the HTML files, both localized:

**1. Replace the 2 `httpsCallable` calls with `fetch()`:**

```js
// OLD (admin.html, ~line 1677)
const fn = httpsCallable(slFunctions, 'createTeacherAccount');
const result = await fn({ name, email, password });

// NEW
const token = await auth.currentUser.getIdToken();
const res = await fetch(`${BACKEND_URL}/api/admin/teachers`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({ name, email, password })
});
if (!res.ok) throw new Error((await res.json()).error.message);
const result = await res.json();
```

Same pattern for `createParentAccount` → `POST /api/admin/parents`.

**2. Replace direct `addDoc()` calls to `alerts` / `notifications` /
`parentRequests` with `fetch()` to the matching endpoint** (find these in
`teacher_portal.html` / `admin.html` / `parent_portal.html` wherever an alert,
notification, or parent request is raised):

```js
// OLD
await addDoc(collection(db, 'alerts'), { title, desc, teacherId, sid, severity });

// NEW
const token = await auth.currentUser.getIdToken();
await fetch(`${BACKEND_URL}/api/alerts`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({ title, desc, teacherId, sid, severity })
});
```

Add a single constant near the top of each portal file:
```js
const BACKEND_URL = "https://snedlink-backend.onrender.com";; // no trailing slash
```

Nothing else in the 3 portal files needs to change — student management,
behavior logs, IEPs, assessments, and reports keep using the Firestore SDK
exactly as they do today.

## Deployment

### Backend — any Node.js host (Render used as the example)

1. Push this `snedlink-backend/` folder to its own GitHub repo (keep it
   separate from the frontend repo).
2. Render → New → Web Service → connect the repo.
3. Build command: `npm install`. Start command: `npm start`.
4. Add environment variables from `.env.example` in Render's dashboard —
   paste your service account JSON into `FIREBASE_SERVICE_ACCOUNT_JSON` as
   one line, and set `CORS_ORIGINS` to your Cloudflare Pages URL.
5. Deploy. Note the resulting URL (e.g. `https://snedlink-backend.onrender.com`)
   — that's your `BACKEND_URL` for the frontend.
6. Hit `https://<your-backend>/health` to confirm it's live.

(Railway or Fly.io work the same way — connect repo, set env vars, deploy.)

### Frontend — Cloudflare Pages

1. Push `index.html`, `teacher_portal.html`, `admin.html`,
   `parent_portal.html`, `firebase-messaging-sw.js`, the 3
   `manifest-*.json` files, and `firestore.rules` to a repo (or a
   `frontend/` folder in the same repo).
2. Cloudflare dashboard → Workers & Pages → Create → Pages → connect repo.
3. Framework preset: **None** (static HTML). Build command: leave blank.
   Build output directory: `/` (or `frontend` if nested).
4. Deploy. Cloudflare gives you a `*.pages.dev` URL.
5. Add that URL to the backend's `CORS_ORIGINS` env var and redeploy the
   backend so it accepts requests from it.
6. Publish Firestore rules the same way as before — Firebase Console →
   Firestore Database → Rules → paste `firestore.rules` → Publish (Cloud
   Functions are no longer deployed, but Firestore/Auth/Rules still live in
   the Firebase project itself, unchanged).

## Testing

A Postman collection is included at `postman/SNEDLINK.postman_collection.json`.
Import it, set the collection variables `baseUrl` and `idToken` (get `idToken`
by signing in through the frontend and running
`await firebase.auth().currentUser.getIdToken()` in the browser console), and
run requests directly.

Manual smoke test after deploying:
1. `GET /health` → `200 { status: "ok" }`.
2. Sign into `admin.html` → `GET /api/auth/me` (via Postman, using that
   session's ID token) → returns your admin profile.
3. `POST /api/admin/teachers` with a fresh email → `201` with a `uid`, and a
   new Firebase Auth user + `users/{uid}` doc appears.
4. `POST /api/alerts` → `201`, a new `alerts` doc appears, and the linked
   teacher/parent devices receive a push (test with a device that has
   granted notification permission and registered an FCM token).
