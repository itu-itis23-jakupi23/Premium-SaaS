ALTER TABLE "direct_conversations"
  ADD COLUMN IF NOT EXISTS "project_id" uuid REFERENCES "projects"("id") ON DELETE SET NULL;

ALTER TABLE "direct_conversations"
  ADD COLUMN IF NOT EXISTS "exhibition_key" text NOT NULL DEFAULT 'general';

ALTER TABLE "direct_conversations"
  ADD COLUMN IF NOT EXISTS "exhibition_name" text;

ALTER TABLE "direct_conversations"
  DROP CONSTRAINT IF EXISTS "direct_conversations_org_pair_unique";

CREATE UNIQUE INDEX IF NOT EXISTS "direct_conversations_org_pair_scope_unique_idx"
  ON "direct_conversations" ("organization_id", "participant_one_user_id", "participant_two_user_id", "exhibition_key");

ALTER TABLE "direct_messages"
  ADD COLUMN IF NOT EXISTS "attachments" jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS "direct_conversations_participant_one_idx"
  ON "direct_conversations" ("participant_one_user_id", "last_message_at");

CREATE INDEX IF NOT EXISTS "direct_conversations_participant_two_idx"
  ON "direct_conversations" ("participant_two_user_id", "last_message_at");

CREATE INDEX IF NOT EXISTS "direct_messages_conversation_created_idx"
  ON "direct_messages" ("conversation_id", "created_at");

CREATE INDEX IF NOT EXISTS "direct_messages_unread_idx"
  ON "direct_messages" ("conversation_id", "sender_user_id", "read_at");

CREATE TABLE IF NOT EXISTS "stripe_webhook_events" (
  "event_id" text PRIMARY KEY,
  "event_type" text NOT NULL,
  "status" text NOT NULL DEFAULT 'processing',
  "attempts" integer NOT NULL DEFAULT 1,
  "last_error" text,
  "received_at" timestamp with time zone NOT NULL DEFAULT now(),
  "processed_at" timestamp with time zone,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "stripe_webhook_events_status_chk"
    CHECK ("status" IN ('processing', 'processed', 'failed'))
);

CREATE INDEX IF NOT EXISTS "stripe_webhook_events_status_updated_idx"
  ON "stripe_webhook_events" ("status", "updated_at");
