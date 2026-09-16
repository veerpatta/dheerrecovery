# Dheer Recovery Medicines

A caregiver organiser for two prescriptions — the 28 July 2026 Paras Hospitals
sheet from Dr Ajit Singh, and the 15 September 2026 Geetanjali Cancer Centre
chemoradiation sheet from Dr Ankit Agarwal: daily dose tracking, blood-pressure
and weight logging with analysis, seizure watch, caregiver notes, and
doctor-ready Excel/PDF exports.

Rebuilt from the original browser-only prototype onto **Next.js 15 + Neon
Postgres**, so the record is shared across every caregiver's phone instead of
living in one browser's local storage.

**Live:** https://dheerrecovery.vercel.app

> This app supports — it does not replace — the prescription and the treating
> team. A missing entry does not prove a missed dose. Reminder clock times are
> a caregiver organiser; only Betacap's 8:00 AM is printed on the prescription.

---

## Stack

| Layer    | Choice                                                  |
| -------- | ------------------------------------------------------- |
| Framework| Next.js 15 (App Router, Server Actions), React 19        |
| Language | TypeScript                                              |
| Styling  | Tailwind CSS v4                                         |
| Fonts    | Inter + Noto Sans Devanagari, self-hosted via @fontsource|
| Database | Neon serverless Postgres via Drizzle ORM                |
| Exports  | ExcelJS (.xlsx) · print-to-PDF report page              |
| Hosting  | Vercel                                                  |

## Layout

The app is a 430px phone shell: sticky header (language, settings, SOS), a
scrolling screen, and a five-tab bottom bar. Wider viewports get the same
column centred on the page rather than a separate desktop layout — this is a
tool caregivers use on a phone at the bedside.

Five actions open as bottom sheets rather than pages, because they are things
a caregiver reaches for mid-task: **SOS medicines**, **Log BP** and **Log
weight** (numeric keypads, not number spinners), **Add medicine**, and the
**dose time** dialog.

SOS and Log BP are floating buttons above the nav on every screen. Log weight
deliberately is not: it is a once-a-day planned action performed standing on a
scale, not something reached for one-handed mid-task, so it lives on the Today
card and on `/logs` rather than adding a third permanent control. Tapping
**Taken** on a dose opens the time dialog — a big "Now", one-tap "15m ago"
style chips, and a custom time — because caregivers log after settling the
patient, not during, and recording the tap instant quietly corrupts every
timing figure in the doctor report. A recorded dose then shows no buttons at
all — a filled "Taken ✓" beside an empty "Skip" reads as a live choice rather
than a settled fact — so clearing one is a correction, tucked behind the card's
disclosure with explicit wording about what it changes.

The app tree is split by route group, which does not change any URL:

- `app/(shell)/` — the six app screens, inside the phone shell.
- `app/(print)/report/` — the doctor report, deliberately *outside* the shell
  so page breaks, margins and wide tables survive a trip to the printer.

Fonts are vendored through `@fontsource` rather than `next/font/google`. The
app is a `noindex` medical record and should not fetch anything from a third
party at runtime, and `next/font/google` needs outbound access to
fonts.googleapis.com at *build* time, which fails on a runner without egress.
Inter carries no Devanagari, so the Hindi chrome has its own face.

## How access works

There is no login and nothing to enter. Opening the site lands straight on
today's medicines for the one family record, which every caregiver's phone
shares.

`lib/household.ts` decides which row that is, most specific first, so a fresh
database still works and a populated one can never silently pick the wrong
record:

1. `PRIMARY_CARE_CODE`, if the env var is set.
2. The record migrated from the original Sites app.
3. The oldest household present.
4. Otherwise a new one seeded from the prescription catalogue.

The `care_code` column stays in the schema because the Sites migration keyed
the imported record on it — dropping the column would strand that data. It is
simply no longer part of the URL or the UI. Old `/c/<code>/…` links still
resolve: everything under `/c/` permanently redirects to the same page at the
top level.

