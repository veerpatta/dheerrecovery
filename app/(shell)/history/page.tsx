import Link from 'next/link'
import { RangeForm } from '@/components/range-form'
import { getHousehold } from '@/lib/household'
import { getAllMedicines, getDoseRecords, getMedicines } from '@/lib/queries'
import {
  buildDoseMatrix,
  intakeTotals,
  onTimeScore,
  perfectDays,
  totals,
} from '@/lib/stats'
import {
  addDays,
  careDate,
  dateRange,
  driftMinutes,
  formatDrift,
  formatGap,
  prettyDate,
  prettyDateTime,
  prettyTime,
  shortDay,
} from '@/lib/time'
import { toneOf } from '@/lib/tone'

export const dynamic = 'force-dynamic'

const STATUS_TEXT: Record<string, { label: string; className: string }> = {
  taken: { label: 'Taken', className: 'text-teal' },
  skipped: { label: 'Skipped', className: 'text-coral' },
  'not-recorded': { label: 'Not recorded', className: 'text-amber' },
  upcoming: { label: 'Upcoming', className: 'text-muted' },
}

const HEAT_CELL: Record<string, string> = {
  taken: 'bg-teal',
  skipped: 'bg-coral',
  'not-recorded': 'bg-amber/40',
  upcoming: 'bg-line',
}

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const sp = await searchParams
  const household = await getHousehold()

  const today = careDate()
  const isDate = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v)
  const to = isDate(sp.to) ? sp.to! : today
  const from = isDate(sp.from) ? sp.from! : addDays(to, -13)
  const [lo, hi] = from <= to ? [from, to] : [to, from]

  const [meds, allMeds, records] = await Promise.all([
    getMedicines(household.id),
    getAllMedicines(household.id),
    getDoseRecords(household.id, lo, hi),
  ])

  // One pass over the grid feeds the stat cards, the dose map, the on-time
  // score, perfect days, the intake cards and the ledger.
  const days = dateRange(lo, hi)
    .reverse()
    .filter((d) => d >= household.courseStart)
  const matrix = buildDoseMatrix(meds, records, days)
  const stats = totals(matrix)
  const onTime = onTimeScore(matrix)
  const perfect = perfectDays(matrix)
  const intake = intakeTotals(meds, matrix)

  const activeIds = new Set(meds.map((m) => m.id))
  const medById = new Map(allMeds.map((m) => [m.id, m]))
  const importedRecords = records
    .filter((r) => !activeIds.has(r.medicineId) && medById.get(r.medicineId)?.archivedAt)
    .sort((a, b) => {
      const left = a.takenAt ? +new Date(a.takenAt) : +new Date(a.createdAt)
      const right = b.takenAt ? +new Date(b.takenAt) : +new Date(b.createdAt)
      return right - left
    })

  // Archived medicines still carry recorded doses; count them in the totals.
  const taken = stats.taken + importedRecords.filter((r) => r.status === 'taken').length
  const skipped =
    stats.skipped + importedRecords.filter((r) => r.status === 'skipped').length
  const pastSlots = taken + skipped + stats.notRecorded
  const completion = pastSlots ? Math.round((taken / pastSlots) * 100) : 0

  const sosLogs = records
    .filter(
      (r) => activeIds.has(r.medicineId) && medById.get(r.medicineId)?.kind === 'sos',
    )
    .sort((a, b) =>
      a.takenAt && b.takenAt ? +new Date(b.takenAt) - +new Date(a.takenAt) : 0,
    )

  return (
    <>
      <section className="card">
        <p className="eyebrow">Daily care ledger</p>
        <h1 className="mt-1 text-xl font-extrabold tracking-tight text-navy">
          <span className="lang-en">History, trends &amp; exports</span>
          <span className="lang-hi">इतिहास और निर्यात</span>
        </h1>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
          Every Taken or Skipped tap is kept by date in the shared database. Review
          the record here or export a doctor-ready copy.
        </p>
      </section>

      <section className="card flex flex-col gap-2 no-print">
        <p className="eyebrow">Complete backup</p>
        {/* Both must stay real navigations — one downloads, one leaves the shell. */}
        <a
          href={`/export/xlsx?from=${lo}&to=${hi}`}
          className="flex flex-col items-start gap-0.5 rounded-[13px] border border-line bg-white px-3.5 py-3 transition active:scale-[0.98]"
        >
          <span className="text-sm font-extrabold text-navy">Export all to Excel</span>
          <span className="text-[11.5px] text-muted">
            6 organised worksheets · .xlsx
          </span>
        </a>
        <Link
          href={`/report?from=${lo}&to=${hi}`}
          className="flex flex-col items-start gap-0.5 rounded-[13px] border border-line bg-white px-3.5 py-3 transition active:scale-[0.98]"
        >
          <span className="text-sm font-extrabold text-navy">Doctor report (PDF)</span>
          <span className="text-[11.5px] text-muted">
            Printable multi-page care report
          </span>
        </Link>
      </section>

      {/*
        The stat cards come before the dose map on purpose: the map's legend
        also contains the word "Taken", and the totals should read first.
      */}
      <section className="grid grid-cols-2 gap-2.5">
        {[
          { k: 'Taken', v: taken, sub: 'recorded doses', c: 'text-teal' },
          { k: 'Skipped', v: skipped, sub: 'marked by caregiver', c: 'text-coral' },
          {
            k: 'Not recorded',
            v: stats.notRecorded,
            sub: 'no caregiver entry',
            c: 'text-amber',
          },
          {
            k: 'Log completion',
            v: `${completion}%`,
            sub: 'taken ÷ past slots',
            c: 'text-navy',
          },
        ].map((s) => (
          <div key={s.k} className="rounded-[14px] border border-line bg-white px-3.5 py-3">
            <p className="eyebrow text-[10px]">{s.k}</p>
            <p className={`mt-0.5 text-[22px] font-extrabold ${s.c}`}>{s.v}</p>
            <p className="text-[10.5px] text-muted">{s.sub}</p>
          </div>
        ))}
      </section>

      <RangeForm from={lo} to={hi} />

      {matrix.length ? (
        <section className="card flex flex-col gap-2.5">
          <div>
            <p className="eyebrow">
              <span className="lang-en">Dose map</span>
              <span className="lang-hi">खुराक नक्शा</span>
            </p>
            <h2 className="mt-1 text-[15px] font-extrabold text-navy">
              <span className="lang-en">Every dose at a glance</span>
              <span className="lang-hi">हर खुराक एक नज़र में</span>
            </h2>
          </div>
          <div className="flex flex-col gap-1.5">
            {matrix.map((day) => {
              const t = day.cells.filter((c) => c.status === 'taken').length
              return (
                <div key={day.isoDate} className="flex items-center gap-2">
                  <span className="w-[46px] shrink-0 text-[10.5px] font-semibold text-muted">
                    {shortDay(day.isoDate)}
                  </span>
                  <div className="flex flex-1 gap-[3px]">
                    {day.cells.map((c) => (
                      <span
                        key={`${c.medicineId}-${c.slotKey}`}
                        title={`${c.brand} · ${prettyTime(c.time)} · ${STATUS_TEXT[c.status].label}`}
                        className={`h-[15px] flex-1 rounded ${HEAT_CELL[c.status]}`}
                      />
                    ))}
                  </div>
                  <span className="w-[30px] shrink-0 text-right text-[10.5px] font-bold text-navy">
                    {t}/{day.cells.length}
                  </span>
                </div>
              )
            })}
          </div>
          <div className="flex flex-wrap gap-3 text-[10.5px] text-muted">
            {[
              ['bg-teal', 'Taken'],
              ['bg-coral', 'Skipped'],
              ['bg-amber/40', 'Not recorded'],
              ['bg-line', 'Upcoming'],
            ].map(([cls, label]) => (
              <span key={label} className="flex items-center gap-1.5">
                <span className={`h-[11px] w-[11px] rounded ${cls}`} aria-hidden />
                {label}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      <section className="grid grid-cols-2 gap-2.5">
        <div className="rounded-[14px] border border-line bg-white px-3.5 py-3">
          <p className="eyebrow text-[10px]">On-time score</p>
          <p className="mt-0.5 text-[22px] font-extrabold text-navy">
            {onTime !== null ? `±${formatGap(onTime)}` : '—'}
          </p>
          <p className="text-[10.5px] text-muted">average gap from scheduled time</p>
        </div>
        <div className="rounded-[14px] border border-line bg-white px-3.5 py-3">
          <p className="eyebrow text-[10px]">Perfect days</p>
          <p className="mt-0.5 text-[22px] font-extrabold text-teal">{perfect}</p>
          <p className="text-[10.5px] text-muted">every dose recorded taken</p>
        </div>
      </section>

      {intake.length ? (
        <>
          <p className="eyebrow px-0.5">
            <span className="lang-en">Medicine intake · salts taken</span>
            <span className="lang-hi">दवा की मात्रा · लिया गया साल्ट</span>
          </p>
          {intake.map((c) => (
            <div key={c.medicineId} className="card-toned">
              <span className={`spine ${toneOf(c.tone).bar}`} aria-hidden />
              <div className="flex flex-col gap-2.5 py-3.5 pr-3.5 pl-[18px]">
                <div className="flex items-center justify-between gap-2.5">
                  <p className="text-[14.5px] font-extrabold text-navy">{c.brand}</p>
                  <span className="shrink-0 rounded-full bg-paper px-2.5 py-1 text-[10.5px] font-bold text-muted">
                    {c.taken} of {c.expected} doses
                  </span>
                </div>
                {c.salts.length ? (
                  c.salts.map((s) => (
                    <div key={s.name} className="flex items-baseline justify-between gap-2.5">
                      <p className="text-xs text-muted">{s.name}</p>
                      <p className="text-base font-extrabold text-navy">
                        {s.total.toLocaleString('en-IN')} mg
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted">
                    Salt breakdown not recorded for caregiver-added medicines.
                  </p>
                )}
                <div className="h-1.5 overflow-hidden rounded-full bg-paper">
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: `${c.percent}%`,
                      background: toneOf(c.tone).hex,
                    }}
                  />
                </div>
                <p className="text-[10.5px] text-muted">
                  {c.expected
                    ? `${c.percent}% of expected doses recorded taken`
                    : 'No dose due yet in this range'}
                </p>
              </div>
            </div>
          ))}
          <p className="px-1 text-[11px] leading-relaxed text-muted">
            Totals count only doses recorded as taken — a missing entry does not
            prove a missed dose.
          </p>
        </>
      ) : null}

      {importedRecords.length ? (
        <section className="card !p-0">
          <div className="border-b border-line px-3.5 py-3">
            <p className="eyebrow">Imported prior prescription</p>
            <h2 className="mt-1 text-sm font-extrabold text-navy">
              Previous medicine records preserved
            </h2>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">
              These entries came from the earlier Dheer Recovery site and remain
              separate from the current prescription.
            </p>
          </div>
          <ul className="flex flex-col">
            {importedRecords.map((record) => {
              const medicine = medById.get(record.medicineId)
              return (
                <li
                  key={record.id}
                  className="flex items-center gap-2.5 border-b border-line/60 px-3.5 py-2.5 last:border-b-0"
                >
                  <span className="w-14 shrink-0 text-[11.5px] text-muted">
                    {record.scheduledTime ? prettyTime(record.scheduledTime) : '—'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-bold text-navy">
                      {medicine?.brand ?? 'Previous medicine'}
                    </p>
                    <p className="truncate text-[10.5px] text-muted">
                      {prettyDate(record.doseDate)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p
                      className={`text-[11.5px] font-bold ${
                        record.status === 'taken' ? 'text-teal' : 'text-coral'
                      }`}
                    >
                      {record.status === 'taken' ? 'Taken' : 'Skipped'}
                    </p>
                    <p className="text-[10px] text-muted">
                      {record.takenAt ? prettyDateTime(record.takenAt) : '—'}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      <p className="eyebrow mt-0.5 px-0.5">
        <span className="lang-en">Day-by-day ledger</span>
        <span className="lang-hi">दिन-प्रतिदिन का रिकॉर्ड</span>
      </p>

      {matrix.map((day) => {
        const t = day.cells.filter((c) => c.status === 'taken').length
        const s = day.cells.filter((c) => c.status === 'skipped').length
        const n = day.cells.filter((c) => c.status === 'not-recorded').length
        return (
          <div key={day.isoDate} className="card !overflow-hidden !p-0">
            <div className="flex items-baseline justify-between gap-2 border-b border-line px-3.5 py-2.5">
              <p className="text-[13px] font-extrabold text-navy">
                {prettyDate(day.isoDate)}
              </p>
              <p className="text-[11px] text-muted">
                {t}/{day.cells.length} taken · {s} skipped · {n} not recorded
              </p>
            </div>
            <ul className="flex flex-col">
              {day.cells.map((c) => {
                const st = STATUS_TEXT[c.status]
                const drift =
                  c.record?.takenAt && c.record.scheduledTime
                    ? driftMinutes(
                        day.isoDate,
                        c.record.scheduledTime,
                        new Date(c.record.takenAt),
                      )
                    : null
                return (
                  <li
                    key={`${c.medicineId}-${c.slotKey}`}
                    className="flex items-center gap-2.5 border-b border-line/60 px-3.5 py-2.5 last:border-b-0"
                  >
                    <span className="w-14 shrink-0 text-[11.5px] text-muted">
                      {prettyTime(c.time)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] font-bold text-navy">
                        {c.brand}
                      </p>
                      <p className="truncate text-[10.5px] text-muted">{c.label}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`text-[11.5px] font-bold ${st.className}`}>
                        {st.label}
                      </p>
                      <p className="text-[10px] text-muted">
                        {c.record?.takenAt
                          ? `${prettyDateTime(c.record.takenAt)}${drift !== null ? ` · ${formatDrift(drift)}` : ''}`
                          : '—'}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}

      {sosLogs.length ? (
        <section className="card flex flex-col gap-2">
          <p className="eyebrow text-coral">SOS doses in this range</p>
          {sosLogs.map((r) => (
            <div
              key={r.id}
              className="flex items-baseline justify-between gap-2.5 rounded-xl bg-paper px-2.5 py-2.5"
            >
              <span className="text-[13px] font-bold text-navy">
                {medById.get(r.medicineId)?.brand}
              </span>
              <span className="text-[11px] text-muted">
                {r.takenAt ? prettyDateTime(r.takenAt) : r.doseDate}
              </span>
            </div>
          ))}
        </section>
      ) : null}

      <p className="px-1 pb-1.5 text-[11px] leading-relaxed text-muted">
        Complete shared record. History and recovery logs are stored in the shared
        database. A missing entry does not prove a missed dose.
      </p>
    </>
  )
}
