import 'server-only'
import { and, asc, desc, eq, gte, inArray, lte } from 'drizzle-orm'
import type { BatchItem, BatchResponse } from 'drizzle-orm/batch'
import { cache } from 'react'
import { canBatch, db } from '@/db'
import {
  bpReadings,
  careDays,
  careNotes,
  doseRecords,
  doseSlots,
  households,
  medicines,
  pushSubscriptions,
  seizureEvents,
  weightReadings,
  type BpReading,
  type CareDay,
  type CareNote,
  type DoseRecord,
  type Household,
  type Medicine,
  type SeizureEvent,
  type WeightReading,
} from '@/db/schema'
import {
  CATALOG,
  PATIENT_NAME,
  PRESCRIBER,
  PRESCRIPTION_DATE,
  PRESCRIPTION_VERSION,
} from './catalog'
import { medicineApplies } from './schedule'
import { addDays, careClock, careDate, careMinutes, minutesOf } from './time'

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
 * Create a household pre-loaded with the whole catalogue — the 28 July 2026
 * prescription and the 15 September 2026 chemoradiation sheet both.
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
        // These four must stay in step with the catalogue. Miss one and a
        // freshly seeded record schedules a daily chemotherapy capsule that
        // the migration correctly gated on the therapy answer — a divergence
        // only a test against an empty database would ever see.
        courseStartDate: m.courseStartDate ?? null,
        courseEndDate: m.courseEndDate ?? null,
        weekdays: m.weekdays ?? null,
        therapyOnly: m.therapyOnly ?? false,
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

/**
 * -------------------------------------------------------- one round-trip --
 *
 * Every read below is wrapped in React's `cache`, which dedupes it for the
 * life of one request. Deduping alone was not enough, though: Neon's HTTP
 * driver sends each query as its own HTTPS request, so four deduped reads
 * still cost four network round-trips — and they were arranged in waves,
 * because the SOS records could not start until the medicine list came back
 * and told them which medicine ids were SOS.
 *
 * So the shell's reads are now issued as a single `db.batch()`. Every screen
 * goes through the shell layout, which wants the medicine list, the SOS log
 * and a page of blood-pressure readings on every route, so this is exactly
 * the set each render needs — nothing loads more than it did before, it just
 * arrives in one trip instead of three or four.
 *
 * The SOS query asks the database which medicines are SOS with a subquery
 * rather than waiting to be told. That is what makes the batch possible: a
 * query that depends on another query's result cannot travel with it.
 *
 * `Promise.all` on the node-postgres path is not a downgrade — that driver
 * holds a real connection and pipelines on it, so the round-trip arithmetic
 * that motivates all of this does not apply there.
 */
async function runAll<T extends Readonly<[BatchItem<'pg'>, ...BatchItem<'pg'>[]]>>(
  queries: T,
): Promise<BatchResponse<T>> {
  if (canBatch()) return db.batch(queries)
  return Promise.all(queries) as Promise<BatchResponse<T>>
}

/** One page of SOS log rows. The shell asks for 40; nothing asks for more. */
const SOS_PAGE = 50

/**
 * Anything a screen asks for fits inside one page of readings, so every screen
 * shares a single load and slices it. The shell wants the latest reading for
 * the BP sheet and Today wants two hundred for the sparkline — that was two
 * round-trips for overlapping rows. The export asks for more than a page and
 * gets its own query; it is a download, not a screen.
 */
const BP_PAGE = 400

/**
 * Therapy answers ride along in the shell's batch rather than costing Today a
 * round-trip of its own — on the Neon HTTP path the whole tuple is one request,
 * which is the entire point of batching it. A page covers the 42-day
 * chemoradiation course and the report's 30-day default with room to spare; a
 * report asked for an older `from` falls out to its own query, exactly as an
 * over-sized BP read does. Unlike the BP page this is bounded by date, because
 * that is what the callers ask in.
 */
const CARE_DAY_PAGE_DAYS = 120

/**
 * Weight rides in the batch for the same reason as the therapy answers, and
 * costs even less: at most one reading a day, against a page of four hundred
 * blood-pressure rows. Today would otherwise have grown a third round-trip.
 */
const WEIGHT_PAGE = 400

interface Core {
  medicines: MedicineWithSlots[]
  bp: BpReading[]
  sos: DoseRecord[]
  careDays: CareDay[]
  weight: WeightReading[]
}

