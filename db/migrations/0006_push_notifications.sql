CREATE TABLE "notification_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"care_date" date NOT NULL,
	"claimed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"attempts" integer DEFAULT 1 NOT NULL,
	"device_count" integer DEFAULT 0 NOT NULL,
	"acted_at" timestamp with time zone,
	"acted_action" text
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"lang" text DEFAULT 'en' NOT NULL,
	"label" text,
	"supports_actions" boolean DEFAULT false NOT NULL,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone,
	"last_sent_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "households" ADD COLUMN "notify_morning" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "households" ADD COLUMN "notify_evening" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "households" ADD COLUMN "notify_weight" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "households" ADD COLUMN "notify_bloods" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "households" ADD COLUMN "notify_milestones" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_log" ADD CONSTRAINT "notification_log_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_log_household_kind_date_idx" ON "notification_log" USING btree ("household_id","kind","care_date");--> statement-breakpoint
CREATE UNIQUE INDEX "push_subscriptions_endpoint_idx" ON "push_subscriptions" USING btree ("endpoint");--> statement-breakpoint
CREATE INDEX "push_subscriptions_household_idx" ON "push_subscriptions" USING btree ("household_id");