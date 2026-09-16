import 'server-only'
import { and, eq, isNull, lt, sql } from 'drizzle-orm'
import { db } from '@/db'
import { notificationLog } from '@/db/schema'
import type { NotifyKind } from './types'

/*
 * The guard that stops one alert becoming many.
 *
 * The cron ticks every five minutes and each tick asks the same question, so
 * something has to make "send the morning greeting" happen exactly once. The
 * answer is to make the *claim* the atomic act rather than the send: a row is
 * inserted with ON CONFLICT DO NOTHING, and only the tick whose insert
 * actually returned a row goes on to send.
 *
 * Sending first and recording afterwards would be the obvious order and is
 * the wrong one — a crash between the two sends the alert again on the next
 * tick, and the next, for as long as the day lasts.
 */

/** Attempts before a repeatedly-failing alert is left alone for the day. */
const MAX_ATTEMPTS = 3

/** How long a claim is honoured before another tick may retry it. */
const RETRY_AFTER = '4 minutes'

export interface Claim {
  id: string
  /** False when another tick already holds this one. */
  won: boolean
}

/**
 * Try to become the tick that sends `kind` on `careDate`.
 *
 * Returns `won: false` when the row already exists and is either sent or
 * still inside another tick's retry window — the caller must then do nothing
 * at all, not even build a payload.
 */
export async function claim(
  householdId: string,
  kind: NotifyKind,
  careDate: string,
): Promise<Claim | null> {
  const [fresh] = await db
    .insert(notificationLog)
    .values({ householdId, kind, careDate })
    .onConflictDoNothing({
      target: [
        notificationLog.householdId,
        notificationLog.kind,
        notificationLog.careDate,
      ],
    })
    .returning({ id: notificationLog.id })

  if (fresh) return { id: fresh.id, won: true }

  /*
   * The row exists. It is only ours to retry if a previous attempt claimed it,
   * never finished sending, and has since gone quiet — which is what separates
   * "someone else is sending it right now" from "the send died". Bounded at
   * three so a permanently broken send costs three notifications, not sixty.
   */
  const [retry] = await db
    .update(notificationLog)
    .set({
      claimedAt: new Date(),
      attempts: sql`${notificationLog.attempts} + 1`,
    })
    .where(
      and(
        eq(notificationLog.householdId, householdId),
        eq(notificationLog.kind, kind),
        eq(notificationLog.careDate, careDate),
        isNull(notificationLog.sentAt),
        lt(notificationLog.attempts, MAX_ATTEMPTS),
        lt(notificationLog.claimedAt, sql`now() - interval '${sql.raw(RETRY_AFTER)}'`),
      ),
    )
    .returning({ id: notificationLog.id })

  return retry ? { id: retry.id, won: true } : null
}

/**
 * Mark a claim finished. Called even when zero devices were reached — there
 * is nothing to retry when nobody is subscribed, and leaving it unsent would
 * make the next three ticks try again for no reason.
 */
export async function markSent(id: string, deviceCount: number) {
  await db
    .update(notificationLog)
    .set({ sentAt: new Date(), deviceCount })
    .where(eq(notificationLog.id, id))
}

/** Release a claim whose send threw, so the retry window can pick it up. */
export async function releaseClaim(id: string) {
  await db
    .update(notificationLog)
    .set({ claimedAt: new Date(Date.now() - 10 * 60_000) })
    .where(eq(notificationLog.id, id))
}