**Anyone who has the URL can read and write the record.** That is the
trade-off for having no gate at all. Pages are `noindex, nofollow` and
`force-dynamic`, so nothing is cached or crawled, but the address is the only
thing standing between a stranger and the medical data.

## Routes

| Route            | Purpose                                                    |
| ---------------- | ---------------------------------------------------------- |
| `/`              | Today — ring, therapy question, BP + weight cards, doses  |
| `/chart`         | Full medicine chart: 8 routine + 5 SOS, all clinical text  |
| `/history`       | Dose map, on-time score, salt intake, ledger, exports      |
| `/safety`        | Emergency numbers, the four safety rules, review questions |
| `/logs`          | BP + weight analysis, 14-day strips, seizure watch, notes  |
| `/settings`      | Alerts, reminder times, add medicine                       |
| `/report`        | Printable multi-page doctor report (Save as PDF)           |
| `/export/xlsx`   | Seven-worksheet Excel export                               |
| `/catch-up`      | Doses left unrecorded — where an evening alert lands       |
| `/api/cron/tick` | The scheduler's one endpoint, secret-guarded               |
| `/api/push/*`    | subscribe · unsubscribe · act on a notification            |
| `/c/<code>/…`    | Permanent redirect to the equivalent path above            |

## Local development

```bash
npm install
cp .env.example .env.local     # paste your Neon pooled connection string
npm run db:migrate             # create the tables
npm run dev
```

`DATABASE_URL` accepts either a Neon URL (uses Neon's HTTP driver, right for
serverless) or any plain `postgres://` URL (falls back to node-postgres), so
the app runs against a local Postgres with no Neon account.

## Database

Eleven tables — `households`, `medicines`, `dose_slots`, `dose_records`,
`care_days`, `bp_readings`, `weight_readings`, `seizure_events`, `care_notes`,
`push_subscriptions` and `notification_log`.
Creating a record seeds the thirteen catalogue medicines and their reminder
slots from `lib/catalog.ts`, which holds the prescription text transcribed
verbatim.

`lib/catalog.ts` is read **only** by `createHousehold()`, so it reaches a new
record and never one already deployed. Every catalogue change therefore ships
with a hand-written data migration as well — see `0002` through `0005`.

Five design notes worth keeping:

- **A dose row only exists once a caregiver taps.** "Not recorded" is the
  absence of a row, never an inferred "missed" — the app must not imply a dose
  was skipped when nobody wrote it down. `care_days.therapy` follows the same
  rule: an absent row means nobody has said yet, never "no".
- **Not every medicine is due every day, and a recorded dose never vanishes.**
  `lib/schedule.ts` composes three rules — a course window, a weekday
  restriction (Septran DS is Mondays and Thursdays), and the therapy gate
  (Temozolomide only on a day Today has been answered "yes"). But
  `buildDaySchedule` keeps any slot that *has a record*, whichever rule would
  otherwise drop it. Re-answering a day "no therapy" does not unswallow the
  capsule, and the export flags such a row "Off schedule" rather than hiding
  it. That rule can only ever surface a `taken` or `skipped` dose, so it can
  never invent a missed one.
- **All dates resolve through `Asia/Kolkata`.** Vercel functions run in UTC; a
  9:30 pm dose would otherwise land on the wrong date after 18:30 UTC.
- **`medicines.dosing_interval_hours` drives the 12-hour rule.** Lacoset and
  Valprol are prescribed twice daily about twelve hours apart, so once the
  morning dose is recorded the evening dose is due twelve hours after the time
  it was *actually* given — 8:20 am makes the evening dose 8:20 pm, and
  `dose_records.scheduled_time` stores that derived time so drift and the
  on-time score stay honest.

  The chain is deliberately re-anchored every care-date: tomorrow's morning
  slot returns to its printed reminder time. Chaining across days instead
  would let one late dose ratchet the whole schedule later with no way back,
  which is not a safe property for an anti-seizure medicine. A gap that lands
  past midnight falls back to the printed time and says so on the card.

  Rows recorded before this shipped keep their original `scheduled_time` —
  history is never rewritten.

