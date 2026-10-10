-- Partial payments (BIZ-02 follow-up). Until now an invoice could only be paid
-- in full: mark-paid set amount_paid_cents = total_cents, so a deposit or an
-- instalment had nowhere to live and the client could never see a real balance.
--
-- invoice_payments is the ledger, and invoices.amount_paid_cents becomes a cache
-- of sum(invoice_payments.amount_cents) for that invoice. Every write path
-- recomputes it from the ledger rather than adjusting it in place, so the two can
-- never drift.

CREATE TABLE IF NOT EXISTS "invoice_payments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE cascade,
  "invoice_id" uuid NOT NULL REFERENCES "invoices"("id") ON DELETE cascade,
  "amount_cents" integer NOT NULL,
  "method" varchar(40) DEFAULT 'manual' NOT NULL,
  "reference" varchar(200),
  "note" text,
  "recorded_by_user_id" uuid REFERENCES "users"("id") ON DELETE set null,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "invoice_payments_amount_positive" CHECK ("amount_cents" > 0)
);

CREATE INDEX IF NOT EXISTS "invoice_payments_invoice_idx" ON "invoice_payments" ("invoice_id", "created_at");
CREATE INDEX IF NOT EXISTS "invoice_payments_org_idx" ON "invoice_payments" ("organization_id");

-- Backfill the ledger from invoices already marked paid, so history is complete
-- for existing records and the cache below matches on the first recompute.
INSERT INTO "invoice_payments" ("organization_id", "invoice_id", "amount_cents", "method", "note", "created_at")
SELECT i."organization_id", i."id", i."amount_paid_cents", 'legacy', 'Backfilled from invoice mark-paid', COALESCE(i."paid_at", i."updated_at")
FROM "invoices" i
WHERE i."amount_paid_cents" > 0
  AND NOT EXISTS (SELECT 1 FROM "invoice_payments" p WHERE p."invoice_id" = i."id");
