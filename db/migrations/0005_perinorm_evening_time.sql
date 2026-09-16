-- Perinorm's second tablet is given at 6 pm, before dinner — not at 9 pm.
--
-- No schema change. 0004 seeded the slot at 21:00 with the label "Night",
-- which was the organiser's guess at "1–0–1"; the caregiver has since said
-- when the tablet is actually taken. The 15 September sheet prints no clock
-- time for Perinorm, so this is the reminder doing what lib/catalog.ts:5-8
-- says reminder times are for, not a change to the prescription. The
-- `prescription` text stays as transcribed.
--
-- Matched on the seeded value rather than blanket-updated, so a reminder a
-- caregiver has already moved somewhere else is left alone. A migration runs
-- once, but the guard costs nothing and says what this is for.
UPDATE "dose_slots" s
SET "time" = '18:00'::time, "label" = 'Evening · before dinner'
FROM "medicines" m
WHERE m."id" = s."medicine_id"
  AND m."catalog_id" = 'perinorm'
  AND s."slot_key" = 'pm'
  AND s."time" = '21:00'::time;
