-- Exhibitions as a first-class entity (WF-05 / SHOW-01).
--
-- Until now a show was denormalized onto each project as loose text
-- (exhibition_name, venue, city, country) with one `deadline_at` standing in
-- for every date that matters. In this industry the calendar IS the plan:
-- freight cut-off, move-in, open, close and move-out are distinct dates, they
-- belong to the show rather than to any one project, and every internal
-- milestone is planned backwards from them.
--
-- Projects keep their denormalized columns so existing reads stay valid; the
-- new exhibition_id is the source of truth when it is set.

DO $$ BEGIN
  CREATE TYPE "exhibition_status" AS ENUM ('planned', 'confirmed', 'in_production', 'on_site', 'live', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "exhibitions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "name" varchar(180) NOT NULL,
  "venue" varchar(180),
  "city" varchar(120),
  "country" varchar(120),
  "hall" varchar(60),
  "stand_number" varchar(60),
  "status" "exhibition_status" NOT NULL DEFAULT 'planned',
  -- The show window itself.
  "opens_at" timestamp with time zone,
  "closes_at" timestamp with time zone,
  -- Build and strike windows around it.
  "move_in_at" timestamp with time zone,
  "move_out_at" timestamp with time zone,
  -- Last date freight can leave the workshop and still arrive on time.
  "freight_deadline_at" timestamp with time zone,
  "notes" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone
);

ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "exhibition_id" uuid REFERENCES "exhibitions"("id") ON DELETE SET NULL;

-- Milestones gain a stable key so a re-plan can replace the generated chain
-- without touching milestones a human added by hand.
ALTER TABLE "milestones"
  ADD COLUMN IF NOT EXISTS "source_key" varchar(60);

CREATE INDEX IF NOT EXISTS "exhibitions_org_opens_idx" ON "exhibitions" ("organization_id", "opens_at");
CREATE INDEX IF NOT EXISTS "exhibitions_org_status_idx" ON "exhibitions" ("organization_id", "status");
CREATE INDEX IF NOT EXISTS "projects_exhibition_idx" ON "projects" ("exhibition_id");
CREATE UNIQUE INDEX IF NOT EXISTS "milestones_project_source_key_idx" ON "milestones" ("project_id", "source_key") WHERE "source_key" IS NOT NULL;
