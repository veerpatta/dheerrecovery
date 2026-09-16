import 'server-only'
import type { Household } from '@/db/schema'
import {
  buildDaySchedule,
  getDoseRecords,
  getMedicines,
  getTherapyDays,
  getWeightReadings,
  type ScheduledDose,
} from '../queries'
import { therapyQuestionApplies } from '../schedule'
import { buildDoseMatrix, perfectDays } from '../stats'
import { addDays, careDate, daysBetween, prettyTime } from '../time'
import { formatKg, formatPercent, lossFromBaseline, weightBandOf } from '../weight'
import * as C from './copy'
import { courseDayOf, MILESTONE_DAYS } from './plan'
import type { Lang, NotifyKind, PushAction, PushPayload } from './types'

/*
 * Turns "the morning alert is due" into the actual words, for a real day.
 *
 * Every builder returns `null` when the alert has nothing to say — an evening
 * wrap on a day where everything was recorded, a weight nudge on a day the
 * scale was already used. A null here means no row is claimed and nothing is
 * sent: silence is a feature, not a failure.
 */

/** A payload still missing the per-device language. */
type Draft = {
  title: C.Line
  body: C.Line
  url: string
  actions: { action: PushAction['action']; title: C.Line }[]
  badge: number
}

export type Composed = { draft: Draft; kind: NotifyKind }

function render(draft: Draft, kind: NotifyKind, logId: string | null, date: string) {
  return (lang: Lang): PushPayload => ({
    kind,
    title: C.pick(draft.title, lang),
    body: C.pick(draft.body, lang),
    url: draft.url,
    logId,
    careDate: date,
    tag: `${kind}-${date}`,
    actions: draft.actions.map((a) => ({
      action: a.action,
      title: C.pick(a.title, lang),
    })),
    badge: draft.badge,
  })
}

export function payloadFor(
  composed: Composed,
  logId: string | null,
  date: string,
): (lang: Lang) => PushPayload {
  return render(composed.draft, composed.kind, logId, date)
}

/** The day's schedule plus what has been recorded against it. */
async function dayState(household: Household, date: string) {
  const [meds, records, therapyDays] = await Promise.all([
    getMedicines(household.id),
    getDoseRecords(household.id, date, date),
    getTherapyDays(household.id, date, date),
  ])
  const schedule = buildDaySchedule(meds, records, date, { therapyDays })
  return { meds, records, therapyDays, schedule }
}

const unrecorded = (schedule: ScheduledDose[]) =>
  schedule.filter((d) => d.status === 'not-recorded')

// ---------------------------------------------------------- morning ----

export async function composeMorning(
  household: Household,
  date: string,
): Promise<Composed | null> {
  const { meds, schedule, therapyDays } = await dayState(household, date)
  const greeting = C.morningLineFor(date)

  const asks = therapyQuestionApplies(meds, date) && !therapyDays.has(date)
  if (asks) {
    return {
      kind: 'morning',
      draft: {
        title: greeting,
        body: C.MORNING_THERAPY,
        url: '/',
        actions: [
          { action: 'therapy-yes', title: C.THERAPY_ACTIONS.yes },
          { action: 'therapy-no', title: C.THERAPY_ACTIONS.no },
        ],
        badge: 0,
      },
    }
  }

  // Nothing due and nothing to ask — say nothing rather than manufacture a
  // greeting about an empty chart.
  const first = schedule[0]
  if (!first) return null

  return {
    kind: 'morning',
    draft: {
      title: greeting,
      body: C.MORNING_PLAIN(first.medicine.brand, prettyTime(first.time), schedule.length),
      url: '/',
      actions: [{ action: 'open', title: C.OPEN_TODAY }],
      badge: 0,
    },
  }
}

// ----------------------------------------------------- evening wrap ----