```bash
npm run db:generate   # after editing db/schema.ts
npm run db:migrate    # apply to DATABASE_URL (over HTTPS)
npm run db:studio     # browse the data
```

`db:migrate` runs `scripts/migrate.mjs`. Against a Neon URL it applies
migrations through Neon's HTTP driver on port 443; `drizzle-kit migrate` needs
TCP 5432, which is blocked on many CI runners and sandboxes (it is still
available as `db:migrate:tcp` when you have a direct connection). Any other
`postgres://` URL falls back to node-postgres, mirroring `db/index.ts`, so the
command above works against a local Postgres with no Neon account.

## Deployment (Vercel + Neon)

1. Import this repo on Vercel.
2. **Storage → Neon** in the Vercel dashboard (or paste `DATABASE_URL` from the
   Neon console into Project → Settings → Environment Variables). The
   marketplace integration injects `DATABASE_URL` automatically.
3. Run the migration once against the production database:
   ```bash
   DATABASE_URL="<neon pooled url>" npm run db:migrate
   ```
   This goes over HTTPS, so it works from anywhere — including CI runners that
   block outbound Postgres on 5432.
4. Deploy. Open the site — it lands straight on today's medicines.

Use the **pooled** Neon connection string (`...-pooler...`) — serverless
functions open many short-lived connections.

## Tests

```bash
npm run build
DATABASE_URL="postgres://…" scripts/e2e.sh 3111        # local, 104 checks
ENTRY_URL="https://dheerrecovery.vercel.app/" node scripts/live-check.mjs
```

`scripts/smoke.mjs` drives a real browser through the whole app on a 420px
viewport, starting from an empty database: opening straight onto today,
verifying the prescription, marking a dose taken through the time dialog,
undoing it, the twelve-hour chain (recording Lacoset's morning dose at 8:20 and
asserting the evening dose moves to 8:20 pm, then that undoing it restores the
printed time), the SOS sheet and adding an SOS medicine, an SOS dose appearing
on the timeline without moving the N/7 ring, every tab, logging BP through the
keypad, seizures and notes, the dose map and salt-intake totals, editing a
reminder time, the printable report, the Excel download, a legacy `/c/<code>/`
redirect, and a 404 for an unknown path. It also checks the floating buttons
clear the last list item, and fails the run on any console error or failed
request.

`scripts/live-check.mjs` runs a shorter version of the same flow against a
deployed instance, and honours `HTTPS_PROXY` plus a Vercel `?_vercel_share=`
link so it works against a deployment that still has Deployment Protection on.
It writes to the real record: it marks one dose taken and undoes it, and leaves
one BP reading behind.

`scripts/hydration-check.mjs` replays every route in both languages against a
dev server and fails on any console error or warning, which is where hydration
mismatches actually surface.

```bash
npm run dev -- -p 3112
BASE_URL=http://127.0.0.1:3112 node scripts/hydration-check.mjs
```

## Alerts

Push notifications that arrive with the app closed. Five kinds, and
deliberately **no alert for each individual dose** — eleven buzzes a day is how
a caregiver learns to ignore the app. The evening wrap covers anything left
unrecorded instead.

| Kind | When | Silent when |
|---|---|---|
| Morning | 07:00 | the day has no doses at all |
| Evening wrap | 21:45 | every dose is already recorded |
| Weekly weight | Mondays 08:00 | already weighed today |
| Blood tests | course days 6 and 7 | outside the course |
| Milestone | course days 1, 7, 14, 21, 28, 35, 42 | any other day |

Fire times are constants in `lib/notify/plan.ts`; Settings offers a **toggle**
per kind, not a time. That is not laziness — see the Neon note below.

