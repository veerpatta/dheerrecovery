import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  buildDaySchedule,
  findHousehold,
  getDoseRecords,
  getMedicines,
} from '@/lib/queries'
import {
  addDays,
  careDate,
  dateRange,
  driftMinutes,
  formatDrift,
  prettyDate,
  prettyTime,
} from '@/lib/time'
import { RangeForm } from '@/components/range-form'

export const dynamic = 'force-dynamic'

const STATUS_TEXT: Record<string, { label: string; className: string }> = {
  taken: { label: 'Taken', className: 'text-teal' },
  skipped: { label: 'Skipped', className: 'text-coral' },
  'not-recorded': { label: 'Not recorded', className: 'text-amber' },
  upcoming: { label: 'Upcoming', className: 'text-muted' },
}

export default async function HistoryPage({
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
  const from = isDate(sp.from) ? sp.from! : addDays(to, -13)
  const [lo, hi] = from <= to ? [from, to] : [to, from]

  const [meds, records] = await Promise.all([
    getMedicines(household.id),
    getDoseRecords(household.id, lo, hi),
  ])

  const days = dateRange(lo, hi).reverse()
  const perDay = days.map((d) => ({
    date: d,
    doses: buildDaySchedule(meds, records, d),
  }))

  const all = perDay.flatMap((d) => d.doses)
  const taken = all.filter((d) => d.status === 'taken').length
  const skipped = all.filter((d) => d.status === 'skipped').length
  const notRecorded = all.filter((d) => d.status === 'not-recorded').length
  const pastSlots = taken + skipped + notRecorded
  const completion = pastSlots ? Math.round((taken / pastSlots) * 100) : 0

  const medById = new Map(meds.map((m) => [m.id, m]))
  const sosLogs = records
    .filter((r) => medById.get(r.medicineId)?.kind === 'sos')
    .sort((a, b) => (a.takenAt && b.takenAt ? +new Date(b.takenAt) - +new Date(a.takenAt) : 0))

  return (
    <>
      <section className="card">
        <p className="eyebrow">Daily care ledger</p>
        <h1 className="mt-1 text-xl font-bold tracking-tight text-navy">
          History, trends &amp; exports
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          Every Taken or Skipped tap is kept by date in the shared database.
          Review the record here or export a doctor-ready copy.
        </p>
      </section>

      <section className="card no-print">
        <p className="eyebrow">Complete backup</p>
        <h2 className="mt-1 text-base font-bold text-navy">
          One record across medicines and recovery logs
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          Exports include the complete medicine ledger, scheduled and actual times,
          BP readings, seizure events and caregiver notes.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <a
            href={`/c/${code}/export/xlsx?from=${lo}&to=${hi}`}
            className="btn-ghost flex-col !items-start gap-0.5 !py-3"
          >
            <span className="text-sm font-bold text-navy">Export all to Excel</span>
            <span className="text-xs font-normal text-muted">
              5 organised worksheets · .xlsx
            </span>
          </a>
          <Link
            href={`/c/${code}/report?from=${lo}&to=${hi}`}
            className="btn-ghost flex-col !items-start gap-0.5 !py-3"
          >
            <span className="text-sm font-bold text-navy">Doctor report (PDF)</span>
            <span className="text-xs font-normal text-muted">
              Printable multi-page care report
            </span>
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { k: 'Taken', v: taken, sub: 'recorded doses', c: 'text-teal' },
          { k: 'Skipped', v: skipped, sub: 'marked by caregiver', c: 'text-coral' },
          { k: 'Not recorded', v: notRecorded, sub: 'no caregiver entry', c: 'text-amber' },
          {
            k: 'Log completion',
            v: `${completion}%`,
            sub: 'taken ÷ past slots',
            c: 'text-navy',
          },
        ].map((s) => (
          <div key={s.k} className="card !p-4">
            <p className="eyebrow">{s.k}</p>
            <p className={`mt-1 text-2xl font-bold ${s.c}`}>{s.v}</p>
            <p className="text-[11px] text-muted">{s.sub}</p>
          </div>
        ))}
      </section>

      <RangeForm code={code} from={lo} to={hi} />

      <section className="space-y-4">
        {perDay.map((day) => {
          const t = day.doses.filter((d) => d.status === 'taken').length
          const s = day.doses.filter((d) => d.status === 'skipped').length
          const n = day.doses.filter((d) => d.status === 'not-recorded').length
          return (
            <div key={day.date} className="card !p-0">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-3">
                <p className="text-sm font-bold text-navy">
                  {prettyDate(day.date)}
                </p>
                <p className="text-xs text-muted">
                  {t} taken · {s} skipped · {n} not recorded
                  <span className="ml-2 font-semibold text-navy">
                    {t}/{day.doses.length}
                  </span>
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[36rem] text-left text-sm">
                  <thead>
                    <tr className="text-[10px] tracking-[0.12em] text-muted uppercase">
                      <th className="px-4 py-2 font-semibold">Time</th>
                      <th className="px-4 py-2 font-semibold">Medicine</th>
                      <th className="px-4 py-2 font-semibold">Status</th>
                      <th className="px-4 py-2 font-semibold">Recorded</th>
                      <th className="px-4 py-2 font-semibold">Difference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {day.doses.map((d) => {
                      const st = STATUS_TEXT[d.status]
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
                          className="border-t border-line/70 align-top"
                        >
                          <td className="px-4 py-2.5 whitespace-nowrap text-muted">
                            {prettyTime(d.time)}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="font-semibold text-navy">
                              {d.medicine.brand}
                            </span>
                            <span className="block text-xs text-muted">
                              {d.medicine.dose} · {d.label}
                            </span>
                          </td>
                          <td
                            className={`px-4 py-2.5 font-semibold whitespace-nowrap ${st.className}`}
                          >
                            {st.label}
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap text-muted">
                            {d.record?.takenAt
                              ? new Date(d.record.takenAt).toLocaleTimeString(
                                  'en-GB',
                                  {
                                    timeZone: 'Asia/Kolkata',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  },
                                )
                              : '—'}
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap text-muted">
                            {drift !== null ? formatDrift(drift) : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })}
      </section>

      {sosLogs.length ? (
        <section className="card">
          <p className="eyebrow text-coral">SOS doses in this range</p>
          <ul className="mt-2 space-y-2">
            {sosLogs.map((r) => (
              <li
                key={r.id}
                className="flex items-baseline justify-between gap-3 rounded-xl bg-paper px-3 py-2.5 text-sm"
              >
                <span className="font-semibold text-navy">
                  {medById.get(r.medicineId)?.brand}
                </span>
                <span className="text-xs text-muted">
                  {r.takenAt
                    ? new Date(r.takenAt).toLocaleString('en-GB', {
                        timeZone: 'Asia/Kolkata',
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : r.doseDate}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="px-1 pb-2 text-xs leading-relaxed text-muted">
        Complete shared record. History and recovery logs are stored under the
        private caregiver link. A missing entry does not prove a missed dose.
      </p>
    </>
  )
}