const loadCore = cache(async (householdId: string): Promise<Core> => {
  // Not awaited — handed to the batch as a subquery so this travels with the
  // medicine list rather than waiting for it.
  const sosMedicineIds = db
    .select({ id: medicines.id })
    .from(medicines)
    .where(and(eq(medicines.householdId, householdId), eq(medicines.kind, 'sos')))

  const [meds, slotRows, bp, sos, days, weight] = await runAll([
    db
      .select()
      .from(medicines)
      .where(eq(medicines.householdId, householdId))
      .orderBy(asc(medicines.sortOrder), asc(medicines.brand)),
    db
      .select()
      .from(doseSlots)
      .innerJoin(medicines, eq(doseSlots.medicineId, medicines.id))
      .where(eq(medicines.householdId, householdId))
      .orderBy(asc(doseSlots.sortOrder)),
    db
      .select()
      .from(bpReadings)
      .where(eq(bpReadings.householdId, householdId))
      .orderBy(desc(bpReadings.measuredAt))
      .limit(BP_PAGE),
    db
      .select()
      .from(doseRecords)
      .where(
        and(
          eq(doseRecords.householdId, householdId),
          inArray(doseRecords.medicineId, sosMedicineIds),
        ),
      )
      .orderBy(desc(doseRecords.createdAt))
      .limit(SOS_PAGE),
    db
      .select()
      .from(careDays)
      .where(
        and(
          eq(careDays.householdId, householdId),
          gte(careDays.careDate, addDays(careDate(), -CARE_DAY_PAGE_DAYS)),
        ),
      )
      .orderBy(desc(careDays.careDate)),
    db
      .select()
      .from(weightReadings)
      .where(eq(weightReadings.householdId, householdId))
      .orderBy(desc(weightReadings.measuredAt))
      .limit(WEIGHT_PAGE),
  ] as const)

  const byMed = new Map<string, (typeof doseSlots.$inferSelect)[]>()
  for (const row of slotRows) {
    const list = byMed.get(row.dose_slots.medicineId) ?? []
    list.push(row.dose_slots)
    byMed.set(row.dose_slots.medicineId, list)
  }

  return {
    medicines: meds.map((m) => ({ ...m, slots: byMed.get(m.id) ?? [] })),
    bp,
    sos,
    careDays: days,
    weight,
  }
})

/** Devices receiving alerts, newest first, for the Settings list. */
export const getPushDevices = cache(async (householdId: string) =>
  db
    .select({
      id: pushSubscriptions.id,
      label: pushSubscriptions.label,
      lang: pushSubscriptions.lang,
      supportsActions: pushSubscriptions.supportsActions,
      lastSeenAt: pushSubscriptions.lastSeenAt,
      endpoint: pushSubscriptions.endpoint,
    })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.householdId, householdId))
    .orderBy(desc(pushSubscriptions.lastSeenAt)),
)

export async function getWeightReadings(
  householdId: string,
  limit = WEIGHT_PAGE,
): Promise<WeightReading[]> {
  if (limit > WEIGHT_PAGE) {
    return db
      .select()
      .from(weightReadings)
      .where(eq(weightReadings.householdId, householdId))
      .orderBy(desc(weightReadings.measuredAt))
      .limit(limit)
  }
  const page = (await loadCore(householdId)).weight
  return page.length > limit ? page.slice(0, limit) : page
}

/**
 * Therapy answers by care-date, for `buildDaySchedule`.
 *
 * A date absent from the map has not been answered. A row whose `therapy` is
 * null is the same thing — it exists because a note was left, or because an
 * answer was taken back — so it is dropped here rather than being mistaken for
 * a "no" by `.has()`.
 */
export async function getTherapyDays(
  householdId: string,
  from: string,
  to: string,
): Promise<Map<string, boolean>> {
  const pageStart = addDays(careDate(), -CARE_DAY_PAGE_DAYS)
  const rows =
    from < pageStart
      ? await db
          .select()
          .from(careDays)
          .where(
            and(
              eq(careDays.householdId, householdId),
              gte(careDays.careDate, from),
              lte(careDays.careDate, to),
            ),
          )
      : (await loadCore(householdId)).careDays

  const out = new Map<string, boolean>()
  for (const r of rows) {
    if (r.therapy === null) continue
    if (r.careDate < from || r.careDate > to) continue
    out.set(r.careDate, r.therapy)
  }
  return out
}

/**
 * The archived/active split is a filter over one cached load, not a second
 * query — History and the report ask for both lists on the same request.
 */
export const getMedicines = cache(
  async (householdId: string): Promise<MedicineWithSlots[]> =>
    (await loadCore(householdId)).medicines.filter((m) => !m.archivedAt),
)

