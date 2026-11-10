# Database (MongoDB)

Models: `backend/src/db/models.js` (Mongoose). Indexes are created automatically when the server starts (no migrations).
Every document id is a UUID string in `_id`. Field names are snake_case.

| collection | purpose | important indexes |
|---|---|---|
| `users` | accounts (`caregiver` / `admin`), Argon2id password hash | unique `email` (stored lower-case) |
| `refresh_sessions` | hashed rotating refresh tokens | unique `token_hash`; TTL on `expires_at` (auto-deleted) |
| `password_reset_tokens` | hashed single-use reset tokens | unique `token_hash`; TTL |
| `patients` | profile, time zone, status policy (`grace_minutes`, `missed_after_hours`) | — |
| `caregiver_patients` | **authorization**: which user may manage which patient (`owner` / `caregiver`) | unique `(user_id, patient_id)` |
| `boxes` | physical box: `box_code`, `registered → paired → retired`, owner, patient, device-reported state | unique `box_code` |
| `device_credentials` | SHA-256 of each box's `mgd_…` token | unique `token_hash` |
| `box_pairing_tokens` | hashed, expiring, single-use pairing codes | unique `token_hash` |
| `box_ownership_history` | registered / paired / unpaired / token issued | `(box_id, created_at)` |
| `drawers` | 4 per box | unique `(box_id, slot)` |
| `medicines` | per patient, optional `drawer_id`, embedded `schedule` (`times` or `interval`), soft-delete `archived_at` | `patient_id`, `drawer_id` |
| `device_config_versions` | immutable snapshot per version + ack state (`pending/applied/failed/superseded`) | unique `(box_id, version)` |
| `device_events` | raw events from the box (`via: socket|http`), outcome | unique `(box_id, event_uid)` → idempotent |
| `dose_instances` | one per scheduled dose; embedded human `confirmation` | unique `(medicine_id, scheduled_at)` |
| `refill_sessions` | refill windows reported by the box | unique `(box_id, started_at)` |
| `stock_ledger` | every stock change | unique `dose_instance_id` where `reason = consumption` |
| `notifications` | in-app notifications | unique `(user_id, dedupe_key)` |
| `audit_logs` | sensitive operations (no secrets) | `(entity_type, entity_id)` |

## No transactions needed
The code is written so it works on a plain single MongoDB server (MongoDB Community on Windows, no replica set):
uniqueness is guaranteed by the unique indexes above; single-use codes and refresh tokens are claimed with one atomic
`findOneAndUpdate`; stock uses optimistic concurrency (update only if the quantity is unchanged, retry otherwise).

## Deletes (MongoDB has no foreign keys)
* Medicine delete → archived (history kept). Box unpair → medicines detach from drawers, future doses detach.
* Patient delete → patient, its caregiver links, medicines, doses, stock ledger and notifications are deleted; boxes return to `registered`.
* Account delete → user, sessions, notifications deleted; patients only that user managed are deleted; boxes unpaired.

## Looking at the data
Install **MongoDB Compass** (GUI) and connect to the same `MONGODB_URI`, or use `mongosh`:
```
mongosh "mongodb://127.0.0.1:27017/mediguardian"
db.boxes.find({}, {box_code:1, status:1, last_seen_at:1})
db.device_events.find().sort({occurred_at:-1}).limit(5)
```
