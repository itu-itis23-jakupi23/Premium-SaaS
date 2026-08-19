-- CRM lead pipeline (CRM-01): a sales pipeline that runs orthogonally to the
-- client lifecycle (client_status). A lead moves new → contacted → qualified →
-- proposal → won / lost. "won" is the signal to convert the lead into an active
-- client; "lost" retires it. Deal value + a follow-up date drive the board.

DO $$ BEGIN
  CREATE TYPE "lead_stage" AS ENUM ('new', 'contacted', 'qualified', 'proposal', 'won', 'lost');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "clients"
  ADD COLUMN IF NOT EXISTS "lead_stage" "lead_stage",
  ADD COLUMN IF NOT EXISTS "lead_value_cents" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lead_stage_changed_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "next_follow_up_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "lost_reason" varchar(300);

-- Seed a stage for existing leads so the board isn't empty on first load.
UPDATE "clients" SET "lead_stage" = 'new', "lead_stage_changed_at" = now()
  WHERE "status" = 'lead' AND "lead_stage" IS NULL;

CREATE INDEX IF NOT EXISTS "clients_org_lead_stage_idx" ON "clients" ("organization_id", "lead_stage");
CREATE INDEX IF NOT EXISTS "clients_follow_up_idx" ON "clients" ("organization_id", "next_follow_up_at");