**Logging a dose from a notification takes two taps, on purpose.** The
notification opens `/catch-up`; the second tap is the time chip. A one-tap
"Taken ✓" would record the moment the caregiver tapped, not the moment the
tablet was swallowed, and `dose_records.scheduled_time` would carry that
fiction into the on-time score and the doctor report. `components/dose-time-sheet.tsx`
exists for exactly this reason.

**iOS is the constraint that shapes the whole design.** Safari allows web push
only for a page added to the Home Screen — in a tab, `Notification` is not even
defined — and it renders notifications with **no action buttons at all**. So
every alert is fully actionable by tapping its body, and the buttons Android
shows are a bonus rather than the mechanism.

### How the scheduling works

An external cron (cron-job.org) POSTs `/api/cron/tick` every five minutes with
`x-cron-secret`. The route also accepts Vercel Cron's `Authorization: Bearer`
form, so moving to a Vercel Pro cron later needs only a `crons` entry in
`vercel.json` and no code change.

Two properties are load-bearing:

- **The database is not touched on a quiet tick.** `planFor()` is pure
  arithmetic on a clock string and runs before anything opens a connection. A
  query every five minutes would never let Neon auto-suspend — 8,640
  invocations a month against a free allowance of ~191 compute-hours. As
  written, Postgres wakes about five times a day.
- **A claim is taken before anything is sent.** `notification_log` is unique on
  `(household_id, kind, care_date)` and the row is inserted with
  `ON CONFLICT DO NOTHING`; only the tick that won the insert sends. Sending
  first and recording after would resend the same alert on every tick for the
  rest of the day. A send that fails is retried at most three times.

`notification_log.id` travels in the push payload, and that is what makes an
action safe without any signature: `/api/push/action` refuses when the row is
for another day (a notification left on a lock screen overnight) or has already
been acted on (a second caregiver's phone). There is no HMAC because there is
nothing for it to protect — every export of `lib/actions.ts` is already a
public unauthenticated endpoint.

```bash
# Preview the copy without sending anything
curl -X POST -H "x-cron-secret: $CRON_SECRET" \
  'http://127.0.0.1:3111/api/cron/tick?dry=1&kind=morning' | jq '.ran[0].en'

# What the scheduler would do right now
curl -X POST -H "x-cron-secret: $CRON_SECRET" \
  'http://127.0.0.1:3111/api/cron/tick?dry=1' | jq
```

`node scripts/push-check.mjs` verifies the VAPID pair, that a payload actually
encrypts, and that the service worker is served and handles the events it must.
It cannot check delivery: a Chromium launched under automation has no
connection to Apple's or Google's push service, so receiving a real
notification has to be checked on a real device.

**Testing on an iPhone:** open the site in Safari → Share → Add to Home Screen,
close Safari completely, reopen from the icon, then Settings → *Turn on alerts
on this phone* → *Send a test*. It should arrive on the lock screen with the
app icon and no buttons.

**Never rotate the VAPID keys on a live record.** They are half of every
existing subscription; a new pair silently stops every phone and each one has
to be turned on again by hand.

## Medicines in the catalogue

**Routine (8)** — Pantocid‑DSR 40/30 · Lacoset 100 · Valprol CR 500 ·
Betacap TR 40 · Tryptomer 10, plus the 15 September chemoradiation sheet's
Temozolomide 140 mg (radiotherapy days only) · Perinorm 10 · Septran DS
(Mondays and Thursdays). Between 7 and 12 scheduled doses depending on the day.

**SOS (5)** — Napra‑D 500/10 (current) · Zytee Gel LA, Dolo, Looz syrup
(earlier discharge instructions, marked "confirm first") · ORS / safe fluids
(supportive care). SOS is deliberately excluded from reminders, and logging an
entry never reactivates an old instruction.

Editing clinical wording in `lib/catalog.ts` changes what a caregiver is told
at the moment of dosing. Change it only against the prescription sheet.
