'use client'

import { confirmPrescription } from '@/lib/actions'
import { useAction } from './chrome'

/**
 * `count` is passed in rather than written into the sentence: the copy said
 * "all six medicines" through a prescription change that made it eight, and a
 * banner whose whole job is accuracy cannot be the thing that is out of date.
 */
export function VerifyBanner({
  prescriptionDate,
  count,
}: {
  prescriptionDate: string
  count: number
}) {
  const { run, busy: pending } = useAction()

  return (
    <section className="flex flex-col gap-2 rounded-2xl border border-coral/30 bg-coral-soft p-4 no-print">
      <p className="eyebrow text-coral">Verify before first use</p>
      <p className="text-sm font-bold text-navy">
        Match all {count} daily medicines to the prescriptions
      </p>
      <p className="text-[12.5px] leading-relaxed text-ink/80">
        Check each strip against the {prescriptionDate} prescription and the
        15 September 2026 chemoradiation sheet. Reminder times are an organiser;
        only Betacap’s 8:00 AM time is explicitly printed.
      </p>
      <button
        type="button"
        disabled={pending}
        aria-label="I checked the new prescription"
        onClick={() => run(() => confirmPrescription(), 'Prescription verified ✓')}
        className="btn-danger h-11 w-full"
      >
        {pending ? 'Saving…' : 'I checked the new prescription'}
      </button>
    </section>
  )
}
