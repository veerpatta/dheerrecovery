ALTER TABLE "medicines" ADD COLUMN "dosing_interval_hours" integer;--> statement-breakpoint
-- Backfill: the deployed record was seeded before this column existed, and
-- the two anti-seizure medicines are prescribed twice daily about 12 hours
-- apart. Fresh records get this from lib/catalog.ts at seed time instead.
UPDATE "medicines" SET "dosing_interval_hours" = 12
 WHERE "catalog_id" IN ('lacoset', 'valprol');
