/*
 * When each alert fires, decided without touching the database.
 *
 * This matters more than it looks. The cron ticks every five minutes; if each
 * tick queried Postgres, Neon would never auto-suspend and a free tier's
 * ~191 monthly compute-hours would be gone in a week. So a tick first asks
 * this module — pure arithmetic on a clock string — whether anything is even
 * a candidate, and only then opens a connection. The database is touched
 * about five times a day rather than 288.
 *
 * Fire times are therefore constants rather than columns. Settings offers a
 * toggle per alert, not a time picker; moving a time is a deploy. That is the
 * honest trade for keeping the scheduler free.
 */
import { RT_COURSE_END, RT_COURSE_START } from '../catalog'
import { daysBetween, minutesOf, weekdayOf } from '../time'
import type { NotifyKind } from './types'

/**
 * How long after its fire time an alert may still go out.
 *
 * Without a window, a claim-only design would fire "Good morning" at 11:04
 * after a four-hour cron outage. Nine minutes covers a missed five-minute
 * tick plus a slow one; past that, a missing greeting is better than a wrong
 * one. Every fire time below sits on a five-minute boundary so no tick can
 * fall between them.
 */
export const WINDOW_MINUTES = 9

export const FIRE_TIMES: Record<Exclude<NotifyKind, 'test'>, string> = {
  morning: '07:00',
  bloods: '08:00',
  weight: '08:00',
  milestone: '08:30',
  // After the 21:00 Perinorm and the 21:30 Tryptomer are both due, so the
  // wrap is describing a finished day rather than interrupting one.
  evening: '21:45',
}

/** Days of the 42 that get a milestone message. */
export const MILESTONE_DAYS = [1, 7, 14, 21, 28, 35, 42] as const

/** Monday. The weekly weigh-in rides with the start of the week. */
const WEIGHT_WEEKDAY = 1

/**
 * The bloods review the 15 September sheet ordered: "review after 7 days with
 * CBC, S. creatinine, SGPT". One nudge the day before and one on the day,
 * because it needs a trip to a lab rather than a tap.
 */
export const BLOODS_DAYS = [6, 7] as const

export interface Candidate {
  kind: NotifyKind
  /** 1-based day of the chemoradiation course, or null outside it. */
  courseDay: number | null
}

/** True when `clock` is inside `[fire, fire + WINDOW_MINUTES]`. */
function inWindow(clock: string, fire: string): boolean {
  const now = minutesOf(clock)
  const due = minutesOf(fire)
  return now >= due && now <= due + WINDOW_MINUTES
}

/** 1-based day of the course for a care-date, or null outside it. */
export function courseDayOf(isoDate: string): number | null {
  if (isoDate < RT_COURSE_START || isoDate > RT_COURSE_END) return null
  return daysBetween(RT_COURSE_START, isoDate) + 1
}

/**
 * Which alerts could fire at this moment, before any of them has been checked
 * against the record. `enabled` is the household's toggles; a kind switched
 * off never becomes a candidate, so it never costs a query either.
 */
/** The household's toggles, keyed the way `households` names its columns. */
export interface Enabled {
  morning: boolean
  evening: boolean
  weight: boolean
  bloods: boolean
  milestones: boolean
}

export function planFor(clock: string, isoDate: string, enabled: Enabled): Candidate[] {
  const courseDay = courseDayOf(isoDate)
  const out: Candidate[] = []

  if (enabled.morning && inWindow(clock, FIRE_TIMES.morning)) {
    out.push({ kind: 'morning', courseDay })
  }
  if (enabled.evening && inWindow(clock, FIRE_TIMES.evening)) {
    out.push({ kind: 'evening', courseDay })
  }
  if (
    enabled.weight &&
    weekdayOf(isoDate) === WEIGHT_WEEKDAY &&
    inWindow(clock, FIRE_TIMES.weight)
  ) {
    out.push({ kind: 'weight', courseDay })
  }
  if (
    enabled.bloods &&
    courseDay !== null &&
    (BLOODS_DAYS as readonly number[]).includes(courseDay) &&
    inWindow(clock, FIRE_TIMES.bloods)
  ) {
    out.push({ kind: 'bloods', courseDay })
  }
  if (
    enabled.milestones &&
    courseDay !== null &&
    (MILESTONE_DAYS as readonly number[]).includes(courseDay) &&
    inWindow(clock, FIRE_TIMES.milestone)
  ) {
    out.push({ kind: 'milestone', courseDay })
  }

  return out
}

/**
 * The earliest and latest minute any alert can fire, so the external cron can
 * be restricted to those hours and skip roughly two thirds of its pings.
 */
export const QUIET_BEFORE = FIRE_TIMES.morning
export const QUIET_AFTER = FIRE_TIMES.evening
