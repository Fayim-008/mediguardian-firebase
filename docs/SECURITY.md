# Security & privacy notes

| area | what is implemented | where |
|---|---|---|
| Passwords | Argon2id (19 MiB, t=2); never stored/logged; min 8 / max 128 chars; equal‑timing login for unknown emails | `lib/crypto.js`, `authService.js` |
| Identity | Firebase Authentication (email/password + Google). Passwords never reach this server. The backend verifies every Firebase ID token with firebase-admin (signature, project, expiry; revocation when a service account is configured) | `lib/firebaseAdmin.js`, `services/authService.js` |
| Sessions | 15‑min HS256 access token (memory only in the browser) + 30‑day **rotating** refresh token returned in the JSON body and kept in `localStorage` by the app (the frontend and API live on different sites, where cookies would be third-party and often blocked). Only a hash is stored server-side; reuse of an old refresh token revokes every session. Trade-off: an XSS bug could read the refresh token, so keep the CSP/helmet defaults and never render untrusted HTML | `authService.js`, `routes/auth.js` |
| Authorization | Every patient/box/medicine route resolves access from the **database** using the authenticated user id (`caregiver_patients`, `boxes.owner_user_id`). A client‑supplied patient id is never trusted. Inaccessible resources return **404** (not 403) so ids can't be probed | `middleware/auth.js` |
| Device auth | Separate `mgd_…` secret, SHA‑256 hashed, revocable, usable only on `/device/*` for its own box | `requireDevice` |
| QR / pairing | QR holds only `box_code` + a one‑time pairing code (no patient data, no device secret). Pairing code: ≥ 60 bits random, hashed, expiring (default 14 days), single use, only newest valid; all failures return the same message; failed attempts are audited and rate‑limited. Unpair issues a fresh 72 h transfer code | `boxService.js` |
| Real‑time | Socket.IO handshake requires a valid access token; each user is in their own room; events are emitted only to caregivers of that patient and carry ids only; clients re‑fetch through the authorised REST API | `lib/realtime.js` |
| Input | zod validation on every route (bodies, params, queries); Mongoose schemas + `strictQuery` (unknown filter fields are stripped; ids validated as UUIDs before they reach a query); JSON body limit 200 kB | `routes/*` |
| Abuse | Rate limits: auth 20/15 min/IP, API 300/min, device 240/min/device (per instance, in‑memory) | `app.js` |
| Transport/headers | Helmet defaults (CSP, HSTS in prod, frame protection); CORS limited to `FRONTEND_URL`(+extras) with credentials; HTTPS must be terminated by the host/proxy; `TRUST_PROXY` for correct client IPs | `app.js`, `config.js` |
| Secrets | Env vars only; `.env` git‑ignored; production refuses to start without a ≥32‑char `AUTH_SECRET`; no secrets in Vite variables; logger redacts credential fields | `config.js`, `lib/logger.js` |
| Errors | Safe messages; stack traces never sent; 500s are logged server‑side only | `app.js` |
| Audit | register/login failures/pair/unpair/medicine/box registration/config acks/account deletion | `lib/audit.js` |
| Dev tools | `/api/v1/dev/*` only when `ENABLE_DEV_TOOLS=true` (default off in production) and only on boxes flagged `is_simulated` | `routes/dev.js` |

**CSRF:** no cookies are used at all; every call needs the `Authorization: Bearer` header or a refresh token in the body, so a forged cross‑site form cannot act. CORS allows only `FRONTEND_URL` (+ `EXTRA_CORS_ORIGINS`).

**Devices:** each box has its own `mgd_…` token (only its SHA‑256 is stored). It works only on the HTTP device API and the `/device` Socket.IO namespace, never on user endpoints. Use `wss://` (USE_TLS 1) in production.

## Data retention & deletion
Data is kept until a caregiver deletes it. *Delete patient* and *Delete account* (Settings) remove data as described in `DATABASE.md`. `audit_logs` and `box_ownership_history` keep non‑personal event records. Recommended for a real deployment: automated daily DB backups with 30‑day retention, a documented restore test, and a written privacy policy covering health data in your jurisdiction.

## Known limitations (be honest with users)
* Rate limiting is per server instance (use a shared store if you scale out).
* No MFA, no email verification (no mail provider yet), password‑reset links cannot be delivered until one is configured.
* Medication data is health‑related: before real patients use this, get a security review and check local regulations (e.g. HIPAA/GDPR‑type rules). This project is not a medical device.

**Account linking:** an existing account is only linked to a new Firebase identity when Firebase reports the email as verified (Google emails always are), so nobody can take over an account by signing up with someone else's address. Deleting an account requires a Firebase sign-in from the last 5 minutes.
