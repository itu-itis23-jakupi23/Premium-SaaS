-- Link a quote back to the booth version it was priced from.
--
-- The workspace already computes a complete take-off - structural parts, room
-- lines, placed furniture, the fascia option, a contingency allowance and a
-- quote total - and booth_versions.cost_estimate_cents already stores a cost
-- per version. There was no column joining that to a quote, so the only way to
-- turn a priced stand into a quote was to read the numbers off the BOM panel
-- and type them into the quote builder again.
--
-- Provenance only. The quote keeps its own line items and totals, so removing
-- the version leaves the quote intact and merely unlinked - the same
-- `set null` treatment client_id and project_id already get.

ALTER TABLE "quotes"
  ADD COLUMN IF NOT EXISTS "booth_version_id" uuid;

DO $$ BEGIN
  ALTER TABLE "quotes"
    ADD CONSTRAINT "quotes_booth_version_id_booth_versions_id_fk"
    FOREIGN KEY ("booth_version_id") REFERENCES "booth_versions"("id")
    ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Quotes are listed and filtered per organization; this index serves the
-- "was this version already quoted?" lookup the create path does.
CREATE INDEX IF NOT EXISTS "quotes_booth_version_idx"
  ON "quotes" ("booth_version_id");
