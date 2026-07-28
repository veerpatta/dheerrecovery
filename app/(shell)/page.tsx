import { SheetTrigger } from '@/components/chrome'
import { DoseCard } from '@/components/dose-card'
import { LoggedDoseRow } from '@/components/logged-dose-row'
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
  careMinutes,
  driftMinutes,
  minutesOf,
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

  /*
   * The day as it actually happened: the seven scheduled slots plus every
   * unscheduled dose that was logged, in one list ordered by time. SOS rows
   * are merged into the *view* only — they never enter `schedule`, which is
   * what the progress ring, "left to record" and every adherence figure in
   * the app are counted from.
   */
  const medById = new Map(meds.map((m) => [m.id, m]))
  const logged = records
    .filter((r) => /^(sos|manual)-/.test(r.slotKey) && medById.has(r.medicineId))
    .map((r) => {
      const at = new Date(r.takenAt ?? r.createdAt)
      return { record: r, medicine: medById.get(r.medicineId)!, at }
    })

  type TimelineItem =
    | { kind: 'scheduled'; minutes: number; dose: (typeof schedule)[number] }
    | { kind: 'logged'; minutes: number; entry: (typeof logged)[number] }

  const timeline: TimelineItem[] = [
    ...schedule.map((dose) => ({
      kind: 'scheduled' as const,
      minutes: minutesOf(dose.time),
      dose,
    })),
    ...logged.map((entry) => ({
      kind: 'logged' as const,
      minutes: careMinutes(entry.at),
      entry,
    })),
  ].sort((a, b) => a.minutes - b.minutes)

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

      <div className="flex items-baseline justify-between gap-2 px-0.5 pt-0.5">
        <p className="eyebrow">
          <span className="lang-en">Today’s timeline</span>
          <span className="lang-hi">आज का क्रम</span>
        </p>
        <p className="text-[11.5px] font-bold text-muted">
          {pending} <span className="lang-en">left to record</span>
          <span className="lang-hi">बाकी</span>
        </p>
      </div>

      <ul className="flex flex-col gap-3">
        {timeline.map((item) =>
          item.kind === 'scheduled' ? (
            <DoseCard
              key={`${item.dose.medicine.id}-${item.dose.slotKey}`}
              doseDate={today}
              medicineId={item.dose.medicine.id}
              slotKey={item.dose.slotKey}
              brand={item.dose.medicine.brand}
              dose={item.dose.medicine.dose}
              label={item.dose.label}
              time={item.dose.time}
              plannedTime={item.dose.plannedTime}
              intervalHours={item.dose.intervalHours}
              rollsOver={item.dose.rollsOver}
              derivedFrom={
                item.dose.derivedFrom
                  ? {
                      label: item.dose.derivedFrom.label,
                      takenAt: item.dose.derivedFrom.takenAt.toISOString(),
                    }
                  : null
              }
              tone={item.dose.medicine.tone}
              status={item.dose.status}
              purpose={item.dose.medicine.purpose}
              prescriptionHi={item.dose.medicine.prescriptionHi}
              food={item.dose.medicine.food}
              instruction={item.dose.medicine.instruction}
              caution={item.dose.medicine.caution}
              verify={item.dose.medicine.verify}
              isNext={
                next
                  ? next.medicine.id === item.dose.medicine.id &&
                    next.slotKey === item.dose.slotKey
                  : false
              }
              takenClock={
                item.dose.record?.takenAt
                  ? careClock(new Date(item.dose.record.takenAt))
                  : null
              }
              drift={
                item.dose.record?.takenAt && item.dose.record.scheduledTime
                  ? driftMinutes(
                      today,
                      item.dose.record.scheduledTime,
                      new Date(item.dose.record.takenAt),
                    )
                  : null
              }
            />
          ) : (
            <LoggedDoseRow
              key={item.entry.record.id}
              recordId={item.entry.record.id}
              brand={item.entry.medicine.brand}
              dose={item.entry.medicine.dose}
              when={prettyTime(careClock(item.entry.at))}
              note={item.entry.record.note}
              isSos={item.entry.record.slotKey.startsWith('sos-')}
            />
          ),
        )}
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
