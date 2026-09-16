import { and, eq, isNull } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { notificationLog } from '@/db/schema'
import { setTherapyDay } from '@/lib/actions'
import { getHousehold } from '@/lib/household'
import * as C from '@/lib/notify/copy'
import type { PushActionRequest, PushActionResponse } from '@/lib/notify/types'
import { careDate } from '@/lib/time'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Act on a notification button.
 *
 * There is no signature on the payload and none is needed. Every export of
 * lib/actions.ts is already a public unauthenticated endpoint — the app has
 * no login at all and says so in the README — so a signature here would be a
 * lock on one door of a house with no walls. What actually needs solving is
 * *staleness*: a notification can sit on a lock screen overnight, and tapping
 * yesterday's "No therapy" must not rewrite today.
 *
 * The `logId` does that with no crypto. It names a `notification_log` row,
 * and this route refuses when that row is for another day or has already been
 * acted on — which also gives replay protection, de-duplication across two
 * caregivers' phones, and an audit trail of how each answer was given.
 */
export async function POST(request: Request) {
  const household = await getHousehold()

  let body: PushActionRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false } satisfies PushActionResponse, {
      status: 400,
    })
  }

  const today = careDate()
  const { logId, action } = body

  if (!logId || !action) {
    return NextResponse.json({ ok: false } satisfies PushActionResponse, {
      status: 400,
    })
  }

  const [row] = await db
    .select()
    .from(notificationLog)
    .where(
      and(
        eq(notificationLog.id, logId),
        eq(notificationLog.householdId, household.id),
      ),
    )
    .limit(1)

  if (!row) {
    return NextResponse.json(
      { ok: false, stale: true, message: C.STALE.en, url: '/' } satisfies PushActionResponse,
      { status: 404 },
    )
  }

  // Left on a lock screen overnight. Open the app rather than write anything.
  if (row.careDate !== today) {
    return NextResponse.json(
      { ok: false, stale: true, message: C.STALE.en, url: '/' } satisfies PushActionResponse,
      { status: 409 },
    )
  }

  if (action === 'open') {
    return NextResponse.json({ ok: true, url: '/' } satisfies PushActionResponse)
  }

  if (action !== 'therapy-yes' && action !== 'therapy-no') {
    return NextResponse.json({ ok: false } satisfies PushActionResponse, {
      status: 400,
    })
  }

  /*
   * Claim the action the same way the cron claims a send: the UPDATE only
   * matches while `acted_at` is still null, so two caregivers tapping the same
   * alert on two phones cannot both write. The second gets told so plainly
   * rather than silently doing nothing.
   */
  const [claimed] = await db
    .update(notificationLog)
    .set({ actedAt: new Date(), actedAction: action })
    .where(and(eq(notificationLog.id, row.id), isNull(notificationLog.actedAt)))
    .returning({ id: notificationLog.id })

  if (!claimed) {
    return NextResponse.json(
      { ok: false, message: C.ALREADY_ANSWERED.en, url: '/' } satisfies PushActionResponse,
      { status: 409 },
    )
  }

  const therapy = action === 'therapy-yes'
  // setTherapyDay is an upsert, so it is safe to call from here; it is also
  // the same function the Today card calls, so there is one code path.
  await setTherapyDay({ careDate: today, therapy })

  return NextResponse.json({
    ok: true,
    message: therapy ? C.THERAPY_CONFIRMED.yes.en : C.THERAPY_CONFIRMED.no.en,
    url: '/',
  } satisfies PushActionResponse)
}
