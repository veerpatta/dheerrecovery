import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  date,
  time,
  uuid,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

/**
 * A household = one caregiver circle sharing one private care code.
 * There is no login: the care code in the URL is the credential.
 */
export const households = pgTable(
  'households',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    careCode: text('care_code').notNull(),
    patientName: text('patient_name').notNull().default('Dheer'),
    prescriptionVersion: text('prescription_version')
      .notNull()
      .default('paras-ajit-singh-2026-07-28'),
    prescriptionDate: date('prescription_date').notNull().default('2026-07-28'),
    prescriberName: text('prescriber_name').notNull().default('Dr Ajit Singh'),
    courseStart: date('course_start').notNull().default('2026-07-28'),
    rxVerifiedAt: timestamp('rx_verified_at', { withTimezone: true }),
    alertLeadMinutes: integer('alert_lead_minutes').notNull().default(10),
    // Home reference band, editable only on the treating doctor's instruction.
    bandSystolicLow: integer('band_systolic_low').notNull().default(90),
    bandSystolicHigh: integer('band_systolic_high').notNull().default(135),
    bandDiastolicLow: integer('band_diastolic_low').notNull().default(60),
    bandDiastolicHigh: integer('band_diastolic_high').notNull().default(85),
    bandConfirmed: boolean('band_confirmed').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex('households_care_code_idx').on(t.careCode)],
)

export const medicines = pgTable(
  'medicines',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    catalogId: text('catalog_id').notNull(),
    brand: text('brand').notNull(),
    generic: text('generic'),
    dose: text('dose').notNull(),
    form: text('form'),
    purpose: text('purpose'),
    prescription: text('prescription'),
    prescriptionHi: text('prescription_hi'),
    courseDays: integer('course_days'),
    tone: text('tone').notNull().default('recovery'),
    /** 'routine' | 'sos' */
    kind: text('kind').notNull().default('routine'),
    /** 'current' | 'previous' | 'supportive' — SOS permission status */
    sosStatus: text('sos_status'),
    symptom: text('symptom'),
    repeatableLog: boolean('repeatable_log').notNull().default(false),
    food: text('food'),
    prescribedAt: text('prescribed_at'),
    doctorNote: text('doctor_note'),
    instruction: text('instruction'),
    caution: text('caution'),
    verify: text('verify'),
    sortOrder: integer('sort_order').notNull().default(0),
    isCustom: boolean('is_custom').notNull().default(false),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (t) => [
    index('medicines_household_idx').on(t.householdId),
    uniqueIndex('medicines_household_catalog_idx').on(t.householdId, t.catalogId),
  ],
)

/** One scheduled reminder slot per medicine per day (am / pm / night...). */
export const doseSlots = pgTable(
  'dose_slots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    medicineId: uuid('medicine_id')
      .notNull()
      .references(() => medicines.id, { onDelete: 'cascade' }),
    slotKey: text('slot_key').notNull(),
    /** Caregiver-editable reminder clock time. */
    time: time('time').notNull(),
    /** Printed wording from the prescription — never rewritten by an edit. */
    label: text('label').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [
    index('dose_slots_medicine_idx').on(t.medicineId),
    uniqueIndex('dose_slots_medicine_slot_idx').on(t.medicineId, t.slotKey),
  ],
)

/** One row per Taken / Skipped tap. Absence of a row means "not recorded". */
export const doseRecords = pgTable(
  'dose_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    medicineId: uuid('medicine_id')
      .notNull()
      .references(() => medicines.id, { onDelete: 'cascade' }),
    slotKey: text('slot_key').notNull(),
    doseDate: date('dose_date').notNull(),
    /** 'taken' | 'skipped' */
    status: text('status').notNull(),
    /** The reminder time this record was measured against. */
    scheduledTime: time('scheduled_time'),
    /** When the dose was actually taken, as entered by the caregiver. */
    takenAt: timestamp('taken_at', { withTimezone: true }),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('dose_records_household_date_idx').on(t.householdId, t.doseDate),
    index('dose_records_medicine_idx').on(t.medicineId),
  ],
)

export const bpReadings = pgTable(
  'bp_readings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    systolic: integer('systolic').notNull(),
    diastolic: integer('diastolic').notNull(),
    pulse: integer('pulse'),
    /** Free-text symptom tags recorded alongside the reading. */
    symptoms: text('symptoms'),
    /** Context captured by the original quick-BP workflow. */
    context: text('context'),
    position: text('position'),
    arm: text('arm'),
    /** Shared identifier for two readings taken as one home-BP session. */
    pairId: text('pair_id'),
    measuredAt: timestamp('measured_at', { withTimezone: true }).notNull(),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('bp_readings_household_measured_idx').on(t.householdId, t.measuredAt)],
)

export const seizureEvents = pgTable(
  'seizure_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    durationMinutes: integer('duration_minutes'),
    recoveryMinutes: integer('recovery_minutes'),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('seizure_events_household_idx').on(t.householdId, t.occurredAt)],
)

export const careNotes = pgTable(
  'care_notes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('care_notes_household_idx').on(t.householdId, t.createdAt)],
)

export type Household = typeof households.$inferSelect
export type Medicine = typeof medicines.$inferSelect
export type DoseSlot = typeof doseSlots.$inferSelect
export type DoseRecord = typeof doseRecords.$inferSelect
export type BpReading = typeof bpReadings.$inferSelect
export type SeizureEvent = typeof seizureEvents.$inferSelect
export type CareNote = typeof careNotes.$inferSelect
