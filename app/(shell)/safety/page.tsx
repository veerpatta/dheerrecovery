import { getHousehold } from '@/lib/household'
import {
  EMERGENCY_CONTACTS,
  EMERGENCY_TRIGGER,
  REFERENCES,
  REVIEW_QUESTIONS,
  RT_COURSE_END,
  RT_COURSE_START,
  SAFETY_RULES,
  SUPPLY_DAYS,
} from '@/lib/catalog'
import { addDays, careDate, daysBetween, prettyRxDate } from '@/lib/time'

export const dynamic = 'force-dynamic'

export default async function SafetyPage() {
  const household = await getHousehold()

  const supplyEnds = addDays(household.courseStart, SUPPLY_DAYS)
  const daysLeft = daysBetween(careDate(), supplyEnds)

  /*
   * The 15 September sheet orders a review in seven days with CBC, S. creatinine
   * and SGPT, and the chemoradiation course itself ends on a fixed date. Neither
   * had anywhere to live before this — they are prescribed instructions, so they
   * belong beside the supply date rather than only inside a medicine card.
   */
  const bloodsDue = addDays(RT_COURSE_START, 7)
  const rtDaysLeft = daysBetween(careDate(), RT_COURSE_END)

  return (
    <>
      <section className="card">
        <p className="eyebrow">Safety centre · current prescription</p>
        <h1 className="mt-1 text-xl font-extrabold tracking-tight text-navy">
          Know what requires action
        </h1>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
          This page supports — not replaces — the{' '}
          {prettyRxDate(household.prescriptionDate)} prescription and treating team.
        </p>
      </section>

      <section className="rounded-2xl border border-coral/40 bg-coral-soft p-4">
        <p className="eyebrow text-coral">
          <span className="lang-en">Call emergency help</span>
          <span className="lang-hi">आपातकालीन सहायता</span>
        </p>
        <p className="mt-1.5 text-[13px] leading-relaxed font-medium text-ink">
          {EMERGENCY_TRIGGER}
        </p>
        <ul className="mt-3 flex flex-col gap-2">
          {EMERGENCY_CONTACTS.map((c) => (
            <li key={c.phone}>
              <a
                href={`tel:${c.phone.replace(/\s/g, '')}`}
                className="flex items-center justify-between gap-2.5 rounded-[13px] bg-white px-3.5 py-3.5 transition hover:brightness-95"
              >
                <span className="text-[13.5px] font-bold text-navy">{c.label}</span>
                <span className="text-[13.5px] font-extrabold text-coral">
                  {c.phone}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <ul className="flex flex-col gap-3">
        {SAFETY_RULES.map((r) => (
          <li key={r.n} className="card flex gap-3">
            <span className="shrink-0 text-lg font-extrabold text-line">{r.n}</span>
            <div>
              <h3 className="text-[13.5px] font-extrabold text-navy">{r.title}</h3>
              <p className="mt-1 text-[12.5px] leading-relaxed text-ink/80">
                {r.body}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <section className="card">
        <p className="eyebrow">Before the 1-month supply ends</p>
        <h2 className="mt-1 text-base font-extrabold text-navy">
          Questions for the treating team
        </h2>
        <p className="mt-1 text-[12.5px] text-muted">
          Supply started {prettyRxDate(household.courseStart)} —{' '}
          {daysLeft > 0
            ? `about ${daysLeft} day${daysLeft === 1 ? '' : 's'} left.`
            : 'the one-month supply window has passed; arrange review.'}
        </p>

        <div className="mt-2.5 rounded-xl bg-paper px-3 py-2.5">
          <p className="eyebrow text-[10px]">Chemoradiation course</p>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink/85">
            {prettyRxDate(RT_COURSE_START)} to {prettyRxDate(RT_COURSE_END)} —{' '}
            {rtDaysLeft > 0
              ? `about ${rtDaysLeft} day${rtDaysLeft === 1 ? '' : 's'} left.`
              : 'the 42 days have passed; confirm what continues.'}
          </p>
          <p className="mt-1 text-[12.5px] leading-relaxed font-semibold text-ink">
            The 15 September sheet orders a review after 7 days —{' '}
            {prettyRxDate(bloodsDue)} — with CBC, S. creatinine and SGPT.
          </p>
        </div>
        <ul className="mt-2.5 flex flex-col gap-2">
          {REVIEW_QUESTIONS.map((q) => (
            <li
              key={q}
              className="flex gap-2 rounded-xl bg-paper px-2.5 py-2.5 text-[12.5px] leading-relaxed text-ink/85"
            >
              <span aria-hidden className="font-extrabold text-teal">
                ?
              </span>
              {q}
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <p className="eyebrow">Medicine references</p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
          Prescription facts come from the supplied Paras Hospitals sheet. General
          patient guidance:
        </p>
        <ul className="mt-2.5 flex flex-wrap gap-2">
          {REFERENCES.map((r) => (
            <li key={r.href}>
              <a
                href={r.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex rounded-full bg-paper px-3 py-1.5 text-[11px] font-bold text-ink hover:bg-mint hover:text-teal"
              >
                {r.label} ↗
              </a>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
