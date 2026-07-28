'use client'

import { useRouter } from 'next/navigation'
import { archiveMedicine, logSosDose } from '@/lib/actions'
import type { DoseRecord } from '@/db/schema'
import type { MedicineWithSlots } from '@/lib/queries'
import { prettyDateTime } from '@/lib/time'
import { Sheet, useChrome } from './chrome'

const STATUS_STYLE: Record<string, string> = {
  current: 'bg-coral text-white',
  previous: 'bg-amber/15 text-amber',
  supportive: 'bg-mint text-teal',
}

const STATUS_LABEL: Record<string, string> = {
  current: 'Current SOS',
  previous: 'Confirm first',
  supportive: 'Supportive care',
}

/**
 * SOS sits outside the reminder schedule on purpose. Logging an entry records
 * that it was taken; it never reactivates an old discharge instruction.
 */
export function SosSheet({
  medicines,
  records,
}: {
  medicines: MedicineWithSlots[]
  records: DoseRecord[]
}) {
  const { run, closeSheet, openSheet, pending } = useChrome()
  const router = useRouter()

  const lastLoggedFor = (medicineId: string) =>
    records.find((r) => r.medicineId === medicineId)?.takenAt ?? null

  return (
    <Sheet
      name="sos"
      eyebrow="SOS medicines"
      title="Outside the routine schedule"
      intro="SOS is deliberately excluded from reminders. Log an item only after it was actually taken — logging does not restart an old instruction."
      footer={
        <>
          <button
            type="button"
            onClick={() => openSheet('add', { mode: 'sos' })}
            aria-label="Add SOS medicine"
            className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed border-sage py-3.5 text-sm font-bold text-teal transition active:scale-[0.98]"
          >
            +{' '}
            <span className="lang-en" aria-hidden>
              Add SOS medicine
            </span>
            <span className="lang-hi" aria-hidden>
              SOS दवा जोड़ें
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              closeSheet()
              router.push('/safety')
            }}
            className="mt-3 w-full text-[12.5px] font-bold text-coral"
          >
            Emergency numbers →
          </button>
        </>
      }
    >
      <ul className="flex flex-col gap-2.5">
        {medicines.map((m) => {
          const last = lastLoggedFor(m.id)
          return (
            <li key={m.id} className="card flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2.5">
                <div className="min-w-0">
                  <p className="text-[14.5px] font-extrabold text-navy">{m.brand}</p>
                  <p className="text-[11.5px] text-muted">{m.dose}</p>
                </div>
                <span
                  className={`pill shrink-0 ${STATUS_STYLE[m.sosStatus ?? 'previous']}`}
                >
                  {STATUS_LABEL[m.sosStatus ?? 'previous']}
                </span>
              </div>

              {m.symptom ? (
                <p className="text-xs font-bold text-ink">For: {m.symptom}</p>
              ) : null}
              {m.instruction ? (
                <p className="text-[11.5px] leading-relaxed text-muted">{m.instruction}</p>
              ) : null}
              {m.caution ? (
                <p className="note-warn">
                  <strong className="font-bold">Watch: </strong>
                  {m.caution}
                </p>
              ) : null}
              {last ? (
                <p className="text-[11px] font-semibold text-teal">
                  Last logged {prettyDateTime(last)}
                </p>
              ) : null}

              <button
                type="button"
                disabled={pending}
                aria-label={`Log SOS dose of ${m.brand}`}
                onClick={() =>
                  run(() => logSosDose({ medicineId: m.id }), `Logged ✓ ${m.brand}`)
                }
                className="btn-ghost h-12 w-full"
              >
                <span className="lang-en" aria-hidden>
                  Log SOS dose
                </span>
                <span className="lang-hi" aria-hidden>
                  SOS खुराक दर्ज करें
                </span>
              </button>

              {m.isCustom ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    run(
                      () => archiveMedicine({ medicineId: m.id }),
                      `${m.brand} removed`,
                    )
                  }
                  className="text-[11.5px] font-bold text-coral"
                >
                  Remove caregiver entry
                </button>
              ) : null}
            </li>
          )
        })}
      </ul>
    </Sheet>
  )
}
