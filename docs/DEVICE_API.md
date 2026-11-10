# Device API v2 — the contract between the ESP32 and the server

The firmware in `esp32-firmware/MediGuardianBox/` implements this. Two transports carry **the same JSON messages**:

| transport | used by | address |
|---|---|---|
| **Socket.IO** namespace `/device` (real time, server can push) | the ESP32 firmware, `simulator/socket-device.js` | `ws://<server>:4000/socket.io/?EIO=4` (or `wss://` in production) |
| HTTP `/api/v1/device/*` (request/response) | `simulator/cli.js`, curl/PowerShell tests, fallback | `http(s)://<server>/api/v1/device` |

## Socket.IO protocol (`/device`)
Connect with Engine.IO v4, then join the namespace with the token as auth payload. On the wire:
```
40/device,{"token":"mgd_xxx"}          box  -> server   join + authenticate
40/device,{"sid":"..."}                server -> box    joined
44/device,{"message":"unauthorized"}   server -> box    bad / revoked token
42/device,["heartbeat",{...}]          box  -> server   any event
```
| box emits | server replies with | body |
|---|---|---|
| `heartbeat` | `heartbeat:ack` | same as `POST /heartbeat` below |
| `events` | `events:result` | `{events:[...]}` → `{results:{...}}` |
| `config:get` | `config` | `{since: 7}` (omit `since` to force a full config) |
| `config:ack` | `config:ack:result` | `{version, status:"applied"/"failed", error?}` |
| `status` | `status` | `{}` |

Server pushes (no request needed):
* `welcome` `{server_time, paired, config_version, heartbeat_interval_seconds}` right after joining. If `config_version` differs from yours, send `config:get`.
* `config:changed` `{version, reason}` — the caregiver changed medicines/drawers/patient settings (or unpaired the box): send `config:get` now.
* `command` `{command, text?}` from the app: `ring` (beep so the box can be found), `sync_config` (send `config:get` without `since`), `message` (show `text` on the LCD), `stop_alarm`.
* `error:device` `{event, message}` — a message was rejected (validation). For a rejected `events` batch, drop those events.

If the client attaches a Socket.IO acknowledgement callback, the reply comes as the ack instead of the reply event. Messages from one box are processed one at a time, in order. Limit: 240 messages/min per connection.
A box with a live socket shows **Live link** in the app and is never marked offline while connected. Heartbeats are still sent every `heartbeat_interval_seconds`.

## Authentication
HTTP: every request carries `Authorization: Bearer mgd_<secret>`. Socket.IO: `{"token":"mgd_<secret>"}` in the namespace join.
* The token is created when the box is registered (`npm run register-box` or the admin screen), shown **once**, and put into that box's `secrets.h` (`DEVICE_TOKEN`). The server stores only its SHA‑256 hash.
* It is a *device* credential: it is rejected by every user endpoint, and user tokens are rejected here. It can only act on its own box.
* `401` = unknown/revoked token. Never retry a 401 in a tight loop.

## Time
* Send timestamps as ISO‑8601 **UTC with offset** (`2026-10-24T08:12:30Z`). The ESP32 must sync SNTP at boot; if the clock is not synced yet, queue events but do not send them with a bogus year.
* `GET /status` and the heartbeat reply return `server_time`; use it as a sanity check for clock drift.
* `occurred_at` more than 5 minutes in the future is rejected (400).

## Messages (HTTP paths shown; the Socket.IO event names are in the table above)

### `POST /heartbeat` (every `heartbeat_interval_seconds`, default 60)
```json
{ "sent_at":"2026-10-24T08:00:00Z", "firmware_version":"1.0.3", "config_version":7,
  "refill_mode":false, "power_state":"on", "wifi_rssi":-58, "uptime_s":1234, "queued_events":0 }
```
All fields optional. Reply:
```json
{ "server_time":"…Z", "config_version":8, "config_changed":true, "heartbeat_interval_seconds":60, "paired":true }
```
If `config_changed` is true → `GET /config`. The server treats a box as **offline** when no heartbeat/event arrived for `OFFLINE_AFTER_SEC` (default 180 s) **unless** the box last reported `power_state:"off"` (shown as "Switched off"). The server never infers `refill_mode` or `power_state`; it only shows what was reported (older reports never overwrite newer ones).

