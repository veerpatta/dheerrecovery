'use client'

import { useEffect, useState, useTransition } from 'react'
import { logSosDose } from '@/lib/actions'
import type { MedicineWithSlots } from '@/lib/queries'

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

export function SosDrawer({ medicines }: { medicines: MedicineWithSlots[] }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [, start] = useTransition()

  // Escape closes, and the page behind stays put instead of scrolling away.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  function log(medicineId: string) {
    setError(null)
    setBusy(medicineId)
    start(async () => {
      try {
        await logSosDose({ medicineId })
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not save that.')
      } finally {
        setBusy(null)
      }
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-full bg-coral px-3 py-1.5 text-xs font-bold text-white"
      >
        SOS
        <span className="rounded-full bg-white/25 px-1.5">{medicines.length}</span>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-navy/40 p-0 sm:items-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="SOS medicines"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-paper p-5 sm:rounded-3xl">
            {/* Sticky so Close stays reachable however far the list scrolls. */}
            <div className="sticky -top-5 z-10 -mx-5 mb-4 flex items-start justify-between gap-3 bg-paper px-5 pt-1 pb-3">
              <div>
                <p className="eyebrow text-coral">SOS medicines</p>
                <h2 className="text-lg font-bold text-navy">
                  Outside the routine schedule
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  SOS is deliberately excluded from reminders. Log an item only
                  after it was actually taken — logging does not restart an old
                  instruction.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="shrink-0 rounded-full border border-line bg-white px-2.5 py-1 text-sm text-muted"
              >
                ×
              </button>
            </div>

            {error ? (
              <p className="mb-3 rounded-xl bg-coral-soft px-3 py-2 text-sm font-medium text-coral">
                {error}
              </p>
            ) : null}

            <ul className="space-y-3">
              {medicines.map((m) => (
                <li key={m.id} className="card space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-navy">{m.brand}</p>
                      <p className="text-xs text-muted">{m.dose}</p>
                    </div>
                    <span
                      className={`pill shrink-0 ${STATUS_STYLE[m.sosStatus ?? 'previous']}`}
                    >
                      {STATUS_LABEL[m.sosStatus ?? 'previous']}
                    </span>
                  </div>

                  {m.symptom ? (
                    <p className="text-xs font-semibold text-ink">For: {m.symptom}</p>
                  ) : null}
                  {m.instruction ? (
                    <p className="text-xs leading-relaxed text-muted">
                      {m.instruction}
                    </p>
                  ) : null}
                  {m.caution ? (
                    <p className="rounded-lg bg-coral-soft px-2.5 py-2 text-xs leading-relaxed text-ink">
                      <strong className="font-semibold">Watch: </strong>
                      {m.caution}
                    </p>
                  ) : null}

                  <button
                    type="button"
                    disabled={busy === m.id}
                    onClick={() => log(m.id)}
                    className="btn-ghost w-full"
                  >
                    {busy === m.id ? 'Saving…' : 'Log SOS dose'}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </>
  )
}
