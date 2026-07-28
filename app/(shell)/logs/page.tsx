import { BpChart } from '@/components/bp-chart'
import { SheetTrigger } from '@/components/chrome'
import { BandForm, DeleteButton, NoteForm, SeizureForm } from '@/components/log-forms'
import { bandOf, bpStrip, classify, summarise } from '@/lib/bp'
import { getHousehold } from '@/lib/household'
import { getBpReadings, getCareNotes, getSeizureEvents } from '@/lib/queries'
import { prettyDateTime, shortDay } from '@/lib/time'

export const dynamic = 'force-dynamic'

const WINDOWS = [7, 14, 30] as const

const STRIP_STYLE = {
  high: 'bg-coral text-white',
  low: 'bg-amber text-white',
  'in-band': 'bg-mint text-teal',
  none: 'bg-paper text-muted',
} as const

export default async function LogsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>
}) {
  const sp = await searchParams
  const household = await getHousehold()

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
  const strip = bpStrip(readings, band, 14)

  // The list, the chart and the averages must all describe the same set —
  // `summarise` windows by care-date, so re-filtering here would disagree.
  const windowReadings = bp.windowReadings

  return (
    <>
      <section className="card">
        <p className="eyebrow">
          <span className="lang-en">Recovery log</span>
          <span className="lang-hi">रिकवरी रिकॉर्ड</span>
        </p>
        <h1 className="mt-1 text-xl font-extrabold tracking-tight text-navy">
          Record useful information for the doctor
        </h1>
        <p className="mt-1.5 mb-3 text-[12.5px] leading-relaxed text-muted">
          Home BP is best measured as two readings about a minute apart — log both.
          Saved to the shared family record.
        </p>
        <SheetTrigger
          sheet="bp"
          aria-label="Log BP"
          className="h-[50px] w-full rounded-2xl bg-teal text-base font-bold text-white transition active:scale-[0.97]"
        >
          <span className="lang-en" aria-hidden>
            Log BP · Add a reading
          </span>
          <span className="lang-hi" aria-hidden>
            BP दर्ज करें · रीडिंग जोड़ें
          </span>
        </SheetTrigger>
      </section>

      <section className="card flex flex-col gap-3.5">
        <div>
          <p className="eyebrow">BP intelligence · रक्तचाप विश्लेषण</p>
          <h2 className="mt-1 text-base font-extrabold text-navy">
            Patterns at a glance
          </h2>
          <p className="mt-1 text-[11.5px] leading-relaxed text-muted">
            Observations from the shared record — not a diagnosis or an instruction
            to change medicine.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="eyebrow text-[10px]">Latest</p>
            <p className="mt-0.5 text-xl font-extrabold text-navy">
              {bp.latest ? `${bp.latest.systolic}/${bp.latest.diastolic}` : '—'}
            </p>
            <p className="text-[10.5px] text-muted">
              {bp.latest ? prettyDateTime(bp.latest.measuredAt) : 'No reading yet'}
            </p>
          </div>
          <div>
            <p className="eyebrow text-[10px]">{days}-day average</p>
            <p className="mt-0.5 text-xl font-extrabold text-navy">
              {bp.avgSystolic != null ? `${bp.avgSystolic}/${bp.avgDiastolic}` : '—'}
            </p>
            <p className="text-[10.5px] text-muted">{bp.windowCount} readings</p>
          </div>
          <div>
            <p className="eyebrow text-[10px]">High / low</p>
            <p className="mt-0.5 text-xl font-extrabold text-navy">
              {bp.high} / {bp.low}
            </p>
            <p className="text-[10.5px] text-muted">
              vs {band.systolicLow}/{band.diastolicLow}–{band.systolicHigh}/
              {band.diastolicHigh}
            </p>
          </div>
          <div>
            <p className="eyebrow text-[10px]">Data quality</p>
            <p className="mt-0.5 text-xl font-extrabold text-navy">
              {bp.pairedSessions}
            </p>
            <p className="text-[10.5px] text-muted">
              paired sessions · two readings 1 min apart
            </p>
          </div>
        </div>

        <div className="flex gap-2 no-print">
          {WINDOWS.map((d) => (
            <a key={d} href={`/logs?days=${d}`} className={d === days ? 'chip-on' : 'chip'}>
              {d} days
            </a>
          ))}
        </div>

        <BpChart readings={windowReadings} band={band} />

        <div>
          <p className="eyebrow">Smart observations</p>
          <ul className="mt-2 flex flex-col gap-2">
            {bp.observations.map((o, i) => (
              <li
                key={i}
                className="flex gap-2 rounded-xl bg-paper px-2.5 py-2.5 text-[12.5px] leading-relaxed text-ink/85"
              >
                <strong className="text-teal">{i + 1}</strong>
                <span>{o}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11.5px] leading-relaxed font-medium text-coral">
            Never skip, double, stop or change Betacap or any medicine based on this
            dashboard. Confirm decisions with the treating doctor.
          </p>
        </div>

        <div>
          <p className="eyebrow">14-day strip</p>
          <div className="mt-2 flex gap-1 pb-1">
            {strip.map((d) => (
              <div
                key={d.isoDate}
                className={`flex min-w-0 flex-1 flex-col items-center rounded-lg px-0.5 py-1.5 text-[10px] font-bold ${STRIP_STYLE[d.worst]}`}
                title={`${shortDay(d.isoDate)} · ${d.count} reading${d.count === 1 ? '' : 's'}`}
              >
                <span>{d.day}</span>
                <span className="opacity-70">{d.count || '·'}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="eyebrow">Daily history</p>
          {windowReadings.length ? (
            <ul className="mt-2 flex flex-col gap-2">
              {windowReadings.map((r) => {
                const cls = classify(r, band)
                return (
                  <li
                    key={r.id}
                    className="flex items-start justify-between gap-2.5 rounded-xl bg-paper px-2.5 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-extrabold text-navy">
                        {r.systolic}/{r.diastolic}
                        {r.pulse ? (
                          <span className="ml-2 text-[11px] font-normal text-muted">
                            ♥ {r.pulse}
                          </span>
                        ) : null}
                        <span
                          className={`pill ml-2 ${
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
                      <p className="mt-0.5 text-[11px] text-muted">
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
                    <DeleteButton id={r.id} kind="bp" />
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="mt-2 text-[12.5px] text-muted">No readings match this view.</p>
          )}
        </div>

        <div className="rounded-xl bg-paper px-3 py-2.5">
          <p className="eyebrow text-[10px]">Reference band only</p>
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink/80">
            {band.systolicLow}/{band.diastolicLow} to {band.systolicHigh}/
            {band.diastolicHigh}. A single unusual reading does not establish a
            trend.{' '}
            {household.bandConfirmed
              ? 'These limits are marked as doctor-confirmed.'
              : 'These limits are not yet marked as doctor-confirmed.'}
          </p>
          <div className="mt-2">
            <BandForm band={{ ...band, confirmed: household.bandConfirmed }} />
          </div>
        </div>
      </section>

      <section className="card flex flex-col gap-2.5">
        <div>
          <p className="eyebrow">
            ⌁ <span className="lang-en">Seizure watch</span>
            <span className="lang-hi">दौरे की निगरानी</span>
          </p>
          <h2 className="mt-1 text-base font-extrabold text-navy">Seizure event</h2>
        </div>
        <SeizureForm />
        {seizures.length ? (
          <ul className="flex flex-col gap-2">
            {seizures.map((s) => (
              <li
                key={s.id}
                className="flex items-start justify-between gap-2.5 rounded-xl bg-paper px-2.5 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-[13px] font-extrabold text-navy">
                    {prettyDateTime(s.occurredAt)}
                  </p>
                  <p className="text-[11px] text-muted">
                    {s.durationMinutes != null
                      ? `${s.durationMinutes} min event`
                      : 'Duration not recorded'}
                    {s.recoveryMinutes != null
                      ? ` · ${s.recoveryMinutes} min recovery`
                      : ''}
                  </p>
                  {s.description ? (
                    <p className="mt-1 text-[12.5px] leading-relaxed text-ink/85">
                      {s.description}
                    </p>
                  ) : null}
                </div>
                <DeleteButton id={s.id} kind="seizure" />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[12.5px] text-muted">No seizure events saved.</p>
        )}
      </section>

      <section className="card flex flex-col gap-2.5">
        <div>
          <p className="eyebrow">
            ✎ <span className="lang-en">Caregiver notes</span>
            <span className="lang-hi">देखभाल टिप्पणियाँ</span>
          </p>
          <h2 className="mt-1 text-base font-extrabold text-navy">
            Daily observations
          </h2>
        </div>
        <NoteForm />
        {notes.length ? (
          <ul className="flex flex-col gap-2">
            {notes.map((n) => (
              <li
                key={n.id}
                className="flex items-start justify-between gap-2.5 rounded-xl bg-paper px-2.5 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-[11px] text-muted">
                    {prettyDateTime(n.createdAt)}
                  </p>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-ink/85">
                    {n.body}
                  </p>
                </div>
                <DeleteButton id={n.id} kind="note" />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[12.5px] text-muted">No caregiver notes saved yet.</p>
        )}
      </section>

      <p className="px-1 pb-1.5 text-[11px] leading-relaxed text-muted">
        Shared caregiver record. Anyone who opens this site can view and edit these
        records.
      </p>
    </>
  )
}
