-- Client invoicing workflow (BIZ-02): extend the invoices table from a bare
-- subscription-billing record into a full client-facing invoice with line items,
-- a link back to the originating quote/project, and workflow timestamps. Reuses
-- the existing invoice_status lifecycle (draft → open → paid / void).

ALTER TABLE "invoices"
  ADD COLUMN IF NOT EXISTS "project_id" uuid REFERENCES "projects"("id") ON DELETE set null,
  ADD COLUMN IF NOT EXISTS "quote_id" uuid REFERENCES "quotes"("id") ON DELETE set null,
  ADD COLUMN IF NOT EXISTS "title" varchar(200),
  ADD COLUMN IF NOT EXISTS "line_items" jsonb DEFAULT '[]'::jsonb NOT NULL,
  ADD COLUMN IF NOT EXISTS "discount_cents" integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS "amount_paid_cents" integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS "notes" text,
  ADD COLUMN IF NOT EXISTS "issued_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "created_by_user_id" uuid REFERENCES "users"("id") ON DELETE set null,
  ADD COLUMN IF NOT EXISTS "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;

CREATE INDEX IF NOT EXISTS "invoices_project_idx" ON "invoices" ("project_id");
CREATE INDEX IF NOT EXISTS "invoices_quote_idx" ON "invoices" ("quote_id");
