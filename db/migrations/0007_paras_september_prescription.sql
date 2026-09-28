ALTER TABLE "households" ALTER COLUMN "prescription_version" SET DEFAULT 'paras-ajit-singh-2026-09-26';--> statement-breakpoint
ALTER TABLE "households" ALTER COLUMN "prescription_date" SET DEFAULT '2026-09-26';--> statement-breakpoint
-- Keep course_start at 28 July: it is the start of the caregiver history, not
-- the date of the newest sheet. Reopen prescription verification for both
-- existing households. Recorded doses and caregiver-edited reminder times stay.
UPDATE "households"
SET "prescription_version" = 'paras-ajit-singh-2026-09-26',
    "prescription_date" = '2026-09-26',
    "prescriber_name" = 'Dr Ajit Singh',
    "rx_verified_at" = NULL,
    "updated_at" = now()
WHERE "prescription_version" = 'paras-ajit-singh-2026-07-28';--> statement-breakpoint
-- These four routine medicines are renewed with the same dose and schedule
-- on the 26 September Paras sheet. Change the source, not the reminders.
UPDATE "medicines"
SET "prescribed_at" = 'Paras Hospitals · 26 Sep 2026'
WHERE "catalog_id" IN ('pantocid', 'lacoset', 'valprol', 'tryptomer')
  AND "prescribed_at" = 'Paras Hospitals · 28 Jul 2026';--> statement-breakpoint
-- Napra-D is explicitly listed again and marked SOS in the printed remarks.
UPDATE "medicines"
SET "prescribed_at" = 'Paras Hospitals · 26 Sep 2026'
WHERE "catalog_id" = 'napra-d'
  AND "prescribed_at" = 'Paras Hospitals · 28 Jul 2026';--> statement-breakpoint
UPDATE "medicines"
SET "verify" = 'Betacap is absent from the 26 September sheet. Confirm with the treating team whether it continues, and check the TR / modified-release form on the strip.'
WHERE "catalog_id" = 'betacap'
  AND "verify" = 'Confirm the TR / modified-release form on the strip.';
