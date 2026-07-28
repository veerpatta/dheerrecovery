import { notFound } from 'next/navigation'
import { findHousehold, getMedicines } from '@/lib/queries'
import { prettyRxDate, prettyTime } from '@/lib/time'

export const dynamic = 'force-dynamic'

const TONE_BAR: Record<string, string> = {
  recovery: 'bg-teal',
  seizure: 'bg-violet',
  bp: 'bg-blue',
  comfort: 'bg-amber',
}

const SOS_PILL: Record<string, { label: string; className: string }> = {
  current: { label: 'Current SOS', className: 'bg-coral text-white' },
  previous: { label: 'Confirm first', className: 'bg-amber/15 text-amber' },
  supportive: { label: 'Supportive care', className: 'bg-mint text-teal' },
}

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null
  return (
    <div>
      <p className="eyebrow">{label}</p>
      <p className="mt-0.5 text-sm leading-relaxed text-ink/85">{value}</p>
    </div>
  )
}

export default async function ChartPage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = await params
  const household = await findHousehold(code)
  if (!household) notFound()

  const meds = await getMedicines(household.id)
  const routine = meds.filter((m) => m.kind === 'routine')
  const sos = meds.filter((m) => m.kind === 'sos')

  function Card({ m }: { m: (typeof meds)[number] }) {
    const times = m.slots
      .map((s) => prettyTime(s.time))
      .join(' · ')
    const sosPill = m.sosStatus ? SOS_PILL[m.sosStatus] : null

    return (
      <li className="card relative overflow-hidden !p-0">
        <span
          className={`absolute inset-y-0 left-0 w-1 ${TONE_BAR[m.tone] ?? 'bg-teal'}`}
          aria-hidden
        />
        <div className="space-y-3 py-4 pr-4 pl-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {m.purpose ? (
                <p className="eyebrow leading-relaxed">{m.purpose}</p>
              ) : null}
              <h3 className="mt-1 text-base font-bold text-navy">{m.brand}</h3>
              <p className="text-sm text-ink/80">{m.dose}</p>
              {m.generic ? (
                <p className="text-xs text-muted">{m.generic}</p>
              ) : null}
            </div>
            {sosPill ? (
              <span className={`pill shrink-0 ${sosPill.className}`}>
                {sosPill.label}
              </span>
            ) : null}
          </div>

          <div className="rounded-xl bg-paper px-3 py-2.5">
            <p className="eyebrow">Rx</p>
            <p className="mt-0.5 text-sm font-semibold text-navy">
              {m.prescription}
            </p>
            {m.prescriptionHi ? (
              <p className="mt-0.5 text-xs text-muted">{m.prescriptionHi}</p>
            ) : null}
            {times ? (
              <p className="mt-1 text-sm font-bold text-teal">{times}</p>
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
            <div className="rounded-xl bg-coral-soft px-3 py-2.5">
              <p className="eyebrow text-coral">Watch</p>
              <p className="mt-0.5 text-sm leading-relaxed text-ink">{m.caution}</p>
            </div>
          ) : null}

          {m.verify ? (
            <p className="text-xs leading-relaxed font-medium text-ink/70">
              ⚑ {m.verify}
            </p>
          ) : null}
          {m.prescribedAt ? (
            <p className="text-[11px] text-muted">{m.prescribedAt}</p>
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
        <h1 className="mt-1 text-xl font-bold tracking-tight text-navy">
          Current medicine chart
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          Transcribed from {household.prescriberName}’s Paras Hospitals
          prescription. Old discharge-only medicines have been removed from the
          active chart.
        </p>
        <p className="mt-2 rounded-xl bg-paper px-3 py-2.5 text-xs leading-relaxed text-ink/80">
          Printed instruction: every medicine says “as directed.” Food notes below
          are clearly marked general guidance; the strip label, pharmacist and
          treating doctor take priority.
        </p>
      </section>

      <section className="space-y-3">
        <div className="px-1">
          <p className="eyebrow">Routine · {routine.length} medicines</p>
          <h2 className="text-base font-bold text-navy">Daily schedule</h2>
          <p className="mt-0.5 text-xs leading-relaxed text-muted">
            SOS medicine is excluded from automatic reminders.
          </p>
        </div>
        <ul className="space-y-3">
          {routine.map((m) => (
            <Card key={m.id} m={m} />
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <div className="px-1">
          <p className="eyebrow text-coral">SOS · {sos.length} guides</p>
          <h2 className="text-base font-bold text-navy">When something happens</h2>
          <p className="mt-0.5 text-xs leading-relaxed text-muted">
            Only Napra‑D is on the current prescription. The rest are earlier
            discharge instructions kept for reference and marked “confirm first.”
          </p>
        </div>
        <ul className="space-y-3">
          {sos.map((m) => (
            <Card key={m.id} m={m} />
          ))}
        </ul>
      </section>
    </>
  )
}
