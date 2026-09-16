import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { getHousehold } from '@/lib/household'
import { claim, markSent, releaseClaim } from '@/lib/notify/claim'
import {
  composeBloods,
  composeEvening,
  composeMilestone,
  composeMorning,
  composeWeight,
  payloadFor,
  type Composed,
} from '@/lib/notify/compose'
import { courseDayOf, planFor, type Candidate } from '@/lib/notify/plan'
import { pushConfigured, sendToHousehold } from '@/lib/notify/send'
import type { NotifyKind } from '@/lib/notify/types'
import { careClock, careDate } from '@/lib/time'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/*
 * The scheduler's one endpoint, called every five minutes by an external cron.
 *
 * The ordering inside matters more than it looks. `planFor` is pure arithmetic
 * on a clock string and runs *before* anything opens a database connection —
 * on all but a handful of minutes a day it returns nothing and the request
 * ends having touched Postgres zero times. That is what lets a free Neon tier
 * survive a scheduler that never sleeps: the compute only wakes for the five
 * or so minutes a day an alert is actually due.
 */

function authorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false

  const url = new URL(request.url)
  const offered =
    request.headers.get('x-cron-secret') ??
    // Vercel Cron sends this form, so a later move to a Pro cron needs no
    // code change — only a `crons` entry in vercel.json.
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ??
    url.searchParams.get('secret') ??
    ''

  const a = Buffer.from(offered)
  const b = Buffer.from(secret)
  return a.length === b.length && timingSafeEqual(a, b)
}

async function composeFor(
  candidate: Candidate,
  household: Awaited<ReturnType<typeof getHousehold>>,
  date: string,
): Promise<Composed | null> {
  switch (candidate.kind) {
    case 'morning':
      return composeMorning(household, date)
    case 'evening':
      return composeEvening(household, date)
    case 'weight':
      return composeWeight(household, date)
    case 'bloods':
      return candidate.courseDay ? composeBloods(candidate.courseDay) : null
    case 'milestone':
      return candidate.courseDay
        ? composeMilestone(household, date, candidate.courseDay)
        : null
    default:
      return null
  }
}

async function handle(request: Request) {
  if (!authorised(request)) {
    // 503 when the secret is unset, so a misconfigured deploy is never an
    // open endpoint that anyone can use to send notifications.
    const status = process.env.CRON_SECRET ? 401 : 503
    return NextResponse.json({ ok: false }, { status })
  }

  const url = new URL(request.url)
  const dry = url.searchParams.get('dry') === '1'
  const forced = url.searchParams.get('kind') as NotifyKind | null

  const date = careDate()
  const clock = careClock()

  if (!pushConfigured()) {
    return NextResponse.json({ ok: false, reason: 'vapid-not-configured' })
  }

  const household = await getHousehold()
  const enabled = {
    morning: household.notifyMorning,
    evening: household.notifyEvening,
    weight: household.notifyWeight,
    bloods: household.notifyBloods,
    milestones: household.notifyMilestones,
  }

  /*
   * `?kind=` bypasses the time window so a real notification can be forced
   * during testing. It still goes through claim and compose, so the
   * idempotency and silence rules are exercised rather than skipped — which
   * is the whole point of testing it.
   */
  const candidates: Candidate[] = forced
    ? [{ kind: forced, courseDay: courseDayOf(date) }]
    : planFor(clock, date, enabled)

  if (!candidates.length) {
    return NextResponse.json({ ok: true, clock, date, ran: [], skipped: [] })
  }

  const ran: unknown[] = []
  const skipped: unknown[] = []

  for (const candidate of candidates) {
    const composed = await composeFor(candidate, household, date)

    // A builder returning null is the silence rule: an evening wrap on a day
    // where everything is recorded, a weight nudge after a weigh-in today.
    if (!composed) {
      skipped.push({ kind: candidate.kind, reason: 'nothing-to-say' })
      continue
    }

    // A dry run returns the words rather than sending them, so the copy can be
    // read before it lands on anyone's phone — and so a test can assert on it.
    if (dry) {
      const preview = payloadFor(composed, null, date)
      ran.push({
        kind: candidate.kind,
        claimed: false,
        dry: true,
        en: preview('en'),
        hi: preview('hi'),
      })
      continue
    }

    const won = await claim(household.id, candidate.kind, date)
    if (!won) {
      skipped.push({ kind: candidate.kind, reason: 'already-claimed' })
      continue
    }

    try {
      const build = payloadFor(composed, won.id, date)
      const result = await sendToHousehold(household.id, (sub) =>
        build(sub.lang === 'hi' ? 'hi' : 'en'),
      )
      // Marked sent even at zero devices: there is nothing to retry when
      // nobody is subscribed, and leaving it open would retry twice more.
      await markSent(won.id, result.sent)
      ran.push({ kind: candidate.kind, claimed: true, ...result })
    } catch (error) {
      await releaseClaim(won.id)
      skipped.push({
        kind: candidate.kind,
        reason: 'send-failed',
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return NextResponse.json({ ok: true, clock, date, ran, skipped })
}

export const POST = handle
export const GET = handle
