import { notFound } from 'next/navigation'
import { BpChart } from '@/components/bp-chart'
import {
  BandForm,
  BpForm,
  DeleteButton,
  NoteForm,
  SeizureForm,
} from '@/components/log-forms'
import { bandOf, classify, summarise } from '@/lib/bp'
import {
  findHousehold,
  getBpReadings,
  getCareNotes,
  getSeizureEvents,
} from '@/lib/queries'
import { addDays, careDate, prettyDateTime, shortDay } from '@/lib/time'

export const dynamic = 'force-dynamic'

const WINDOWS = [7, 14, 30] as const

export default async function LogsPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>
  searchParams: Promise<{ days?: string }>
}) {
  const { code } = await params
  const sp = await searchParams
  const household = await findHousehold(code)
  if (!household) notFound()

  const days = WINDOWS.includes(Number(sp.days) as (typeof WINDOWS)[number])
    ? Number(sp.days)
    : 7

  const [readings, seizures, notes] = await Promise.all([
    getBpReadings(household.id, 400),
    getSeizureEvents(household.id),
    getCareNotes(household.id),
  ])

  const band = bandOf(household)
  const bp = summarise(readings, band, days)

  const today = careDate()
  const strip = Array.from({ length: 14 }, (_, i) => addDays(today, -(13 - i)))
  const byDate = new Map<string, typeof readings>()
  for (const r of readings) {
    const d = new Date(r.measuredAt).toLocaleDateString('en-CA', {
      timeZone: 'Asia/Kolkata',
    })
    byDate.set(d, [...(byDate.get(d) ?? []), r])
  }

  const windowReadings = readings.filter(
    (r) =>
      new Date(r.measuredAt).getTime() >= Date.now() - days * 86_400_000,
  )

  return (
    <>
      <section className="card">
        <p className="eyebrow">Recovery log</p>
        <h1 className="mt-1 text-xl font-bold tracking-tight text-navy">
          Record useful information for the doctor
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          Saved to the private family record protected by your sync code.
        </p>
      </section>

      <BpForm code={code} band={band} />

      <section className="card space-y-4">
        <div>
          <p className="eyebrow">BP intelligence · रक्तचाप विश्लेषण</p>
          <h2 className="mt-1 text-base font-bold text-navy">Patterns at a glance</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Observations from the shared record — not a diagnosis or an instruction
            to change medicine.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <p className="eyebrow">Latest</p>
            <p className="mt-0.5 text-xl font-bold text-navy">
              {bp.latest ? `${bp.latest.systolic}/${bp.latest.diastolic}` : '—'}
            </p>
            <p className="text-[11px] text-muted">
              {bp.latest ? prettyDateTime(bp.latest.measuredAt) : 'No reading yet'}
            </p>
          </div>
          <div>
            <p className="eyebrow">{days}-day average</p>
            <p className="mt-0.5 text-xl font-bold text-navy">
              {bp.avgSystolic != null ? `${bp.avgSystolic}/${bp.avgDiastolic}` : '—'}
            </p>
            <p className="text-[11px] text-muted">{bp.windowCount} readings</p>
          </div>
          <div>
            <p className="eyebrow">High / low</p>
            <p className="mt-0.5 text-xl font-bold text-navy">
              {bp.high} / {bp.low}
            </p>
            <p className="text-[11px] text-muted">
              vs {band.systolicLow}/{band.diastolicLow}–{band.systolicHigh}/
              {band.diastolicHigh}
            </p>
          </div>
          <div>
            <p className="eyebrow">Data quality</p>
            <p className="mt-0.5 text-xl font-bold text-navy">{bp.pairedSessions}</p>
            <p className="text-[11px] text-muted">
              paired sessions · two readings 1 min apart
            </p>
          </div>
        </div>

        <div className="flex gap-2 no-print">
          {WINDOWS.map((d) => (
            <a
              key={d}
              href={`/c/${code}/logs?days=${d}`}
              className={`pill border ${
                d === days
                  ? 'border-navy bg-navy text-white'
                  : 'border-line bg-white text-muted'
              }`}
            >
              {d} days
            </a>
          ))}
        </div>

        <BpChart readings={windowReadings} band={band} />

        <div>
          <p className="eyebrow">Smart observations</p>
          <ul className="mt-2 space-y-2">
            {bp.observations.map((o, i) => (
              <li
                key={i}
                className="flex gap-2 rounded-xl bg-paper px-3 py-2.5 text-sm leading-relaxed text-ink/85"
              >
                <span className="font-bold text-teal">{i + 1}</span>
                {o}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs leading-relaxed font-medium text-coral">
            Never skip, double, stop or change Betacap or any medicine based on this
            dashboard. Confirm decisions with the treating doctor.
          </p>
        </div>

        <div>
          <p className="eyebrow">14-day strip</p>
          <div className="mt-2 flex gap-1 pb-1">
            {strip.map((d) => {
              const rs = byDate.get(d) ?? []
              const worst = rs.some((r) => classify(r, band) === 'high')
                ? 'bg-coral text-white'
                : rs.some((r) => classify(r, band) === 'low')
                  ? 'bg-amber text-white'
                  : rs.length
                    ? 'bg-mint text-teal'
                    : 'bg-paper text-muted'
              return (
                <div
                  key={d}
                  className={`flex min-w-0 flex-1 flex-col items-center rounded-lg px-0.5 py-1.5 text-[10px] font-semibold ${worst}`}
                  title={`${shortDay(d)} · ${rs.length} reading${rs.length === 1 ? '' : 's'}`}
                >
                  <span>{d.slice(-2)}</span>
                  <span className="opacity-70">{rs.length || '·'}</span>
                </div>
              )
            })}
          </div>
        </div>

        <div>
          <p className="eyebrow">Daily history</p>
          {windowReadings.length ? (
            <ul className="mt-2 space-y-2">
              {windowReadings.map((r) => {
                const cls = classify(r, band)
                return (
                  <li
                    key={r.id}
                    className="flex items-start justify-between gap-3 rounded-xl bg-paper px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-navy">
                        {r.systolic}/{r.diastolic}
                        {r.pulse ? (
                          <span className="ml-2 text-xs font-normal text-muted">
                            ♥ {r.pulse}
                          </span>
                        ) : null}
                        <span
                          className={`ml-2 pill ${
                            cls === 'high'
                              ? 'bg-coral-soft text-coral'
                              : cls === 'low'
                                ? 'bg-amber/15 text-amber'
                                : 'bg-mint text-teal'
                          }`}
                        >
                          {cls === 'in-band' ? 'In band' : cls}
                        </span>
                      </p>
                      <p className="text-xs text-muted">
                        {prettyDateTime(r.measuredAt)}
                        {r.symptoms ? ` · ${r.symptoms}` : ''}
                      </p>
                      {r.context || r.position || r.arm ? (
                        <p className="mt-0.5 text-[11px] text-muted">
                          {[r.context, r.position, r.arm ? `${r.arm} arm` : null]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      ) : null}
                    </div>
                    <DeleteButton code={code} id={r.id} kind="bp" />
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted">No readings match this view.</p>
          )}
        </div>

        <div className="rounded-xl bg-paper px-3 py-2.5">
          <p className="eyebrow">Reference band only</p>
          <p className="mt-0.5 text-xs leading-relaxed text-ink/80">
            {band.systolicLow}/{band.diastolicLow} to {band.systolicHigh}/
            {band.diastolicHigh}. A single unusual reading does not establish a
            trend.{' '}
            {household.bandConfirmed
              ? 'These limits are marked as doctor-confirmed.'
              : 'These limits are not yet marked as doctor-confirmed.'}
          </p>
          <div className="mt-2">
            <BandForm
              code={code}
              band={{ ...band, confirmed: household.bandConfirmed }}
            />
          </div>
        </div>
      </section>

      <section className="card space-y-3">
        <div>
          <p className="eyebrow">⌁ Seizure watch</p>
          <h2 className="mt-1 text-base font-bold text-navy">Seizure event</h2>
        </div>
        <SeizureForm code={code} />
        {seizures.length ? (
          <ul className="space-y-2">
            {seizures.map((s) => (
              <li
                key={s.id}
                className="flex items-start justify-between gap-3 rounded-xl bg-paper px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-navy">
                    {prettyDateTime(s.occurredAt)}
                  </p>
                  <p className="text-xs text-muted">
                    {s.durationMinutes != null
                      ? `${s.durationMinutes} min event`
                      : 'Duration not recorded'}
                    {s.recoveryMinutes != null
                      ? ` · ${s.recoveryMinutes} min recovery`
                      : ''}
                  </p>
                  {s.description ? (
                    <p className="mt-1 text-sm leading-relaxed text-ink/85">
                      {s.description}
                    </p>
                  ) : null}
                </div>
                <DeleteButton code={code} id={s.id} kind="seizure" />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No seizure events saved.</p>
        )}
      </section>

      <section className="card space-y-3">
        <div>
          <p className="eyebrow">✎ Caregiver notes</p>
          <h2 className="mt-1 text-base font-bold text-navy">Daily observations</h2>
        </div>
        <NoteForm code={code} />
        {notes.length ? (
          <ul className="space-y-2">
            {notes.map((n) => (
              <li
                key={n.id}
                className="flex items-start justify-between gap-3 rounded-xl bg-paper px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-xs text-muted">{prettyDateTime(n.createdAt)}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-ink/85">
                    {n.body}
                  </p>
                </div>
                <DeleteButton code={code} id={n.id} kind="note" />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No caregiver notes saved yet.</p>
        )}
      </section>

      <p className="px-1 pb-2 text-xs leading-relaxed text-muted">
        Shared caregiver record. Anyone opening the private caregiver link can view
        and edit these records. Treat that link like a password.
      </p>
    </>
  )
}
