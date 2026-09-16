import 'server-only'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { doseRecords } from '@/db/schema'

/*
 * Writing a dose from somewhere that cannot be trusted to be the only writer.
 *
 * Deliberately NOT in lib/actions.ts and deliberately not `'use server'`.
 * `recordDose` there is a toggle: called with a status a row already holds, it
 * *deletes* the row, because that is what re-tapping "Taken ✓" on a dose card
 * is supposed to mean. That behaviour is right for a card a caregiver is
 * looking at and catastrophic for anything that might fire twice — two
 * caregivers acting on the same notification would be one create and one
 * delete, silently erasing a chemotherapy dose from the record.
 *
 * This only ever inserts, and only when nothing is there.
 */

export interface DoseWriteResult {
  written: boolean
  reason?: 'already-recorded'
}

export async function recordDoseIfAbsent(input: {
  householdId: string
  medicineId: string
  slotKey: string
  doseDate: string
  status: 'taken' | 'skipped'
  takenAt: Date | null
  scheduledTime: string | null
  note?: string | null
}): Promise<DoseWriteResult> {
  const [existing] = await db
    .select({ id: doseRecords.id })
    .from(doseRecords)
    .where(
      and(
        eq(doseRecords.householdId, input.householdId),
        eq(doseRecords.medicineId, input.medicineId),
        eq(doseRecords.slotKey, input.slotKey),
        eq(doseRecords.doseDate, input.doseDate),
      ),
    )
    .limit(1)

  if (existing) return { written: false, reason: 'already-recorded' }

  await db.insert(doseRecords).values({
    householdId: input.householdId,
    medicineId: input.medicineId,
    slotKey: input.slotKey,
    doseDate: input.doseDate,
    status: input.status,
    scheduledTime: input.scheduledTime,
    takenAt: input.status === 'taken' ? input.takenAt : null,
    note: input.note ?? null,
  })

  return { written: true }
}
