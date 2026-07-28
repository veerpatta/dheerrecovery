'use client'

import { useRef } from 'react'
import {
  addCareNote,
  deleteBp,
  deleteCareNote,
  deleteSeizure,
  logSeizure,
  updateBand,
} from '@/lib/actions'
import { useChrome } from './chrome'

function Chevron() {
  return (
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
  )
}

export function BandForm({
  band,
}: {
  band: {
    systolicLow: number
    systolicHigh: number
    diastolicLow: number
    diastolicHigh: number
    confirmed?: boolean
  }
}) {
  const { run, pending } = useChrome()

  return (
    <details className="no-print">
      <summary className="flex items-center gap-1 text-xs font-bold text-teal">
        Edit care band
        <Chevron />
      </summary>
      <form
        action={(fd) => run(() => updateBand(fd), 'Band saved ✓')}
        className="flex flex-col gap-2 pt-2"
      >
        <p className="text-[11px] leading-relaxed text-muted">
          Edit this band only on the treating doctor’s instruction. It changes what
          the dashboard calls high or low — never what medicine to take.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ['bandSystolicLow', 'Systolic low', band.systolicLow],
              ['bandSystolicHigh', 'Systolic high', band.systolicHigh],
              ['bandDiastolicLow', 'Diastolic low', band.diastolicLow],
              ['bandDiastolicHigh', 'Diastolic high', band.diastolicHigh],
            ] as const
          ).map(([name, label, value]) => (
            <label key={name} className="space-y-1">
              <span className="eyebrow text-[10px]">{label}</span>
              <input name={name} type="number" defaultValue={value} className="field" />
            </label>
          ))}
        </div>
        <label className="flex items-start gap-2 rounded-xl border border-line bg-white p-3 text-xs leading-relaxed text-ink/80">
          <input
            name="bandConfirmed"
            type="checkbox"
            defaultChecked={band.confirmed}
            className="mt-0.5 accent-teal"
          />
          <span>
            These limits were confirmed by the treating doctor for this patient.
          </span>
        </label>
        <button
          type="submit"
          disabled={pending}
          aria-label="Save band"
          className="btn-primary h-11 w-full"
        >
          Save band
        </button>
      </form>
    </details>
  )
}

export function SeizureForm() {
  const form = useRef<HTMLFormElement>(null)
  const { run, pending } = useChrome()

  return (
    <form
      ref={form}
      action={(fd) =>
        run(async () => {
          await logSeizure(fd)
          form.current?.reset()
        }, 'Seizure event saved ✓')
      }
      className="flex flex-col gap-2"
    >
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1">
          <span className="eyebrow text-[10px]">Duration (minutes)</span>
          <input
            name="durationMinutes"
            type="number"
            min={0}
            max={600}
            inputMode="numeric"
            className="field"
          />
        </label>
        <label className="space-y-1">
          <span className="eyebrow text-[10px]">Recovery (minutes)</span>
          <input
            name="recoveryMinutes"
            type="number"
            min={0}
            max={1440}
            inputMode="numeric"
            className="field"
          />
        </label>
      </div>
      <label className="block space-y-1">
        <span className="eyebrow text-[10px]">When</span>
        <input name="occurredAt" type="datetime-local" className="field" />
      </label>
      <label className="block space-y-1">
        <span className="eyebrow text-[10px]">What happened?</span>
        <textarea
          name="description"
          rows={3}
          placeholder="What was seen, how it started and stopped, anything before it."
          className="field resize-y"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        aria-label="Save seizure event"
        className="btn-primary h-12 w-full"
      >
        {pending ? 'Saving…' : 'Save seizure event'}
      </button>
    </form>
  )
}

export function NoteForm() {
  const form = useRef<HTMLFormElement>(null)
  const { run, pending } = useChrome()

  return (
    <form
      ref={form}
      action={(fd) =>
        run(async () => {
          await addCareNote(fd)
          form.current?.reset()
        }, 'Note saved ✓')
      }
      className="flex flex-col gap-2"
    >
      <label className="block space-y-1">
        <span className="eyebrow text-[10px]">
          What should the doctor or next caregiver know?
        </span>
        <textarea
          name="body"
          rows={3}
          required
          placeholder="Appetite, sleep, mood, side effects, anything unusual."
          className="field resize-y"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        aria-label="Save caregiver note"
        className="btn-primary h-12 w-full"
      >
        {pending ? 'Saving…' : 'Save caregiver note'}
      </button>
    </form>
  )
}

export function DeleteButton({
  id,
  kind,
}: {
  id: string
  kind: 'bp' | 'seizure' | 'note'
}) {
  const { run, pending } = useChrome()
  const fn =
    kind === 'bp' ? deleteBp : kind === 'seizure' ? deleteSeizure : deleteCareNote

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => run(() => fn(id), 'Removed')}
      className="shrink-0 py-0.5 text-[11px] font-bold text-muted hover:text-coral no-print"
      aria-label="Remove this entry"
    >
      Remove
    </button>
  )
}
