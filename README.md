# Dheer Recovery Medicines

A caregiver organiser for the 28 July 2026 Paras Hospitals prescription from
Dr Ajit Singh: daily dose tracking, blood-pressure logging and analysis,
seizure watch, caregiver notes, and doctor-ready Excel/PDF exports.

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

Four actions open as bottom sheets rather than pages, because they are things
a caregiver reaches for mid-task: **SOS medicines**, **Log BP** (a numeric
keypad, not number spinners), **Add medicine**, and the **dose time** dialog.

SOS and Log BP are floating buttons above the nav on every screen. Tapping
**Taken** on a dose opens the time dialog — a big "Now", one-tap "15m ago"
style chips, and a custom time — because caregivers log after settling the
patient, not during, and recording the tap instant quietly corrupts every
timing figure in the doctor report. Re-tapping **Taken ✓** still undoes
immediately: a dialog in front of a correction is the wrong trade.

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
| `/`              | Today — progress ring, BP card, the 7 doses, Taken/Skip    |
| `/chart`         | Full medicine chart: 5 routine + 5 SOS, all clinical text  |
| `/history`       | Dose map, on-time score, salt intake, ledger, exports      |
| `/safety`        | Emergency numbers, the four safety rules, review questions |
| `/logs`          | BP intelligence, 14-day strip, seizure watch, notes        |
| `/settings`      | Alert lead time, reminder times, add medicine              |
| `/report`        | Printable multi-page doctor report (Save as PDF)           |
| `/export/xlsx`   | Five-worksheet Excel export                                |
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

Seven tables — `households`, `medicines`, `dose_slots`, `dose_records`,
`bp_readings`, `seizure_events`, `care_notes`. Creating a record seeds the ten
catalogue medicines and their reminder slots from `lib/catalog.ts`, which holds
the prescription text transcribed verbatim.

Three design notes worth keeping:

- **A dose row only exists once a caregiver taps.** "Not recorded" is the
  absence of a row, never an inferred "missed" — the app must not imply a dose
  was skipped when nobody wrote it down.
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
DATABASE_URL="postgres://…" scripts/e2e.sh 3111        # local, 63 checks
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

## Medicines in the catalogue

**Routine (5)** — Pantocid‑DSR 40/30 · Lacoset 100 · Valprol CR 500 ·
Betacap TR 40 · Tryptomer 10 → 7 scheduled doses a day.

**SOS (5)** — Napra‑D 500/10 (current) · Zytee Gel LA, Dolo, Looz syrup
(earlier discharge instructions, marked "confirm first") · ORS / safe fluids
(supportive care). SOS is deliberately excluded from reminders, and logging an
entry never reactivates an old instruction.

Editing clinical wording in `lib/catalog.ts` changes what a caregiver is told
at the moment of dosing. Change it only against the prescription sheet.
