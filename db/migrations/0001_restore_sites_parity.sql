ALTER TABLE "bp_readings" ADD COLUMN "context" text;--> statement-breakpoint
ALTER TABLE "bp_readings" ADD COLUMN "position" text;--> statement-breakpoint
ALTER TABLE "bp_readings" ADD COLUMN "arm" text;--> statement-breakpoint
ALTER TABLE "bp_readings" ADD COLUMN "pair_id" text;--> statement-breakpoint
ALTER TABLE "households" ADD COLUMN "band_confirmed" boolean DEFAULT false NOT NULL;
