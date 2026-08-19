-- Quote / proposal workflow (BIZ-01): turn a booth design's BOM into a formal,
-- client-facing quote that can be sent, viewed, accepted, or rejected. Feeds the
-- gap between an approved design and a confirmed order.

DO $$ BEGIN
  CREATE TYPE "quote_status" AS ENUM ('draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired', 'revised');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "quotes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE cascade,
  "client_id" uuid REFERENCES "clients"("id") ON DELETE set null,
  "project_id" uuid REFERENCES "projects"("id") ON DELETE set null,
  "quote_number" varchar(80) NOT NULL,
  "title" varchar(200),
  "status" "quote_status" DEFAULT 'draft' NOT NULL,
  "currency" varchar(3) DEFAULT 'USD' NOT NULL,
  "line_items" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "subtotal_cents" integer DEFAULT 0 NOT NULL,
  "discount_cents" integer DEFAULT 0 NOT NULL,
  "tax_cents" integer DEFAULT 0 NOT NULL,
  "total_cents" integer DEFAULT 0 NOT NULL,
  "notes" text,
  "terms" text,
  "valid_until" timestamp with time zone,
  "created_by_user_id" uuid REFERENCES "users"("id") ON DELETE set null,
  "sent_at" timestamp with time zone,
  "viewed_at" timestamp with time zone,
  "responded_at" timestamp with time zone,
  "response_note" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone
);

CREATE UNIQUE INDEX IF NOT EXISTS "quotes_org_number_idx" ON "quotes" ("organization_id", "quote_number");
CREATE INDEX IF NOT EXISTS "quotes_org_status_idx" ON "quotes" ("organization_id", "status");
CREATE INDEX IF NOT EXISTS "quotes_client_idx" ON "quotes" ("client_id");
CREATE INDEX IF NOT EXISTS "quotes_project_idx" ON "quotes" ("project_id");
