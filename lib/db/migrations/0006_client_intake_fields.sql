ALTER TABLE "clients" ADD COLUMN "intake_exhibition_name" varchar(180);--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "intake_booth_size_sqm" numeric(8, 2);--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "intake_city" varchar(120);--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "intake_deadline_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "intake_preferred_system" "booth_system";--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "intake_notes" text;