# Notifications

**Implemented:** persistent in‑app notifications (collection `notifications`) pushed to the browser through Socket.IO (`notification:new`) for: overdue doses, missed doses, device offline, low stock, configuration failures. Each `(user, dedupe_key)` exists once, so an unresolved condition notifies once (e.g. `late:<dose>`, `missed:<dose>`, `offline:<box>:<last_seen>`, `lowstock:<medicine>:<refill cycle>`).
A background sweep runs every minute (`services/worker.js`).

**Not implemented (needs a provider):** email, SMS, mobile push. The UI and API never claim a message was sent: the forgot‑password response is `delivery: "not_configured"` and the page says so. To add email: implement a transport in `authService.requestPasswordReset` and in `notificationService` (e.g. Nodemailer with `SMTP_URL`), keep the dedupe keys, and add provider credentials as environment variables only.
"Upcoming dose" and "refill reminder" notifications are not generated (low‑stock covers refill need).
