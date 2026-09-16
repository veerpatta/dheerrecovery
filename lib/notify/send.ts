import 'server-only'
import { and, eq } from 'drizzle-orm'
import webpush, { WebPushError } from 'web-push'
import { db } from '@/db'
import { pushSubscriptions, type PushSubscription } from '@/db/schema'
import type { PushPayload } from './types'

/*
 * Delivery. Everything about *what* to say lives in copy.ts and compose.ts;
 * this file only knows how to get bytes onto a phone and what to do when a
 * device stops answering.
 */

let configured = false

/** True when the VAPID keys are present. Nothing sends without them. */
export function pushConfigured(): boolean {
  return Boolean(
    process.env.VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.VAPID_SUBJECT,
  )
}

function configure() {
  if (configured) return
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  )
  configured = true
}

/**
 * How many consecutive failures before a subscription is dropped.
 *
 * A 404 or 410 is deleted immediately — the endpoint is permanently gone and
 * there is nothing to retry. Everything else is transient until it clearly
 * is not: at roughly five alerts a day, eight is about two days of a device
 * being genuinely unreachable.
 */
const MAX_FAILURES = 8

export interface SendResult {
  sent: number
  failed: number
  pruned: number
}

/**
 * Send one payload to every device on a record.
 *
 * `Promise.allSettled` rather than a loop: each send is an HTTPS round-trip to
 * Apple or Google, and with a handful of devices the difference between
 * ~300ms and ~2s is the difference between finishing inside a serverless
 * budget and not. One dead phone must never stop a live one being told.
 *
 * The body is rendered per subscription because each device carries its own
 * language — and personalising costs nothing, since web push encrypts a
 * separate ciphertext per subscription regardless.
 */
export async function sendToHousehold(
  householdId: string,
  build: (sub: PushSubscription) => PushPayload,
): Promise<SendResult> {
  if (!pushConfigured()) return { sent: 0, failed: 0, pruned: 0 }
  configure()

  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.householdId, householdId))

  if (!subs.length) return { sent: 0, failed: 0, pruned: 0 }

  const results = await Promise.allSettled(
    subs.map(async (sub) => {
      const payload = build(sub)
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify(payload),
        { TTL: 60 * 60 * 6 },
      )
      return sub
    }),
  )

  let sent = 0
  let failed = 0
  let pruned = 0

  await Promise.all(
    results.map(async (r, i) => {
      const sub = subs[i]
      if (r.status === 'fulfilled') {
        sent++
        await db
          .update(pushSubscriptions)
          .set({ failureCount: 0, lastError: null, lastSentAt: new Date() })
          .where(eq(pushSubscriptions.id, sub.id))
        return
      }

      failed++
      const err = r.reason as WebPushError | Error
      const status = err instanceof WebPushError ? err.statusCode : 0

      // 404/410 mean the browser threw this subscription away. It will never
      // come back; keeping the row would just fail forever.
      if (status === 404 || status === 410) {
        pruned++
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id))
        return
      }

      const next = sub.failureCount + 1
      if (next >= MAX_FAILURES) {
        pruned++
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id))
        return
      }
      await db
        .update(pushSubscriptions)
        .set({
          failureCount: next,
          lastError: `${status || 'network'}: ${err.message}`.slice(0, 300),
        })
        .where(eq(pushSubscriptions.id, sub.id))
    }),
  )

  return { sent, failed, pruned }
}

/** Send to one device only — the "send a test notification" button. */
export async function sendToEndpoint(
  householdId: string,
  endpoint: string,
  payload: PushPayload,
): Promise<boolean> {
  if (!pushConfigured()) return false
  configure()
  const [sub] = await db
    .select()
    .from(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.householdId, householdId),
        eq(pushSubscriptions.endpoint, endpoint),
      ),
    )
    .limit(1)
  if (!sub) return false

  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
      { TTL: 60 * 10 },
    )
    return true
  } catch {
    return false
  }
}
