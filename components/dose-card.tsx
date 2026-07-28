'use client'

import { recordDose, setDoseTakenAt } from '@/lib/actions'
import { formatDrift, prettyTime } from '@/lib/time'
import { toneOf } from '@/lib/tone'
import type { DoseStatus } from '@/lib/queries'
import { useChrome } from './chrome'

/**
 * Colour on this card answers "where does this dose stand?", not "what kind of
 * medicine is it?" — that is what a caregiver is scanning for. Drug category
 * survives as the small dot beside the brand, and is spelled out in the
 * disclosure so the colour is never the only thing carrying it.
 *
 * Every state also has its own node shape on the rail, so the timeline reads
 * without relying on colour at all.
 */
const STATUS: Record<
  DoseStatus,
  { en: string; hi: string; pill: string; node: string }
> = {
  taken: {
    en: 'Taken',
    hi: 'ले ली',
    pill: 'bg-teal text-white',
    node: 'node-taken',
  },
  skipped: {
    en: 'Skipped',
    hi: 'छोड़ी गई',
    pill: 'bg-coral-ink text-white',
    node: 'node-skipped',
  },
  'not-recorded': {
    en: 'Due now',
    hi: 'अभी देय',
    pill: 'bg-amber-ink text-white',
    node: 'node-due',
  },
  upcoming: {
    en: 'Upcoming',
    hi: 'आने वाली',
    pill: 'border border-line bg-white text-muted',
    node: 'node-upcoming',
  },
}

export interface DoseCardProps {
  doseDate: string
  medicineId: string
  brand: string
  dose: string
  label: string
  /** When the dose is due — derived for interval medicines. */
  time: string
  /** The printed reminder time, shown alongside a derived one. */
  plannedTime: string
  intervalHours: number | null
  derivedFrom: { label: string; takenAt: string } | null
  /** The interval lands past midnight, so `time` fell back to the reminder. */
  rollsOver: boolean
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
  const { run, pending, openSheet } = useChrome()
  const status = STATUS[props.status]
  const tone = toneOf(props.tone)
  const isTaken = props.status === 'taken'
  const isSkipped = props.status === 'skipped'

  /*
   * Everything reference-shaped now lives behind the disclosure. The gate has
   * to cover all six fields, not just the three that used to be in there, or a
   * medicine carrying only a food note would lose it entirely.
   */
  const hasDetails = Boolean(
    props.purpose ||
      props.prescriptionHi ||
      props.food ||
      props.instruction ||
      props.caution ||
      props.verify,
  )

  function tapTaken() {
    // Re-tapping a taken dose undoes it, immediately. Putting a dialog in
    // front of an undo is the wrong trade — undo is the correction path.
    if (isTaken) {
      run(
        () =>
          recordDose({
            medicineId: props.medicineId,
            slotKey: props.slotKey,
            doseDate: props.doseDate,
            status: 'taken',
          }),
        'Undone',
      )
      return
    }

    openSheet('dose', {
      medicineId: props.medicineId,
      slotKey: props.slotKey,
      doseDate: props.doseDate,
      brand: props.brand,
      dueTime: props.time,
      intervalHours: props.intervalHours,
      previousTakenAt: props.derivedFrom?.takenAt ?? null,
      previousLabel: props.derivedFrom?.label ?? null,
    })
  }

  function tapSkip() {
    run(
      () =>
        recordDose({
          medicineId: props.medicineId,
          slotKey: props.slotKey,
          doseDate: props.doseDate,
          status: 'skipped',
        }),
      isSkipped ? 'Undone' : `${props.brand} skipped`,
    )
  }

