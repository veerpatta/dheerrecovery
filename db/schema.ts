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
    /**
     * Weight, in grams for the same reason every blood-pressure column is an
     * integer: drizzle hands `numeric` back as a JS string, and lib/weight.ts
     * does arithmetic on these on every render.
     *
     * The baseline is the 15 September 2026 sheet's recorded weight, and is a
     * column rather than a constant because a doctor can re-baseline it. The
     * band is a home reference range, editable only on the treating doctor's
     * instruction — the same stance as the blood-pressure band above. The name
     * is `weight_band_confirmed` rather than matching `band_confirmed`
     * deliberately: renaming a live column is not worth the symmetry.
     */
    weightBaselineGrams: integer('weight_baseline_grams').notNull().default(91000),
    bandWeightLowGrams: integer('band_weight_low_grams').notNull().default(86500),
    bandWeightHighGrams: integer('band_weight_high_grams').notNull().default(95000),
    weightBandConfirmed: boolean('weight_band_confirmed').notNull().default(false),
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
    /**
     * Hours the prescription expects between consecutive doses of this
     * medicine — 12 for the anti-seizure pair. When set, a later slot's due
     * time is derived from when the previous dose was actually taken, so an
     * 8:20 am morning dose moves the evening dose to 8:20 pm.
     */
    dosingIntervalHours: integer('dosing_interval_hours'),
    repeatableLog: boolean('repeatable_log').notNull().default(false),
    /*
     * Which days this medicine is actually due on. All three are absent on the
     * 28 July prescription, whose medicines are simply due every day forever —
     * so every column here is nullable or defaulted, and a row that says
     * nothing means exactly that. A caregiver-added medicine inherits the same
     * silence, which is the right default for one.
     *
     * `courseDays` above is not usable for this: it is display-only, and the
     * chemoradiation course starts on 15 September while `households
     * .courseStart` is 28 July, so a start-plus-days window would land in the
     * wrong place. Explicit dates.
     */
    courseStartDate: date('course_start_date'),
    courseEndDate: date('course_end_date'),
    /**
     * ISO-8601 weekdays, comma-joined: Monday = 1 … Sunday = 7. NULL is every
     * day. Septran DS is '1,4'. Note `Date.getDay()` is Sunday = 0 and would
     * ship it on the wrong day — use `weekdayOf()` in lib/time.ts.
     */
    weekdays: text('weekdays'),
    /** Scheduled only on a date answered "yes" in `care_days`. */
    therapyOnly: boolean('therapy_only').notNull().default(false),
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

/**
 * One row per care-date, for facts about the day rather than about a dose.
 *
 * Today it holds one: whether there was radiation therapy, which decides
 * whether the temozolomide capsule is on the schedule at all. `therapy` is
 * nullable and a missing row is equivalent to a null one — both mean "nobody
 * has answered yet", never an inferred "no". That is the same stance
 * `dose_records` takes, and for the same reason.
 *
 * This is a table rather than a sentinel `dose_records` row because a therapy
 * answer is not about a medicine: `dose_records.medicine_id` is NOT NULL with
 * a foreign key, its `status` is 'taken' | 'skipped', and a sentinel would
 * need a fourth `slot_key` namespace beside the three that two regexes in the
 * app already depend on.
 */
export const careDays = pgTable(
  'care_days',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    careDate: date('care_date').notNull(),
    therapy: boolean('therapy'),
    answeredAt: timestamp('answered_at', { withTimezone: true }),
    /** e.g. "RT postponed, machine down" — printed beside a "no" in the report. */
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex('care_days_household_date_idx').on(t.householdId, t.careDate)],
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

/**
 * Home weight readings. Deliberately not a copy of `bp_readings`: there is no
 * `pair_id`, `position`, `arm`, `symptoms` or `pulse`, because a weight has no
 * second reading a minute later and is not measured on an arm.
 */
export const weightReadings = pgTable(
  'weight_readings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    /**
     * 88.6 kg is stored as 88600. Integer for the same reason every BP column
     * is: drizzle returns `numeric` as a string, and lib/weight.ts would then
     * be doing arithmetic on strings on every render.
     */
    grams: integer('grams').notNull(),
    /** A weight means a different thing before breakfast than after therapy. */
    context: text('context'),
    note: text('note'),
    measuredAt: timestamp('measured_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('weight_readings_household_measured_idx').on(t.householdId, t.measuredAt),
  ],
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
export type CareDay = typeof careDays.$inferSelect
export type BpReading = typeof bpReadings.$inferSelect
export type WeightReading = typeof weightReadings.$inferSelect
export type SeizureEvent = typeof seizureEvents.$inferSelect
export type CareNote = typeof careNotes.$inferSelect
