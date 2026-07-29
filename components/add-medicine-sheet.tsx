'use client'

import { useRef, useState } from 'react'
import { addCustomMedicine } from '@/lib/actions'
import { Sheet, useAction, useChrome } from './chrome'
import { prettyTime } from '@/lib/time'

/**
 * A caregiver-added medicine, always flagged as such. Setting a time puts it
 * on today's schedule; leaving it blank files it with the SOS entries.
 */
export function AddMedicineSheet() {
  const { closeSheet, payload } = useChrome()
  const { run, busy: pending } = useAction()
  const form = useRef<HTMLFormElement>(null)
  const [schedule, setSchedule] = useState(false)
  const [frequency, setFrequency] = useState(1)

  // Opened from the SOS sheet: no reminder time, which is what makes
  // `addCustomMedicine` file it as an SOS entry rather than a routine one.
  const sosMode = payload.mode === 'sos'

  return (
    <Sheet
      name="add"
      title={
        sosMode ? (
          <>
            <span className="lang-en">Add SOS medicine</span>
            <span className="lang-hi">SOS दवा जोड़ें</span>
          </>
        ) : (
          <>
            <span className="lang-en">Add medicine</span>
            <span className="lang-hi">दवा जोड़ें</span>
          </>
        )
      }
      intro={
        sosMode
          ? 'Added as an SOS entry with no reminder — outside the routine schedule, like the other SOS medicines. It is marked as a caregiver entry, not part of the printed prescription.'
          : 'Anything added here is marked as a caregiver entry, not part of the printed prescription. Set a time to put it on today’s schedule; leave the time blank to add it as an SOS-style entry.'
      }
    >
      <form
        ref={form}
        action={(fd) => {
          const brand = String(fd.get('brand') ?? '').trim()
          const time = String(fd.get('time') ?? '').trim()
          run(async () => {
            await addCustomMedicine(fd)
            form.current?.reset()
            setSchedule(false)
            setFrequency(1)
            closeSheet()
          }, time ? `${brand} added · ${prettyTime(time)} ✓` : `${brand} added as an SOS-style entry ✓`)
        }}
        className="flex flex-col gap-2"
      >
        <label className="block space-y-1">
          <span className="eyebrow">Medicine name</span>
          <input name="brand" required placeholder="e.g. Shelcal 500" className="field" />
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

        {/*
          In SOS mode no time is submitted at all — that absence is exactly
          what makes `addCustomMedicine` file it as an SOS entry rather than
          putting it on the reminder schedule.
        */}
        {sosMode ? null : (
          <label className="block space-y-1">
            <span className="eyebrow">Reminder time (optional)</span>
            <input name="time" type="time" className="field" />
          </label>
        )}

        <details>
          <summary className="flex items-center gap-1 py-1 text-xs font-bold text-teal">
            Log it as taken now, or add a repeating schedule
            <svg
              className="chev"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              aria-hidden
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </summary>

          <div className="flex flex-col gap-2 pt-2">
            <fieldset className="grid grid-cols-2 gap-2">
              <legend className="eyebrow mb-1">What happened?</legend>
              <label className="cursor-pointer">
                <input
                  type="radio"
                  name="action"
                  value="taken"
                  className="peer sr-only"
                />
                <span className="block rounded-xl border border-line bg-white p-3 text-sm font-semibold peer-checked:border-teal peer-checked:bg-mint peer-checked:text-teal">
                  Taken just now
                </span>
              </label>
              <label className="cursor-pointer">
                <input
                  type="radio"
                  name="action"
                  value="add"
                  defaultChecked
                  className="peer sr-only"
                />
                <span className="block rounded-xl border border-line bg-white p-3 text-sm font-semibold peer-checked:border-navy peer-checked:bg-paper peer-checked:text-navy">
                  Add without taking
                </span>
              </label>
            </fieldset>

            {sosMode ? null : (
              <label className="flex items-center gap-3 rounded-xl bg-white p-3">
                <input
                  type="checkbox"
                  checked={schedule}
                  onChange={(e) => setSchedule(e.target.checked)}
                  className="h-5 w-5 accent-teal"
                />
                <span>
                  <b className="block text-sm text-navy">Repeat more than once a day</b>
                  <small className="text-xs text-muted">
                    Enter only the times provided by the treating team.
                  </small>
                </span>
              </label>
            )}

            {schedule && !sosMode ? (
              <div className="flex flex-col gap-2 rounded-xl border border-line bg-white p-3">
                <label className="block space-y-1">
                  <span className="eyebrow">Daily frequency</span>
                  <select
                    name="frequency"
                    value={frequency}
                    onChange={(e) => setFrequency(Number(e.target.value))}
                    className="field"
                  >
                    <option value={1}>Once daily</option>
                    <option value={2}>Twice daily</option>
                    <option value={3}>Three times daily</option>
                  </select>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {Array.from({ length: frequency }, (_, i) => (
                    <label key={i} className="space-y-1">
                      <span className="eyebrow">Dose {i + 1}</span>
                      <input
                        name={`time${i + 1}`}
                        type="time"
                        required
                        defaultValue={['08:00', '20:00', '14:00'][i]}
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
                rows={2}
                placeholder="Why it was taken, or what the doctor said."
                className="field resize-y"
              />
            </label>
          </div>
        </details>

        <p className="note-warn">
          Verify the strip, strength and current instruction before every dose.
          Adding an entry does not prescribe or restart a medicine.
        </p>

        <button
          type="submit"
          disabled={pending}
          aria-label="Add medicine"
          className="btn-primary h-12 w-full"
        >
          <span className="lang-en" aria-hidden>
            {pending ? 'Saving…' : sosMode ? 'Add to SOS list' : 'Add to schedule'}
          </span>
          <span className="lang-hi" aria-hidden>
            {pending
              ? 'सहेजा जा रहा…'
              : sosMode
                ? 'SOS सूची में जोड़ें'
                : 'शेड्यूल में जोड़ें'}
          </span>
        </button>
      </form>
    </Sheet>
  )
}
