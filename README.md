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
| Database | Neon serverless Postgres via Drizzle ORM                |
| Exports  | ExcelJS (.xlsx) · print-to-PDF report page              |
| Hosting  | Vercel                                                  |

## How access works

There is no login. A **care code** in the URL (`/c/<CODE>`) is the credential —
one private link opens the same record on every phone, matching how the
original app's family sync worked. Codes are 20 characters of crypto-grade
randomness from a 32-symbol alphabet (~100 bits), so they are not guessable,
but anyone holding a link can read and write that family's record. Treat the
link like a password.

Pages are `noindex, nofollow` and `force-dynamic` so nothing is cached or
crawled.

## Routes

| Route                    | Purpose                                                     |
| ------------------------ | ----------------------------------------------------------- |
| `/`                      | Create a new care record, or open one with an existing code |
| `/c/[code]`              | Today — the 7 scheduled doses, Taken/Skip, BP snapshot      |
| `/c/[code]/chart`        | Full medicine chart: 5 routine + 5 SOS, all clinical text   |
| `/c/[code]/history`      | Dose ledger by date range, completion stats, exports        |
| `/c/[code]/safety`       | Emergency numbers, the four safety rules, review questions  |
| `/c/[code]/logs`         | BP intelligence, 14-day strip, seizure watch, notes         |
| `/c/[code]/settings`     | Family sync link, alert lead time, reminder times           |
| `/c/[code]/report`       | Printable multi-page doctor report (Save as PDF)            |
| `/c/[code]/export/xlsx`  | Five-worksheet Excel export                                 |

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

Two design notes worth keeping:

- **A dose row only exists once a caregiver taps.** "Not recorded" is the
  absence of a row, never an inferred "missed" — the app must not imply a dose
  was skipped when nobody wrote it down.
- **All dates resolve through `Asia/Kolkata`.** Vercel functions run in UTC; a
  9:30 pm dose would otherwise land on the wrong date after 18:30 UTC.

```bash
npm run db:generate   # after editing db/schema.ts
npm run db:migrate    # apply to DATABASE_URL (over HTTPS)
npm run db:studio     # browse the data
```

`db:migrate` runs `scripts/migrate.mjs`, which applies migrations through
Neon's HTTP driver on port 443. `drizzle-kit migrate` needs TCP 5432, which is
blocked on many CI runners and sandboxes; it is still available as
`db:migrate:tcp` when you have a direct connection.

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
4. Deploy. Open the site, create a record, and save the care link.

Use the **pooled** Neon connection string (`...-pooler...`) — serverless
functions open many short-lived connections.

## Tests

```bash
npm run build
DATABASE_URL="postgres://…" scripts/e2e.sh 3111        # local, 38 checks
ENTRY_URL="https://dheerrecovery.vercel.app/" node scripts/live-check.mjs
```

`scripts/smoke.mjs` drives a real browser through the whole app on a 420px
viewport: creating a record, verifying the prescription, marking a dose taken,
undoing it, the SOS drawer, every tab, logging BP and seizures and notes,
editing a reminder time, the printable report, the Excel download, and a 404
for an unknown code. It also fails the run on any console error or failed
request.

`scripts/live-check.mjs` runs a shorter version of the same flow against a
deployed instance, and honours `HTTPS_PROXY` plus a Vercel `?_vercel_share=`
link so it works against a deployment that still has Deployment Protection on.

## Medicines in the catalogue

**Routine (5)** — Pantocid‑DSR 40/30 · Lacoset 100 · Valprol CR 500 ·
Betacap TR 40 · Tryptomer 10 → 7 scheduled doses a day.

**SOS (5)** — Napra‑D 500/10 (current) · Zytee Gel LA, Dolo, Looz syrup
(earlier discharge instructions, marked "confirm first") · ORS / safe fluids
(supportive care). SOS is deliberately excluded from reminders, and logging an
entry never reactivates an old instruction.

Editing clinical wording in `lib/catalog.ts` changes what a caregiver is told
at the moment of dosing. Change it only against the prescription sheet.
