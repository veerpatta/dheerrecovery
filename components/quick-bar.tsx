'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'
import { addCustomMedicine } from '@/lib/actions'
import { T } from './t'

/** Fixed bottom bar — the two things a caregiver reaches for mid-task. */
export function QuickBar({ code }: { code: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [schedule, setSchedule] = useState(false)
  const [frequency, setFrequency] = useState(1)
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const form = useRef<HTMLFormElement>(null)

  function close() {
    if (pending) return
    setOpen(false)
    setSchedule(false)
    setFrequency(1)
    setError(null)
    form.current?.reset()
  }

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-4 py-3 backdrop-blur no-print">
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          <Link href={`/c/${code}/logs#log-bp`} className="btn-primary flex-1">
            <span aria-hidden>♥</span>
            <T k="logBp" />
          </Link>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="btn-ghost flex-1"
          >
            <T k="addMedicine" />
          </button>
        </div>
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-navy/45 p-0 sm:p-4 no-print"
          onMouseDown={(event) => event.target === event.currentTarget && close()}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="quick-medicine-title"
            className="mx-auto min-h-dvh w-full max-w-xl bg-white px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(6rem,env(safe-area-inset-bottom))] sm:min-h-0 sm:rounded-3xl sm:p-6"
          >
            <header className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="eyebrow">Quick add medicine</p>
                <h2
                  id="quick-medicine-title"
                  className="mt-1 text-xl font-bold text-navy"
                >
                  Add it, log it, save it
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  Caregiver-added entries are clearly separated from the printed
                  prescription.
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                className="btn-ghost !h-11 !w-11 !p-0"
                aria-label="Close quick add medicine"
              >
                ×
              </button>
            </header>

            <form
              ref={form}
              action={(fd) =>
                start(async () => {
                  setError(null)
                  try {
                    await addCustomMedicine(code, fd)
                    router.refresh()
                    close()
                  } catch (e) {
                    setError(e instanceof Error ? e.message : 'Could not save that.')
                  }
                })
              }
              className="space-y-4"
            >
              <label className="block space-y-1">
                <span className="eyebrow">Medicine name</span>
                <input
                  name="brand"
                  required
                  placeholder="e.g. Shelcal"
                  className="field"
                />
              </label>

              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1">
                  <span className="eyebrow">Strength</span>
                  <input name="strength" placeholder="500 mg" className="field" />
                </label>
                <label className="space-y-1">
                  <span className="eyebrow">Form</span>
                  <select name="form" defaultValue="Tablet" className="field">
                    <option>Tablet</option>
                    <option>Capsule</option>
                    <option>Syrup</option>
                    <option>Other</option>
                  </select>
                </label>
              </div>

              <fieldset className="space-y-2">
                <legend className="eyebrow">What happened?</legend>
                <div className="grid grid-cols-2 gap-2">
                  <label className="cursor-pointer">
                    <input
                      type="radio"
                      name="action"
                      value="taken"
                      defaultChecked
                      className="peer sr-only"
                    />
                    <span className="block rounded-xl border border-line p-3 text-sm font-semibold peer-checked:border-teal peer-checked:bg-mint peer-checked:text-teal">
                      Taken just now
                    </span>
                  </label>
                  <label className="cursor-pointer">
                    <input
                      type="radio"
                      name="action"
                      value="add"
                      className="peer sr-only"
                    />
                    <span className="block rounded-xl border border-line p-3 text-sm font-semibold peer-checked:border-navy peer-checked:bg-paper peer-checked:text-navy">
                      Add without taking
                    </span>
                  </label>
                </div>
              </fieldset>

              <label className="flex items-center gap-3 rounded-xl bg-paper p-3">
                <input
                  type="checkbox"
                  checked={schedule}
                  onChange={(event) => setSchedule(event.target.checked)}
                  className="h-5 w-5"
                />
                <span>
                  <b className="block text-sm text-navy">Add a future schedule</b>
                  <small className="text-xs text-muted">
                    Enter only the times provided by the treating team.
                  </small>
                </span>
              </label>

              {schedule ? (
                <div className="space-y-3 rounded-xl border border-line p-3">
                  <label className="block space-y-1">
                    <span className="eyebrow">Daily frequency</span>
                    <select
                      name="frequency"
                      value={frequency}
                      onChange={(event) => setFrequency(Number(event.target.value))}
                      className="field"
                    >
                      <option value={1}>Once daily</option>
                      <option value={2}>Twice daily</option>
                      <option value={3}>Three times daily</option>
                    </select>
                  </label>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {Array.from({ length: frequency }, (_, index) => (
                      <label key={index} className="space-y-1">
                        <span className="eyebrow">Dose {index + 1}</span>
                        <input
                          name={`time${index + 1}`}
                          type="time"
                          required
                          defaultValue={['08:00', '20:00', '14:00'][index]}
                          className="field"
                        />
                      </label>
                    ))}
                  </div>
                  <label className="block space-y-1">
                    <span className="eyebrow">Course days (optional)</span>
                    <input
                      name="courseDays"
                      type="number"
                      min={1}
                      max={365}
                      inputMode="numeric"
                      className="field"
                    />
                  </label>
                </div>
              ) : null}

              <label className="block space-y-1">
                <span className="eyebrow">Notes (optional)</span>
                <textarea
                  name="notes"
                  rows={3}
                  placeholder="Why it was taken, or what the doctor said."
                  className="field resize-y"
                />
              </label>

              <p className="rounded-xl bg-coral-soft px-3 py-2.5 text-xs leading-relaxed text-ink">
                Verify the strip, strength and current instruction before every
                dose. Adding an entry does not prescribe or restart a medicine.
              </p>

              {error ? <p className="text-sm font-medium text-coral">{error}</p> : null}

              <div className="sticky bottom-0 grid grid-cols-2 gap-2 bg-white py-3">
                <button type="button" onClick={close} className="btn-ghost">
                  Cancel
                </button>
                <button type="submit" disabled={pending} className="btn-primary">
                  {pending ? 'Saving…' : 'Save medicine'}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </>
  )
}
