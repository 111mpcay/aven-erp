ALTER TABLE "profiles" ADD COLUMN "pin_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "pin_locked_until" timestamp with time zone;