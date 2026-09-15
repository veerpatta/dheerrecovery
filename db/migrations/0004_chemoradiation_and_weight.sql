CREATE TABLE "care_days" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"care_date" date NOT NULL,
	"therapy" boolean,
	"answered_at" timestamp with time zone,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weight_readings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"grams" integer NOT NULL,
	"context" text,
	"note" text,
	"measured_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "households" ADD COLUMN "weight_baseline_grams" integer DEFAULT 91000 NOT NULL;--> statement-breakpoint
ALTER TABLE "households" ADD COLUMN "band_weight_low_grams" integer DEFAULT 86500 NOT NULL;--> statement-breakpoint
ALTER TABLE "households" ADD COLUMN "band_weight_high_grams" integer DEFAULT 95000 NOT NULL;--> statement-breakpoint
ALTER TABLE "households" ADD COLUMN "weight_band_confirmed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "medicines" ADD COLUMN "course_start_date" date;--> statement-breakpoint
ALTER TABLE "medicines" ADD COLUMN "course_end_date" date;--> statement-breakpoint
ALTER TABLE "medicines" ADD COLUMN "weekdays" text;--> statement-breakpoint
ALTER TABLE "medicines" ADD COLUMN "therapy_only" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "care_days" ADD CONSTRAINT "care_days_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weight_readings" ADD CONSTRAINT "weight_readings_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "care_days_household_date_idx" ON "care_days" USING btree ("household_id","care_date");--> statement-breakpoint
CREATE INDEX "weight_readings_household_measured_idx" ON "weight_readings" USING btree ("household_id","measured_at");--> statement-breakpoint
-- Chemoradiation medicines from the Geetanjali Cancer Centre sheet dated
-- 15 September 2026 (Dr Ankit Agarwal), for the 42-day course 15 Sep - 26 Oct.
--
-- lib/catalog.ts is only read by createHousehold(), which runs once when a
-- record is first created, so a catalogue entry alone reaches new records and
-- never the one already deployed. Same situation as 0002 and 0003, same remedy.
--
-- sort_order is literal 10/11/12 rather than 0003's MAX+1: these are routine
-- medicines joining a chart with a meaningful order, and 10-12 is clear of the
-- seeded 0-9 and of addCustomMedicine's 900. The unique index on
-- (household_id, catalog_id) makes every insert here idempotent.
--
-- Anything the sheet does not print is a question in `verify`, never a
-- statement in `caution`. The sheet prints no clock time for any of the three;
-- the reminder times in the slot insert below are a caregiver organiser and
-- stay editable in Settings.
INSERT INTO "medicines" (
  "household_id", "catalog_id", "brand", "generic", "dose", "form", "purpose",
  "prescription", "prescription_hi", "course_days", "course_start_date",
  "course_end_date", "weekdays", "therapy_only", "tone", "kind", "food",
  "prescribed_at", "doctor_note", "instruction", "caution", "verify",
  "sort_order", "is_custom"
)
SELECT
  h."id",
  'temozolomide',
  'Temozolomide 140 mg',
  'Temozolomide · dispensed as 100 mg + 40 mg',
  '140 mg · 100 mg capsule + 40 mg capsule',
  'Capsule',
  'Chemotherapy given alongside the radiotherapy course',
  'Once daily on a radiotherapy day · 42 days · with RT',
  'रेडियोथेरेपी वाले दिन रोज़ 1 बार · 42 दिन · RT के साथ',
  42,
  '2026-09-15',
  '2026-10-26',
  NULL,
  true,
  'chemo',
  'routine',
  'Food timing is not printed on the 15 September sheet.',
  'Geetanjali Cancer Centre · 15 Sep 2026',
  'Rx: Cap. Temozolomide 140 mg OD 42 days with RT (100+40). Review after 7 days with CBC, S. creatinine, SGPT.',
  'Two capsules make up the 140 mg dose — 100 mg and 40 mg together. Give only on a day radiotherapy is actually going ahead, and log it after it was swallowed.',
  'This is chemotherapy and it lowers blood counts. Urgent advice for fever, chills, a sore throat, mouth ulcers, unusual bruising or bleeding, or persistent vomiting that stops the dose staying down. Do not double up for a missed day.',
  'Confirm the 100 mg + 40 mg capsule pairing, whether the capsule is swallowed whole or may be opened, the empty-stomach gap before radiotherapy, and what to do on a day radiotherapy is cancelled.',
  10,
  false
