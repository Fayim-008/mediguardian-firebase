# MediGuardian — Caring Beyond Distance

Smart 4-drawer medicine box (ESP32) + caregiver web app. Three separate parts:

```
 ┌───────────────────────┐   REST (HTTPS) + Socket.IO "/"    ┌──────────────────────────────┐      ┌──────────┐
 │  frontend/  (React)   │ ────────────────────────────────▶ │  backend/  (Node.js)         │ ───▶ │ MongoDB  │
 │  Vite, responsive     │ ◀──── live updates ────────────── │  Express + Socket.IO         │      └──────────┘
 │  runs on :5173        │                                   │  runs on :4000               │
 └───────────────────────┘                                   │                              │
                                                             │  Socket.IO "/device"  ◀──────┼──── ESP32 box
 ┌───────────────────────┐                                   │  (real time, both ways)      │     esp32-firmware/
 │ simulator/ (optional) │ ── same protocol as the ESP32 ──▶ └──────────────────────────────┘
 └───────────────────────┘
```

| folder | what | tech |
|---|---|---|
| `frontend/` | caregiver website (phones, tablets, laptops) | React 18, Vite, Firebase Auth (email + Google), react-toastify, Recharts, socket.io-client |
| `backend/` | API + real-time server + reminders worker | Node.js ≥ 20, Express 5, Socket.IO 4, Mongoose 8, firebase-admin |
| `esp32-firmware/MediGuardianBox/` | box firmware | Arduino (ESP32), WebSockets/SocketIOclient, ArduinoJson 7 |
| `simulator/` | fake box for testing without hardware | Node.js |
| `docs/` | API, device protocol, database, wiring, security | — |

---

## 1. Install the tools (once)

| tool | download | check |
|---|---|---|
| Node.js **22 LTS** (or 20 LTS) | https://nodejs.org | `node -v` |
| MongoDB Community Server **7 or 8** (choose "Install as a Service") — *or* a free MongoDB Atlas cluster | https://www.mongodb.com/try/download/community · https://www.mongodb.com/atlas | `mongosh --eval "db.runCommand({ping:1})"` |
| MongoDB Compass (optional GUI) | installed with MongoDB, or separately | — |
| Arduino IDE 2.x (for the box) | https://www.arduino.cc/en/software | — |

> Atlas instead of local MongoDB: create a free cluster → *Database Access*: add a user → *Network Access*: add your IP →
> *Connect → Drivers* → copy the `mongodb+srv://…` string into `MONGODB_URI` (add `/mediguardian` before the `?`).

---

## 2. Firebase setup (sign-up, login, Google login) — once

1. https://console.firebase.google.com → **Add project** (Google Analytics not needed).
2. **Build → Authentication → Get started → Sign-in method**: enable **Email/Password** and **Google** (choose a support email, Save).
3. **Authentication → Settings → Authorized domains**: `localhost` is already there. Add your LAN IP (e.g. `192.168.1.23`) for phone testing and your production domain later.
4. **Project settings (gear) → General → Your apps → Web (`</>`)** → register an app → copy `apiKey`, `authDomain`, `projectId`, `appId` into `frontend/.env`.
5. **Project settings → Service accounts → Generate new private key** → save the JSON as `backend/firebase-service-account.json` (never commit it) and set `FIREBASE_PROJECT_ID` + `FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json` in `backend/.env`.
6. Optional: **Authentication → Templates** → change the sender name / language of the verification and password-reset emails.

`FIREBASE_PROJECT_ID` (backend) and `VITE_FIREBASE_PROJECT_ID` (frontend) must be the same project.

## 3. Backend (terminal 1)

```powershell
cd mediguardian\backend
npm install
copy .env.example .env          # macOS/Linux: cp .env.example .env
```
Edit `backend\.env` — the defaults work for a local setup:
```
MONGODB_URI=mongodb://127.0.0.1:27017/mediguardian
FRONTEND_URL=http://localhost:5173
AUTH_SECRET=        # empty is OK in development; REQUIRED (>= 32 chars) in production
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
```
Then:
```powershell
npm run dev         # starts the API on http://localhost:4000 (auto-restarts when you edit code)
```
Check: open http://localhost:4000/health → `{"ok":true,"db":"up","firebase":"ready",…}`.
The log also prints the LAN address the ESP32 must use, e.g. `ESP32 should use SERVER_HOST = 192.168.1.23`.

## 4. Frontend (terminal 2)

```powershell
cd mediguardian\frontend
npm install
copy .env.example .env          # set VITE_API_URL=http://localhost:4000 and the VITE_FIREBASE_* values (step 2.4)
npm run dev                     # http://localhost:5173
```
Open **http://localhost:5173** → **Create Account** (email + password) or **Sign up with Google**.
To use the admin screens (register boxes from the browser): `cd backend` → `npm run make-admin -- you@example.com`, then log out and in again.

