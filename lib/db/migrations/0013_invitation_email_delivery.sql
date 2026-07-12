ALTER TABLE "invitations"
  ADD COLUMN IF NOT EXISTS "email_status" text NOT NULL DEFAULT 'pending';

ALTER TABLE "invitations"
  ADD COLUMN IF NOT EXISTS "email_last_error" text;

ALTER TABLE "invitations"
  ADD COLUMN IF NOT EXISTS "email_last_attempt_at" timestamp with time zone;

ALTER TABLE "invitations"
  DROP CONSTRAINT IF EXISTS "invitations_email_status_chk";

ALTER TABLE "invitations"
  ADD CONSTRAINT "invitations_email_status_chk"
  CHECK ("email_status" IN ('pending', 'sent', 'failed', 'skipped'));

CREATE INDEX IF NOT EXISTS "invitations_org_email_status_idx"
  ON "invitations" ("organization_id", "email_status", "created_at");
