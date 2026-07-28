'use client'

import { useRef, useState, useTransition } from 'react'
import {
  addCareNote,
  deleteBp,
  deleteCareNote,
  deleteSeizure,
  logBp,
  logSeizure,
  updateBand,
} from '@/lib/actions'

function useAction() {
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const run = (fn: () => Promise<unknown>, after?: () => void) => {
    setError(null)
    start(async () => {
      try {
        await fn()
        after?.()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not save that.')
      }
    })
  }
  return { pending, error, run }
}

export function BpForm({ code }: { code: string }) {
  const form = useRef<HTMLFormElement>(null)
  const { pending, error, run } = useAction()

  return (
    <form
      ref={form}
      id="log-bp"
      action={(fd) => run(() => logBp(code, fd), () => form.current?.reset())}
      className="card scroll-mt-32 space-y-3"
    >
      <div>
        <p className="eyebrow">Log BP · BP दर्ज करें</p>
        <h2 className="mt-1 text-base font-bold text-navy">Add a reading</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          Home BP is best measured as two readings about a minute apart — log both.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <label className="space-y-1">
          <span className="eyebrow">Systolic</span>
          <input
            name="systolic"
            type="number"
            required
            min={50}
            max={260}
            inputMode="numeric"
            placeholder="118"
            className="field"
          />
        </label>
        <label className="space-y-1">
          <span className="eyebrow">Diastolic</span>
          <input
            name="diastolic"
            type="number"
            required
            min={30}
            max={180}
            inputMode="numeric"
            placeholder="76"
            className="field"
          />
        </label>
        <label className="space-y-1">
          <span className="eyebrow">Pulse</span>
          <input
            name="pulse"
            type="number"
            min={20}
            max={220}
            inputMode="numeric"
            placeholder="72"
            className="field"
          />
        </label>
      </div>

      <label className="block space-y-1">
        <span className="eyebrow">Symptoms (optional)</span>
        <input
          name="symptoms"
          placeholder="Dizziness, headache, chest pain…"
          className="field"
        />
      </label>

      <label className="block space-y-1">
        <span className="eyebrow">Measured at</span>
        <input name="measuredAt" type="datetime-local" className="field" />
      </label>

      {error ? <p className="text-sm font-medium text-coral">{error}</p> : null}
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? 'Saving…' : 'Save BP'}
      </button>
    </form>
  )
}

export function BandForm({
  code,
  band,
}: {
  code: string
  band: {
    systolicLow: number
    systolicHigh: number
    diastolicLow: number
    diastolicHigh: number
  }
}) {
  const [open, setOpen] = useState(false)
  const { pending, error, run } = useAction()

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-ghost w-full no-print"
      >
        Edit care band
      </button>
    )
  }

  return (
    <form
      action={(fd) => run(() => updateBand(code, fd), () => setOpen(false))}
      className="space-y-3 rounded-xl bg-paper p-3 no-print"
    >
      <p className="text-xs leading-relaxed text-muted">
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
            <span className="eyebrow">{label}</span>
            <input
              name={name}
              type="number"
              defaultValue={value}
              className="field"
            />
          </label>
        ))}
      </div>
      {error ? <p className="text-sm font-medium text-coral">{error}</p> : null}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="btn-primary flex-1">
          Save band
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="btn-ghost flex-1"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

export function SeizureForm({ code }: { code: string }) {
  const form = useRef<HTMLFormElement>(null)
  const { pending, error, run } = useAction()

  return (
    <form
      ref={form}
      action={(fd) => run(() => logSeizure(code, fd), () => form.current?.reset())}
      className="space-y-3"
    >
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1">
          <span className="eyebrow">Duration (minutes)</span>
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
          <span className="eyebrow">Recovery time (minutes)</span>
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
        <span className="eyebrow">When</span>
        <input name="occurredAt" type="datetime-local" className="field" />
      </label>
      <label className="block space-y-1">
        <span className="eyebrow">What happened?</span>
        <textarea
          name="description"
          rows={3}
          placeholder="What was seen, how it started and stopped, anything before it."
          className="field resize-y"
        />
      </label>
      {error ? <p className="text-sm font-medium text-coral">{error}</p> : null}
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? 'Saving…' : 'Save seizure event'}
      </button>
    </form>
  )
}

export function NoteForm({ code }: { code: string }) {
  const form = useRef<HTMLFormElement>(null)
  const { pending, error, run } = useAction()

  return (
    <form
      ref={form}
      action={(fd) => run(() => addCareNote(code, fd), () => form.current?.reset())}
      className="space-y-3"
    >
      <label className="block space-y-1">
        <span className="eyebrow">
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
      {error ? <p className="text-sm font-medium text-coral">{error}</p> : null}
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? 'Saving…' : 'Save caregiver note'}
      </button>
    </form>
  )
}

export function DeleteButton({
  code,
  id,
  kind,
}: {
  code: string
  id: string
  kind: 'bp' | 'seizure' | 'note'
}) {
  const { pending, run } = useAction()
  const fn =
    kind === 'bp' ? deleteBp : kind === 'seizure' ? deleteSeizure : deleteCareNote

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => run(() => fn(code, id))}
      className="shrink-0 text-xs font-semibold text-muted hover:text-coral no-print"
      aria-label="Remove this entry"
    >
      {pending ? '…' : 'Remove'}
    </button>
  )
}
