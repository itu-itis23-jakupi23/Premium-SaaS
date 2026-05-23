CREATE TABLE IF NOT EXISTS "direct_conversations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "participant_one_user_id" uuid NOT NULL,
  "participant_two_user_id" uuid NOT NULL,
  "last_message_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "direct_conversations_distinct_participants_chk" CHECK ("participant_one_user_id" <> "participant_two_user_id"),
  CONSTRAINT "direct_conversations_sorted_participants_chk" CHECK ("participant_one_user_id" < "participant_two_user_id"),
  CONSTRAINT "direct_conversations_org_pair_unique" UNIQUE("organization_id","participant_one_user_id","participant_two_user_id")
);

CREATE TABLE IF NOT EXISTS "direct_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "conversation_id" uuid NOT NULL,
  "organization_id" uuid NOT NULL,
  "sender_user_id" uuid NOT NULL,
  "body" text NOT NULL,
  "read_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "direct_conversations" ADD CONSTRAINT "direct_conversations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "direct_conversations" ADD CONSTRAINT "direct_conversations_participant_one_user_id_users_id_fk" FOREIGN KEY ("participant_one_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "direct_conversations" ADD CONSTRAINT "direct_conversations_participant_two_user_id_users_id_fk" FOREIGN KEY ("participant_two_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_conversation_id_direct_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."direct_conversations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_sender_user_id_users_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "direct_conversations_participant_one_idx" ON "direct_conversations" USING btree ("participant_one_user_id","last_message_at");
CREATE INDEX IF NOT EXISTS "direct_conversations_participant_two_idx" ON "direct_conversations" USING btree ("participant_two_user_id","last_message_at");
CREATE INDEX IF NOT EXISTS "direct_messages_conversation_created_idx" ON "direct_messages" USING btree ("conversation_id","created_at");
CREATE INDEX IF NOT EXISTS "direct_messages_unread_idx" ON "direct_messages" USING btree ("conversation_id","sender_user_id","read_at");
