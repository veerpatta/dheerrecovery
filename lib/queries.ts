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
import { careClock, careDate, careMinutes, minutesOf } from './time'

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
 *
 * Safe to call concurrently. On a first visit to an empty database, Next
 * prefetches the nav links, so several requests race to seed at once — each
 * insert defers to whichever request won, rather than failing on the unique
 * index and throwing a caregiver into the error boundary.
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
    .onConflictDoNothing({ target: households.careCode })
    .returning()

  // Another request inserted it between the lookup and the insert.
  if (!household) {
    const raced = await findHousehold(careCode)
    if (raced) return raced
    throw new Error('Could not open the care record. Try again.')
  }

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
        dosingIntervalHours: m.dosingIntervalHours ?? null,
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
    .onConflictDoNothing({
      target: [medicines.householdId, medicines.catalogId],
    })
    .returning({ id: medicines.id, catalogId: medicines.catalogId })

  const byCatalogId = new Map(inserted.map((r) => [r.catalogId, r.id]))
  const slotRows = CATALOG.flatMap((m) => {
    const medicineId = byCatalogId.get(m.id)
    if (!medicineId) return [] // seeded by a concurrent request
    return m.slots.map((s, i) => ({
      medicineId,
      slotKey: s.key,
      time: s.time,
      label: s.label,
      sortOrder: i,
    }))
  })
  if (slotRows.length) {
    await db
      .insert(doseSlots)
      .values(slotRows)
      .onConflictDoNothing({ target: [doseSlots.medicineId, doseSlots.slotKey] })
  }

  return household
}

async function loadMedicines(
  householdId: string,
  includeArchived: boolean,
): Promise<MedicineWithSlots[]> {
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
    .filter((m) => includeArchived || !m.archivedAt)
    .map((m) => ({ ...m, slots: byMed.get(m.id) ?? [] }))
}

export async function getMedicines(
  householdId: string,
): Promise<MedicineWithSlots[]> {
  return loadMedicines(householdId, false)
}

/** Includes archived prescriptions for migrated history, reports and exports. */
export async function getAllMedicines(
  householdId: string,
): Promise<MedicineWithSlots[]> {
  return loadMedicines(householdId, true)
}

export type DoseStatus = 'taken' | 'skipped' | 'not-recorded' | 'upcoming'

export interface ScheduledDose {
  medicine: MedicineWithSlots
  slotKey: string
  /** When the dose is actually due — derived for interval medicines. */
  time: string
  /** The reminder time printed on the slot, before any derivation. */
  plannedTime: string
  label: string
  status: DoseStatus
  record: DoseRecord | null
  /** Set only when `time` was derived from the previous dose that day. */
  derivedFrom: { slotKey: string; label: string; takenAt: Date } | null
  /**
   * The interval lands past midnight, so `time` fell back to the printed
   * reminder. Surfaced rather than swallowed: the gap will not be the
   * prescribed one and the caregiver should know.
   */
  rollsOver: boolean
  intervalHours: number | null
}

const recordKey = (medicineId: string, slotKey: string) => `${medicineId}::${slotKey}`

/**
 * The due times for one medicine on one date, slot by slot.
 *
 * For a medicine with a dosing interval, a slot after the first is due
 * `intervalHours` after the *previous dose was actually taken* — an 8:20 am
 * Lacoset moves the evening dose to 8:20 pm.
 *
 * The chain is deliberately re-anchored every care-date: tomorrow's first
 * slot returns to its printed reminder time. Chaining across days instead
 * would let a single late dose ratchet the whole schedule later with no way
 * back, which is not a safe property for an anti-seizure medicine.
 */
type DueTime = Pick<ScheduledDose, 'time' | 'derivedFrom' | 'rollsOver'>

