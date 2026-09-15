/**
 * Derived views over the dose ledger: the dose map, the on-time score, perfect
 * days and salt intake.
 *
 * Pure and free of `server-only` so the history page, the printed report and
 * the Excel export can all share one pass over the same grid — these five
 * widgets otherwise rebuild the identical 14x7 matrix five times.
 */
import type { DoseRecord } from '@/db/schema'
import { SALTS } from './catalog'
import {
  buildDaySchedule,
  type DayScheduleOptions,
  type DoseStatus,
  type MedicineWithSlots,
} from './queries'
import { therapyQuestionApplies } from './schedule'
import { driftMinutes } from './time'

export interface MatrixCell {
  medicineId: string
  catalogId: string
  brand: string
  slotKey: string
  time: string
  label: string
  status: DoseStatus
  record: DoseRecord | null
  /** False when the slot is only here because a dose was recorded on it. */
  applies: boolean
  /** Slot ordering within its medicine, so the map can build stable columns. */
  sortOrder: number
  medicineSortOrder: number
}

export interface MatrixDay {
  isoDate: string
  cells: MatrixCell[]
  /** true / false / null when nobody has answered. */
  therapy: boolean | null
  /**
   * A therapy-gated medicine applied to this date but the day was never
   * answered — so the day is not finished, however many cells read taken.
   */
  therapyPending: boolean
}

/**
 * One row per date, one cell per scheduled slot. `dates` is expected
 * newest-first, which is how the history page lists them.
 */
export function buildDoseMatrix(
  meds: MedicineWithSlots[],
  records: DoseRecord[],
  dates: string[],
  options: DayScheduleOptions,
): MatrixDay[] {
  return dates.map((isoDate) => {
    const answered = options.therapyDays.has(isoDate)
    return {
      isoDate,
      therapy: answered ? (options.therapyDays.get(isoDate) ?? null) : null,
      therapyPending: !answered && therapyQuestionApplies(meds, isoDate),
      cells: buildDaySchedule(meds, records, isoDate, options).map((d) => ({
        medicineId: d.medicine.id,
        catalogId: d.medicine.catalogId,
        brand: d.medicine.brand,
        slotKey: d.slotKey,
        time: d.time,
        label: d.label,
        status: d.status,
        record: d.record,
        applies: d.applies,
        sortOrder:
          d.medicine.slots.find((s) => s.slotKey === d.slotKey)?.sortOrder ?? 0,
        medicineSortOrder: d.medicine.sortOrder,
      })),
    }
  })
}

export interface MatrixColumn {
  medicineId: string
  slotKey: string
  brand: string
  label: string
}

/**
 * A stable column set for the dose map — the union of every slot seen across
 * the range.
 *
 * Without this the map stops being a grid the moment a medicine is scheduled
 * conditionally: a Monday row carries eleven cells and a Sunday nine, so the
 * third cell means a different medicine on every line and the heatmap reads as
 * noise with nothing on screen saying so.
 *
 * Ordered by medicine then slot `sortOrder`, deliberately not by due time —
 * the twelve-hour chain moves an evening dose whenever the morning one lands
 * late, and columns that reshuffle with it would be worse than no columns.
 */
export function matrixColumns(matrix: MatrixDay[]): MatrixColumn[] {
  const seen = new Map<string, MatrixColumn & { a: number; b: number }>()
  for (const day of matrix) {
    for (const c of day.cells) {
      const key = `${c.medicineId}::${c.slotKey}`
      if (seen.has(key)) continue
      seen.set(key, {
        medicineId: c.medicineId,
        slotKey: c.slotKey,
        brand: c.brand,
        label: c.label,
        a: c.medicineSortOrder,
        b: c.sortOrder,
      })
    }
  }
  return [...seen.values()]
    .sort((x, y) => x.a - y.a || x.b - y.b)
    .map(({ medicineId, slotKey, brand, label }) => ({
      medicineId,
      slotKey,
      brand,
      label,
    }))
}

/** The cell for one column on one day, or null where it was not scheduled. */
export function cellAt(day: MatrixDay, col: MatrixColumn): MatrixCell | null {
  return (
    day.cells.find(
      (c) => c.medicineId === col.medicineId && c.slotKey === col.slotKey,
    ) ?? null
  )
}

export interface MatrixTotals {
  taken: number
  skipped: number
  notRecorded: number
  upcoming: number
  /** Slots whose time has passed — the honest denominator for completion. */
  past: number
  completion: number
}

export function totals(matrix: MatrixDay[]): MatrixTotals {
  let taken = 0
  let skipped = 0
  let notRecorded = 0
  let upcoming = 0

  for (const day of matrix) {
    for (const cell of day.cells) {
      if (cell.status === 'taken') taken++
      else if (cell.status === 'skipped') skipped++
      else if (cell.status === 'not-recorded') notRecorded++
      else upcoming++
    }
  }

  const past = taken + skipped + notRecorded
  return {
    taken,
    skipped,
    notRecorded,
    upcoming,
    past,
    completion: past ? Math.round((taken / past) * 100) : 0,
  }
}

/**
 * Mean absolute gap between the reminder time and when the dose was actually
 * recorded. `null` until at least one taken dose carries both times.
 */
export function onTimeScore(matrix: MatrixDay[]): number | null {
  let total = 0
  let n = 0
  for (const day of matrix) {
    for (const cell of day.cells) {
      const r = cell.record
      if (r?.status !== 'taken' || !r.takenAt || !r.scheduledTime) continue
      total += Math.abs(driftMinutes(day.isoDate, r.scheduledTime, new Date(r.takenAt)))
      n++
    }
  }
  return n ? Math.round(total / n) : null
}

/**
 * Days where every scheduled slot was recorded taken.
 *
 * A day nobody answered the therapy question on cannot be perfect however many
 * cells read taken: the capsule is not absent, it is unknown, and calling that
 * day finished is the same mistake as calling a missing entry a missed dose.
 */
export function perfectDays(matrix: MatrixDay[]): number {
  return matrix.filter(
    (day) =>
      day.cells.length > 0 &&
      !day.therapyPending &&
      day.cells.every((c) => c.status === 'taken'),
  ).length
}

export interface IntakeCard {
  medicineId: string
  brand: string
  tone: string
  taken: number
  expected: number
  percent: number
  salts: { name: string; mg: number; total: number }[]
}

/**
 * Salt totals from doses actually recorded as taken.
 *
 * `expected` excludes upcoming slots — counting tonight's un-due dose as
 * missed would make every afternoon look like non-adherence.
 */
export function intakeTotals(
  meds: MedicineWithSlots[],
  matrix: MatrixDay[],
): IntakeCard[] {
  const counts = new Map<string, { taken: number; expected: number }>()
  for (const day of matrix) {
    for (const cell of day.cells) {
      const entry = counts.get(cell.medicineId) ?? { taken: 0, expected: 0 }
      if (cell.status !== 'upcoming') {
        entry.expected++
        if (cell.status === 'taken') entry.taken++
      }
      counts.set(cell.medicineId, entry)
    }
  }

  return meds
    .filter((m) => m.kind === 'routine' && counts.has(m.id))
    .map((m) => {
      const { taken, expected } = counts.get(m.id)!
      return {
        medicineId: m.id,
        brand: m.brand,
        tone: m.tone,
        taken,
        expected,
        percent: expected ? Math.round((taken / expected) * 100) : 0,
        salts: (SALTS[m.catalogId] ?? []).map((s) => ({
          ...s,
          total: s.mg * taken,
        })),
      }
    })
}
