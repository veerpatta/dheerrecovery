'use client'

import { useRef, useState, useTransition } from 'react'
import { addCustomMedicine, updateSettings, updateSlotTime } from '@/lib/actions'
import { prettyTime } from '@/lib/time'

export function SettingsForm({
  alertLeadMinutes,
  courseStart,
}: {
  alertLeadMinutes: number
  courseStart: string
}) {
  const [pending, start] = useTransition()
  const [saved, setSaved] = useState(false)

  return (
    <form
      action={(fd) =>
        start(async () => {
          await updateSettings(fd)
          setSaved(true)
          setTimeout(() => setSaved(false), 2000)
        })
      }
      className="space-y-3"
    >
      <fieldset className="space-y-2">
        <legend className="eyebrow">Alert before</legend>
        <div className="flex gap-2">
          {[5, 10, 15].map((m) => (
            <label key={m} className="flex-1">
              <input
                type="radio"
                name="alertLeadMinutes"
                value={m}
                defaultChecked={m === alertLeadMinutes}
                className="peer sr-only"
              />
              <span className="block cursor-pointer rounded-xl border border-line bg-white px-3 py-2.5 text-center text-sm font-semibold text-muted peer-checked:border-navy peer-checked:bg-navy peer-checked:text-white">
                {m} minutes
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="block space-y-1">
        <span className="eyebrow">Prescription start</span>
        <input
          name="courseStart"
          type="date"
          defaultValue={courseStart}
          className="field"
        />
        <span className="block text-xs leading-relaxed text-muted">
          Keep this at the prescription date unless the treating team gave a
          different start date.
        </span>
      </label>

      <button type="submit" disabled={pending} className="btn-primary w-full">
        {saved ? 'Saved ✓' : pending ? 'Saving…' : 'Save settings'}
      </button>
    </form>
  )
}

export function SlotTimeRow({
  slotId,
  brand,
  label,
  time,
  editable,
}: {
  slotId: string
  brand: string
  label: string
  time: string
  editable: boolean
}) {
  const [pending, start] = useTransition()
  const [value, setValue] = useState(time.slice(0, 5))
  const [error, setError] = useState<string | null>(null)

  function save(next: string) {
    setValue(next)
    setError(null)
    start(async () => {
      try {
        await updateSlotTime({ slotId, time: next })
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not save that.')
      }
    })
  }

  return (
    <li className="flex items-center justify-between gap-3 rounded-xl bg-paper px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-navy">{brand}</p>
        <p className="text-xs text-muted">{label}</p>
        {error ? <p className="text-xs font-medium text-coral">{error}</p> : null}
      </div>
      {editable ? (
        <input
          type="time"
          value={value}
          disabled={pending}
          onChange={(e) => save(e.target.value)}
          className="field w-32 shrink-0 !py-1.5 text-center"
          aria-label={`Reminder time for ${brand}, ${label}`}
        />
      ) : (
        <span className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-sm font-bold text-navy">
          {prettyTime(time)}
        </span>
      )}
    </li>
  )
}

export function AddMedicineForm() {
  const form = useRef<HTMLFormElement>(null)
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <form
      ref={form}
      id="add-medicine"
      action={(fd) =>
        start(async () => {
          setError(null)
          try {
            await addCustomMedicine(fd)
            form.current?.reset()
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not save that.')
          }
        })
      }
      className="card scroll-mt-32 space-y-3"
    >
      <div>
        <p className="eyebrow">Add medicine</p>
        <h2 className="mt-1 text-base font-bold text-navy">
          Scheduled or unscheduled
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          Anything added here is marked as a caregiver entry, not part of the
          printed prescription. Leave the time blank to add it as an SOS-style
          entry.
        </p>
      </div>

      <label className="block space-y-1">
        <span className="eyebrow">Medicine name</span>
        <input name="brand" required placeholder="e.g. Shelcal 500" className="field" />
      </label>
      <label className="block space-y-1">
        <span className="eyebrow">Dose</span>
        <input name="dose" placeholder="1 tablet · 500 mg" className="field" />
      </label>
      <label className="block space-y-1">
        <span className="eyebrow">Reminder time (optional)</span>
        <input name="time" type="time" className="field" />
      </label>

      {error ? <p className="text-sm font-medium text-coral">{error}</p> : null}
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? 'Saving…' : 'Add medicine'}
      </button>
    </form>
  )
}
