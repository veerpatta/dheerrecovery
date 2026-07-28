import 'server-only'
import { and, asc, desc, eq, gte, lte, sql } from 'drizzle-orm'
import { db } from '@/db'
import {
  bpReadings,
  careNotes,
  doseRecords,
  doseSlots,
  households,
  medicines,
  seizureEvents,
  type BpReading,
  type CareNote,
  type DoseRecord,
  type Household,
  type Medicine,
  type SeizureEvent,
} from '@/db/schema'
import {
  CATALOG,
  PATIENT_NAME,
  PRESCRIBER,
  PRESCRIPTION_DATE,
  PRESCRIPTION_VERSION,
} from './catalog'
import { careDate, careMinutes, minutesOf } from './time'

export type MedicineWithSlots = Medicine & { slots: (typeof doseSlots.$inferSelect)[] }

/** Load a household by care code, or return null. Seeds nothing. */
export async function findHousehold(careCode: string): Promise<Household | null> {
  const [row] = await db
    .select()
    .from(households)
    .where(eq(households.careCode, careCode))
    .limit(1)
  return row ?? null
}

/**
 * Create a household pre-loaded with the 28 July 2026 prescription.
 * Idempotent on care code.
 */
export async function createHousehold(careCode: string): Promise<Household> {
  const existing = await findHousehold(careCode)
  if (existing) return existing

  const [household] = await db
    .insert(households)
    .values({
      careCode,
      patientName: PATIENT_NAME,
      prescriptionVersion: PRESCRIPTION_VERSION,
      prescriptionDate: PRESCRIPTION_DATE,
      prescriberName: PRESCRIBER,
      courseStart: PRESCRIPTION_DATE,
    })
    .returning()

  const inserted = await db
    .insert(medicines)
    .values(
      CATALOG.map((m, i) => ({
        householdId: household.id,
        catalogId: m.id,
        brand: m.brand,
        generic: m.generic,
        dose: m.dose,
        form: m.form,
        purpose: m.purpose,
        prescription: m.prescription,
        prescriptionHi: m.prescriptionHi,
        courseDays: m.courseDays,
        tone: m.tone,
        kind: m.kind,
        sosStatus: m.sosStatus ?? null,
        symptom: m.symptom ?? null,
        repeatableLog: m.repeatableLog ?? false,
        food: m.food,
        prescribedAt: m.prescribedAt,
        doctorNote: m.doctorNote,
        instruction: m.instruction,
        caution: m.caution,
        verify: m.verify,
        sortOrder: i,
      })),
    )
    .returning({ id: medicines.id, catalogId: medicines.catalogId })

  const byCatalogId = new Map(inserted.map((r) => [r.catalogId, r.id]))
  const slotRows = CATALOG.flatMap((m) =>
    m.slots.map((s, i) => ({
      medicineId: byCatalogId.get(m.id)!,
      slotKey: s.key,
      time: s.time,
      label: s.label,
      sortOrder: i,
    })),
  )
  if (slotRows.length) await db.insert(doseSlots).values(slotRows)

  return household
}

export async function getMedicines(householdId: string): Promise<MedicineWithSlots[]> {
  const meds = await db
    .select()
    .from(medicines)
    .where(eq(medicines.householdId, householdId))
    .orderBy(asc(medicines.sortOrder), asc(medicines.brand))

  const slots = await db
    .select()
    .from(doseSlots)
    .innerJoin(medicines, eq(doseSlots.medicineId, medicines.id))
    .where(eq(medicines.householdId, householdId))
    .orderBy(asc(doseSlots.sortOrder))

  const byMed = new Map<string, (typeof doseSlots.$inferSelect)[]>()
  for (const row of slots) {
    const list = byMed.get(row.dose_slots.medicineId) ?? []
    list.push(row.dose_slots)
    byMed.set(row.dose_slots.medicineId, list)
  }

  return meds
    .filter((m) => !m.archivedAt)
    .map((m) => ({ ...m, slots: byMed.get(m.id) ?? [] }))
}

