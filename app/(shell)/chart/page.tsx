import { getHousehold } from '@/lib/household'
import { getMedicines } from '@/lib/queries'
import { courseDaysLeft, courseFinished, rulesOf } from '@/lib/schedule'
import { careDate, prettyRxDate, prettyTime, weekdayList } from '@/lib/time'
import { sosStyleOf, toneOf } from '@/lib/tone'

export const dynamic = 'force-dynamic'

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null
  return (
    <p className="text-xs leading-relaxed text-ink/85">
      <strong>{label}:</strong> {value}
    </p>
  )
}

export default async function ChartPage() {
  const household = await getHousehold()

  const meds = await getMedicines(household.id)
  const routine = meds.filter((m) => m.kind === 'routine')
  const sos = meds.filter((m) => m.kind === 'sos')
  const today = careDate()

  function Card({ m }: { m: (typeof meds)[number] }) {
    const times = m.slots.map((s) => prettyTime(s.time)).join(' · ')
    const sosPill = sosStyleOf(m.sosStatus)

    /*
     * Which days this one is actually for. Printing "8:00 am · 8:00 pm" beside
     * Septran with nothing saying Mondays and Thursdays would be wrong on the
     * one page whose whole job is to be the medicine chart — and these
     * medicines are never archived, so without the finished state they would
     * sit here as current long after 26 October.
     */
    const rules = rulesOf(m)
    const window =
      m.courseStartDate && m.courseEndDate
        ? `${prettyRxDate(m.courseStartDate)} – ${prettyRxDate(m.courseEndDate)}`
        : null
    const finished = courseFinished(rules, today)
    const daysLeft = courseDaysLeft(rules, today)

    return (
      <li className="card-toned">
        <span className={`spine ${toneOf(m.tone).bar}`} aria-hidden />
        <div className="flex flex-col gap-2.5 py-3.5 pr-3.5 pl-[18px]">
          <div className="flex items-start justify-between gap-2.5">
            <div className="min-w-0">
              {m.purpose ? (
                <p className="text-[10.5px] leading-relaxed font-semibold tracking-[0.1em] text-muted uppercase">
                  {m.purpose}
                </p>
              ) : null}
              <h3 className="mt-1 text-base font-extrabold text-navy">{m.brand}</h3>
              <p className="text-[13px] text-ink/80">{m.dose}</p>
              {m.generic ? (
                <p className="text-[11.5px] text-muted">{m.generic}</p>
              ) : null}
            </div>
            {sosPill ? (
              <span className={`pill shrink-0 ${sosPill.className}`}>
                {sosPill.label}
              </span>
            ) : null}
          </div>

          {m.symptom ? (
            <p className="text-[12.5px] font-bold text-ink">For: {m.symptom}</p>
          ) : null}

          <div className="rounded-xl bg-paper px-2.5 py-2.5">
            <p className="text-[10px] font-semibold tracking-[0.14em] text-muted uppercase">
              Rx
            </p>
            <p className="mt-0.5 text-[13px] font-semibold text-navy">
              {m.prescription}
            </p>
            {m.prescriptionHi ? (
              <p className="mt-0.5 text-[11.5px] text-muted">{m.prescriptionHi}</p>
            ) : null}
            {times ? (
              <p className="mt-1 text-[13px] font-extrabold text-teal">{times}</p>
            ) : null}
            {m.dosingIntervalHours ? (
              <p className="mt-1 text-[11.5px] font-semibold text-ink/80">
                Take about {m.dosingIntervalHours} hours apart — the evening dose
                follows {m.dosingIntervalHours} hours after the morning one was
                actually given.
              </p>
            ) : null}
            {m.weekdays ? (
              <p className="mt-1 text-[11.5px] font-extrabold text-ink/80">
                {weekdayList(m.weekdays)} only — not the other days.
              </p>
            ) : null}
            {m.therapyOnly ? (
              <p className="mt-1 text-[11.5px] font-extrabold text-ink/80">
                Only on a day radiation therapy actually happened. Today asks before
                this appears on the timeline.
              </p>
            ) : null}
            {window ? (
              <p
                className={`mt-1 text-[11.5px] font-semibold ${
                  finished ? 'text-muted' : 'text-ink/80'
                }`}
              >
                {window}
                {finished
                  ? ' · course finished'
                  : daysLeft !== null
                    ? ` · ${daysLeft} day${daysLeft === 1 ? '' : 's'} left`
                    : ''}
              </p>
            ) : null}
            {m.isCustom ? (
              <p className="mt-1 text-xs font-semibold text-amber">
                Added by a caregiver — not on the printed prescription.
              </p>
            ) : null}
          </div>

          <Field label="Doctor wrote" value={m.doctorNote} />
          <Field label="Food" value={m.food} />
          <Field label="How" value={m.instruction} />

          {m.caution ? (
            <div className="rounded-xl bg-coral-soft px-2.5 py-2.5">
              <p className="text-[10px] font-semibold tracking-[0.14em] text-coral uppercase">
                Watch
              </p>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink">
                {m.caution}
              </p>
            </div>
          ) : null}

          {m.verify ? (
            <p className="text-[11.5px] leading-relaxed font-medium text-ink/70">
              ⚑ {m.verify}
            </p>
          ) : null}
          {m.prescribedAt ? (
            <p className="text-[10.5px] text-muted">{m.prescribedAt}</p>
          ) : null}
        </div>
      </li>
    )
  }

  return (
    <>
      <section className="card">
        <p className="eyebrow">
          Latest prescription · {prettyRxDate(household.prescriptionDate)}
        </p>
        <h1 className="mt-1 text-xl font-extrabold tracking-tight text-navy">
          <span className="lang-en">Current medicine chart</span>
          <span className="lang-hi">पूरा चार्ट</span>
        </h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
          Transcribed from {household.prescriberName}’s Paras Hospitals
          prescription. Old discharge-only medicines have been removed from the
          active chart.
        </p>
        <p className="note mt-2">
          Printed instruction: every medicine says “as directed.” Food notes below
          are clearly marked general guidance; the strip label, pharmacist and
          treating doctor take priority.
        </p>
      </section>

      <p className="eyebrow px-0.5">
        Routine · {routine.length} medicines · daily schedule
      </p>
      <p className="px-0.5 text-[11.5px] leading-relaxed text-muted">
        Not every one of these is due every day. A medicine with a course window, a
        weekday rule, or a radiation-therapy rule says so on its own card, and
        Today’s timeline only lists the ones actually due.
      </p>
      <ul className="flex flex-col gap-3">
        {routine.map((m) => (
          <Card key={m.id} m={m} />
        ))}
      </ul>

      <p className="eyebrow mt-1 px-0.5 text-coral">
        SOS · {sos.length} guides · when something happens
      </p>
      <p className="px-0.5 text-[11.5px] leading-relaxed text-muted">
        Of these, only Napra‑D and Centnil T are current. The rest are earlier
        discharge instructions kept for reference and marked “confirm first.”
      </p>
      <ul className="flex flex-col gap-3">
        {sos.map((m) => (
          <Card key={m.id} m={m} />
        ))}
      </ul>
    </>
  )
}
