import { SheetTrigger } from './chrome'
import { prettyDateTime } from '@/lib/time'
import {
  classifyWeight,
  formatDeltaKg,
  formatKg,
  formatPercent,
  type WeightSummary,
} from '@/lib/weight'

/**
 * Today's weight panel, directly under the blood-pressure one.
 *
 * A white card rather than a second navy block. Two equally loud panels do not
 * compete for attention, they cancel — neither then reads as the one to look at
 * first. Blood pressure earns the dark treatment: it has a doctor-set band, a
 * chart, a strip and an SOS medicine hanging off it. Weight is a slower trend,
 * and a sibling of lower rank is what it actually is.
 */
export function WeightCard({
  summary,
  baselineGrams,
  band,
  sparkPoints,
}: {
  summary: WeightSummary
  baselineGrams: number
  band: { lowGrams: number; highGrams: number }
  sparkPoints: string
}) {
  const latest = summary.latest
  const level = latest ? classifyWeight(latest.grams, band) : null
  const change = summary.change

  return (
    <section className="card">
      <div className="flex items-center justify-between gap-2">
        <p className="eyebrow">
          <span className="lang-en">Weight</span>
          <span className="lang-hi">वज़न</span>
        </p>
        <span
          className={`pill ${
            level === 'low'
              ? 'bg-coral-soft text-coral'
              : level === 'high'
                ? 'bg-amber/20 text-amber-ink'
                : level === 'in-band'
                  ? 'bg-mint text-teal'
                  : 'bg-line/50 text-muted'
          }`}
        >
          {level === 'low'
            ? 'Below band'
            : level === 'high'
              ? 'Above band'
              : level === 'in-band'
                ? 'In band'
                : 'No data'}
        </span>
      </div>

      <div className="mt-2 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[30px] leading-none font-extrabold text-navy">
            {latest ? formatKg(latest.grams) : '—'}{' '}
            <span className="text-[11px] font-medium text-muted">kg</span>
          </p>
          <p className="mt-1.5 text-[11px] text-muted">
            {latest ? prettyDateTime(latest.measuredAt) : 'No reading yet'}
          </p>
        </div>
        <div className="text-right">
          {sparkPoints ? (
            <svg
              width="110"
              height="34"
              viewBox="0 0 110 34"
              preserveAspectRatio="none"
              aria-hidden
            >
              <polyline
                points={sparkPoints}
                fill="none"
                stroke="#29a997"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : null}
          {change ? (
            <p
              className={`mt-1 text-[11px] font-semibold ${
                change.flagged ? 'text-coral' : 'text-muted'
              }`}
            >
              {formatDeltaKg(change.deltaGrams)} ({formatPercent(change.percent)}){' '}
              <span className="font-normal">
                <span className="lang-en">from baseline</span>
                <span className="lang-hi">बेसलाइन से</span>{' '}
                {formatKg(baselineGrams)} kg
              </span>
            </p>
          ) : (
            <p className="mt-1 text-[11px] text-muted">
              <span className="lang-en">Baseline</span>
              <span className="lang-hi">बेसलाइन</span> {formatKg(baselineGrams)} kg
            </p>
          )}
        </div>
      </div>

      {change?.flagged ? (
        <p className="note note-warn mt-2.5">
          Five per cent or more below the recorded baseline. Worth mentioning at the
          next review — this is an observation, not advice.
        </p>
      ) : null}

      <SheetTrigger
        sheet="weight"
        aria-label="Log weight"
        className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border-[1.5px] border-teal bg-white text-[15px] font-bold text-teal transition active:scale-[0.97]"
      >
        <svg
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M7 5h10l3 14H4z" />
          <path d="M12 5V3M9.5 11h5" />
        </svg>
        <span className="lang-en" aria-hidden>
          Log weight
        </span>
        <span className="lang-hi" aria-hidden>
          वज़न दर्ज करें
        </span>
      </SheetTrigger>
    </section>
  )
}
