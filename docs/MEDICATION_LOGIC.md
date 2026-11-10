# Medication logic

MediGuardian **records** the schedule a caregiver/clinician enters. It never recommends doses or changes prescriptions.

## Evidence ≠ ingestion
A drawer interaction (`reed open AND (IR A OR IR B)`) is *evidence of a hand interaction*. The app shows two separate facts per dose: **Removal detected** (hardware) and **Intake confirmed** (a caregiver clicked confirm; source + time kept in the dose's `confirmation` field). Nothing silently converts one into the other.

## Dose instances
Each (medicine, scheduled instant) is one document in `dose_instances`, with a unique index on `(medicine_id, scheduled_at)` so repeated generation can never duplicate a dose or inflate a report denominator.
* `times` schedules: `HH:MM` wall‑clock in the **patient's time zone** → UTC instant (Luxon). DST: a time that does not exist (spring‑forward gap) moves forward; an ambiguous time uses the first occurrence; `08:00` stays `08:00` local across DST changes.
* `interval` schedules (Extra drawer; e.g. every 3/8/12 h): anchor `HH:MM` on the start date, then every N **absolute** hours (so it crosses midnight and DST evenly).
* `start_date`/`end_date` are patient‑local dates. Doses are never back‑filled before the moment the schedule was saved (`effective_from`).
* Changing a schedule deletes only *future, evidence‑free* doses and regenerates them; history is untouched. Removing a medicine archives it (reports keep working).
* Several medicines in one drawer share the moment: one removal completes all of that moment's doses for the drawer.

## Status policy (defaults; per patient: `grace_minutes` 60, `missed_after_hours` 24)
| status | rule |
|---|---|
| upcoming | scheduled time not reached |
| awaiting_confirmation | due, no valid evidence yet, not missed yet (shown as **Overdue** after the grace period) |
| on_time | valid evidence at/after scheduled time and ≤ grace (inclusive) |
| late | valid evidence after grace but before `missed_after_hours` |
| missed | no valid evidence by `scheduled + missed_after_hours` |

* Classification uses the **device's `occurred_at`**, not arrival time. A delayed event can correct a dose the sweeper already marked missed, provided `occurred_at` was inside the window.
* Evidence **before** the scheduled time is not valid for that dose.
* An event at/after the 24 h mark never completes the old dose. It is matched to the *latest still‑open* dose in that drawer (usually the newer one); with nothing open it is stored as `unmatched`. Manual confirmation after the threshold also leaves the dose `missed` (the confirmation is still stored).
* **Consequences of changing the policy:** a larger grace window turns late doses into on‑time ones (higher on‑time %), a smaller `missed_after_hours` makes doses count as missed sooner and shortens the window delayed events can still rescue. Existing rows keep the status they were classified with; new classifications use the new numbers.

## Which dose does a removal complete?
`latest scheduled_at ≤ occurred_at, still open, occurred_at < scheduled_at + missed_after_hours`, in that drawer of that box. (An early opening at 07:50 therefore completes yesterday's still‑open 08:00 dose as *late* — the box cannot know intent; if nothing is open it is `unmatched`.)

## Stock
`medicines.stock_quantity` is an **estimate**; the sensors cannot count tablets. It changes only through `stock_ledger` rows written together with every change (optimistic concurrency: the quantity is only updated if it hasn't changed since it was read) (reasons: `initial`, `refill`, `adjustment`, `consumption`; sources: caregiver/device/system).
* Automatic consumption: only for a *validated* removal (qualifying sensors, not refill mode, matched to a dose), once per dose (unique index), by the medicine's `dose_quantity`, clamped at 0. Manual confirmation does not change stock.
* Never negative (schema `min: 0` plus service validation). Low‑stock notification once per stock cycle.
* Refill mode: events flagged `refill_mode:true`, or inside a recorded refill session, never consume stock. Adding stock is the explicit *Refill* action (or an adjustment).

## Adherence
`adherence = (on_time + late) / (on_time + late + missed)`. Upcoming and awaiting doses are **not** in the denominator and are not counted as taken. Reports also show `hardwareOnly` (completed doses nobody confirmed) so hardware evidence stays visible.
