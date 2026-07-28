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
import { buildDaySchedule, type DoseStatus, type MedicineWithSlots } from './queries'
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
}

export interface MatrixDay {
  isoDate: string
  cells: MatrixCell[]
}

/**
 * One row per date, one cell per scheduled slot. `dates` is expected
 * newest-first, which is how the history page lists them.
 */
export function buildDoseMatrix(
  meds: MedicineWithSlots[],
  records: DoseRecord[],
  dates: string[],
  now: Date = new Date(),
): MatrixDay[] {
  return dates.map((isoDate) => ({
    isoDate,
    cells: buildDaySchedule(meds, records, isoDate, now).map((d) => ({
      medicineId: d.medicine.id,
      catalogId: d.medicine.catalogId,
      brand: d.medicine.brand,
      slotKey: d.slotKey,
      time: d.time,
      label: d.label,
      status: d.status,
      record: d.record,
    })),
  }))
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

/** Days where every scheduled slot was recorded taken. */
export function perfectDays(matrix: MatrixDay[]): number {
  return matrix.filter(
    (day) => day.cells.length > 0 && day.cells.every((c) => c.status === 'taken'),
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
