/*
 * Imported by the weight entry sheet as well as the server pages, so the band
 * preview can be classified as the caregiver types. Keep the schema import a
 * `import type` and never add `server-only` here, or drizzle and pg get pulled
 * into the client bundle. Same rule, and same reason, as lib/bp.ts.
 *
 * Weight is held in grams throughout — 88.6 kg is 88600 — because that is how
 * the column stores it. Only the formatters below turn it back into kilograms.
 */
import type { Household, WeightReading } from '@/db/schema'
import { addDays, careDate, daysBetween } from './time'

export interface WeightBand {
  lowGrams: number
  highGrams: number
}

export function weightBandOf(h: Household): WeightBand {
  return { lowGrams: h.bandWeightLowGrams, highGrams: h.bandWeightHighGrams }
}

/**
 * The share of baseline weight whose loss is worth a caregiver noticing.
 *
 * A constant rather than a column: five per cent is the convention used during
 * chemoradiation, not a setting for this record. The *baseline* is a column,
 * because a doctor can re-baseline it.
 */
export const LOSS_FLAG_FRACTION = 0.05

/** Widened to a bare number so an in-progress keypad draft can be classified. */
export function classifyWeight(
  grams: number,
  band: WeightBand,
): 'high' | 'low' | 'in-band' {
  if (grams > band.highGrams) return 'high'
  if (grams < band.lowGrams) return 'low'
  return 'in-band'
}

export interface BaselineChange {
  deltaGrams: number
  /** Signed, so a loss is negative. Rounded to one decimal place. */
  percent: number
  /** At or past the five-per-cent loss mark. */
  flagged: boolean
}

export function lossFromBaseline(
  grams: number,
  baselineGrams: number,
): BaselineChange {
  const deltaGrams = grams - baselineGrams
  const ratio = baselineGrams > 0 ? deltaGrams / baselineGrams : 0
  return {
    deltaGrams,
    percent: Math.round(ratio * 1000) / 10,
    // Compared before rounding, so a reading that is 4.95% down does not get
    // rounded up into a flag it has not earned.
    flagged: -ratio >= LOSS_FLAG_FRACTION,
  }
}

/** "88600" -> "88.6". One decimal place, always — that is what the pad enters. */
export function formatKg(grams: number): string {
  return (grams / 1000).toFixed(1)
}

/** "−2.4 kg" / "+0.6 kg", with a true minus sign rather than a hyphen. */
export function formatDeltaKg(deltaGrams: number): string {
  const sign = deltaGrams < 0 ? '−' : '+'
  return `${sign}${(Math.abs(deltaGrams) / 1000).toFixed(1)} kg`
}

/**
 * "−2.6%" / "+0.7%". Its own helper only so the sign matches `formatDeltaKg`
 * — the two are printed side by side, and a hyphen next to a true minus reads
 * as a typo in the number rather than a difference in punctuation.
 */
export function formatPercent(percent: number): string {
  const sign = percent < 0 ? '−' : '+'
  return `${sign}${Math.abs(percent).toFixed(1)}%`
}

export interface WeightSummary {
  latest: WeightReading | null
  count: number
  avgGrams: number | null
  /** The readings the average was computed from — windowed by care-date. */
  windowReadings: WeightReading[]
  windowCount: number
  priorAvgGrams: number | null
  /** Change from the recorded baseline, for the latest reading. */
  change: BaselineChange | null
  high: number
  low: number
  observations: string[]
}

const avg = (xs: number[]) =>
  xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null

/**
 * `readings` must be newest-first. `days` is the trailing window; the same
 * window immediately before it is used as the comparison period. Windowed by
 * care-date day boundaries, exactly as `summarise` in lib/bp.ts is.
 */
export function summariseWeight(
  readings: WeightReading[],
  band: WeightBand,
  baselineGrams: number,
  days = 7,
  now: Date = new Date(),
): WeightSummary {
  const today = careDate(now)
  const inWindow = readings.filter(
    (r) => daysBetween(careDate(new Date(r.measuredAt)), today) < days,
  )
  const priorWindow = readings.filter((r) => {
    const age = daysBetween(careDate(new Date(r.measuredAt)), today)
    return age >= days && age < days * 2
  })

  const latest = readings[0] ?? null
  const avgGrams = avg(inWindow.map((r) => r.grams))
  const priorAvgGrams = avg(priorWindow.map((r) => r.grams))

  return {
    latest,
    count: readings.length,
    avgGrams,
    windowReadings: inWindow,
    windowCount: inWindow.length,
    priorAvgGrams,
    change: latest ? lossFromBaseline(latest.grams, baselineGrams) : null,
    high: inWindow.filter((r) => classifyWeight(r.grams, band) === 'high').length,
    low: inWindow.filter((r) => classifyWeight(r.grams, band) === 'low').length,
    observations: observeWeight(latest, avgGrams, priorAvgGrams, baselineGrams),
  }
}

export interface WeightStripDay {
  isoDate: string
  /** Day of month, the label the strip prints. */
  day: string
  count: number
  worst: 'high' | 'low' | 'in-band' | 'none'
}

/** One cell per day, coloured by that day's worst reading. */
export function weightStrip(
  readings: WeightReading[],
  band: WeightBand,
  days = 14,
  now: Date = new Date(),
): WeightStripDay[] {
  const today = careDate(now)
  const byDate = new Map<string, WeightReading[]>()
  for (const r of readings) {
    const key = careDate(new Date(r.measuredAt))
    byDate.set(key, [...(byDate.get(key) ?? []), r])
  }

  return Array.from({ length: days }, (_, i) => {
    const isoDate = addDays(today, -(days - 1 - i))
    const day = byDate.get(isoDate) ?? []
    const worst = day.some((r) => classifyWeight(r.grams, band) === 'low')
      ? 'low'
      : day.some((r) => classifyWeight(r.grams, band) === 'high')
        ? 'high'
        : day.length
          ? 'in-band'
          : 'none'
    return { isoDate, day: isoDate.slice(-2), count: day.length, worst }
  })
}

/**
 * Descriptive observations only. Nothing here suggests a change to a medicine,
 * a feed or a dose — that stays with the treating team.
 */
function observeWeight(
  latest: WeightReading | null,
  avgGrams: number | null,
  priorAvgGrams: number | null,
  baselineGrams: number,
): string[] {
  if (!latest) return []
  const out: string[] = []

  const change = lossFromBaseline(latest.grams, baselineGrams)
  out.push(
    `Latest ${formatKg(latest.grams)} kg — ${formatDeltaKg(change.deltaGrams)} from the ${formatKg(baselineGrams)} kg baseline (${formatPercent(change.percent)}).`,
  )
  if (change.flagged) {
    out.push(
      'That is five per cent or more below the recorded baseline. Worth raising at the next review — this is an observation, not advice.',
    )
  }

  if (avgGrams != null && priorAvgGrams != null) {
    const shift = avgGrams - priorAvgGrams
    out.push(
      Math.abs(shift) < 300
        ? 'The seven-day average is steady against the week before.'
        : `The seven-day average is ${formatDeltaKg(shift)} against the week before.`,
    )
  }

  return out
}
