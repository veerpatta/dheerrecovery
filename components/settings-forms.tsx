'use client'

import { useRef, useState } from 'react'
import {
  addCustomMedicine,
  archiveMedicine,
  updateAlertLead,
  updateSettings,
  updateSlotTime,
} from '@/lib/actions'
import { prettyTime } from '@/lib/time'
import { useChrome } from './chrome'

/** The design's chips save on tap — no submit button to hunt for. */
export function AlertLeadChips({ alertLeadMinutes }: { alertLeadMinutes: number }) {
  const { run, pending } = useChrome()

  return (
    <div className="flex gap-2">
      {[5, 10, 15].map((m) => (
        <button
          key={m}
          type="button"
          disabled={pending}
          aria-pressed={m === alertLeadMinutes}
          onClick={() =>
            run(() => updateAlertLead({ minutes: m }), `Alerts ${m} minutes before ✓`)
          }
          className={`h-11 flex-1 rounded-xl border text-[13px] font-bold transition active:scale-95 ${
            m === alertLeadMinutes
              ? 'border-navy bg-navy text-white'
              : 'border-line bg-white text-muted'
          }`}
        >
          {m} minutes
        </button>
      ))}
    </div>
  )
}

export function CourseStartForm({ courseStart }: { courseStart: string }) {
  const { run, pending } = useChrome()

  return (
    <details className="no-print">
      <summary className="flex items-center gap-1 py-1 text-xs font-bold text-teal">
        Change the prescription start date
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
      <form
        action={(fd) => run(() => updateSettings(fd), 'Settings saved ✓')}
        className="flex flex-col gap-2 pt-2"
      >
        <label className="block space-y-1">
          <span className="eyebrow text-[10px]">Prescription start</span>
          <input
            name="courseStart"
            type="date"
            defaultValue={courseStart}
            className="field"
          />
          <span className="block text-[11px] leading-relaxed text-muted">
            Keep this at the prescription date unless the treating team gave a
            different start date.
          </span>
        </label>
        <button
          type="submit"
          disabled={pending}
          aria-label="Save settings"
          className="btn-primary h-11 w-full"
        >
          Save settings
        </button>
      </form>
    </details>
  )
}

export function SlotTimeRow({
  slotId,
  medicineId,
  brand,
  label,
  time,
  editable,
  removable,
}: {
  slotId: string
  medicineId: string
  brand: string
  label: string
  time: string
  editable: boolean
  removable: boolean
}) {
  const { run, pending } = useChrome()
  const [value, setValue] = useState(time.slice(0, 5))

  return (
    <li className="flex items-center justify-between gap-2.5 rounded-xl bg-paper px-2.5 py-2.5">
      <div className="min-w-0">
        <p className="text-[13px] font-bold text-navy">{brand}</p>
        <p className="text-[11px] text-muted">{label}</p>
      </div>
      {editable ? (
        <input
          type="time"
          value={value}
          disabled={pending}
          onChange={(e) => {
            const next = e.target.value
            setValue(next)
            if (!next) return
            run(
              () => updateSlotTime({ slotId, time: next }),
              `${brand} → ${prettyTime(next)}`,
            )
          }}
          className="w-28 shrink-0 rounded-[10px] border border-line bg-white p-1.5 text-center text-sm outline-teal"
          aria-label={`Reminder time for ${brand}, ${label}`}
        />
      ) : (
        <span className="shrink-0 rounded-[10px] bg-white px-3 py-1.5 text-[13px] font-extrabold text-navy">
          {prettyTime(time)}
        </span>
      )}
      {removable ? (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(() => archiveMedicine({ medicineId }), `${brand} removed`)
          }
          className="shrink-0 py-0.5 text-[11px] font-bold text-coral"
          aria-label={`Remove ${brand}`}
        >
          Remove
        </button>
      ) : null}
    </li>
  )
}

export function AddMedicineForm() {
  const form = useRef<HTMLFormElement>(null)
  const { run, pending } = useChrome()

  return (
    <form
      ref={form}
      id="add-medicine"
      action={(fd) => {
        const brand = String(fd.get('brand') ?? '').trim()
        run(async () => {
          await addCustomMedicine(fd)
          form.current?.reset()
        }, `${brand} added ✓`)
      }}
      className="card flex scroll-mt-32 flex-col gap-2.5"
    >
      <div>
        <p className="eyebrow">
          <span className="lang-en">Add medicine</span>
          <span className="lang-hi">दवा जोड़ें</span>
        </p>
        <h2 className="mt-1 text-[15px] font-extrabold text-navy">
          Scheduled or unscheduled
        </h2>
        <p className="mt-1 text-[11.5px] leading-relaxed text-muted">
          Anything added here is marked as a caregiver entry, not part of the
          printed prescription. Leave the time blank to add it as an SOS-style
          entry.
        </p>
      </div>

      <label className="block space-y-1">
        <span className="eyebrow text-[10px]">Medicine name</span>
        <input name="brand" required placeholder="e.g. Shelcal 500" className="field" />
      </label>
      <label className="block space-y-1">
        <span className="eyebrow text-[10px]">Dose</span>
        <input name="dose" placeholder="1 tablet · 500 mg" className="field" />
      </label>
      <label className="block space-y-1">
        <span className="eyebrow text-[10px]">Reminder time (optional)</span>
        <input name="time" type="time" className="field" />
      </label>

      <button
        type="submit"
        disabled={pending}
        aria-label="Add medicine"
        className="btn-primary h-12 w-full"
      >
        <span className="lang-en" aria-hidden>
          {pending ? 'Saving…' : 'Add medicine'}
        </span>
        <span className="lang-hi" aria-hidden>
          {pending ? 'सहेजा जा रहा…' : 'दवा जोड़ें'}
        </span>
      </button>
    </form>
  )
}
