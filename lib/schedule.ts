/*
 * Which medicines are due on which day.
 *
 * Until the 15 September 2026 chemoradiation sheet, this file had no reason to
 * exist: every routine medicine's every slot was due on every date, forever.
 * Three rules now compose on top of that, and only the last of them depends on
 * something a caregiver has to tell us:
 *
 *   1. a course window        — Temozolomide, Perinorm and Septran run
 *                               15 Sep to 26 Oct 2026 and then stop
 *   2. a weekday restriction  — Septran DS is Mondays and Thursdays only
 *   3. the therapy gate       — Temozolomide is given only on a day that
 *                               actually had radiotherapy
 *
 * Pure, and free of `server-only`: the Today page imports
 * `therapyQuestionApplies` to decide whether the day is still waiting on an
 * answer, and the schema import stays `import type` so drizzle and pg are not
 * pulled anywhere near the client bundle.
 */
import type { Medicine } from '@/db/schema'
import { weekdayOf } from './time'

/**
 * The scheduling fields only. Widened from `Medicine` so a catalogue entry or
 * a test fixture can be passed without building a whole database row.
 */
export interface ScheduleRules {
  courseStartDate: string | null
  courseEndDate: string | null
  weekdays: string | null
  therapyOnly: boolean
}

/** Whether `isoDate` falls inside a medicine's course, if it has one. */
function inCourse(m: ScheduleRules, isoDate: string): boolean {
  // Plain string comparison: both sides are YYYY-MM-DD, which is what drizzle
  // returns for a `date` column and how the rest of the app compares dates.
  if (m.courseStartDate && isoDate < m.courseStartDate) return false
  if (m.courseEndDate && isoDate > m.courseEndDate) return false
  return true
}

/**
 * Whether this medicine is due on this date at all.
 *
 * `therapy` is the day's answer: `true` yes, `false` no, `undefined` nobody has
 * said. Unanswered schedules the same as "no" — a dose that might not be
 * happening must not be put on the day as something to catch up on — but the
 * two read differently everywhere else, which is why the caller keeps them
 * apart rather than collapsing them here.
 */
export function medicineApplies(
  m: ScheduleRules,
  isoDate: string,
  therapy: boolean | undefined,
): boolean {
  if (!inCourse(m, isoDate)) return false
  if (m.weekdays) {
    const allowed = m.weekdays.split(',').map((n) => Number(n.trim()))
    if (!allowed.includes(weekdayOf(isoDate))) return false
  }
  if (m.therapyOnly && therapy !== true) return false
  return true
}

/**
 * Whether the day should be asking "was there radiation therapy?" at all.
 *
 * Derived from the medicines rather than from a hard-coded catalogue id, so
 * the question stops being asked on 27 October of its own accord, and starts
 * again by itself if a second therapy-gated medicine is ever prescribed.
 */
export function therapyQuestionApplies(
  meds: ScheduleRules[],
  isoDate: string,
): boolean {
  return meds.some((m) => m.therapyOnly && inCourse(m, isoDate))
}

/** Days of a course remaining after `isoDate`, or null for an open-ended one. */
export function courseDaysLeft(m: ScheduleRules, isoDate: string): number | null {
  if (!m.courseEndDate) return null
  const end = Date.parse(`${m.courseEndDate}T00:00:00Z`)
  const on = Date.parse(`${isoDate}T00:00:00Z`)
  return Math.max(0, Math.round((end - on) / 86_400_000))
}

/** True once a medicine's course has run out — it is never auto-archived. */
export function courseFinished(m: ScheduleRules, isoDate: string): boolean {
  return Boolean(m.courseEndDate && isoDate > m.courseEndDate)
}

/** Narrow a full medicine row to the rule fields, for callers holding one. */
export function rulesOf(m: Medicine): ScheduleRules {
  return {
    courseStartDate: m.courseStartDate,
    courseEndDate: m.courseEndDate,
    weekdays: m.weekdays,
    therapyOnly: m.therapyOnly,
  }
}
