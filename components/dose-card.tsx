'use client'

import { recordDose, setDoseTakenAt } from '@/lib/actions'
import { foodRuleOf } from '@/lib/food'
import { driftBand, formatGap, prettyTime, shortDrift } from '@/lib/time'
import { toneOf } from '@/lib/tone'
import type { DoseStatus } from '@/lib/queries'
import { useChrome } from './chrome'

/**
 * Colour on this card answers "where does this dose stand?", not "what kind of
 * medicine is it?" — that is what a caregiver is scanning for. Drug category
 * survives as the small dot beside the brand and as a chip in the always-on
 * meta row, so the colour is never the only thing carrying it.
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

const DRIFT_CHIP: Record<ReturnType<typeof driftBand>, string> = {
  'on-time': 'bg-mint text-teal-deep',
  close: 'bg-white/80 text-muted',
  off: 'bg-amber-soft text-amber-ink',
}

export interface DoseCardProps {
  doseDate: string
  medicineId: string
  brand: string
  generic: string | null
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
  /** Minutes the due time is already past, for an unrecorded dose. */
  overdueMinutes: number | null
  purpose: string | null
  prescriptionHi: string | null
  food: string | null
  instruction: string | null
  caution: string | null
  verify: string | null
  /** The one dose the caregiver should act on next. */
  isNext: boolean
}

