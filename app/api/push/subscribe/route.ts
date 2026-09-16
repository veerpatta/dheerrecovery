import { and, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { pushSubscriptions } from '@/db/schema'
import { getHousehold } from '@/lib/household'

// `web-push` and the pg driver both need Node built-ins.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Register — or refresh — this device.
 *
 * Called on every app open by `PushSync`, not only when permission is first
 * granted. That is deliberate: it keeps `lang` in step with the language
 * toggle, refreshes `lastSeenAt`, and quietly repairs the subscription iOS
 * rotates when a Home-Screen app has gone unopened for a few weeks.
 *
 * The endpoint is the identity, so this upserts on it. `replaces` lets the
 * service worker's `pushsubscriptionchange` hand over the old endpoint for
 * deletion rather than leaving a row that will fail forever.
 */
export async function POST(request: Request) {
  const household = await getHousehold()

  let body: {
    subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
    lang?: string
    label?: string
    supportsActions?: boolean
    replaces?: string | null
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Bad JSON' }, { status: 400 })
  }

  const sub = body.subscription
  const endpoint = sub?.endpoint?.trim()
  const p256dh = sub?.keys?.p256dh
  const auth = sub?.keys?.auth
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json(
      { ok: false, error: 'Subscription is incomplete.' },
      { status: 400 },
    )
  }

  const lang = body.lang === 'hi' ? 'hi' : 'en'
  const label = body.label?.trim().slice(0, 60) || null
  const supportsActions = body.supportsActions === true

  if (body.replaces && body.replaces !== endpoint) {
    await db
      .delete(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.householdId, household.id),
          eq(pushSubscriptions.endpoint, body.replaces),
        ),
      )
  }

  await db
    .insert(pushSubscriptions)
    .values({
      householdId: household.id,
      endpoint,
      p256dh,
      auth,
      lang,
      label,
      supportsActions,
      lastSeenAt: new Date(),
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: {
        householdId: household.id,
        p256dh,
        auth,
        lang,
        supportsActions,
        lastSeenAt: new Date(),
        // A device that is answering again starts from a clean slate, so an
        // old run of failures cannot get it pruned on its next hiccup.
        failureCount: 0,
        lastError: null,
      },
    })

  return NextResponse.json({ ok: true })
}
