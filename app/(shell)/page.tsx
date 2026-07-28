import { SheetTrigger } from '@/components/chrome'
import { DoseCard } from '@/components/dose-card'
import { VerifyBanner } from '@/components/verify-banner'
import { bandOf, classify, summarise } from '@/lib/bp'
import { getHousehold } from '@/lib/household'
import {
  buildDaySchedule,
  getBpReadings,
  getDoseRecords,
  getMedicines,
} from '@/lib/queries'
import {
  careClock,
  careDate,
  driftMinutes,
  prettyDate,
  prettyDateTime,
  prettyRxDate,
  prettyTime,
} from '@/lib/time'

export const dynamic = 'force-dynamic'

/** Circumference of the r=31 progress ring the design draws. */
const RING = 194.8

export default async function TodayPage() {
  const household = await getHousehold()

  const today = careDate()
  const [meds, records, readings] = await Promise.all([
    getMedicines(household.id),
    getDoseRecords(household.id, today, today),
    getBpReadings(household.id, 200),
  ])

  const schedule = buildDaySchedule(meds, records, today)
  const taken = schedule.filter((d) => d.status === 'taken').length
  const pending = schedule.filter(
    (d) => d.status === 'not-recorded' || d.status === 'upcoming',
  ).length
  const next = schedule.find((d) => d.status === 'upcoming')

  const manualRecords = records.filter((r) => r.slotKey.startsWith('manual-'))
  const customUnscheduled = meds
    .filter((m) => m.isCustom && m.slots.length === 0 && m.kind !== 'sos')
    .map((medicine) => ({
      medicine,
      record: manualRecords.find((r) => r.medicineId === medicine.id),
    }))

  const band = bandOf(household)
  const bp = summarise(readings, band)
  const latest = bp.latest
  const latestBand = latest ? classify(latest, band) : null

  // Sparkline over the last dozen systolic readings, oldest to newest.
  const sparkSource = [...readings]
    .sort((a, b) => +new Date(a.measuredAt) - +new Date(b.measuredAt))
    .slice(-12)
  let sparkPoints = ''
  if (sparkSource.length >= 2) {
    const values = sparkSource.map((r) => r.systolic)
    const min = Math.min(...values) - 4
    const max = Math.max(...values) + 4
    sparkPoints = sparkSource
      .map((r, i) => {
        const x = (i / (sparkSource.length - 1)) * 106 + 2
        const y = (1 - (r.systolic - min) / Math.max(1, max - min)) * 28 + 3
        return `${x.toFixed(1)},${y.toFixed(1)}`
      })
      .join(' ')
  }

  const allDone = schedule.length > 0 && taken === schedule.length

  return (
    <>
      {!household.rxVerifiedAt ? (
        <VerifyBanner prescriptionDate={prettyRxDate(household.prescriptionDate)} />
      ) : null}

      <section className="card flex items-center gap-4">
        <svg width="76" height="76" viewBox="0 0 76 76" className="shrink-0" aria-hidden>
          <circle cx="38" cy="38" r="31" fill="none" stroke="#e7f5f1" strokeWidth="7" />
          <circle
            cx="38"
            cy="38"
            r="31"
            fill="none"
            stroke="#29a997"
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={RING}
            strokeDashoffset={(
              RING * (1 - (schedule.length ? taken / schedule.length : 0))
            ).toFixed(1)}
            transform="rotate(-90 38 38)"
          />
          <text
            x="38"
            y="37"
            textAnchor="middle"
            fontSize="19"
            fontWeight="800"
            fill="#132238"
          >
            {taken}
          </text>
          <text x="38" y="52" textAnchor="middle" fontSize="9.5" fill="#66748b">
            of {schedule.length}
          </text>
        </svg>
        <div className="flex min-w-0 flex-col gap-1">
          <p className="eyebrow">
            <span className="lang-en">Today</span>
            <span className="lang-hi">आज</span>
          </p>
          <h1 className="text-lg font-extrabold tracking-tight text-navy">
            <span className="lang-en">Today’s medicines</span>
            <span className="lang-hi">आज की दवाइयाँ</span>
          </h1>
          {/* SVG <text> is unreliable for assistive tech and for innerText. */}
          <p className="sr-only">
            {taken}/{schedule.length} taken
          </p>
          <p className="text-xs text-muted">{prettyDate(today)}</p>
          <p
            className={`inline-flex self-start rounded-full px-2.5 py-1 text-[11.5px] font-bold ${
              allDone ? 'bg-teal text-white' : 'bg-mint text-teal'
            }`}
          >
            {allDone ? (
              <>
                <span className="lang-en">All {schedule.length} recorded ✓</span>
                <span className="lang-hi">सभी {schedule.length} दर्ज ✓</span>
              </>
            ) : next ? (
              <>
                <span className="lang-en">Next</span>
                <span className="lang-hi">अगली</span>: {next.medicine.brand} ·{' '}
                {prettyTime(next.time)}
              </>
            ) : (
              <>
                <span className="lang-en">{pending} to review</span>
                <span className="lang-hi">{pending} की जाँच बाकी</span>
              </>
            )}
          </p>
        </div>
      </section>

      <section className="rounded-2xl bg-navy p-4 shadow-soft">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10.5px] font-semibold tracking-[0.14em] text-white/55 uppercase">
            <span className="lang-en">Blood pressure</span>
            <span className="lang-hi">रक्तचाप</span>
          </p>
          <span
            className={`pill ${
              latestBand === 'high'
                ? 'bg-coral-soft text-coral'
                : latestBand === 'low'
                  ? 'bg-amber/20 text-amber'
                  : latestBand === 'in-band'
                    ? 'bg-mint text-teal'
                    : 'bg-white/12 text-white/70'
            }`}
          >
            {latestBand === 'high'
              ? 'High'
              : latestBand === 'low'
                ? 'Low'
                : latestBand === 'in-band'
                  ? 'In band'
                  : 'No data'}
          </span>
        </div>

        <div className="mt-2 flex items-end justify-between gap-3">
          <div>
            <p className="text-[34px] leading-none font-extrabold text-white">
              {latest ? `${latest.systolic}/${latest.diastolic}` : '—'}{' '}
              <span className="text-[11px] font-medium text-white/50">mmHg</span>
            </p>
            <p className="mt-1.5 text-[11px] text-white/60">
              {latest ? prettyDateTime(latest.measuredAt) : 'No reading yet'}
            </p>
          </div>
          <div className="text-right">
            {sparkPoints ? (
              <svg
                width="110"
                height="34"
                viewBox="0 0 110 34"
                preserveAspectRatio="none"
                aria-hidden
              >
                <polyline
                  points={sparkPoints}
                  fill="none"
                  stroke="#29a997"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : null}
            <p className="mt-1 text-[11px] text-white/70">
              <span className="lang-en">7-day avg</span>
              <span className="lang-hi">7-दिन औसत</span>{' '}
              <strong className="text-white">
                {bp.avgSystolic != null ? `${bp.avgSystolic}/${bp.avgDiastolic}` : '—'}
              </strong>{' '}
              · {bp.windowCount} <span className="lang-en">readings</span>
              <span className="lang-hi">रीडिंग</span>
            </p>
          </div>
        </div>

        <SheetTrigger
          sheet="bp"
          aria-label="Log BP"
          className="mt-3.5 flex h-[50px] w-full items-center justify-center gap-2 rounded-2xl bg-teal text-base font-bold text-white transition active:scale-[0.97]"
        >
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M3 12h4l2-6 4 12 2-6h6" />
          </svg>
          <span className="lang-en" aria-hidden>
            Log BP
          </span>
          <span className="lang-hi" aria-hidden>
            BP दर्ज करें
          </span>
        </SheetTrigger>
      </section>

      {customUnscheduled.length ? (
        <section className="card">
          <p className="eyebrow">Caregiver-added medicines</p>
          <p className="mt-1 text-sm font-bold text-navy">
            Added outside the printed schedule
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {customUnscheduled.map(({ medicine, record }) => (
              <li
                key={medicine.id}
                className="flex items-start justify-between gap-3 rounded-xl bg-paper px-3 py-2.5"
              >
                <div>
                  <p className="text-sm font-bold text-navy">{medicine.brand}</p>
                  <p className="text-xs text-muted">
                    {medicine.dose} · No reminder schedule
                  </p>
                  {record?.takenAt ? (
                    <p className="mt-0.5 text-[11px] text-muted">
                      Recorded {prettyDateTime(record.takenAt)}
                    </p>
                  ) : null}
                </div>
                <span
                  className={`pill shrink-0 ${
                    record?.status === 'taken'
                      ? 'bg-mint text-teal'
                      : record?.status === 'skipped'
                        ? 'bg-coral-soft text-coral'
                        : 'bg-white text-muted'
                  }`}
                >
                  {record?.status === 'taken'
                    ? 'Taken'
                    : record?.status === 'skipped'
                      ? 'Skipped'
                      : 'Added'}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            These entries are caregiver-added and are not part of the current
            printed prescription.
          </p>
        </section>
      ) : null}

      <div className="flex items-baseline justify-between gap-2 px-0.5 pt-0.5">
        <p className="eyebrow">
          <span className="lang-en">Routine medicines</span>
          <span className="lang-hi">रोज़ की दवाइयाँ</span>
        </p>
        <p className="text-[11.5px] font-bold text-muted">
          {pending} <span className="lang-en">left to record</span>
          <span className="lang-hi">बाकी</span>
        </p>
      </div>

      <ul className="flex flex-col gap-3">
        {schedule.map((d) => (
          <DoseCard
            key={`${d.medicine.id}-${d.slotKey}`}
            doseDate={today}
            medicineId={d.medicine.id}
            slotKey={d.slotKey}
            brand={d.medicine.brand}
            dose={d.medicine.dose}
            label={d.label}
            time={d.time}
            tone={d.medicine.tone}
            status={d.status}
            purpose={d.medicine.purpose}
            prescriptionHi={d.medicine.prescriptionHi}
            food={d.medicine.food}
            instruction={d.medicine.instruction}
            caution={d.medicine.caution}
            verify={d.medicine.verify}
            isNext={
              next
                ? next.medicine.id === d.medicine.id && next.slotKey === d.slotKey
                : false
            }
            takenClock={d.record?.takenAt ? careClock(new Date(d.record.takenAt)) : null}
            drift={
              d.record?.takenAt && d.record.scheduledTime
                ? driftMinutes(today, d.record.scheduledTime, new Date(d.record.takenAt))
                : null
            }
          />
        ))}
      </ul>

      <SheetTrigger
        sheet="add"
        aria-label="Add medicine to the schedule"
        className="flex items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed border-sage py-3.5 text-sm font-bold text-teal transition active:scale-[0.98]"
      >
        +{' '}
        <span className="lang-en" aria-hidden>
          Add medicine to the schedule
        </span>
        <span className="lang-hi" aria-hidden>
          शेड्यूल में दवा जोड़ें
        </span>
      </SheetTrigger>

      <p className="px-1 pb-1.5 text-[11px] leading-relaxed text-muted">
        A missing entry does not prove a missed dose. This organiser supports — it
        does not replace — the {prettyRxDate(household.prescriptionDate)} prescription
        and the treating team.
      </p>
    </>
  )
}
