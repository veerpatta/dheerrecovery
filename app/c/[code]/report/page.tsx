import { notFound } from 'next/navigation'
import { BpChart } from '@/components/bp-chart'
import { PrintButton } from '@/components/print-button'
import { bandOf, summarise } from '@/lib/bp'
import {
  buildDaySchedule,
  findHousehold,
  getAllMedicines,
  getBpReadings,
  getCareNotes,
  getDoseRecords,
  getMedicines,
  getSeizureEvents,
} from '@/lib/queries'
import {
  addDays,
  careDate,
  dateRange,
  driftMinutes,
  formatDrift,
  prettyDate,
  prettyDateTime,
  prettyRxDate,
  prettyTime,
} from '@/lib/time'

export const dynamic = 'force-dynamic'

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const { code } = await params
  const sp = await searchParams
  const household = await findHousehold(code)
  if (!household) notFound()

  const today = careDate()
  const isDate = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v)
  const to = isDate(sp.to) ? sp.to! : today
  const from = isDate(sp.from) ? sp.from! : addDays(to, -29)

  const [meds, allMeds, records, readings, seizures, notes] = await Promise.all([
    getMedicines(household.id),
    getAllMedicines(household.id),
    getDoseRecords(household.id, from, to),
    getBpReadings(household.id, 400),
    getSeizureEvents(household.id),
    getCareNotes(household.id),
  ])

  const band = bandOf(household)
  const bp = summarise(readings, band, 30)
  const days = dateRange(from, to).reverse()
  const perDay = days.map((d) => ({
    date: d,
    doses:
      d >= household.courseStart ? buildDaySchedule(meds, records, d) : [],
  }))
  const all = perDay.flatMap((d) => d.doses)
  const activeIds = new Set(meds.map((m) => m.id))
  const medById = new Map(allMeds.map((m) => [m.id, m]))
  const importedRecords = records.filter(
    (r) => !activeIds.has(r.medicineId) && medById.get(r.medicineId)?.archivedAt,
  )
  const taken =
    all.filter((d) => d.status === 'taken').length +
    importedRecords.filter((r) => r.status === 'taken').length
  const skipped =
    all.filter((d) => d.status === 'skipped').length +
    importedRecords.filter((r) => r.status === 'skipped').length
  const notRecorded = all.filter((d) => d.status === 'not-recorded').length

  const rangeReadings = readings.filter((r) => {
    const d = new Date(r.measuredAt).toLocaleDateString('en-CA', {
      timeZone: 'Asia/Kolkata',
    })
    return d >= from && d <= to
  })

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-5 py-8">
      <PrintButton />

      <header className="print-page space-y-2 border-b border-line pb-4">
        <p className="eyebrow">Care report · generated {prettyDate(today)}</p>
        <h1 className="text-2xl font-bold tracking-tight text-navy">
          {household.patientName} — medicine &amp; recovery record
        </h1>
        <p className="text-sm text-muted">
          Prescription {prettyRxDate(household.prescriptionDate)} ·{' '}
          {household.prescriberName} · Paras Hospitals
        </p>
        <p className="text-sm text-muted">
          Reporting period {prettyDate(from)} → {prettyDate(to)}
        </p>
        <div className="mt-3 grid grid-cols-3 gap-3 text-center">
          {[
            { k: 'Taken', v: taken },
            { k: 'Skipped', v: skipped },
            { k: 'Not recorded', v: notRecorded },
          ].map((s) => (
            <div key={s.k} className="rounded-xl bg-paper px-3 py-2.5">
              <p className="text-xl font-bold text-navy">{s.v}</p>
              <p className="eyebrow">{s.k}</p>
            </div>
          ))}
        </div>
        <p className="pt-2 text-xs leading-relaxed text-muted">
          Caregiver record only. A missing entry does not prove a missed dose.
          Reminder clock times are a caregiver organiser; only Betacap’s 8:00 AM is
          printed on the prescription.
        </p>
      </header>

      <section className="print-page space-y-3">
        <h2 className="text-lg font-bold text-navy">1 · Current medicine chart</h2>
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-line text-[10px] tracking-wide text-muted uppercase">
              <th className="py-2 pr-2 font-semibold">Medicine</th>
              <th className="py-2 pr-2 font-semibold">Dose</th>
              <th className="py-2 pr-2 font-semibold">Prescribed</th>
              <th className="py-2 font-semibold">Times</th>
            </tr>
          </thead>
          <tbody>
            {meds.map((m) => (
              <tr key={m.id} className="border-b border-line/60 align-top">
                <td className="py-2 pr-2">
                  <span className="font-semibold text-navy">{m.brand}</span>
                  <span className="block text-muted">{m.generic}</span>
                </td>
                <td className="py-2 pr-2">{m.dose}</td>
                <td className="py-2 pr-2">{m.prescription}</td>
                <td className="py-2">
                  {m.slots.length
                    ? m.slots.map((s) => prettyTime(s.time)).join(' · ')
                    : m.kind === 'sos'
                      ? `SOS — ${m.sosStatus}`
                      : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="print-page space-y-3">
        <h2 className="text-lg font-bold text-navy">2 · Blood pressure</h2>
        <p className="text-sm text-muted">
          {bp.count} readings on file. 30-day average{' '}
          {bp.avgSystolic != null ? `${bp.avgSystolic}/${bp.avgDiastolic}` : '—'}.
          Home reference band {band.systolicLow}/{band.diastolicLow}–
          {band.systolicHigh}/{band.diastolicHigh}.
        </p>
        <BpChart readings={rangeReadings} band={band} height={200} />
        {rangeReadings.length ? (
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-line text-[10px] tracking-wide text-muted uppercase">
                <th className="py-2 pr-2 font-semibold">When</th>
                <th className="py-2 pr-2 font-semibold">BP</th>
                <th className="py-2 pr-2 font-semibold">Pulse</th>
                <th className="py-2 font-semibold">Context / symptoms</th>
              </tr>
            </thead>
            <tbody>
              {rangeReadings.map((r) => (
                <tr key={r.id} className="border-b border-line/60">
                  <td className="py-1.5 pr-2">{prettyDateTime(r.measuredAt)}</td>
                  <td className="py-1.5 pr-2 font-semibold text-navy">
                    {r.systolic}/{r.diastolic}
                  </td>
                  <td className="py-1.5 pr-2">{r.pulse ?? '—'}</td>
                  <td className="py-1.5">
                    {[r.context, r.position, r.arm, r.symptoms]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>

      {importedRecords.length ? (
        <section className="print-page space-y-3">
          <h2 className="text-lg font-bold text-navy">
            Prior prescription appendix
          </h2>
          <p className="text-xs leading-relaxed text-muted">
            Preserved from the earlier Dheer Recovery site and kept separate from
            the current medicine chart.
          </p>
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-line text-[10px] tracking-wide text-muted uppercase">
                <th className="py-2 pr-2 font-semibold">Date</th>
                <th className="py-2 pr-2 font-semibold">Time</th>
                <th className="py-2 pr-2 font-semibold">Medicine</th>
                <th className="py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {importedRecords.map((record) => {
                const medicine = medById.get(record.medicineId)
                return (
                  <tr key={record.id} className="border-b border-line/60">
                    <td className="py-1.5 pr-2">{prettyDate(record.doseDate)}</td>
                    <td className="py-1.5 pr-2">
                      {record.scheduledTime
                        ? prettyTime(record.scheduledTime)
                        : '—'}
                    </td>
                    <td className="py-1.5 pr-2 font-medium text-navy">
                      {medicine?.brand ?? 'Previous medicine'}{' '}
                      <span className="font-normal text-muted">
                        {medicine?.dose ?? ''}
                      </span>
                    </td>
                    <td className="py-1.5">
                      {record.status === 'taken' ? 'Taken' : 'Skipped'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>
      ) : null}

      <section className="print-page space-y-3">
        <h2 className="text-lg font-bold text-navy">3 · Dose ledger</h2>
        {perDay.map((day) => (
          <div key={day.date} className="space-y-1">
            <h3 className="text-sm font-bold text-navy">{prettyDate(day.date)}</h3>
            <table className="w-full text-left text-xs">
              <tbody>
                {day.doses.map((d) => {
                  const drift =
                    d.record?.takenAt && d.record.scheduledTime
                      ? driftMinutes(
                          day.date,
                          d.record.scheduledTime,
                          new Date(d.record.takenAt),
                        )
                      : null
                  return (
                    <tr
                      key={`${d.medicine.id}-${d.slotKey}`}
                      className="border-b border-line/60"
                    >
                      <td className="w-20 py-1.5 pr-2 text-muted">
                        {prettyTime(d.time)}
                      </td>
                      <td className="py-1.5 pr-2 font-medium text-navy">
                        {d.medicine.brand}
                      </td>
                      <td className="w-24 py-1.5 pr-2">
                        {d.status === 'not-recorded'
                          ? 'Not recorded'
                          : d.status === 'upcoming'
                            ? 'Upcoming'
                            : d.status === 'taken'
                              ? 'Taken'
                              : 'Skipped'}
                      </td>
                      <td className="w-28 py-1.5 text-muted">
                        {drift !== null ? formatDrift(drift) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ))}
      </section>

      <section className="print-page space-y-3">
        <h2 className="text-lg font-bold text-navy">4 · Seizure events</h2>
        {seizures.length ? (
          <ul className="space-y-2 text-sm">
            {seizures.map((s) => (
              <li key={s.id} className="border-b border-line/60 pb-2">
                <p className="font-semibold text-navy">
                  {prettyDateTime(s.occurredAt)}
                  {s.durationMinutes != null ? ` · ${s.durationMinutes} min` : ''}
                  {s.recoveryMinutes != null
                    ? ` · ${s.recoveryMinutes} min recovery`
                    : ''}
                </p>
                {s.description ? (
                  <p className="text-muted">{s.description}</p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No seizure events recorded.</p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-navy">5 · Caregiver notes</h2>
        {notes.length ? (
          <ul className="space-y-2 text-sm">
            {notes.map((n) => (
              <li key={n.id} className="border-b border-line/60 pb-2">
                <p className="text-xs text-muted">{prettyDateTime(n.createdAt)}</p>
                <p>{n.body}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No caregiver notes recorded.</p>
        )}
      </section>
    </div>
  )
}
