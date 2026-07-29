-- Add Centnil T as a current SOS medicine for blood pressure.
--
-- No schema change. lib/catalog.ts is only inserted by createHousehold(), which
-- runs once when a record is first created, so a catalogue entry alone reaches
-- new records and never the one already deployed. Same situation as 0002's
-- twelve-hour backfill, and the same remedy.
--
-- sort_order continues past whatever the household already has, so the new row
-- lands at the end of the SOS list rather than displacing Napra-D. The unique
-- index on (household_id, catalog_id) makes the insert idempotent — re-running
-- this migration, or running it against a record seeded after the catalogue
-- change, is a no-op.
--
-- Strength, the reading that triggers a dose, the minimum gap and the daily
-- maximum were not recorded when this was added; the `verify` text below is
-- what the app shows the caregiver about that, and must not be dropped.
INSERT INTO "medicines" (
  "household_id", "catalog_id", "brand", "generic", "dose", "form", "purpose",
  "prescription", "prescription_hi", "course_days", "tone", "kind",
  "sos_status", "symptom", "food", "prescribed_at", "doctor_note",
  "instruction", "caution", "verify", "sort_order", "is_custom"
)
SELECT
  h."id",
  'centnil-t',
  'Centnil T',
  'Blood-pressure tablet · composition not captured',
  '1 tablet · strength not printed',
  'Tablet',
  'SOS use for a high blood-pressure reading',
  'SOS only · confirm the triggering reading before giving',
  'केवल SOS · देने से पहले रीडिंग की पुष्टि करें',
  NULL,
  'bp',
  'sos',
  'current',
  'High blood pressure',
  'Food timing was not captured. Ask the treating team whether it should be given with or after food.',
  'Added by caregiver · not transcribed from the 28 July sheet',
  'The strength, the reading that triggers a dose, the minimum gap and the daily maximum were not recorded when this was added.',
  'Take a blood-pressure reading first and log it, so the reading that prompted the dose sits beside it in the record. Log the dose only after it was actually given.',
  'Do not repeat without the treating team’s advice, and do not combine with another blood-pressure tablet unless they have said to. Urgent review for chest pain, breathlessness, one-sided weakness, slurred speech, a severe headache or fainting.',
  'Confirm the strength, the blood-pressure reading that triggers a dose, the minimum gap and the maximum tablets in 24 hours with the treating team.',
  COALESCE((SELECT MAX(m."sort_order") + 1 FROM "medicines" m WHERE m."household_id" = h."id"), 0),
  false
FROM "households" h
ON CONFLICT ("household_id", "catalog_id") DO NOTHING;