export async function composeEvening(
  household: Household,
  date: string,
): Promise<Composed | null> {
  const { schedule } = await dayState(household, date)
  const open = unrecorded(schedule)

  // A clean day is silent. Being told "nothing to do" is still an interruption.
  if (!open.length) return null

  if (open.length === 1) {
    const d = open[0]
    const one = C.EVENING_ONE(d.medicine.brand, d.label, prettyTime(d.time))
    // The chemotherapy capsule and the anti-seizure pair carry the extra line
    // about never doubling — the two places where a guess does real harm.
    const serious = d.medicine.tone === 'chemo' || d.medicine.tone === 'seizure'
    return {
      kind: 'evening',
      draft: {
        title: one.title,
        body: serious
          ? {
              en: `${one.body.en} ${C.EVENING_SERIOUS.en}`,
              hi: `${one.body.hi} ${C.EVENING_SERIOUS.hi}`,
            }
          : one.body,
        url: `/catch-up?date=${date}`,
        actions: [{ action: 'open', title: C.EVENING_ACTION.one }],
        badge: 1,
      },
    }
  }

  const many = C.EVENING_MANY(
    open.length,
    open[0].medicine.brand,
    open[1].medicine.brand,
  )
  return {
    kind: 'evening',
    draft: {
      title: many.title,
      body: many.body,
      url: `/catch-up?date=${date}`,
      actions: [{ action: 'open', title: C.EVENING_ACTION.many }],
      badge: open.length,
    },
  }
}

// ----------------------------------------------------------- weight ----

export async function composeWeight(
  household: Household,
  date: string,
): Promise<Composed | null> {
  const readings = await getWeightReadings(household.id, 30)
  const latest = readings[0] ?? null

  // Weighed today already — nothing to nudge about.
  if (latest && careDate(new Date(latest.measuredAt)) === date) return null

  const since = latest
    ? daysBetween(careDate(new Date(latest.measuredAt)), date)
    : null

  const change = latest
    ? lossFromBaseline(latest.grams, household.weightBaselineGrams)
    : null

  // Five per cent down is not a moment for a joke about the scale.
  const copy =
    change?.flagged && latest
      ? C.WEIGHT_FLAGGED(formatKg(latest.grams), formatPercent(change.percent))
      : C.WEIGHT_DUE(since)

  return {
    kind: 'weight',
    draft: {
      title: copy.title,
      body: copy.body,
      url: '/logs',
      actions: [{ action: 'open', title: C.WEIGHT_ACTION }],
      badge: 0,
    },
  }
}

// ----------------------------------------------------------- bloods ----

export function composeBloods(courseDay: number): Composed | null {
  const copy = courseDay === 6 ? C.BLOODS.tomorrow : C.BLOODS.today
  return {
    kind: 'bloods',
    draft: {
      title: copy.title,
      body: copy.body,
      url: '/chart',
      actions: [{ action: 'open', title: C.BLOODS_ACTION }],
      badge: 0,
    },
  }
}

// -------------------------------------------------------- milestone ----

export async function composeMilestone(
  household: Household,
  date: string,
  courseDay: number,
): Promise<Composed | null> {
  const entry = C.MILESTONES[courseDay]
  if (!entry) return null

  const from = addDays(date, -6)
  const [meds, records, therapyDays] = await Promise.all([
    getMedicines(household.id),
    getDoseRecords(household.id, from, date),
    getTherapyDays(household.id, from, date),
  ])
  const week = buildDoseMatrix(
    meds,
    records,
    Array.from({ length: 7 }, (_, i) => addDays(from, i)),
    { therapyDays },
  )
  const perfect = perfectDays(week)
  const taken = records.filter((r) => r.status === 'taken').length

  const body = entry.body(taken, perfect)
  const streak = perfect === 7

  return {
    kind: 'milestone',
    draft: {
      title: entry.title,
      body: streak
        ? { en: `${body.en} ${C.STREAK.en}`, hi: `${body.hi} ${C.STREAK.hi}` }
        : body,
      url: '/history',
      actions: [{ action: 'open', title: C.OPEN_TODAY }],
      badge: 0,
    },
  }
}

// ------------------------------------------------------------- test ----

export function composeTest(): Composed {
  return {
    kind: 'test',
    draft: {
      title: C.TEST.title,
      body: C.TEST.body,
      url: '/settings',
      actions: [],
      badge: 0,
    },
  }
}

/** How many doses are still unrecorded — used to set the app badge. */
export async function unrecordedCount(household: Household, date: string) {
  const { schedule } = await dayState(household, date)
  return unrecorded(schedule).length
}

export { MILESTONE_DAYS, courseDayOf, weightBandOf }