export type DoseStatus = 'taken' | 'skipped' | 'not-recorded' | 'upcoming'

export interface ScheduledDose {
  medicine: MedicineWithSlots
  slotKey: string
  time: string
  label: string
  status: DoseStatus
  record: DoseRecord | null
}

/**
 * Build the ordered list of scheduled doses for one date, joined to whatever
 * was actually recorded. A slot with no record is "not-recorded" once its
 * time has passed and "upcoming" before that — never silently "missed",
 * because a missing entry does not prove a missed dose.
 */
export function buildDaySchedule(
  meds: MedicineWithSlots[],
  records: DoseRecord[],
  isoDate: string,
  now: Date = new Date(),
): ScheduledDose[] {
  const today = careDate(now)
  const nowMinutes = careMinutes(now)

  const recordKey = (medicineId: string, slotKey: string) => `${medicineId}::${slotKey}`
  const byKey = new Map<string, DoseRecord>()
  for (const r of records) {
    if (r.doseDate !== isoDate) continue
    byKey.set(recordKey(r.medicineId, r.slotKey), r)
  }

  const doses: ScheduledDose[] = []
  for (const m of meds) {
    if (m.kind !== 'routine') continue
    for (const s of m.slots) {
      const record = byKey.get(recordKey(m.id, s.slotKey)) ?? null
      let status: DoseStatus
      if (record) {
        status = record.status === 'taken' ? 'taken' : 'skipped'
      } else if (isoDate > today) {
        status = 'upcoming'
      } else if (isoDate === today && minutesOf(s.time) > nowMinutes) {
        status = 'upcoming'
      } else {
        status = 'not-recorded'
      }
      doses.push({
        medicine: m,
        slotKey: s.slotKey,
        time: s.time.slice(0, 5),
        label: s.label,
        status,
        record,
      })
    }
  }

  return doses.sort(
    (a, b) =>
      minutesOf(a.time) - minutesOf(b.time) ||
      a.medicine.sortOrder - b.medicine.sortOrder,
  )
}

export async function getDoseRecords(
  householdId: string,
  from: string,
  to: string,
): Promise<DoseRecord[]> {
  return db
    .select()
    .from(doseRecords)
    .where(
      and(
        eq(doseRecords.householdId, householdId),
        gte(doseRecords.doseDate, from),
        lte(doseRecords.doseDate, to),
      ),
    )
    .orderBy(asc(doseRecords.doseDate), asc(doseRecords.scheduledTime))
}

export async function getSosRecords(
  householdId: string,
  limit = 50,
): Promise<DoseRecord[]> {
  const sosMeds = await db
    .select({ id: medicines.id })
    .from(medicines)
    .where(and(eq(medicines.householdId, householdId), eq(medicines.kind, 'sos')))

  if (!sosMeds.length) return []

  return db
    .select()
    .from(doseRecords)
    .where(
      and(
        eq(doseRecords.householdId, householdId),
        sql`${doseRecords.medicineId} in ${sosMeds.map((m) => m.id)}`,
      ),
    )
    .orderBy(desc(doseRecords.createdAt))
    .limit(limit)
}

export async function getBpReadings(
  householdId: string,
  limit = 400,
): Promise<BpReading[]> {
  return db
    .select()
    .from(bpReadings)
    .where(eq(bpReadings.householdId, householdId))
    .orderBy(desc(bpReadings.measuredAt))
    .limit(limit)
}

export async function getSeizureEvents(householdId: string): Promise<SeizureEvent[]> {
  return db
    .select()
    .from(seizureEvents)
    .where(eq(seizureEvents.householdId, householdId))
    .orderBy(desc(seizureEvents.occurredAt))
}

export async function getCareNotes(householdId: string): Promise<CareNote[]> {
  return db
    .select()
    .from(careNotes)
    .where(eq(careNotes.householdId, householdId))
    .orderBy(desc(careNotes.createdAt))
}
