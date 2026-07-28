import { notFound } from 'next/navigation'
import { findHousehold } from '@/lib/queries'
import {
  EMERGENCY_CONTACTS,
  EMERGENCY_TRIGGER,
  REFERENCES,
  REVIEW_QUESTIONS,
  SAFETY_RULES,
} from '@/lib/catalog'
import { addDays, careDate, daysBetween, prettyDate, prettyRxDate } from '@/lib/time'

export const dynamic = 'force-dynamic'

export default async function SafetyPage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = await params
  const household = await findHousehold(code)
  if (!household) notFound()

  const supplyEnds = addDays(household.courseStart, 30)
  const daysLeft = daysBetween(careDate(), supplyEnds)

  return (
    <>
      <section className="card">
        <p className="eyebrow">Safety centre · current prescription</p>
        <h1 className="mt-1 text-xl font-bold tracking-tight text-navy">
          Know what requires action
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          This page supports — not replaces — the{' '}
          {prettyRxDate(household.prescriptionDate)} prescription and treating team.
        </p>
      </section>

      <section className="card border-coral/40 bg-coral-soft">
        <p className="eyebrow text-coral">Call emergency help</p>
        <p className="mt-1.5 text-sm leading-relaxed font-medium text-ink">
          {EMERGENCY_TRIGGER}
        </p>
        <ul className="mt-3 space-y-2">
          {EMERGENCY_CONTACTS.map((c) => (
            <li key={c.phone}>
              <a
                href={`tel:${c.phone.replace(/\s/g, '')}`}
                className="flex items-center justify-between gap-3 rounded-xl bg-white px-3.5 py-3 transition hover:brightness-95"
              >
                <span className="text-sm font-semibold text-navy">{c.label}</span>
                <span className="text-sm font-bold text-coral">{c.phone}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <ul className="space-y-3">
          {SAFETY_RULES.map((r) => (
            <li key={r.n} className="card flex gap-3">
              <span className="shrink-0 text-lg font-black text-line">{r.n}</span>
              <div>
                <h3 className="text-sm font-bold text-navy">{r.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-ink/80">{r.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <p className="eyebrow">Before the 1-month supply ends</p>
        <h2 className="mt-1 text-base font-bold text-navy">
          Questions for the treating team
        </h2>
        <p className="mt-1 text-sm text-muted">
          Supply started {prettyRxDate(household.courseStart)} —{' '}
          {daysLeft > 0
            ? `about ${daysLeft} day${daysLeft === 1 ? '' : 's'} left.`
            : 'the one-month supply window has passed; arrange review.'}
        </p>
        <ul className="mt-3 space-y-2">
          {REVIEW_QUESTIONS.map((q) => (
            <li
              key={q}
              className="flex gap-2 rounded-xl bg-paper px-3 py-2.5 text-sm leading-relaxed text-ink/85"
            >
              <span aria-hidden className="text-teal">
                ?
              </span>
              {q}
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <p className="eyebrow">Medicine references</p>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          Prescription facts come from the supplied Paras Hospitals sheet. General
          patient guidance:
        </p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {REFERENCES.map((r) => (
            <li key={r.href}>
              <a
                href={r.href}
                target="_blank"
                rel="noopener noreferrer"
                className="pill bg-paper text-ink hover:bg-mint hover:text-teal"
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