  return (
    <li
      className="rail-row reveal"
      data-status={props.status}
      data-past={props.status === 'upcoming' ? 'false' : 'true'}
      data-next={props.isNext ? 'true' : 'false'}
    >
      <p className="rail-time">{prettyTime(props.time)}</p>
      <span className="rail-node" aria-hidden>
        <span className={`node ${status.node}`} />
      </span>

      <div className="card-toned rail-card" data-status={props.status}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5">
              <span className={`tone-dot ${tone.bar}`} aria-hidden />
              <span className="truncate text-[15.5px] font-extrabold tracking-tight text-navy">
                {props.brand}
              </span>
            </p>
            <p className="mt-0.5 text-[12px] text-ink/75">
              {props.dose}{' '}
              <span className="font-medium text-muted">· {props.label}</span>
            </p>
          </div>
          <span className={`pill shrink-0 ${status.pill}`}>
            <span className="lang-en">{status.en}</span>
            <span className="lang-hi">{status.hi}</span>
          </span>
        </div>

        {/*
          The clock, not a delta. This used to live only as the value of a
          time input, which meant reading a caption and a form control to
          answer "when was it taken?". The whole strip is the editor's hit
          area — the input sits transparently on top of it.
        */}
        {isTaken && props.takenClock ? (
          <p className="relative mt-2 flex items-baseline gap-1.5 rounded-[10px] bg-white/70 px-2 py-2">
            <span className="text-[10px] font-bold tracking-[0.1em] text-muted uppercase">
              <span className="lang-en">Taken at</span>
              <span className="lang-hi">लिया</span>
            </span>
            {/* The visible text is "6:45 am", which is not a valid time value —
                dateTime carries the machine-readable "HH:MM". */}
            <time
              dateTime={props.takenClock}
              className="text-[19px] leading-none font-extrabold tracking-tight text-teal-deep tabular-nums"
            >
              {prettyTime(props.takenClock)}
            </time>
            {props.drift !== null ? (
              <span className="text-[11px] font-semibold text-muted">
                {formatDrift(props.drift)}
              </span>
            ) : null}
            <svg
              className="ml-auto shrink-0 self-center text-muted"
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
            <input
              type="time"
              defaultValue={props.takenClock}
              disabled={pending}
              aria-label={`Time ${props.brand} was taken`}
              onClick={(e) => {
                // showPicker throws outside a user gesture and in cross-origin
                // frames; the field still works if it does.
                try {
                  e.currentTarget.showPicker?.()
                } catch {}
              }}
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
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </p>
        ) : null}

        {props.rollsOver ? (
          <p className="mt-1.5 text-[11px] font-semibold text-coral-ink">
            {props.intervalHours} h after the{' '}
            {props.derivedFrom?.label.toLowerCase()} dose falls after midnight —
            check the spacing with the treating team.
          </p>
        ) : props.derivedFrom ? (
          <p className="mt-1.5 text-[11px] font-semibold text-teal-deep">
            {props.intervalHours} h after the{' '}
            {props.derivedFrom.label.toLowerCase()} dose · reminder{' '}
            {prettyTime(props.plannedTime)}
          </p>
        ) : props.intervalHours ? (
          <p className="mt-1.5 text-[11px] text-muted">
            Take about {props.intervalHours} h apart
          </p>
        ) : null}

        {hasDetails ? (
          <details className="mt-0.5">
            <summary className="flex min-h-9 items-center gap-1 text-xs font-bold text-teal-deep">
              <span className="lang-en">Details &amp; safety</span>
              <span className="lang-hi">जानकारी और सुरक्षा</span>
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
            <div className="flex flex-col gap-2 pb-1">
              <p className="text-[11px] font-semibold text-muted">
                <span className="lang-en">Category</span>
                <span className="lang-hi">श्रेणी</span>:{' '}
                <span className="lang-en">{tone.label}</span>
                <span className="lang-hi">{tone.labelHi}</span>
              </p>
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
              {props.instruction ? (
                <p className="note">
                  <strong>How:</strong> {props.instruction}
                </p>
              ) : null}
              {props.caution ? (
                <p className="note-warn">
                  <strong className="text-coral-ink">Watch:</strong> {props.caution}
                </p>
              ) : null}
              {props.verify ? (
                <p className="text-[11.5px] leading-relaxed font-medium text-ink/70">
                  ⚑ {props.verify}
                </p>
              ) : null}
              {isTaken || isSkipped ? (
                <p className="text-[11px] leading-relaxed text-muted">
                  Tap the same button again to undo. Skipping never means doubling
                  the next dose.
                </p>
              ) : null}
            </div>
          </details>
        ) : null}

        {/*
          The visible label is bilingual, but the accessible name must stay a
          single stable string — both language spans would otherwise be
          concatenated into "Taken ले ली".

          Taken carries twice the width of Skip: it is the action being taken
          nine times out of ten, and the pair should not read as a coin toss.
        */}
        <div className="mt-1.5 flex gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={tapTaken}
            aria-pressed={isTaken}
            aria-label={isTaken ? 'Taken ✓' : 'Taken'}
            className={`h-12 flex-[2] rounded-[13px] border-[1.5px] text-[15px] font-bold transition active:scale-95 ${
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
            onClick={tapSkip}
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
      </div>
    </li>
  )
}
