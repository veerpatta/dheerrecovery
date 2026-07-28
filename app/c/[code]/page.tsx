import Link from 'next/link'
import { notFound } from 'next/navigation'
import { DoseCard } from '@/components/dose-card'
import { bandOf, summarise } from '@/lib/bp'
import {
  buildDaySchedule,
  findHousehold,
  getBpReadings,
  getDoseRecords,
  getMedicines,
} from '@/lib/queries'
import {
  careDate,
  driftMinutes,
  prettyDate,
  prettyDateTime,
  prettyRxDate,
  prettyTime,
} from '@/lib/time'

export const dynamic = 'force-dynamic'

export default async function TodayPage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = await params
  const household = await findHousehold(code)
  if (!household) notFound()

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
  const manualRecords = records.filter((record) =>
    record.slotKey.startsWith('manual-'),
  )
  const customUnscheduled = meds
    .filter((medicine) => medicine.isCustom && medicine.slots.length === 0)
    .map((medicine) => ({
      medicine,
      record: manualRecords.find(
        (record) => record.medicineId === medicine.id,
      ),
    }))

  const routineCount = meds.filter((m) => m.kind === 'routine').length
  const sosCount = meds.filter((m) => m.kind === 'sos').length
  const bp = summarise(readings, bandOf(household))

  return (
    <>
      <section className="card">
        <p className="eyebrow">Today</p>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-xl font-bold tracking-tight text-navy">
            Today’s medicines
          </h1>
          <p className="text-sm font-semibold text-teal">
            {taken}/{schedule.length} taken
          </p>
        </div>
        <p className="mt-1 text-sm text-muted">{prettyDate(today)}</p>
        <div
          className="mt-3 h-2 w-full overflow-hidden rounded-full bg-paper"
          role="progressbar"
          aria-valuenow={taken}
          aria-valuemin={0}
          aria-valuemax={schedule.length}
        >
          <div
            className="h-full rounded-full bg-teal transition-all"
            style={{
              width: `${schedule.length ? (taken / schedule.length) * 100 : 0}%`,
            }}
          />
        </div>
      </section>

      <section className="card">
        <p className="eyebrow">Current prescription</p>
        <h2 className="mt-1 text-base font-bold text-navy">
          {prettyRxDate(household.prescriptionDate)} · {household.prescriberName}
        </h2>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          <span className="pill bg-mint text-teal">{routineCount} routine</span>
          <span className="pill bg-coral-soft text-coral">{sosCount} SOS guides</span>
        </div>
        <Link
          href={`/c/${code}/chart`}
          className="mt-3 inline-block text-sm font-semibold text-teal underline-offset-4 hover:underline"
        >
          See every detail →
        </Link>
      </section>

      <section className="card">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="eyebrow">Blood pressure snapshot</p>
            <p className="mt-1 text-2xl font-bold text-navy">
              {bp.latest ? `${bp.latest.systolic}/${bp.latest.diastolic}` : '—'}
            </p>
            <p className="text-xs text-muted">
              {bp.latest
                ? prettyDateTime(bp.latest.measuredAt)
                : 'No reading yet'}
            </p>
          </div>
          <div className="text-right">
            <p className="eyebrow">7-day avg</p>
            <p className="mt-1 text-2xl font-bold text-navy">
              {bp.avgSystolic != null
                ? `${bp.avgSystolic}/${bp.avgDiastolic}`
                : '—'}
            </p>
            <p className="text-xs text-muted">{bp.windowCount} readings</p>
          </div>
        </div>
        {bp.windowCount < 1 ? (
          <p className="mt-2 text-xs text-muted">
            Add readings to see a 7-day trend.
          </p>
        ) : null}
        <div className="mt-3 flex gap-2">
          <Link href={`/c/${code}/logs#log-bp`} className="btn-primary flex-1">
            Log BP
          </Link>
          <Link href={`/c/${code}/logs`} className="btn-ghost flex-1">
            View analysis
          </Link>
        </div>
      </section>

      {customUnscheduled.length ? (
        <section className="card">
          <p className="eyebrow">Caregiver-added medicines</p>
          <h2 className="mt-1 text-base font-bold text-navy">
            Added outside the printed schedule
          </h2>
          <ul className="mt-3 space-y-2">
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

      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
          <p className="eyebrow">Routine medicines · earliest to latest</p>
          <p className="text-xs font-semibold text-muted">
            {pending} left to record
          </p>
        </div>
        {next ? (
          <p className="px-1 text-sm font-semibold text-navy">
            Next: {next.medicine.brand} · {prettyTime(next.time)}
          </p>
        ) : null}
        <p className="px-1 text-xs leading-relaxed text-muted">
          Reminder times are editable. Morning/evening wording and the printed 8:00
          AM Betacap time stay visible.
        </p>

        <ul className="space-y-3">
          {schedule.map((d) => (
            <DoseCard
              key={`${d.medicine.id}-${d.slotKey}`}
              code={code}
              doseDate={today}
              medicineId={d.medicine.id}
              slotKey={d.slotKey}
              brand={d.medicine.brand}
              dose={d.medicine.dose}
              label={d.label}
              time={d.time}
              tone={d.medicine.tone}
              status={d.status}
              verify={d.medicine.verify}
              drift={
                d.record?.takenAt && d.record.scheduledTime
                  ? driftMinutes(
                      today,
                      d.record.scheduledTime,
                      new Date(d.record.takenAt),
                    )
                  : null
              }
            />
          ))}
        </ul>
      </section>

      <p className="px-1 pb-2 text-xs leading-relaxed text-muted">
        A missing entry does not prove a missed dose. This organiser supports — it
        does not replace — the {prettyRxDate(household.prescriptionDate)} prescription
        and the treating team.
      </p>
    </>
  )
}
