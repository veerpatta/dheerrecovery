'use client'

import { useState, useTransition } from 'react'
import { recordDose } from '@/lib/actions'
import { formatDrift, prettyTime } from '@/lib/time'
import type { DoseStatus } from '@/lib/queries'

const TONE_BAR: Record<string, string> = {
  recovery: 'bg-teal',
  seizure: 'bg-violet',
  bp: 'bg-blue',
  comfort: 'bg-amber',
}

const STATUS_PILL: Record<DoseStatus, { label: string; className: string }> = {
  taken: { label: 'Taken', className: 'bg-mint text-teal' },
  skipped: { label: 'Skipped', className: 'bg-coral-soft text-coral' },
  'not-recorded': { label: 'Needs review', className: 'bg-amber/15 text-amber' },
  upcoming: { label: 'Upcoming', className: 'bg-paper text-muted' },
}

export interface DoseCardProps {
  doseDate: string
  medicineId: string
  brand: string
  dose: string
  label: string
  time: string
  tone: string
  status: DoseStatus
  slotKey: string
  drift: number | null
  verify: string | null
}

export function DoseCard(props: DoseCardProps) {
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [actualTime, setActualTime] = useState('')
  const pill = STATUS_PILL[props.status]

  function tap(status: 'taken' | 'skipped') {
    setError(null)
    start(async () => {
      try {
        await recordDose({
          medicineId: props.medicineId,
          slotKey: props.slotKey,
          doseDate: props.doseDate,
          status,
          takenAt:
            status === 'taken' && actualTime
              ? new Date(
                  `${props.doseDate}T${actualTime}:00+05:30`,
                ).toISOString()
              : null,
        })
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not save that.')
      }
    })
  }

  const isTaken = props.status === 'taken'
  const isSkipped = props.status === 'skipped'

  return (
    <li className="card relative overflow-hidden !p-0">
      <span
        className={`absolute inset-y-0 left-0 w-1 ${TONE_BAR[props.tone] ?? 'bg-teal'}`}
        aria-hidden
      />
      <div className="space-y-3 py-4 pr-4 pl-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-navy">{prettyTime(props.time)}</p>
            <p className="text-[11px] text-muted">Scheduled time</p>
          </div>
          <span className={`pill shrink-0 ${pill.className}`}>{pill.label}</span>
        </div>

        <div>
          <p className="text-base font-bold text-navy">{props.brand}</p>
          <p className="mt-0.5 text-sm text-ink/80">{props.dose}</p>
          <p className="mt-0.5 text-xs text-muted">{props.label}</p>
        </div>

        {isTaken && props.drift !== null ? (
          <p className="text-xs font-medium text-teal">
            Recorded {formatDrift(props.drift)}
          </p>
        ) : null}

        {props.status === 'not-recorded' && props.verify ? (
          <p className="rounded-lg bg-amber/10 px-2.5 py-2 text-xs leading-relaxed text-ink">
            ⚑ {props.verify}
          </p>
        ) : null}

        {error ? <p className="text-xs font-medium text-coral">{error}</p> : null}

        {!isTaken ? (
          <label className="block space-y-1 rounded-xl bg-paper px-3 py-2">
            <span className="eyebrow">Actual time (optional)</span>
            <input
              type="time"
              value={actualTime}
              onChange={(event) => setActualTime(event.target.value)}
              className="field !py-1.5"
              aria-label={`Actual dose time for ${props.brand}`}
            />
            <span className="block text-[11px] text-muted">
              Leave blank to record the current time.
            </span>
          </label>
        ) : null}

        <div className="flex gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => tap('taken')}
            aria-pressed={isTaken}
            className={isTaken ? 'btn-primary flex-1' : 'btn-ghost flex-1'}
          >
            {isTaken ? 'Taken ✓' : 'Taken'}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => tap('skipped')}
            aria-pressed={isSkipped}
            className={
              isSkipped
                ? 'btn-danger flex-1'
                : 'btn-ghost flex-1 text-muted'
            }
          >
            {isSkipped ? 'Skipped ✓' : 'Skip'}
          </button>
        </div>
        {isTaken || isSkipped ? (
          <p className="text-[11px] text-muted">
            Tap the same button again to undo. Skipping never means doubling the
            next dose.
          </p>
        ) : null}
      </div>
    </li>
  )
}
