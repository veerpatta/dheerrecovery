'use client'

import { useTransition } from 'react'
import { confirmPrescription } from '@/lib/actions'

export function VerifyBanner({
  code,
  prescriptionDate,
}: {
  code: string
  prescriptionDate: string
}) {
  const [pending, start] = useTransition()

  return (
    <section className="card border-coral/30 bg-coral-soft no-print">
      <p className="eyebrow text-coral">Verify before first use</p>
      <h2 className="mt-1 text-base font-bold text-navy">
        Match all six medicines to the new prescription
      </h2>
      <p className="mt-1.5 text-sm leading-relaxed text-ink/80">
        Check each strip against the {prescriptionDate} prescription. Reminder times
        are an organiser; only Betacap’s 8:00 AM time is explicitly printed.
      </p>
      <button
        type="button"
        disabled={pending}
        onClick={() => start(() => confirmPrescription(code))}
        className="btn-danger mt-3 w-full sm:w-auto"
      >
        {pending ? 'Saving…' : 'I checked the new prescription'}
      </button>
    </section>
  )
}