FROM "households" h
ON CONFLICT ("household_id", "catalog_id") DO NOTHING;--> statement-breakpoint
INSERT INTO "medicines" (
  "household_id", "catalog_id", "brand", "generic", "dose", "form", "purpose",
  "prescription", "prescription_hi", "course_days", "course_start_date",
  "course_end_date", "weekdays", "therapy_only", "tone", "kind", "food",
  "prescribed_at", "doctor_note", "instruction", "caution", "verify",
  "sort_order", "is_custom"
)
SELECT
  h."id",
  'perinorm',
  'Perinorm 10',
  'Metoclopramide 10 mg',
  '1 tablet · 10 mg',
  'Tablet',
  'Prevents and settles nausea and vomiting during the course',
  'Twice daily · morning and night · 42 days',
  'दिन में 2 बार · सुबह और रात · 42 दिन',
  42,
  '2026-09-15',
  '2026-10-26',
  NULL,
  false,
  'comfort',
  'routine',
  'Commonly taken before food so it is working by the time the capsule is given; the 15 September sheet does not print a food rule. Confirm the gap with the treating team.',
  'Geetanjali Cancer Centre · 15 Sep 2026',
  'Rx: T. Perinorm (10) 1–0–1.',
  'Given every day of the 42, whether or not there is radiotherapy that day.',
  'Can cause restlessness, muscle stiffness or unusual movements of the face, neck or eyes. Stop and seek advice the same day if any of those appear. Also causes drowsiness.',
  'Confirm how many days in a row Perinorm should be continued, and whether it should be taken before food and how long before the capsule.',
  11,
  false
FROM "households" h
ON CONFLICT ("household_id", "catalog_id") DO NOTHING;--> statement-breakpoint
INSERT INTO "medicines" (
  "household_id", "catalog_id", "brand", "generic", "dose", "form", "purpose",
  "prescription", "prescription_hi", "course_days", "course_start_date",
  "course_end_date", "weekdays", "therapy_only", "tone", "kind", "food",
  "prescribed_at", "doctor_note", "instruction", "caution", "verify",
  "sort_order", "is_custom"
)
SELECT
  h."id",
  'septran-ds',
  'Septran DS',
  'Sulfamethoxazole 800 mg + trimethoprim 160 mg',
  '1 tablet · 800 mg + 160 mg',
  'Double-strength tablet',
  'Prevents a chest infection while the blood counts are low during chemoradiation',
  'Twice daily · Mondays and Thursdays only · 42 days',
  'दिन में 2 बार · केवल सोमवार और गुरुवार · 42 दिन',
  42,
  '2026-09-15',
  '2026-10-26',
  '1,4',
  false,
  'recovery',
  'routine',
  'Take with food and a full glass of water. The 15 September sheet does not print a food rule; this is the usual advice for the tablet and should be confirmed.',
  'Geetanjali Cancer Centre · 15 Sep 2026',
  'Rx: T. Septran-DS 1–0–1 (Mon / Thursday).',
  'Only on Mondays and Thursdays — not the other five days. Both tablets are given on each of those two days.',
  'This is a sulfa medicine. Stop and seek advice the same day for any rash, mouth ulcers, or peeling skin. Keep fluids up.',
  'The sheet prints "Septran-DS" without a strength. Confirm the tablet is the 800 mg + 160 mg double-strength one, and confirm the Monday and Thursday pattern.',
  12,
  false
FROM "households" h
ON CONFLICT ("household_id", "catalog_id") DO NOTHING;--> statement-breakpoint
-- The slots. dose_slots carries no household_id, so it joins through
-- medicine_id, and the VALUES literals are `unknown` and need the ::time cast.
-- Selecting FROM medicines also makes this correct for a household seeded
-- after the catalogue change, where createHousehold already wrote both rows —
-- the ON CONFLICT absorbs it. That is what lets the migration and the
-- catalogue ship together.
INSERT INTO "dose_slots" ("medicine_id", "slot_key", "time", "label", "sort_order")
SELECT m."id", v."slot_key", v."time"::time, v."label", v."sort_order"
FROM "medicines" m
JOIN (VALUES
  ('temozolomide', 'am', '07:55', 'Therapy day · about 1 hour before radiotherapy', 0),
  ('perinorm',     'am', '07:30', 'Morning · about 30 minutes before the capsule', 0),
  ('perinorm',     'pm', '21:00', 'Night', 1),
  ('septran-ds',   'am', '08:00', 'Monday & Thursday · morning', 0),
  ('septran-ds',   'pm', '20:00', 'Monday & Thursday · evening', 1)
) AS v("catalog_id", "slot_key", "time", "label", "sort_order")
  ON v."catalog_id" = m."catalog_id"
ON CONFLICT ("medicine_id", "slot_key") DO NOTHING;--> statement-breakpoint
-- Three new medicines, one of them cytotoxic. That is exactly what the verify
-- banner exists for, so the record is asked to confirm the chart once more.
UPDATE "households" SET "rx_verified_at" = NULL;