> Both at once from the root folder: `npm run install:all` then `npm run dev` (runs backend + frontend together).

---

## 5. Try everything without hardware

**A. Built-in simulator (buttons in the UI)**
Settings → turn **Simulator ON** → My Boxes → **Add simulated box** → pick/create a patient → Set Medicine → put a medicine in a drawer → use *Dose on time*, *Late dose*, *Missed dose*, *Refill mode*, … on the box card.

**B. Socket.IO fake box (exact ESP32 protocol)** — terminal 3:
```powershell
cd mediguardian\backend
npm run register-box -- --count 1          # prints box code, pairing code, device token (mgd_...) + QR in backend\qr-out\
cd ..\simulator
npm install
node socket-device.js http://localhost:4000 mgd_PASTE_TOKEN
```
In the web app: My Boxes → **Add Box** → enter the box code + pairing code (or scan the QR PNG with the camera) → choose a patient.
The fake box receives its settings instantly. Press `1`–`4` in terminal 3 to "take medicine" from a drawer and watch the
dashboard update live. **Ring box** in the app prints `COMMAND from caregiver` in the terminal.

---

## 6. Real ESP32 box

Full wiring table, libraries and test procedure: **`docs/ESP32_INTEGRATION.md`**. Short version:

1. Arduino IDE → Boards Manager: **esp32 by Espressif Systems**. Library Manager: **WebSockets** (Markus Sattler, ≥ 2.6.1), **ArduinoJson** (7.x), **LiquidCrystal I2C** (Frank de Brabander).
2. `npm run register-box -- --count 1` (in `backend/`) → copy the `mgd_…` device token.
3. Edit `esp32-firmware/MediGuardianBox/secrets.h`:
   ```c
   #define WIFI_SSID     "YourWifi"            // 2.4 GHz
   #define WIFI_PASSWORD "YourPassword"
   #define SERVER_HOST   "192.168.1.23"        // your PC's IPv4 from `ipconfig` — never "localhost"
   #define SERVER_PORT   4000
   #define USE_TLS       0
   #define DEVICE_TOKEN  "mgd_..."
   ```
4. Check the pins in `config.h` match your wiring. Board **ESP32 Dev Module** → Upload → Serial Monitor 115200.
5. Allow port 4000 through Windows Firewall (PowerShell **as Administrator**, once):
   ```powershell
   New-NetFirewallRule -DisplayName "MediGuardian API 4000" -Direction Inbound -Protocol TCP -LocalPort 4000 -Action Allow -Profile Private
   ```
