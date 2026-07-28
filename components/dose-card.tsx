'use client'

import { recordDose, setDoseTakenAt } from '@/lib/actions'
import { formatDrift, prettyTime } from '@/lib/time'
import type { DoseStatus } from '@/lib/queries'
import { useChrome } from './chrome'

const TONE_BAR: Record<string, string> = {
  recovery: 'bg-teal',
  seizure: 'bg-violet',
  bp: 'bg-blue',
  comfort: 'bg-amber',
}

const STATUS_PILL: Record<DoseStatus, { en: string; hi: string; className: string }> = {
  taken: { en: 'Taken', hi: 'ले ली', className: 'bg-mint text-teal' },
  skipped: { en: 'Skipped', hi: 'छोड़ी गई', className: 'bg-coral-soft text-coral' },
  'not-recorded': { en: 'Due', hi: 'दर्ज करें', className: 'bg-paper text-muted' },
  upcoming: { en: 'Upcoming', hi: 'आने वाली', className: 'bg-paper text-muted' },
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
  /** "HH:MM" in the care timezone, when the dose is recorded taken. */
  takenClock: string | null
  purpose: string | null
  prescriptionHi: string | null
  food: string | null
  instruction: string | null
  caution: string | null
  verify: string | null
  isNext: boolean
}

export function DoseCard(props: DoseCardProps) {
  const { run, pending } = useChrome()
  const pill = STATUS_PILL[props.status]
  const isTaken = props.status === 'taken'
  const isSkipped = props.status === 'skipped'

  function tap(status: 'taken' | 'skipped') {
    const undoing =
      (status === 'taken' && isTaken) || (status === 'skipped' && isSkipped)
    run(
      () =>
        recordDose({
          medicineId: props.medicineId,
          slotKey: props.slotKey,
          doseDate: props.doseDate,
          status,
        }),
      undoing
        ? 'Undone'
        : status === 'taken'
          ? `${props.brand} taken ✓`
          : `${props.brand} skipped`,
    )
  }

  return (
    <li
      className={`card-toned transition-[border-color] ${
        props.isNext ? 'border-teal' : ''
      } ${isTaken ? 'opacity-75' : isSkipped ? 'opacity-85' : ''}`}
    >
      <span className={`spine ${TONE_BAR[props.tone] ?? 'bg-teal'}`} aria-hidden />
      <div className="flex flex-col gap-2.5 py-3.5 pr-3.5 pl-[18px]">
        <div className="flex items-start justify-between gap-2.5">
          <div className="min-w-0">
            <p className="text-[15px] font-extrabold text-navy">
              {prettyTime(props.time)}{' '}
              <span className="text-[11px] font-medium text-muted">· {props.label}</span>
            </p>
            <p className="mt-0.5 text-[17px] font-extrabold tracking-tight text-navy">
              {props.brand}
            </p>
            <p className="text-[13px] text-ink/80">{props.dose}</p>
          </div>
          <span className={`pill shrink-0 ${pill.className}`}>
            <span className="lang-en">{pill.en}</span>
            <span className="lang-hi">{pill.hi}</span>
          </span>
        </div>

        {props.purpose ? (
          <p className="text-xs leading-relaxed text-muted">{props.purpose}</p>
        ) : null}
        {props.prescriptionHi ? (
          <p className="text-xs text-muted">{props.prescriptionHi}</p>
        ) : null}
        {props.food ? (
          <p className="rounded-[10px] bg-paper px-2.5 py-2 text-[11.5px] leading-relaxed text-muted">
            <strong className="text-ink">
              <span className="lang-en">Food</span>
              <span className="lang-hi">भोजन</span>:
            </strong>{' '}
            {props.food}
          </p>
        ) : null}

        {isTaken && props.drift !== null ? (
          <p className="text-xs font-semibold text-teal">
            Recorded {formatDrift(props.drift)}
          </p>
        ) : null}

        {isTaken ? (
          <div className="flex items-center justify-between gap-2.5 rounded-[10px] bg-paper px-2.5 py-2">
            <span className="text-[11.5px] font-semibold text-muted">
              <span className="lang-en">Taken at — adjust if logging later</span>
              <span className="lang-hi">लेने का समय — बाद में दर्ज करें तो बदलें</span>
            </span>
            <input
              type="time"
              defaultValue={props.takenClock ?? ''}
              disabled={pending}
              aria-label={`Time ${props.brand} was taken`}
              onChange={(e) => {
                const value = e.target.value
                if (!value) return
                run(
                  () =>
                    setDoseTakenAt({
                      medicineId: props.medicineId,
                      slotKey: props.slotKey,
                      doseDate: props.doseDate,
                      time: value,
                    }),
                  `Taken at ${prettyTime(value)} ✓`,
                )
              }}
              className="w-[104px] shrink-0 rounded-[10px] border border-line bg-white p-1.5 text-center text-[13px] outline-teal"
            />
          </div>
        ) : null}

        {props.instruction || props.caution || props.verify ? (
          <details>
            <summary className="flex items-center gap-1 text-xs font-bold text-teal">
              <span className="lang-en">Full details</span>
              <span className="lang-hi">पूरी जानकारी</span>
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
            <div className="flex flex-col gap-2 pt-2.5">
              {props.instruction ? (
                <p className="note">
                  <strong>How:</strong> {props.instruction}
                </p>
              ) : null}
              {props.caution ? (
                <p className="note-warn">
                  <strong className="text-coral">Watch:</strong> {props.caution}
                </p>
              ) : null}
              {props.verify ? (
                <p className="text-[11.5px] leading-relaxed font-medium text-ink/70">
                  ⚑ {props.verify}
                </p>
              ) : null}
            </div>
          </details>
        ) : null}

        {/*
          The visible label is bilingual, but the accessible name must stay a
          single stable string — both language spans would otherwise be
          concatenated into "Taken ले ली".
        */}
        <div className="flex gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => tap('taken')}
            aria-pressed={isTaken}
            aria-label={isTaken ? 'Taken ✓' : 'Taken'}
            className={`h-12 flex-1 rounded-[13px] border-[1.5px] text-[15px] font-bold transition active:scale-95 ${
              isTaken
                ? 'border-teal bg-teal text-white'
                : 'border-line bg-white text-ink'
            }`}
          >
            <span className="lang-en" aria-hidden>
              {isTaken ? 'Taken ✓' : 'Taken'}
            </span>
            <span className="lang-hi" aria-hidden>
              {isTaken ? 'ले ली ✓' : 'ले ली'}
            </span>
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => tap('skipped')}
            aria-pressed={isSkipped}
            aria-label={isSkipped ? 'Skipped ✓' : 'Skip'}
            className={`h-12 flex-1 rounded-[13px] border-[1.5px] text-[15px] font-bold transition active:scale-95 ${
              isSkipped
                ? 'border-coral bg-coral text-white'
                : 'border-line bg-white text-muted'
            }`}
          >
            <span className="lang-en" aria-hidden>
              {isSkipped ? 'Skipped ✓' : 'Skip'}
            </span>
            <span className="lang-hi" aria-hidden>
              {isSkipped ? 'छोड़ी ✓' : 'छोड़ें'}
            </span>
          </button>
        </div>

        {isTaken || isSkipped ? (
          <p className="text-[11px] leading-relaxed text-muted">
            Tap the same button again to undo. Skipping never means doubling the
            next dose.
          </p>
        ) : null}
      </div>
    </li>
  )
}
