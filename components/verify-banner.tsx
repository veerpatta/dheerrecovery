'use client'

import { confirmPrescription } from '@/lib/actions'
import { useChrome } from './chrome'

export function VerifyBanner({ prescriptionDate }: { prescriptionDate: string }) {
  const { run, pending } = useChrome()

  return (
    <section className="flex flex-col gap-2 rounded-2xl border border-coral/30 bg-coral-soft p-4 no-print">
      <p className="eyebrow text-coral">Verify before first use</p>
      <p className="text-sm font-bold text-navy">
        Match all six medicines to the new prescription
      </p>
      <p className="text-[12.5px] leading-relaxed text-ink/80">
        Check each strip against the {prescriptionDate} prescription. Reminder times
        are an organiser; only Betacap’s 8:00 AM time is explicitly printed.
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
