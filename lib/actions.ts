'use server'

import { and, asc, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import {
  bpReadings,
  careNotes,
  doseRecords,
  doseSlots,
  households,
  medicines,
  seizureEvents,
} from '@/db/schema'
import { getHousehold } from './household'
import { dueTimeForSlot } from './queries'
import { careDate, careInstant } from './time'

/** The app serves one record, so every write resolves it the same way. */
async function requireHousehold() {
  return getHousehold()
}

/**
 * Every write shows up on more than one tab — a dose tap changes Today, the
 * history ledger and the report; a BP reading changes Today's snapshot and the
 * logs page. So the whole app is revalidated rather than one segment. All
 * pages are `force-dynamic`, so this only clears the client router cache.
 */
function refresh() {
  revalidatePath('/', 'layout')
}

// ------------------------------------------------------------- household ---

export async function confirmPrescription() {
  const h = await requireHousehold()
  await db
    .update(households)
    .set({ rxVerifiedAt: new Date(), updatedAt: new Date() })
    .where(eq(households.id, h.id))
  refresh()
}

export async function updateSettings(formData: FormData) {
  const h = await requireHousehold()
  const lead = Number(formData.get('alertLeadMinutes'))
  const courseStart = String(formData.get('courseStart') ?? h.courseStart)

  await db
    .update(households)
    .set({
      alertLeadMinutes: [5, 10, 15].includes(lead) ? lead : h.alertLeadMinutes,
      courseStart: /^\d{4}-\d{2}-\d{2}$/.test(courseStart) ? courseStart : h.courseStart,
      updatedAt: new Date(),
    })
    .where(eq(households.id, h.id))
  refresh()
}

/**
 * The design's alert-speed chips save on tap, with no submit button. This is
 * deliberately narrower than `updateSettings`, which also writes `courseStart`
 * — driving that from a chip would clobber the course start date.
 */
export async function updateAlertLead(input: { minutes: number }) {
  const h = await requireHousehold()
  if (![5, 10, 15].includes(input.minutes)) {
    throw new Error('Choose 5, 10 or 15 minutes.')
  }
  await db
    .update(households)
    .set({ alertLeadMinutes: input.minutes, updatedAt: new Date() })
    .where(eq(households.id, h.id))
  refresh()
}

export async function updateBand(formData: FormData) {
  const h = await requireHousehold()
  const num = (k: string, fallback: number) => {
    const v = Number(formData.get(k))
    return Number.isFinite(v) && v > 20 && v < 300 ? Math.round(v) : fallback
  }
  await db
    .update(households)
    .set({
      bandSystolicLow: num('bandSystolicLow', h.bandSystolicLow),
      bandSystolicHigh: num('bandSystolicHigh', h.bandSystolicHigh),
      bandDiastolicLow: num('bandDiastolicLow', h.bandDiastolicLow),
      bandDiastolicHigh: num('bandDiastolicHigh', h.bandDiastolicHigh),
      bandConfirmed: formData.get('bandConfirmed') === 'on',
      updatedAt: new Date(),
    })
    .where(eq(households.id, h.id))
  refresh()
}

// ----------------------------------------------------------------- doses ---

/**
 * Re-derive `scheduledTime` for one medicine's doses on one date after its
 * anchor moved — the morning dose was recorded, undone, or retimed, so the
 * evening dose is no longer due when it was.
 *
 * Deliberately NOT exported: this file is `'use server'`, so every export
 * becomes a publicly callable endpoint.
 */
async function restampDependentDoses(
  householdId: string,
  medicineId: string,
  doseDate: string,
) {
  const [medicine] = await db
    .select()
    .from(medicines)
    .where(eq(medicines.id, medicineId))
    .limit(1)
  if (!medicine?.dosingIntervalHours) return

  const slots = await db
    .select()
    .from(doseSlots)
    .where(eq(doseSlots.medicineId, medicineId))
    .orderBy(asc(doseSlots.sortOrder))

  const dayRecords = await db
    .select()
    .from(doseRecords)
    .where(
      and(
        eq(doseRecords.householdId, householdId),
        eq(doseRecords.medicineId, medicineId),
        eq(doseRecords.doseDate, doseDate),
      ),
    )

  for (const record of dayRecords) {
    const due = dueTimeForSlot({ ...medicine, slots }, record.slotKey, dayRecords, doseDate)
    if (!due || due === record.scheduledTime?.slice(0, 5)) continue
    await db
      .update(doseRecords)
      .set({ scheduledTime: due })
      .where(eq(doseRecords.id, record.id))
  }
}

/**
 * Record a routine dose as taken or skipped. Re-sending the status a record
 * already holds clears it — that is the correction path behind "Remove this
 * entry" on the dose card. It is deliberately no longer reachable by tapping
 * a button twice: a recorded dose shows no action buttons at all.
 */
export async function recordDose(
  input: {
    medicineId: string
    slotKey: string
    doseDate: string
    status: 'taken' | 'skipped'
    takenAt?: string | null
    note?: string | null
  },
) {
  const h = await requireHousehold()

  const [medicine] = await db
    .select()
    .from(medicines)
    .where(and(eq(medicines.id, input.medicineId), eq(medicines.householdId, h.id)))
    .limit(1)
  if (!medicine) throw new Error('Medicine not found in this record.')

  const slots = await db
    .select()
    .from(doseSlots)
    .where(eq(doseSlots.medicineId, medicine.id))
    .orderBy(asc(doseSlots.sortOrder))
  const slot = slots.find((s) => s.slotKey === input.slotKey)

  const [existing] = await db
    .select()
    .from(doseRecords)
    .where(
      and(
        eq(doseRecords.householdId, h.id),
        eq(doseRecords.medicineId, medicine.id),
        eq(doseRecords.slotKey, input.slotKey),
        eq(doseRecords.doseDate, input.doseDate),
      ),
    )
    .limit(1)

  /*
   * For an interval medicine the evening dose is due 12 h after the morning
   * one actually went in, so store *that* as the scheduled time. Storing the
   * printed 8:00 pm instead would make an 8:20 pm dose — exactly on target —
   * read as 20 minutes late in the ledger, the on-time score and the report.
   */
  const dayRecords = await db
    .select()
    .from(doseRecords)
    .where(
      and(
        eq(doseRecords.householdId, h.id),
        eq(doseRecords.medicineId, medicine.id),
        eq(doseRecords.doseDate, input.doseDate),
      ),
    )
  const scheduledTime =
    dueTimeForSlot({ ...medicine, slots }, input.slotKey, dayRecords, input.doseDate) ??
    slot?.time ??
    null

  const takenAt = input.takenAt ? new Date(input.takenAt) : new Date()
  if (Number.isNaN(takenAt.getTime())) throw new Error('Choose a valid dose time.')
  if (takenAt.getTime() > Date.now() + 60_000) {
    throw new Error('Dose time cannot be in the future.')
  }

  if (existing) {
    if (existing.status === input.status) {
      await db.delete(doseRecords).where(eq(doseRecords.id, existing.id))
      // Undoing the morning dose removes the anchor, so the evening reverts
      // to its printed reminder time.
      await restampDependentDoses(h.id, medicine.id, input.doseDate)
      refresh()
      return { cleared: true }
    }
    await db
      .update(doseRecords)
      .set({
        status: input.status,
        // A row flipped from skipped to taken keeps a stale stamp otherwise.
        scheduledTime,
        takenAt: input.status === 'taken' ? takenAt : null,
        note: input.note ?? null,
      })
      .where(eq(doseRecords.id, existing.id))
  } else {
    await db.insert(doseRecords).values({
      householdId: h.id,
      medicineId: medicine.id,
      slotKey: input.slotKey,
      doseDate: input.doseDate,
      status: input.status,
      scheduledTime,
      takenAt: input.status === 'taken' ? takenAt : null,
      note: input.note ?? null,
    })
  }

  // This dose may itself be an anchor for a later one.
  await restampDependentDoses(h.id, medicine.id, input.doseDate)
  refresh()
  return { cleared: false }
}

/**
 * Retime a dose that is already recorded as taken — the "Taken at — adjust if
 * logging later" input on the dose card.
 *
 * This cannot go through `recordDose`: re-sending `status: 'taken'` for a row
 * that is already `taken` deletes it, because that is how Undo works. Doing
 * that here would look like correcting the time erased the dose.
 */
export async function setDoseTakenAt(input: {
  medicineId: string
  slotKey: string
  doseDate: string
  time: string
}) {
  const h = await requireHousehold()
  if (!/^\d{2}:\d{2}$/.test(input.time)) throw new Error('Choose a valid dose time.')

  const takenAt = careInstant(input.doseDate, input.time)
  if (Number.isNaN(takenAt.getTime())) throw new Error('Choose a valid dose time.')
  if (takenAt.getTime() > Date.now() + 60_000) {
    throw new Error('Dose time cannot be in the future.')
  }

  const [existing] = await db
    .select()
    .from(doseRecords)
    .where(
      and(
        eq(doseRecords.householdId, h.id),
        eq(doseRecords.medicineId, input.medicineId),
        eq(doseRecords.slotKey, input.slotKey),
        eq(doseRecords.doseDate, input.doseDate),
      ),
    )
    .limit(1)

  if (!existing) throw new Error('Mark the dose as taken before setting a time.')
  if (existing.status !== 'taken') throw new Error('Only a taken dose has a time.')

  await db.update(doseRecords).set({ takenAt }).where(eq(doseRecords.id, existing.id))
  // Moving the morning dose moves what the evening dose is spaced from.
  await restampDependentDoses(h.id, input.medicineId, input.doseDate)
  refresh()
}

/**
 * Remove a caregiver-added medicine.
 *
 * A soft delete, always. `doseRecords.medicineId` cascades on delete, so
 * removing the row would silently erase every dose already logged against it.
 * Archiving hides it from Today and the SOS sheet while `getAllMedicines`
 * keeps history, the report and the Excel export whole.
 */
export async function archiveMedicine(input: { medicineId: string }) {
  const h = await requireHousehold()
  const [medicine] = await db
    .select()
    .from(medicines)
    .where(and(eq(medicines.id, input.medicineId), eq(medicines.householdId, h.id)))
    .limit(1)
  if (!medicine) throw new Error('Medicine not found in this record.')
  if (!medicine.isCustom) {
    throw new Error('Prescribed medicines cannot be removed from the chart.')
  }

  await db
    .update(medicines)
    .set({ archivedAt: new Date() })
    .where(eq(medicines.id, medicine.id))
  refresh()
}

/** SOS doses sit outside the schedule and are always appended, never toggled. */
export async function logSosDose(
  input: { medicineId: string; takenAt?: string | null; note?: string | null },
) {
  const h = await requireHousehold()
  const [medicine] = await db
    .select()
    .from(medicines)
    .where(and(eq(medicines.id, input.medicineId), eq(medicines.householdId, h.id)))
    .limit(1)
  if (!medicine) throw new Error('Medicine not found in this record.')
  if (medicine.kind !== 'sos') throw new Error('That medicine is not an SOS entry.')

  const takenAt = input.takenAt ? new Date(input.takenAt) : new Date()
  if (Number.isNaN(takenAt.getTime())) throw new Error('Choose a valid dose time.')
  if (takenAt.getTime() > Date.now() + 60_000) {
    throw new Error('Dose time cannot be in the future.')
  }

  await db.insert(doseRecords).values({
    householdId: h.id,
    medicineId: medicine.id,
    slotKey: `sos-${takenAt.getTime()}`,
    doseDate: careDate(takenAt),
    status: 'taken',
    takenAt,
    note: input.note ?? null,
  })
  refresh()
}

/**
 * Remove one unscheduled dose log — an SOS dose or a caregiver-added
 * "taken just now" entry.
 *
 * Guarded to those two key shapes on purpose. A scheduled dose has its own
 * correction path behind the dose card's disclosure, and this must never
 * become a second, less careful way to erase one.
 */
export async function deleteDoseLog(recordId: string) {
  const h = await requireHousehold()
  const [record] = await db
    .select()
    .from(doseRecords)
    .where(and(eq(doseRecords.id, recordId), eq(doseRecords.householdId, h.id)))
    .limit(1)
  if (!record) throw new Error('Entry not found in this record.')
  if (!/^(sos|manual)-/.test(record.slotKey)) {
    throw new Error('Scheduled doses are undone from the dose card.')
  }

  await db.delete(doseRecords).where(eq(doseRecords.id, record.id))
  refresh()
}

export async function updateSlotTime(
  input: { slotId: string; time: string },
) {
  const h = await requireHousehold()
  if (!/^\d{2}:\d{2}$/.test(input.time)) throw new Error('Choose a valid dose time.')

  const [row] = await db
    .select({ slotId: doseSlots.id })
    .from(doseSlots)
    .innerJoin(medicines, eq(doseSlots.medicineId, medicines.id))
    .where(and(eq(doseSlots.id, input.slotId), eq(medicines.householdId, h.id)))
    .limit(1)
  if (!row) throw new Error('Reminder slot not found in this record.')

  await db
    .update(doseSlots)
    .set({ time: input.time })
    .where(eq(doseSlots.id, input.slotId))
  refresh()
}

/** Caregiver-added medicine — clearly flagged as not from the prescription. */
export async function addCustomMedicine(formData: FormData) {
  const h = await requireHousehold()
  const brand = String(formData.get('brand') ?? '').trim()
  const strength = String(formData.get('strength') ?? '').trim()
  const form = String(formData.get('form') ?? '').trim()
  const dose =
    String(formData.get('dose') ?? '').trim() ||
    [strength, form].filter(Boolean).join(' · ')
  const note = String(formData.get('notes') ?? '').trim() || null
  const action = formData.get('action') === 'taken' ? 'taken' : 'add'
  const frequency = Math.min(3, Math.max(1, Number(formData.get('frequency')) || 1))
  const courseDaysRaw = Number(formData.get('courseDays'))
  const courseDays =
    Number.isFinite(courseDaysRaw) && courseDaysRaw > 0
      ? Math.min(365, Math.round(courseDaysRaw))
      : null
  const legacyTime = String(formData.get('time') ?? '').trim()
  const times = [1, 2, 3]
    .slice(0, frequency)
    .map((i) => String(formData.get(`time${i}`) ?? '').trim())
    .filter((time) => /^\d{2}:\d{2}$/.test(time))
  if (!times.length && /^\d{2}:\d{2}$/.test(legacyTime)) times.push(legacyTime)
  if (!brand) throw new Error('Enter the medicine name.')

  const catalogId = `custom-${Date.now()}`
  const [med] = await db
    .insert(medicines)
    .values({
      householdId: h.id,
      catalogId,
      brand,
      dose: dose || 'Dose not recorded',
      form: form || null,
      courseDays,
      kind: times.length ? 'routine' : 'sos',
      sosStatus: times.length ? null : 'previous',
      tone: 'recovery',
      isCustom: true,
      sortOrder: 900,
      instruction:
        'This entry was added by a caregiver. Verify the strip and prescription before every dose.',
      doctorNote: 'Caregiver record only. A missing entry does not prove a missed dose.',
      prescribedAt: 'Added by caregiver',
    })
    .returning()

  if (times.length) {
    await db.insert(doseSlots).values(
      times.map((time, index) => ({
        medicineId: med.id,
        slotKey: `dose-${index + 1}`,
        time,
        label: `Caregiver reminder ${index + 1}`,
        sortOrder: index,
      })),
    )
  }

  if (action === 'taken') {
    const takenAt = new Date()
    await db.insert(doseRecords).values({
      householdId: h.id,
      medicineId: med.id,
      slotKey: `manual-${takenAt.getTime()}`,
      doseDate: careDate(takenAt),
      status: 'taken',
      takenAt,
      note,
    })
  }
  refresh()
  return { medicineId: med.id, logged: action === 'taken' }
}

// ------------------------------------------------------------------- bp ----

export async function logBp(formData: FormData) {
  const h = await requireHousehold()
  const systolic = Number(formData.get('systolic'))
  const diastolic = Number(formData.get('diastolic'))
  const pulseRaw = formData.get('pulse')
  const pulse = pulseRaw ? Number(pulseRaw) : null
  const symptomTags = formData
    .getAll('symptom')
    .map(String)
    .map((value) => value.trim())
    .filter(Boolean)
  const symptoms =
    symptomTags.join(', ') ||
    String(formData.get('symptoms') ?? '').trim() ||
    null
  const context = String(formData.get('context') ?? '').trim() || null
  const position = String(formData.get('position') ?? '').trim() || null
  const arm = String(formData.get('arm') ?? '').trim() || null
  const requestedPairId = String(formData.get('pairId') ?? '').trim()
  const continuePair = formData.get('mode') === 'pair'
  const pairId = requestedPairId || (continuePair ? crypto.randomUUID() : null)
  const measuredAtRaw = String(formData.get('measuredAt') ?? '')

  if (!Number.isFinite(systolic) || systolic < 50 || systolic > 260) {
    throw new Error('Enter a systolic reading between 50 and 260.')
  }
  if (!Number.isFinite(diastolic) || diastolic < 30 || diastolic > 180) {
    throw new Error('Enter a diastolic reading between 30 and 180.')
  }

  const measuredAt = measuredAtRaw ? new Date(measuredAtRaw) : new Date()
  if (Number.isNaN(measuredAt.getTime())) throw new Error('Choose a valid time.')
  if (measuredAt.getTime() > Date.now() + 60_000) {
    throw new Error('Reading time cannot be in the future.')
  }

  const [reading] = await db
    .insert(bpReadings)
    .values({
      householdId: h.id,
      systolic: Math.round(systolic),
      diastolic: Math.round(diastolic),
      pulse: pulse && Number.isFinite(pulse) ? Math.round(pulse) : null,
      symptoms,
      context,
      position,
      arm,
      pairId,
      measuredAt,
    })
    .returning({
      id: bpReadings.id,
      systolic: bpReadings.systolic,
      diastolic: bpReadings.diastolic,
    })
  refresh()
  const level: 'severe' | 'low' | 'high' | 'range' =
    systolic > 180 || diastolic > 120
      ? 'severe'
      : systolic < h.bandSystolicLow || diastolic < h.bandDiastolicLow
        ? 'low'
        : systolic >= h.bandSystolicHigh || diastolic >= h.bandDiastolicHigh
          ? 'high'
          : 'range'

  return {
    reading,
    pairId: continuePair ? pairId : null,
    level,
  }
}

export async function deleteBp(id: string) {
  const h = await requireHousehold()
  await db
    .delete(bpReadings)
    .where(and(eq(bpReadings.id, id), eq(bpReadings.householdId, h.id)))
  refresh()
}

// -------------------------------------------------------- recovery logs ----

export async function logSeizure(formData: FormData) {
  const h = await requireHousehold()
  const duration = Number(formData.get('durationMinutes'))
  const recovery = Number(formData.get('recoveryMinutes'))
  const description = String(formData.get('description') ?? '').trim()
  const occurredAtRaw = String(formData.get('occurredAt') ?? '')

  const occurredAt = occurredAtRaw ? new Date(occurredAtRaw) : new Date()
  if (Number.isNaN(occurredAt.getTime())) throw new Error('Choose a valid time.')

  await db.insert(seizureEvents).values({
    householdId: h.id,
    occurredAt,
    durationMinutes: Number.isFinite(duration) ? Math.round(duration) : null,
    recoveryMinutes: Number.isFinite(recovery) ? Math.round(recovery) : null,
    description: description || null,
  })
  refresh()
}

export async function deleteSeizure(id: string) {
  const h = await requireHousehold()
  await db
    .delete(seizureEvents)
    .where(and(eq(seizureEvents.id, id), eq(seizureEvents.householdId, h.id)))
  refresh()
}

export async function addCareNote(formData: FormData) {
  const h = await requireHousehold()
  const body = String(formData.get('body') ?? '').trim()
  if (!body) throw new Error('Write something before saving the note.')
  await db.insert(careNotes).values({ householdId: h.id, body })
  refresh()
}

export async function deleteCareNote(id: string) {
  const h = await requireHousehold()
  await db
    .delete(careNotes)
    .where(and(eq(careNotes.id, id), eq(careNotes.householdId, h.id)))
  refresh()
}
