# REST API v1 (browser / caregiver side)

Base `/api/v1`. JSON. Auth: `Authorization: Bearer <accessToken>` (from `/auth/login|register|refresh`). Errors: `{ "error": { "code", "message", "details?", "requestId" } }` — `message` is a sentence the app shows in a toast; `requestId` matches the server log line (also in the `X-Request-Id` header). Import `docs/MediGuardian.postman_collection.json` for runnable examples.

| method & path | purpose |
|---|---|
| `POST /auth/firebase` `{idToken, name?, phone?}` | Firebase ID token (email/password or Google sign-in) → `{user, accessToken, refreshToken, isNewUser}`; creates the account on first sign-in (201) |
| `POST /auth/refresh {refreshToken}` · `POST /auth/logout {refreshToken}` · `POST /auth/logout-all` | session. The refresh token is rotated on every refresh (store the new one) |
| `GET/PATCH /auth/me {name?, phone?}` · `DELETE /auth/account {idToken}` (ID token from a sign-in ≤ 5 min old) | account. Sign-up, password reset and password change happen in Firebase from the browser |
| `GET/POST /patients` · `GET/PATCH/DELETE /patients/:id` | patient profiles (`timezone`, `gracePeriodMinutes`, `missedAfterHours`, …) |
| `GET /patients/:id/boxes` · `GET /boxes` | boxes with derived connection state + config sync status |
| `POST /boxes/pair` `{boxCode,pairingCode,patientId \| newPatient,label?}` | link a box (QR or manual) |
| `POST /boxes/:id/unpair` | unpair + returns a one‑time transfer code |
| `GET /boxes/:id/history` · `GET /boxes/:id/config-history` · `PATCH /boxes/:id/drawers/:slot {name}` | history / drawer name |
| `POST /boxes/:id/command {command:"ring"\|"sync_config"\|"message"\|"stop_alarm", text?}` | real-time command to the physical box over Socket.IO; returns `{delivered}` |
| `GET /medicines?patientId=` · `POST /patients/:id/medicines` · `PATCH/DELETE /medicines/:id` | medicines + schedules (`schedule: {type:"times",times:["08:00"]}` or `{type:"interval",everyHours:8,anchor:"06:00"}`, `drawerId`) |
| `POST /medicines/:id/refill {amount}` · `POST /medicines/:id/adjust-stock {newQuantity}` · `GET /medicines/:id/stock-history` | stock ledger |
| `GET /patients/:id/today` · `GET /patients/:id/doses?from&to&status&medicineId` | dose instances (`status`, `hardwareDetected`, `intakeConfirmed`, `overdue`, `simulated`) |
| `POST /doses/:id/confirm {confirmedAt?,note?}` | human intake confirmation |
| `GET /dashboard` · `GET /reports?patientId&range=1D\|7D\|30D&from&to&medicineId&boxId&status` | combined dashboard / reports |
| `GET /notifications?unread=true` · `POST /notifications/read {id?}` | in‑app notifications |
| `POST /admin/boxes {count,label?}` (admin) · `POST /admin/boxes/:code/reissue-pairing` | manufacturing |
| `POST /dev/simulated-box` · `POST /dev/boxes/:id/simulate {scenario,slot}` (dev only) | simulator: `power_on, on_time_dose, late_dose, missed_dose, drawer_open_no_hand, refill_mode, duplicate_event, go_offline, reconnect` |
| `GET /api/v1/meta` · `GET /health` | capability flags / health check (`db: up\|down`) |

Browser Socket.IO (namespace `/`, path `/socket.io`, `auth: { token: accessToken }`): server → client events `device:event`, `device:status`, `device:config`, `dose:update`, `stock:changed`, `config:changed`, `notification:new`. Payloads contain ids only; reload data via REST (the web app does this automatically and after every reconnect).


Boxes use the separate Socket.IO namespace `/device` — see `DEVICE_API.md`.
