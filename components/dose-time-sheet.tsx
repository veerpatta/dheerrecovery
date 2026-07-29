'use client'

import { useEffect, useState } from 'react'
import { recordDose } from '@/lib/actions'
import { careClock, careInstant, formatGap, prettyTime } from '@/lib/time'
import { Sheet, useChrome } from './chrome'

/** Minutes ago, for the one-tap chips. */
const OFFSETS = [5, 15, 30, 60]

/**
 * Captures *when* a dose was taken, not when the button was tapped.
 *
 * Caregivers log after settling the patient, so recording the tap instant
 * quietly corrupts the drift figures, the on-time score and the doctor
 * report. One sheet serves every dose card, via the chrome payload.
 */
export function DoseTimeSheet() {
  const { sheet, payload, run, closeSheet, pending } = useChrome()
  const [custom, setCustom] = useState('')

  const open = sheet === 'dose'
  useEffect(() => {
    if (!open) setCustom('')
  }, [open])

  if (!open || !payload.medicineId || !payload.slotKey || !payload.doseDate) {
    // Still render the Sheet so it stays mounted-by-name; it no-ops when closed.
    return <Sheet name="dose" title="Record a dose">{null}</Sheet>
  }

  const { medicineId, slotKey, doseDate, brand, dueTime, intervalHours } = payload
  const previousTakenAt = payload.previousTakenAt
    ? new Date(payload.previousTakenAt)
    : null

  function save(at: Date, label: string) {
    run(
      () =>
        recordDose({
          medicineId: medicineId!,
          slotKey: slotKey!,
          doseDate: doseDate!,
          status: 'taken',
          takenAt: at.toISOString(),
        }),
      `${brand} taken ${label} ✓`,
    )
    closeSheet()
  }

  /** The gap this choice would produce against the previous dose. */
  function gapFor(at: Date) {
    if (!previousTakenAt || !intervalHours) return null
    const minutes = Math.round((at.getTime() - previousTakenAt.getTime()) / 60_000)
    const target = intervalHours * 60
    // Half an hour either side of a 12-hour target is not worth alarming over.
    const off = Math.abs(minutes - target) > 60
    return { minutes, off }
  }

  const customAt =
    custom && /^\d{2}:\d{2}$/.test(custom) ? careInstant(doseDate, custom) : null
  const preview = gapFor(customAt ?? new Date())

  return (
    <Sheet
      name="dose"
      eyebrow="Record a dose"
      title={`When was ${brand} taken?`}
      intro={
        dueTime
          ? `Due ${prettyTime(dueTime)}. Log the time it was actually given — it is often not the moment you tap.`
          : 'Log the time it was actually given — it is often not the moment you tap.'
      }
    >
      <button
        type="button"
        disabled={pending}
        aria-label="Taken now"
        onClick={() => save(new Date(), 'now')}
        className="h-14 w-full rounded-2xl bg-teal text-[17px] font-bold text-white transition active:scale-[0.97]"
      >
        <span className="lang-en" aria-hidden>
          Now · {prettyTime(careClock(new Date()))}
        </span>
        <span className="lang-hi" aria-hidden>
          अभी · {prettyTime(careClock(new Date()))}
        </span>
      </button>

      <div className="mt-2.5 grid grid-cols-2 gap-2">
        {OFFSETS.map((mins) => (
          <button
            key={mins}
            type="button"
            disabled={pending}
            onClick={() => save(new Date(Date.now() - mins * 60_000), `${formatGap(mins)} ago`)}
            className="h-12 rounded-xl border border-line bg-white text-[13px] font-bold text-ink transition active:scale-95"
          >
            {formatGap(mins)} ago
          </button>
        ))}
      </div>

      <div className="mt-2.5 flex items-center gap-2 rounded-xl bg-white p-2.5">
        <label className="flex-1 text-[11px] font-semibold text-muted">
          <span className="lang-en">Another time today</span>
          <span className="lang-hi">आज का कोई और समय</span>
          <input
            type="time"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            aria-label="Time the dose was taken"
            className="mt-1 w-full rounded-[10px] border border-line bg-white p-2 text-center text-[15px] text-ink outline-teal"
          />
        </label>
        <button
          type="button"
          disabled={pending || !customAt}
          aria-label="Save dose time"
          onClick={() => customAt && save(customAt, `at ${prettyTime(custom)}`)}
          className="btn-primary h-11 self-end px-4"
        >
          Save
        </button>
      </div>

      {preview && previousTakenAt ? (
        <p
          className={`mt-2.5 rounded-xl px-3 py-2.5 text-[12px] leading-relaxed ${
            preview.off ? 'bg-coral-soft text-ink' : 'bg-mint text-teal'
          }`}
        >
          {preview.off ? '⚠ ' : '✓ '}
          {formatGap(preview.minutes)} after the{' '}
          {payload.previousLabel?.toLowerCase() ?? 'previous'} dose
          {preview.off
            ? ` — this medicine is prescribed about ${intervalHours} hours apart. Saving is fine; the gap is recorded for the doctor.`
            : '.'}
        </p>
      ) : null}

      <p className="mt-2.5 text-[11px] leading-relaxed text-muted">
        A time in the future is not accepted. Once saved, tap the time on the
        dose card to correct it — the Taken and Skip buttons step aside, so
        there is nothing left to tap twice by accident.
      </p>
    </Sheet>
  )
}
