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

const BP_SYMPTOMS = [
  'Dizziness',
  'Headache',
  'Weakness',
  'Blurred vision',
  'Chest discomfort',
  'Breathlessness',
] as const

export function BpForm({
  band,
}: {
  band: {
    systolicLow: number
    systolicHigh: number
    diastolicLow: number
    diastolicHigh: number
  }
}) {
  const form = useRef<HTMLFormElement>(null)
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [pairId, setPairId] = useState<string | null>(null)
  const [reaction, setReaction] = useState<{
    level: 'severe' | 'low' | 'high' | 'range'
    systolic: number
    diastolic: number
  } | null>(null)

  const save = (fd: FormData) => {
    setError(null)
    start(async () => {
      try {
        const result = await logBp(fd)
        setReaction({
          level: result.level,
          systolic: result.reading.systolic,
          diastolic: result.reading.diastolic,
        })
        setPairId(result.pairId)
        form.current?.reset()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not save that reading.')
      }
    })
  }

  return (
    <form
      ref={form}
      id="log-bp"
      action={save}
      aria-busy={pending}
      className="card scroll-mt-32 space-y-3"
    >
      <div>
        <p className="eyebrow">Log BP · BP दर्ज करें</p>
        <h2 className="mt-1 text-base font-bold text-navy">Add a reading</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          Home BP is best measured as two readings about a minute apart — log both.
        </p>
      </div>

      <fieldset disabled={pending} className="contents">
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

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <label className="space-y-1">
          <span className="eyebrow">Context</span>
          <select name="context" defaultValue="Resting" className="field">
            <option>Resting</option>
            <option>After activity</option>
            <option>Before medicine</option>
            <option>After medicine</option>
            <option>Feeling unwell</option>
          </select>
        </label>
        <label className="space-y-1">
          <span className="eyebrow">Position</span>
          <select name="position" defaultValue="Seated" className="field">
            <option>Seated</option>
            <option>Lying down</option>
            <option>Standing</option>
          </select>
        </label>
        <label className="space-y-1">
          <span className="eyebrow">Arm</span>
          <select name="arm" defaultValue="" className="field">
            <option value="">Not recorded</option>
            <option>Left</option>
            <option>Right</option>
          </select>
        </label>
      </div>

      <fieldset>
        <legend className="eyebrow">Symptoms (optional)</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {BP_SYMPTOMS.map((symptom) => (
            <label
              key={symptom}
              className="flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-xs font-semibold text-muted"
            >
              <input
                name="symptom"
                type="checkbox"
                value={symptom}
                className="accent-teal"
              />
              {symptom}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="block space-y-1">
        <span className="eyebrow">Measured at</span>
        <input name="measuredAt" type="datetime-local" className="field" />
      </label>
      </fieldset>

      <input name="pairId" type="hidden" value={pairId ?? ''} />

      {pairId ? (
        <p className="rounded-xl bg-mint px-3 py-2 text-xs font-semibold text-teal">
          First reading saved. Rest quietly for about one minute, then save the
          second reading below.
        </p>
      ) : null}

      {reaction ? (
        <div
          role="status"
          className={`rounded-xl px-3 py-2.5 text-xs leading-relaxed ${
            reaction.level === 'severe'
              ? 'bg-coral-soft text-coral'
              : reaction.level === 'low' || reaction.level === 'high'
                ? 'bg-amber/15 text-ink'
                : 'bg-mint text-teal'
          }`}
        >
          <p className="font-bold">
            Saved {reaction.systolic}/{reaction.diastolic}.
          </p>
          {reaction.level === 'severe' ? (
            <p className="mt-1">
              This is far outside the reference band. Recheck after quiet rest and
              seek urgent medical help if it remains very high or there are
              concerning symptoms.
            </p>
          ) : reaction.level === 'high' || reaction.level === 'low' ? (
            <p className="mt-1">
              Outside the family reference band of {band.systolicLow}/
              {band.diastolicLow}–{band.systolicHigh}/{band.diastolicHigh}.
              Recheck calmly and follow the treating doctor’s plan.
            </p>
          ) : (
            <p className="mt-1">Inside the current family reference band.</p>
          )}
        </div>
      ) : null}

      {error ? <p className="text-sm font-medium text-coral">{error}</p> : null}
      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="submit"
          name="mode"
          value="pair"
          disabled={pending}
          className="btn-ghost w-full"
        >
          {pending ? 'Saving…' : pairId ? 'Save + another reading' : 'Save + second reading'}
        </button>
        <button
          type="submit"
          name="mode"
          value="single"
          disabled={pending}
          className="btn-primary w-full"
        >
          {pending ? 'Saving…' : pairId ? 'Save and finish pair' : 'Save BP'}
        </button>
      </div>
    </form>
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
      action={(fd) => run(() => updateBand(fd), () => setOpen(false))}
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

export function SeizureForm() {
  const form = useRef<HTMLFormElement>(null)
  const { pending, error, run } = useAction()

  return (
    <form
      ref={form}
      action={(fd) => run(() => logSeizure(fd), () => form.current?.reset())}
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

export function NoteForm() {
  const form = useRef<HTMLFormElement>(null)
  const { pending, error, run } = useAction()

  return (
    <form
      ref={form}
      action={(fd) => run(() => addCareNote(fd), () => form.current?.reset())}
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
  id,
  kind,
}: {
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
      onClick={() => run(() => fn(id))}
      className="shrink-0 text-xs font-semibold text-muted hover:text-coral no-print"
      aria-label="Remove this entry"
    >
      {pending ? '…' : 'Remove'}
    </button>
  )
}