function dueTimes(
  medicine: MedicineWithSlots,
  byKey: Map<string, DoseRecord>,
  isoDate: string,
): Map<string, DueTime> {
  const out = new Map<string, DueTime>()
  const interval = medicine.dosingIntervalHours

  // Chain in clock order, not `sortOrder`. They agree for the prescription as
  // written, but stop agreeing the moment a caregiver edits a reminder time in
  // Settings — and the chain only means anything in the order doses are given.
  const ordered = [...medicine.slots].sort(
    (a, b) => minutesOf(a.time) - minutesOf(b.time) || a.sortOrder - b.sortOrder,
  )

  ordered.forEach((slot, index) => {
    const planned = slot.time.slice(0, 5)
    const previous = index > 0 ? ordered[index - 1] : null
    const previousRecord = previous
      ? (byKey.get(recordKey(medicine.id, previous.slotKey)) ?? null)
      : null

    // The anchor is the immediately previous slot of this medicine on this
    // date, and only when it was actually taken. A skipped or unrecorded dose
    // falls back to the printed time rather than reaching further back — and
    // nothing ever chains into yesterday, because `byKey` is scoped to one
    // date. That is what stops one late dose ratcheting the schedule later.
    if (
      interval &&
      previous &&
      previousRecord?.status === 'taken' &&
      previousRecord.takenAt
    ) {
      const takenAt = new Date(previousRecord.takenAt)
      const target = new Date(takenAt.getTime() + interval * 3_600_000)
      const derivedFrom = {
        slotKey: previous.slotKey,
        label: previous.label,
        takenAt,
      }

      if (careDate(target) === isoDate) {
        out.set(slot.slotKey, { time: careClock(target), derivedFrom, rollsOver: false })
        return
      }

      // Past midnight. Showing a due time on the wrong day would read as
      // twelve hours overdue and could prompt a second dose, so fall back to
      // the printed reminder and flag it instead.
      out.set(slot.slotKey, { time: planned, derivedFrom, rollsOver: true })
      return
    }

    out.set(slot.slotKey, { time: planned, derivedFrom: null, rollsOver: false })
  })

  return out
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

  const byKey = new Map<string, DoseRecord>()
  for (const r of records) {
    if (r.doseDate !== isoDate) continue
    byKey.set(recordKey(r.medicineId, r.slotKey), r)
  }

  const doses: ScheduledDose[] = []
  for (const m of meds) {
    if (m.kind !== 'routine') continue
    const due = dueTimes(m, byKey, isoDate)
    for (const s of m.slots) {
      const record = byKey.get(recordKey(m.id, s.slotKey)) ?? null
      const { time, derivedFrom, rollsOver } = due.get(s.slotKey)!
      let status: DoseStatus
      if (record) {
        status = record.status === 'taken' ? 'taken' : 'skipped'
      } else if (isoDate > today) {
        status = 'upcoming'
      } else if (isoDate === today && minutesOf(time) > nowMinutes) {
        status = 'upcoming'
      } else {
        status = 'not-recorded'
      }
      doses.push({
        medicine: m,
        slotKey: s.slotKey,
        time,
        plannedTime: s.time.slice(0, 5),
        label: s.label,
        status,
        record,
        derivedFrom,
        rollsOver,
        intervalHours: m.dosingIntervalHours,
      })
    }
  }

  return doses.sort(
    (a, b) =>
      minutesOf(a.time) - minutesOf(b.time) ||
      a.medicine.sortOrder - b.medicine.sortOrder,
  )
}

/**
 * The due time for one slot on one date, for code that writes a record rather
 * than rendering the day — `recordDose` stores this as `scheduledTime` so
 * drift, the on-time score and the report all measure against the time the
 * dose was actually due, not the printed reminder.
 */
export function dueTimeForSlot(
  medicine: MedicineWithSlots,
  slotKey: string,
  records: DoseRecord[],
  isoDate: string,
): string | null {
  const byKey = new Map<string, DoseRecord>()
  for (const r of records) {
    if (r.doseDate !== isoDate) continue
    byKey.set(recordKey(r.medicineId, r.slotKey), r)
  }
  return dueTimes(medicine, byKey, isoDate).get(slotKey)?.time ?? null
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
