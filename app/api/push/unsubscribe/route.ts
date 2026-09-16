import { and, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { pushSubscriptions } from '@/db/schema'
import { getHousehold } from '@/lib/household'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Turn this device off. The browser subscription is unsubscribed client-side. */
export async function POST(request: Request) {
  const household = await getHousehold()

  let endpoint = ''
  try {
    endpoint = String((await request.json())?.endpoint ?? '').trim()
  } catch {
    return NextResponse.json({ ok: false, error: 'Bad JSON' }, { status: 400 })
  }
  if (!endpoint) {
    return NextResponse.json({ ok: false, error: 'No endpoint' }, { status: 400 })
  }

  await db
    .delete(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.householdId, household.id),
        eq(pushSubscriptions.endpoint, endpoint),
      ),
    )

  return NextResponse.json({ ok: true })
}