6. Pair the box in the web app (QR from `backend\qr-out\`). Serial Monitor shows `[io] joined /device` and `[config] vN applied`.

What happens in real time:
* caregiver saves a medicine → server pushes `config:changed` → box downloads the new alarm list in ~1 s
* box detects a removal (reed open + IR hand) → `events` → dose marked on time/late → dashboard updates live
* reminders (LED + LCD + buzzer, 3× every 30 min) run **on the box**, so they keep working without Wi-Fi; events are queued in flash and sent when it reconnects.

---

## 7. Test the responsive layout on your phone
1. Phone and PC on the same Wi-Fi. Find the PC IP (`ipconfig`), e.g. `192.168.1.23`.
2. `frontend\.env`: `VITE_API_URL=http://192.168.1.23:4000`
3. `backend\.env`: `EXTRA_CORS_ORIGINS=http://192.168.1.23:5173`
4. Add `192.168.1.23` to Firebase **Authorized domains** (otherwise Google login says unauthorized-domain).
5. Restart both, allow port **5173** in the firewall too (same command, `-LocalPort 5173`), open `http://192.168.1.23:5173` on the phone.
(Camera QR scanning needs HTTPS or localhost — on the phone use manual code entry, or deploy with HTTPS.)

---

## 8. Deploy (frontend and backend on different servers)

**Database:** MongoDB Atlas (free M0 is fine to start).

**Backend** — any Node host with WebSocket support (Render *Web Service*, Railway, Fly.io, a VPS with Nginx …):
* Root directory `backend`, build `npm install`, start `npm start`
* Environment:
  ```
  NODE_ENV=production
  MONGODB_URI=mongodb+srv://...
  AUTH_SECRET=<node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))">
  FRONTEND_URL=https://your-frontend.netlify.app
  TRUST_PROXY=1
  ENABLE_DEV_TOOLS=false
  FIREBASE_PROJECT_ID=your-project-id
  FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project-id.iam.gserviceaccount.com
  FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
  ```
  (on a host you can't upload files to, paste `client_email` and `private_key` from the service-account JSON instead of a file path)
* After deploy: `https://your-api.onrender.com/health` must show `"db":"up"`.
* Admin: sign up on the deployed site, then from your PC point `backend\.env` `MONGODB_URI` at Atlas (and `FRONTEND_URL` at the deployed site, used inside QR codes) and run `npm run make-admin -- you@example.com`. Register real boxes the same way (`npm run register-box`) so they land in the production database, then put your local values back.
* Free tiers that "sleep" disconnect the box; use an always-on plan for real use.

**Frontend** — any static host (Netlify, Vercel, Cloudflare Pages, Nginx):
* Root `frontend`, build `npm run build`, output folder `dist`
* Environment: `VITE_API_URL=https://your-api.onrender.com` and all `VITE_FIREBASE_*` values (set **before** building)
* Add the site's domain (e.g. `your-frontend.netlify.app`) to Firebase **Authorized domains**
* SPA routing is already handled (`public/_redirects` for Netlify, `vercel.json` for Vercel).

**ESP32 in production:** `SERVER_HOST "your-api.onrender.com"`, `SERVER_PORT 443`, `USE_TLS 1` (see `docs/ESP32_INTEGRATION.md` §7).

---

## 9. Command reference

| where | command | what |
|---|---|---|
| root | `npm run install:all` | install root, backend, frontend, simulator |
| root | `npm run dev` | backend + frontend together |
| backend | `npm run dev` / `npm start` | API with auto-reload / production |
| backend | `npm run make-admin -- you@example.com [--remove]` | give an existing account the admin role |
| backend | `npm run register-box -- --count 3 [--simulated]` | register boxes: codes, device tokens, QR PNGs in `qr-out/` |
| backend | `npm test` | unit tests (dose rules, schedules, sensor rule; no DB needed) |
| frontend | `npm run dev` / `npm run build` / `npm run preview` | dev server / production build into `dist/` / preview build |
| frontend | `npm test` | UI tests (Vitest) |
| simulator | `node socket-device.js <apiUrl> <mgd_token>` | fake box over Socket.IO (keys 1-4, o, r, h, q) |
| simulator | `node cli.js <apiUrl> <mgd_token> 1` | one-shot fake box over HTTP |

---

## 10. Troubleshooting

| symptom | fix |
|---|---|
| `MongooseServerSelectionError: connect ECONNREFUSED 127.0.0.1:27017` | MongoDB isn't running: Windows → Services → **MongoDB Server** → Start (or use Atlas) |
| `bad auth` / `Authentication failed` (Atlas) | wrong user/password in `MONGODB_URI`; special characters in the password must be URL-encoded |
| Atlas timeout | add your IP (or `0.0.0.0/0` for a cloud host) under *Network Access* |
| `Missing required environment variable MONGODB_URI` | you didn't create `backend\.env` (step 2) |
| Website: "Cannot reach the server at …" | backend not running, or `VITE_API_URL` wrong (restart `npm run dev` after editing `.env`) |
| Browser console: CORS error | `FRONTEND_URL` / `EXTRA_CORS_ORIGINS` in `backend\.env` must exactly match the address in the browser bar (scheme + host + port) |
| "Live updates are disconnected" banner | backend restarted or unreachable; it reconnects by itself |
| Box card "Awaiting first connection" | the box has never connected: check Serial Monitor (docs/ESP32_INTEGRATION.md §8) |
| Box "Offline" | no contact for 3 min (`OFFLINE_AFTER_SEC`); reminders still run on the box |
| Ring box / Sync now greyed out | needs a live Socket.IO connection from the box (badge **Live link**) |
| Login page: "Sign-in is not configured: missing VITE_FIREBASE_…" | fill `frontend/.env` (README §2.4) and restart `npm run dev` |
| Toast "Sign-in is temporarily unavailable: the server's Firebase configuration is missing" | set `FIREBASE_PROJECT_ID` (+ service account) in `backend/.env`; `/health` shows the exact reason |
| Toast "…the app and server use different Firebase projects" | `VITE_FIREBASE_PROJECT_ID` ≠ `FIREBASE_PROJECT_ID` |
| Google login: "This website address is not allowed…" | add the domain/IP in Firebase → Authentication → Settings → Authorized domains |
| "This sign-in method is turned off in Firebase" | enable Email/Password or Google in Firebase → Authentication → Sign-in method |
| Reset / verification email not received | check spam; Firebase sends it from `noreply@<project>.firebaseapp.com` |

*MediGuardian records schedules and drawer activity. It is not a medical device and does not give medical advice.*
