ALTER TABLE "activity" ADD COLUMN "planned_start" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "activity" ADD COLUMN "planned_end" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notification" ADD COLUMN "dedupe_key" text;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_dedupe_key_unique" UNIQUE("dedupe_key");