-- Persist successful financial requests so a lost response can be retried
-- without creating another ledger entry. Keys are scoped to organization and
-- actor, and bound to one invoice, operation, and canonical request payload.
CREATE TABLE IF NOT EXISTS "invoice_payment_requests" (
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE cascade,
  "actor_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "request_key" varchar(128) NOT NULL,
  "invoice_id" uuid NOT NULL REFERENCES "invoices"("id") ON DELETE cascade,
  "operation" varchar(20) NOT NULL,
  "request_hash" varchar(64) NOT NULL,
  "response_status" smallint NOT NULL,
  "response_body" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "invoice_payment_requests_pk" PRIMARY KEY ("organization_id", "actor_user_id", "request_key"),
  CONSTRAINT "invoice_payment_requests_key_chk" CHECK ("request_key" ~ '^[A-Za-z0-9][A-Za-z0-9_-]{7,127}$'),
  CONSTRAINT "invoice_payment_requests_operation_chk" CHECK ("operation" IN ('record-payment', 'mark-paid')),
  CONSTRAINT "invoice_payment_requests_hash_chk" CHECK ("request_hash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "invoice_payment_requests_status_chk" CHECK ("response_status" IN (200, 201))
);

CREATE INDEX IF NOT EXISTS "invoice_payment_requests_invoice_idx" ON "invoice_payment_requests" ("invoice_id");
CREATE INDEX IF NOT EXISTS "invoice_payment_requests_actor_idx" ON "invoice_payment_requests" ("actor_user_id");
