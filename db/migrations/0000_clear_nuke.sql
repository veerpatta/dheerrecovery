CREATE TABLE "bp_readings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"systolic" integer NOT NULL,
	"diastolic" integer NOT NULL,
	"pulse" integer,
	"symptoms" text,
	"measured_at" timestamp with time zone NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "care_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dose_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"medicine_id" uuid NOT NULL,
	"slot_key" text NOT NULL,
	"dose_date" date NOT NULL,
	"status" text NOT NULL,
	"scheduled_time" time,
	"taken_at" timestamp with time zone,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dose_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"medicine_id" uuid NOT NULL,
	"slot_key" text NOT NULL,
	"time" time NOT NULL,
	"label" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "households" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"care_code" text NOT NULL,
	"patient_name" text DEFAULT 'Dheer' NOT NULL,
	"prescription_version" text DEFAULT 'paras-ajit-singh-2026-07-28' NOT NULL,
	"prescription_date" date DEFAULT '2026-07-28' NOT NULL,
	"prescriber_name" text DEFAULT 'Dr Ajit Singh' NOT NULL,
	"course_start" date DEFAULT '2026-07-28' NOT NULL,
	"rx_verified_at" timestamp with time zone,
	"alert_lead_minutes" integer DEFAULT 10 NOT NULL,
	"band_systolic_low" integer DEFAULT 90 NOT NULL,
	"band_systolic_high" integer DEFAULT 135 NOT NULL,
	"band_diastolic_low" integer DEFAULT 60 NOT NULL,
	"band_diastolic_high" integer DEFAULT 85 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "medicines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"catalog_id" text NOT NULL,
	"brand" text NOT NULL,
	"generic" text,
	"dose" text NOT NULL,
	"form" text,
	"purpose" text,
	"prescription" text,
	"prescription_hi" text,
	"course_days" integer,
	"tone" text DEFAULT 'recovery' NOT NULL,
	"kind" text DEFAULT 'routine' NOT NULL,
	"sos_status" text,
	"symptom" text,
	"repeatable_log" boolean DEFAULT false NOT NULL,
	"food" text,
	"prescribed_at" text,
	"doctor_note" text,
	"instruction" text,
	"caution" text,
	"verify" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_custom" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "seizure_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"duration_minutes" integer,
	"recovery_minutes" integer,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bp_readings" ADD CONSTRAINT "bp_readings_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "care_notes" ADD CONSTRAINT "care_notes_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dose_records" ADD CONSTRAINT "dose_records_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dose_records" ADD CONSTRAINT "dose_records_medicine_id_medicines_id_fk" FOREIGN KEY ("medicine_id") REFERENCES "public"."medicines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dose_slots" ADD CONSTRAINT "dose_slots_medicine_id_medicines_id_fk" FOREIGN KEY ("medicine_id") REFERENCES "public"."medicines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medicines" ADD CONSTRAINT "medicines_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seizure_events" ADD CONSTRAINT "seizure_events_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bp_readings_household_measured_idx" ON "bp_readings" USING btree ("household_id","measured_at");--> statement-breakpoint
CREATE INDEX "care_notes_household_idx" ON "care_notes" USING btree ("household_id","created_at");--> statement-breakpoint
CREATE INDEX "dose_records_household_date_idx" ON "dose_records" USING btree ("household_id","dose_date");--> statement-breakpoint
CREATE INDEX "dose_records_medicine_idx" ON "dose_records" USING btree ("medicine_id");--> statement-breakpoint
CREATE INDEX "dose_slots_medicine_idx" ON "dose_slots" USING btree ("medicine_id");--> statement-breakpoint
CREATE UNIQUE INDEX "dose_slots_medicine_slot_idx" ON "dose_slots" USING btree ("medicine_id","slot_key");--> statement-breakpoint
CREATE UNIQUE INDEX "households_care_code_idx" ON "households" USING btree ("care_code");--> statement-breakpoint
CREATE INDEX "medicines_household_idx" ON "medicines" USING btree ("household_id");--> statement-breakpoint
CREATE UNIQUE INDEX "medicines_household_catalog_idx" ON "medicines" USING btree ("household_id","catalog_id");--> statement-breakpoint
CREATE INDEX "seizure_events_household_idx" ON "seizure_events" USING btree ("household_id","occurred_at");