export function DoseCard(props: DoseCardProps) {
  const { run, pending, openSheet } = useChrome()
  const status = STATUS[props.status]
  const tone = toneOf(props.tone)
  const isTaken = props.status === 'taken'
  const isSkipped = props.status === 'skipped'
  const isRecorded = isTaken || isSkipped
  const food = foodRuleOf(props.food)

  /*
   * The gutter shows when the dose actually happened, not when it was meant
   * to. A dose given at 8:20 sits at 8:20 on the rail and says so; the printed
   * time only reappears underneath, small, when the two disagree — otherwise
   * it is noise.
   */
  const railTime = isTaken && props.takenClock ? props.takenClock : props.time
  const shifted = isTaken && props.takenClock ? props.takenClock !== props.time : false

  /*
   * Only reference-shaped text stays behind the disclosure now. Purpose, the
   * category and the food rule are the "what is this and how do I give it"
   * layer, and they are always on the card — a caregiver should never have to
   * tap to find out what a tablet is for.
   */
  const hasReference = Boolean(
    props.generic ||
      props.prescriptionHi ||
      props.food ||
      props.instruction ||
      props.caution ||
      props.verify,
  )

  function tapTaken() {
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
      `${props.brand} skipped`,
    )
  }

  /**
   * Clearing a record is a correction, not an action — it lives at the bottom
   * of the disclosure, never on the face of the card. Re-tapping a status no
   * longer toggles it off: the two big buttons disappear once a dose is
   * recorded, so there is nothing left to tap by accident.
   */
  function clearRecord(next: 'taken' | 'skipped') {
    run(
      () =>
        recordDose({
          medicineId: props.medicineId,
          slotKey: props.slotKey,
          doseDate: props.doseDate,
          status: next,
        }),
      `${props.brand} entry removed`,
    )
  }

  return (
    <li
      className="rail-row reveal"
      data-status={props.status}
      data-past={props.status === 'upcoming' ? 'false' : 'true'}
      data-next={props.isNext ? 'true' : 'false'}
    >
      <div className="rail-time">
        <p className="rail-clock">{prettyTime(railTime)}</p>
        {shifted ? (
          <p className="rail-sub">
            <span className="lang-en">due {prettyTime(props.time)}</span>
            <span className="lang-hi">देय {prettyTime(props.time)}</span>
          </p>
        ) : null}
      </div>
      <span className="rail-node" aria-hidden>
        <span className={`node ${status.node}`} />
      </span>

      <div
        className="card-toned rail-card"
        data-status={props.status}
        data-focus={props.isNext ? 'true' : 'false'}
      >
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
            <span className="lang-en">
              {props.status === 'not-recorded' &&
              props.overdueMinutes !== null &&
              props.overdueMinutes >= 45
                ? `${formatGap(props.overdueMinutes)} late`
                : status.en}
            </span>
            <span className="lang-hi">{status.hi}</span>
          </span>
        </div>

        {/*
          What the medicine is for, on the card, always. This used to be the
          first line inside a collapsed <details>, which meant the timeline
          could show seven brand names and tell a stand-in caregiver nothing.
        */}
        {props.purpose ? (
          <p className="dose-purpose">{props.purpose}</p>
        ) : null}

        <div className="meta-row">
          <span className="meta-chip">
            <span className={`tone-dot ${tone.bar}`} aria-hidden />
            <span className="lang-en">{tone.label}</span>
            <span className="lang-hi">{tone.labelHi}</span>
          </span>
          {food ? (
            <span className="meta-chip" data-unsure={food.unsure ? 'true' : 'false'}>
              <span className="lang-en">
                {food.label}
                {food.unsure ? ' · check strip' : ''}
              </span>
              <span className="lang-hi">
                {food.labelHi}
                {food.unsure ? ' · पर्ची देखें' : ''}
              </span>
            </span>
          ) : null}
          {props.intervalHours ? (
            <span className="meta-chip">
              <span className="lang-en">{props.intervalHours} h apart</span>
              <span className="lang-hi">{props.intervalHours} घं. अंतर</span>
            </span>
          ) : null}
        </div>

        {/*
          The clock, not a delta. The whole strip is the editor's hit area —
          the time input sits transparently on top of it — so correcting "I
          tapped it at 9 but gave it at 8:20" is one tap on the number itself.
        */}
        {isTaken && props.takenClock ? (
          <p className="dose-stamp">
            <span className="dose-stamp-key">
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
              <span className={`drift-chip ${DRIFT_CHIP[driftBand(props.drift)]}`}>
                {shortDrift(props.drift)}
              </span>
            ) : null}
            <span className="dose-stamp-edit">
              <svg
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
              <span className="lang-en">Edit</span>
              <span className="lang-hi">बदलें</span>
            </span>
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

        {isSkipped ? (
          <p className="dose-stamp dose-stamp-skipped">
            <span className="dose-stamp-key">
              <span className="lang-en">Not given</span>
              <span className="lang-hi">नहीं दी गई</span>
            </span>
            <span className="text-[12px] leading-snug font-semibold text-ink/80">
              <span className="lang-en">Recorded as skipped · never double the next dose</span>
              <span className="lang-hi">छोड़ी गई · अगली खुराक दोगुनी न करें</span>
            </span>
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
        ) : null}

        {/*
          The two big buttons exist only while there is a decision to make.
          Once a dose is recorded they are gone: leaving a filled "Taken ✓" and
          an empty "Skip" side by side reads as a live choice, and re-tapping
          it silently erased the record.
        */}
        {isRecorded ? null : (
          <div className="mt-2 flex gap-2">
            {/*
              The visible label is bilingual, but the accessible name must stay
              a single stable string — both language spans would otherwise be
              concatenated into "Taken ले ली".

              Taken carries twice the width of Skip: it is the action being
              taken nine times out of ten, and the pair should not read as a
              coin toss. On the dose that is actually due, Taken is filled
              rather than outlined, so the eye lands on it first.
            */}
            <button
              type="button"
              disabled={pending}
              onClick={tapTaken}
              aria-label="Taken"
              className={`h-12 flex-[2] rounded-[13px] border-[1.5px] text-[15px] font-bold transition active:scale-95 ${
                props.isNext || props.status === 'not-recorded'
                  ? 'border-teal bg-teal text-white'
                  : 'border-line bg-white text-ink'
              }`}
            >
              <span className="lang-en" aria-hidden>
                Taken
              </span>
              <span className="lang-hi" aria-hidden>
                ले ली
              </span>
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={tapSkip}
              aria-label="Skip"
              className="h-12 flex-1 rounded-[13px] border-[1.5px] border-line bg-white text-[15px] font-bold text-muted transition active:scale-95"
            >
              <span className="lang-en" aria-hidden>
                Skip
              </span>
              <span className="lang-hi" aria-hidden>
                छोड़ें
              </span>
            </button>
          </div>
        )}

        {hasReference || isRecorded ? (
          <details className="mt-1">
            <summary className="flex min-h-9 items-center gap-1 text-xs font-bold text-teal-deep">
              <span className="lang-en">Full instructions &amp; safety</span>
              <span className="lang-hi">पूरी जानकारी और सुरक्षा</span>
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
              {props.generic ? (
                <p className="text-[11.5px] font-semibold text-muted">{props.generic}</p>
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
              {isRecorded ? (
                <div className="rounded-[10px] border border-line bg-paper px-2.5 py-2">
                  <p className="text-[10px] font-bold tracking-[0.1em] text-muted uppercase">
                    <span className="lang-en">Correction</span>
                    <span className="lang-hi">सुधार</span>
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted">
                    <span className="lang-en">
                      {isTaken
                        ? 'Only if this dose was recorded by mistake. The shared record and the doctor’s report both change.'
                        : 'Puts this dose back on the list as still due.'}
                    </span>
                    <span className="lang-hi">
                      {isTaken
                        ? 'केवल तभी जब यह गलती से दर्ज हुई हो। साझा रिकॉर्ड और रिपोर्ट दोनों बदलेंगे।'
                        : 'यह खुराक फिर से बाकी सूची में आ जाएगी।'}
                    </span>
                  </p>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => clearRecord(isTaken ? 'taken' : 'skipped')}
                    aria-label={`Remove the ${isTaken ? 'taken' : 'skipped'} entry for ${props.brand}`}
                    className="mt-1.5 h-9 rounded-[10px] border-[1.5px] border-coral-line bg-white px-3 text-[12px] font-bold text-coral-ink transition active:scale-95"
                  >
                    <span className="lang-en" aria-hidden>
                      Remove this entry
                    </span>
                    <span className="lang-hi" aria-hidden>
                      यह प्रविष्टि हटाएँ
                    </span>
                  </button>
                </div>
              ) : null}
            </div>
          </details>
        ) : null}
      </div>
    </li>
  )
}
