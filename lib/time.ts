/**
 * Everything in this app is anchored to the caregiver's local clock in India.
 * Vercel functions run in UTC, so "today" must always be derived through the
 * clinic timezone or doses land on the wrong date after 18:30 UTC.
 */
export const CARE_TZ = 'Asia/Kolkata'

const ymd = new Intl.DateTimeFormat('en-CA', {
  timeZone: CARE_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const hm = new Intl.DateTimeFormat('en-GB', {
  timeZone: CARE_TZ,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

/** "2026-07-28" in the care timezone. */
export function careDate(at: Date = new Date()): string {
  return ymd.format(at)
}

/** "20:00" in the care timezone. */
export function careClock(at: Date = new Date()): string {
  return hm.format(at)
}

/** Minutes since midnight in the care timezone. */
export function careMinutes(at: Date = new Date()): number {
  const [h, m] = careClock(at).split(':').map(Number)
  return h * 60 + m
}

export function minutesOf(time: string): number {
  const [h, m] = time.slice(0, 5).split(':').map(Number)
  return h * 60 + m
}

/** "08:00" -> "8:00 am" */
export function prettyTime(time: string): string {
  const [h, m] = time.slice(0, 5).split(':').map(Number)
  const suffix = h >= 12 ? 'pm' : 'am'
  const hour = h % 12 === 0 ? 12 : h % 12
  return `${hour}:${String(m).padStart(2, '0')} ${suffix}`
}

const longDate = new Intl.DateTimeFormat('en-GB', {
  timeZone: CARE_TZ,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

/** "2026-07-28" -> "Tuesday, 28 July 2026" */
export function prettyDate(isoDate: string): string {
  return longDate.format(new Date(`${isoDate}T12:00:00Z`))
}

const plainDate = new Intl.DateTimeFormat('en-GB', {
  timeZone: CARE_TZ,
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

/**
 * "28 July 2026" — how the prescription itself is dated. The weekday is
 * useful for "today", but reads as noise when naming the prescription.
 */
export function prettyRxDate(isoDate: string): string {
  return plainDate.format(new Date(`${isoDate}T12:00:00Z`))
}

const shortDate = new Intl.DateTimeFormat('en-GB', {
  timeZone: CARE_TZ,
  day: '2-digit',
  month: 'short',
})

export function shortDay(isoDate: string): string {
  return shortDate.format(new Date(`${isoDate}T12:00:00Z`))
}

export function prettyDateTime(at: Date | string): string {
  const d = typeof at === 'string' ? new Date(at) : at
  return `${shortDate.format(d)} · ${hm.format(d)}`
}

/** Shift an ISO date string by whole days. */
export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Inclusive list of ISO dates from `from` to `to`. */
export function dateRange(from: string, to: string): string[] {
  const out: string[] = []
  let cur = from
  let guard = 0
  while (cur <= to && guard++ < 800) {
    out.push(cur)
    cur = addDays(cur, 1)
  }
  return out
}

export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`)
  const b = Date.parse(`${to}T00:00:00Z`)
  return Math.round((b - a) / 86_400_000)
}

/**
 * Turn a care-timezone date + "HH:MM" into a real instant.
 * India is a fixed +05:30 offset with no DST, so the offset is safe to hardcode.
 */
export function careInstant(isoDate: string, time: string): Date {
  return new Date(`${isoDate}T${time.slice(0, 5)}:00+05:30`)
}

/** Signed difference in minutes between recorded time and scheduled time. */
export function driftMinutes(
  isoDate: string,
  scheduled: string,
  takenAt: Date,
): number {
  return Math.round(
    (takenAt.getTime() - careInstant(isoDate, scheduled).getTime()) / 60_000,
  )
}

/** "75" -> "1h 15m". Bare minutes past an hour read as noise. */
export function formatGap(mins: number): string {
  const abs = Math.abs(Math.round(mins))
  if (abs === 0) return '0m'
  const h = Math.floor(abs / 60)
  const m = abs % 60
  return [h ? `${h}h` : '', m ? `${m}m` : ''].filter(Boolean).join(' ')
}

export function formatDrift(mins: number): string {
  if (mins === 0) return 'on time'
  return `${mins > 0 ? '+' : '−'}${formatGap(mins)} ${mins > 0 ? 'late' : 'early'}`
}

/**
 * How far off the due time a dose landed, as three buckets rather than a
 * number. Ten minutes either side of a reminder is not a caregiver's problem
 * and must not be coloured like one; beyond about an hour it is worth the eye
 * catching on, which is where the amber chip earns its place.
 */
export type DriftBand = 'on-time' | 'close' | 'off'

export function driftBand(mins: number): DriftBand {
  const abs = Math.abs(mins)
  if (abs <= 10) return 'on-time'
  if (abs <= 60) return 'close'
  return 'off'
}

/** "+20m late" trimmed to "20m late" — the sign is already carried by the word. */
export function shortDrift(mins: number): string {
  if (Math.abs(mins) <= 10) return 'on time'
  return `${formatGap(mins)} ${mins > 0 ? 'late' : 'early'}`
}