/** Includes archived prescriptions for migrated history, reports and exports. */
export async function getAllMedicines(
  householdId: string,
): Promise<MedicineWithSlots[]> {
  return (await loadCore(householdId)).medicines
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
  /**
   * False when this slot is only here because a dose was recorded against it —
   * a Septran tablet given on a Tuesday, or a Temozolomide capsule on a day
   * later re-answered as "no therapy". The record is never hidden; this is how
   * the report and the export say why it is there.
   */
  applies: boolean
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

export interface DayScheduleOptions {
  now?: Date
  /**
   * Therapy answers by care-date. A date that is absent has not been answered,
   * which schedules the same as "no" but reads differently on screen.
   *
   * Deliberately not optional. A caller that forgot to pass it would silently
   * drop every therapy-gated dose out of the report, the export and the
   * adherence figures, with nothing anywhere to say so. Required, it is a
   * build error instead.
   */
  therapyDays: Map<string, boolean>
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
  options: DayScheduleOptions,
): ScheduledDose[] {
  const now = options.now ?? new Date()
  const therapy = options.therapyDays.get(isoDate)
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
    const applies = medicineApplies(m, isoDate, therapy)
    /*
     * Note `dueTimes` is asked for every slot, applicable or not. It chains a
     * medicine's slots in clock order and the `due.get(...)!` below depends on
     * the map being complete; filtering inside it would let a dropped slot
     * become the chain's "immediately previous" one. Nothing with a dosing
     * interval is conditionally scheduled today, which is exactly why this
     * would be introduced later by accident.
     */
    const due = dueTimes(m, byKey, isoDate)
    for (const s of m.slots) {
      const record = byKey.get(recordKey(m.id, s.slotKey)) ?? null
      /*
       * A recorded dose is a statement of fact and never disappears — not when
       * the day is re-answered "no therapy", not when the course window has
       * passed, not when a Monday-only tablet was given on a Tuesday. It can
       * only ever arrive here as taken or skipped, because the status branch
       * below reads the record when there is one, so this rule cannot invent a
       * missed dose. It can only make the record more complete.
       */
      if (!applies && !record) continue
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
        applies,
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
 *
 * Deliberately not gated on whether the medicine applies to the date. A
 * back-dated correction on a day since re-answered "no therapy" still needs
 * its stamp; returning null here would send `recordDose` to the printed
 * reminder instead, which is the wrong baseline to measure drift against.
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

export const getDoseRecords = cache(
  async (householdId: string, from: string, to: string): Promise<DoseRecord[]> =>
    db
      .select()
      .from(doseRecords)
      .where(
        and(
          eq(doseRecords.householdId, householdId),
          gte(doseRecords.doseDate, from),
          lte(doseRecords.doseDate, to),
        ),
      )
      .orderBy(asc(doseRecords.doseDate), asc(doseRecords.scheduledTime)),
)

/**
 * Archived SOS entries stay in scope: their past doses are still part of the
 * record, which is why the subquery filters on `kind` alone.
 */
export async function getSosRecords(
  householdId: string,
  limit = SOS_PAGE,
): Promise<DoseRecord[]> {
  if (limit > SOS_PAGE) {
    const sosIds = (await loadCore(householdId))
      .medicines.filter((m) => m.kind === 'sos')
      .map((m) => m.id)
    if (!sosIds.length) return []
    return db
      .select()
      .from(doseRecords)
      .where(
        and(
          eq(doseRecords.householdId, householdId),
          inArray(doseRecords.medicineId, sosIds),
        ),
      )
      .orderBy(desc(doseRecords.createdAt))
      .limit(limit)
  }
  const page = (await loadCore(householdId)).sos
  return page.length > limit ? page.slice(0, limit) : page
}

export async function getBpReadings(
  householdId: string,
  limit = BP_PAGE,
): Promise<BpReading[]> {
  if (limit > BP_PAGE) {
    return db
      .select()
      .from(bpReadings)
      .where(eq(bpReadings.householdId, householdId))
      .orderBy(desc(bpReadings.measuredAt))
      .limit(limit)
  }
  const page = (await loadCore(householdId)).bp
  return page.length > limit ? page.slice(0, limit) : page
}

export const getSeizureEvents = cache(
  async (householdId: string): Promise<SeizureEvent[]> =>
    db
      .select()
      .from(seizureEvents)
      .where(eq(seizureEvents.householdId, householdId))
      .orderBy(desc(seizureEvents.occurredAt)),
)

export const getCareNotes = cache(
  async (householdId: string): Promise<CareNote[]> =>
    db
      .select()
      .from(careNotes)
      .where(eq(careNotes.householdId, householdId))
      .orderBy(desc(careNotes.createdAt)),
)
