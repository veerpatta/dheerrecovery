import type { BpReading, Household } from '@/db/schema'
import { careDate, daysBetween } from './time'

export interface Band {
  systolicLow: number
  systolicHigh: number
  diastolicLow: number
  diastolicHigh: number
}

export function bandOf(h: Household): Band {
  return {
    systolicLow: h.bandSystolicLow,
    systolicHigh: h.bandSystolicHigh,
    diastolicLow: h.bandDiastolicLow,
    diastolicHigh: h.bandDiastolicHigh,
  }
}

export function classify(r: BpReading, band: Band): 'high' | 'low' | 'in-band' {
  if (r.systolic > band.systolicHigh || r.diastolic > band.diastolicHigh) return 'high'
  if (r.systolic < band.systolicLow || r.diastolic < band.diastolicLow) return 'low'
  return 'in-band'
}

export interface BpSummary {
  latest: BpReading | null
  count: number
  avgSystolic: number | null
  avgDiastolic: number | null
  windowCount: number
  priorAvgSystolic: number | null
  priorAvgDiastolic: number | null
  high: number
  low: number
  pairedSessions: number
  observations: string[]
}

const avg = (xs: number[]) =>
  xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null

/**
 * `readings` must be newest-first. `days` is the trailing window; the same
 * window immediately before it is used as the comparison period.
 */
export function summarise(
  readings: BpReading[],
  band: Band,
  days = 7,
  now: Date = new Date(),
): BpSummary {
  const today = careDate(now)
  const inWindow = readings.filter(
    (r) => daysBetween(careDate(new Date(r.measuredAt)), today) < days,
  )
  const priorWindow = readings.filter((r) => {
    const age = daysBetween(careDate(new Date(r.measuredAt)), today)
    return age >= days && age < days * 2
  })

  const high = inWindow.filter((r) => classify(r, band) === 'high').length
  const low = inWindow.filter((r) => classify(r, band) === 'low').length

  // A "paired session" is two readings taken about a minute apart, which is
  // how home BP is meant to be measured.
  let paired = 0
  const sorted = [...readings].sort(
    (a, b) => +new Date(a.measuredAt) - +new Date(b.measuredAt),
  )
  for (let i = 1; i < sorted.length; i++) {
    const gap =
      (+new Date(sorted[i].measuredAt) - +new Date(sorted[i - 1].measuredAt)) / 60_000
    if (gap >= 0.5 && gap <= 5) paired++
  }

  const avgSys = avg(inWindow.map((r) => r.systolic))
  const avgDia = avg(inWindow.map((r) => r.diastolic))
  const priorSys = avg(priorWindow.map((r) => r.systolic))
  const priorDia = avg(priorWindow.map((r) => r.diastolic))

  return {
    latest: readings[0] ?? null,
    count: readings.length,
    avgSystolic: avgSys,
    avgDiastolic: avgDia,
    windowCount: inWindow.length,
    priorAvgSystolic: priorSys,
    priorAvgDiastolic: priorDia,
    high,
    low,
    pairedSessions: paired,
    observations: observe(inWindow, priorWindow, band, avgSys, priorSys),
  }
}

/**
 * Descriptive observations only. Nothing here suggests a medicine change —
 * that stays with the treating doctor.
 */
function observe(
  window: BpReading[],
  prior: BpReading[],
  band: Band,
  avgSys: number | null,
  priorSys: number | null,
): string[] {
  if (window.length < 3) {
    return ['Add at least three readings to unlock time-of-day and trend observations.']
  }

  const out: string[] = []

  if (avgSys != null && priorSys != null) {
    const delta = avgSys - priorSys
    if (Math.abs(delta) >= 5) {
      out.push(
        `Average systolic is ${Math.abs(delta)} mmHg ${delta > 0 ? 'higher' : 'lower'} than the previous period (${avgSys} vs ${priorSys}).`,
      )
    } else {
      out.push(
        `Average systolic is steady against the previous period (${avgSys} vs ${priorSys}).`,
      )
    }
  }

  const morning = window.filter((r) => new Date(r.measuredAt).getUTCHours() + 5.5 < 12)
  const evening = window.filter((r) => new Date(r.measuredAt).getUTCHours() + 5.5 >= 12)
  const mSys = avg(morning.map((r) => r.systolic))
  const eSys = avg(evening.map((r) => r.systolic))
  if (mSys != null && eSys != null && Math.abs(mSys - eSys) >= 8) {
    out.push(
      `Readings run ${Math.abs(mSys - eSys)} mmHg ${mSys > eSys ? 'higher in the morning' : 'higher in the evening'} (morning ${mSys}, evening ${eSys}).`,
    )
  }

  const outOfBand = window.filter((r) => classify(r, band) !== 'in-band').length
  if (outOfBand) {
    out.push(
      `${outOfBand} of ${window.length} readings sit outside the ${band.systolicLow}/${band.diastolicLow}–${band.systolicHigh}/${band.diastolicHigh} home reference band.`,
    )
  } else {
    out.push(`All ${window.length} readings sit inside the home reference band.`)
  }

  const withSymptoms = window.filter((r) => r.symptoms && r.symptoms.trim())
  if (withSymptoms.length) {
    out.push(
      `${withSymptoms.length} reading${withSymptoms.length > 1 ? 's were' : ' was'} logged with a symptom noted — worth showing the treating team.`,
    )
  }

  return out
}