### `GET /config?since=<version>`
`{ "changed": false, "version": 7 }` when nothing changed, otherwise:
```json
{ "changed": true, "version": 8, "ack_status": "pending",
  "config": {
    "version": 8, "generated_at": "…", "valid_until": "…", "timezone": "Asia/Dhaka", "utc_offset_minutes": 360,
    "policy": { "alerts_per_dose":3, "alert_interval_minutes":30, "alert_duration_seconds":20,
                "grace_minutes":60, "missed_after_hours":24, "heartbeat_interval_seconds":60 },
    "drawers": [ { "slot":1, "kind":"morning", "name":"Morning",
        "medicines":[ { "id":"…", "name":"NAPA Extra", "strength":"500mg", "dose":"1 Tablet", "dose_quantity":1, "unit":"tablets",
                        "instructions":"After breakfast", "schedule":{ "type":"times", "times_local":["08:00"] } } ] },
      { "slot":4, "kind":"extra", "name":"Extra", "medicines":[ { "schedule":{ "type":"interval", "every_hours":8, "anchor_local":"06:00" } } ] } ],
    "alarms": [ { "slot":1, "at":1792915200, "medicines":["NAPA Extra"] } ] } }
```
* **`alarms` are explicit UTC epoch seconds for the next ~48 h** — the firmware can schedule reminders without any time‑zone/DST logic. Re-fetch before they run out (`valid_until`) and whenever `config_changed`. If the network is down, keep running the alarms you already hold.
* For every alarm: LED of `slot` on, LCD shows medicine name, buzzer 20 s; repeat at +30 min and +60 min (`alerts_per_dose` = 3 total), then stop. Stop and cancel the rest as soon as a qualifying removal is detected for that drawer.
* `unpaired: true` with empty `drawers` means the box was unpaired: stop reminding.

### `POST /config/ack`
After the box has **actually applied** a configuration: `{ "version":8, "status":"applied" }`, or on failure `{ "version":8, "status":"failed", "error":"flash write error" }`. The app shows "Settings synced" only after an `applied` ack; a `failed` ack raises a notification. Unknown version → 400.

### `POST /events` (batch up to 100)
```json
{ "events": [ {
  "event_id": "box7-000412",          // REQUIRED, unique per box, stable across retries (>=8 chars, [A-Za-z0-9_.:-])
  "type": "removal_detected",         // boot | power_off | drawer_open | drawer_close | removal_detected |
                                      // interaction_rejected | refill_start | refill_end | reminder_alert
  "drawer": 1,                        // 1..4, required for drawer/removal/rejected/reminder events
  "occurred_at": "2026-10-24T08:12:30Z",
  "config_version": 8,
  "sensors": { "reed_open": true, "ir_a": true, "ir_b": false },   // required for removal_detected
  "refill_mode": false,               // state of the physical refill switch AT THAT MOMENT
  "firmware_version": "1.0.3",
  "extra": { "alert_number": 2 }      // free-form, stored as-is
} ] }
```
Reply: `{ "results": { "<event_id>": { "status":"accepted|duplicate|rejected", "outcome":"matched|unmatched|ignored_refill|rejected_sensors|recorded" } } }`.
* **Idempotent.** Re-sending an event id returns `duplicate` and changes nothing. After any response (even `rejected`), drop those ids from the local queue; on network error/timeout keep them and retry.
* Events may arrive late and out of order; the server sorts by `occurred_at` and classifies by that time.
* Keep a bounded queue (suggest ≥100 events; drop the oldest when full) and flush after reconnect, oldest first, ≤100 per request.
* `removal_detected` is accepted only if `sensors.reed_open && (ir_a || ir_b)` (re-checked server‑side). Send `interaction_rejected` for a drawer opening without a hand detection. `refill_mode:true` events are logged but never consume stock.
* Send `boot` at power‑on, `power_off` when the main switch is turned off (best effort), `refill_start`/`refill_end` when the refill switch changes.

### `GET /status`
`{ "server_time":"…Z", "paired":true, "config_version":8, "heartbeat_interval_seconds":60 }`

## Error format
`{ "error": { "code":"bad_request", "message":"Invalid input: …", "details":[{"path":"events.0.drawer","message":"…"}] } }` — HTTP 400 (validation), 401, 429 (rate limit: 240 req/min per device), 5xx (retry with exponential backoff).

## Event ordering & conflict policy
1. Uniqueness: `(box, event_id)`.
2. Classification time = `occurred_at` (device clock), never arrival time.
3. State reports (`power_state`, `refill_mode`) only apply if newer than the last one stored.
4. A removal matches the **latest still-open dose in that drawer that was scheduled at or before the event and less than `missed_after_hours` earlier** (details: `MEDICATION_LOGIC.md`).
