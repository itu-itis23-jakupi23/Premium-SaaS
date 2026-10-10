-- Client furniture proposals.
--
-- The client portal is read-only over the design on purpose: approval stages and
-- metered revisions only mean something if the PM owns the canonical layout. So a
-- client who wants the counter moved does not edit booth_versions - they draw the
-- change in a sandbox of their own, and the PM accepts or rejects it.
--
-- A separate table rather than a booth_versions status: version history, version
-- numbering and updateDesignFromWorkspace() all key off that table, and a
-- half-real version sitting in it would have to be filtered out of every one of
-- those paths. Nothing here can disturb the design until a PM accepts it.

CREATE TABLE IF NOT EXISTS "workspace_proposals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE cascade,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  -- What the client started from, so the PM can diff the proposal against the
  -- design as it stood rather than against whatever is latest at review time.
  "base_version_id" uuid REFERENCES "booth_versions"("id") ON DELETE set null,
  "created_by_user_id" uuid REFERENCES "users"("id") ON DELETE set null,
  "layout_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "status" varchar(20) DEFAULT 'draft' NOT NULL,
  "note" text,
  "decision_note" text,
  "decided_by_user_id" uuid REFERENCES "users"("id") ON DELETE set null,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "submitted_at" timestamp with time zone,
  "decided_at" timestamp with time zone,
  CONSTRAINT "workspace_proposals_status_known" CHECK (
    "status" IN ('draft', 'submitted', 'accepted', 'rejected', 'withdrawn')
  )
);

CREATE INDEX IF NOT EXISTS "workspace_proposals_project_idx"
  ON "workspace_proposals" ("project_id", "created_at");
CREATE INDEX IF NOT EXISTS "workspace_proposals_org_status_idx"
  ON "workspace_proposals" ("organization_id", "status");

-- One live proposal per project at a time. A client editing a sandbox while an
-- earlier one is still awaiting a decision would leave the PM reviewing a layout
-- that has already moved on. Decided proposals (accepted/rejected/withdrawn) are
-- history and do not block a new one.
CREATE UNIQUE INDEX IF NOT EXISTS "workspace_proposals_one_open_per_project"
  ON "workspace_proposals" ("project_id")
  WHERE "status" IN ('draft', 'submitted');
