CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ BEGIN CREATE TYPE "user_role" AS ENUM('admin', 'owner', 'chief', 'pm', 'client'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "membership_status" AS ENUM('invited', 'active', 'suspended', 'revoked'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "client_status" AS ENUM('lead', 'pending_approval', 'active', 'inactive', 'archived'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "project_health" AS ENUM('on_track', 'at_risk', 'blocked', 'delayed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "booth_system" AS ENUM('octanorm', 'maxima', 'custom'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "booth_type" AS ENUM('inline', 'corner', 'peninsula', 'island'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "booth_version_status" AS ENUM('draft', 'submitted', 'under_review', 'approved', 'rejected', 'revision_requested', 'locked'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "task_status" AS ENUM('todo', 'in_progress', 'blocked', 'done', 'cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "task_priority" AS ENUM('low', 'normal', 'high', 'urgent'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "invoice_status" AS ENUM('draft', 'open', 'paid', 'void', 'uncollectible'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "file_visibility" AS ENUM('internal', 'client_visible', 'public_link'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TYPE "approval_status" ADD VALUE IF NOT EXISTS 'under_review';
ALTER TYPE "approval_status" ADD VALUE IF NOT EXISTS 'revision_requested';
ALTER TYPE "approval_status" ADD VALUE IF NOT EXISTS 'cancelled';
ALTER TYPE "project_status" ADD VALUE IF NOT EXISTS 'planning';
ALTER TYPE "project_status" ADD VALUE IF NOT EXISTS 'in_design';
ALTER TYPE "project_status" ADD VALUE IF NOT EXISTS 'client_review';
ALTER TYPE "project_status" ADD VALUE IF NOT EXISTS 'revision';
ALTER TYPE "project_status" ADD VALUE IF NOT EXISTS 'in_production';
ALTER TYPE "project_status" ADD VALUE IF NOT EXISTS 'cancelled';
ALTER TYPE "document_kind" ADD VALUE IF NOT EXISTS 'proposal';
ALTER TYPE "document_kind" ADD VALUE IF NOT EXISTS 'invoice';
ALTER TYPE "document_kind" ADD VALUE IF NOT EXISTS 'asset';
ALTER TYPE "subscription_status" ADD VALUE IF NOT EXISTS 'cancelled';

ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "legal_name" varchar(200);
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "website" varchar(255);
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "logo_url" text;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "brand_color" varchar(32);
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "timezone" varchar(80) DEFAULT 'Europe/Istanbul';
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "plan" varchar(40) DEFAULT 'starter';
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "seat_limit" integer DEFAULT 5;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "active_project_limit" integer DEFAULT 10;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "storage_limit_mb" integer DEFAULT 10240;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "metadata" jsonb DEFAULT '{}'::jsonb;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;
UPDATE "organizations" SET
  "timezone" = COALESCE("timezone", 'Europe/Istanbul'),
  "plan" = COALESCE("plan", 'starter'),
  "seat_limit" = COALESCE("seat_limit", 5),
  "active_project_limit" = COALESCE("active_project_limit", 10),
  "storage_limit_mb" = COALESCE("storage_limit_mb", 10240),
  "metadata" = COALESCE("metadata", '{}'::jsonb);
ALTER TABLE "organizations" ALTER COLUMN "timezone" SET NOT NULL;
ALTER TABLE "organizations" ALTER COLUMN "plan" SET NOT NULL;
ALTER TABLE "organizations" ALTER COLUMN "seat_limit" SET NOT NULL;
ALTER TABLE "organizations" ALTER COLUMN "active_project_limit" SET NOT NULL;
ALTER TABLE "organizations" ALTER COLUMN "storage_limit_mb" SET NOT NULL;
ALTER TABLE "organizations" ALTER COLUMN "metadata" SET NOT NULL;

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" "user_role" DEFAULT 'client';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_hash" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified_at" timestamp with time zone;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_login_at" timestamp with time zone;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "disabled_at" timestamp with time zone;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "metadata" jsonb DEFAULT '{}'::jsonb;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;
UPDATE "users" u
SET "role" = m."role"::text::"user_role"
FROM "memberships" m
WHERE m."user_id" = u."id";
UPDATE "users" SET
  "role" = COALESCE("role", 'client'::"user_role"),
  "metadata" = COALESCE("metadata", '{}'::jsonb);
ALTER TABLE "users" ALTER COLUMN "role" SET NOT NULL;
ALTER TABLE "users" ALTER COLUMN "metadata" SET NOT NULL;

ALTER TABLE "memberships" ALTER COLUMN "role" TYPE "user_role" USING "role"::text::"user_role";
ALTER TABLE "memberships" ADD COLUMN IF NOT EXISTS "status" "membership_status" DEFAULT 'active';
ALTER TABLE "memberships" ADD COLUMN IF NOT EXISTS "invited_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "memberships" ADD COLUMN IF NOT EXISTS "joined_at" timestamp with time zone;
ALTER TABLE "memberships" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now();
UPDATE "memberships" SET
  "status" = COALESCE("status", 'active'::"membership_status"),
  "joined_at" = COALESCE("joined_at", "created_at"),
  "updated_at" = COALESCE("updated_at", "created_at");
ALTER TABLE "memberships" ALTER COLUMN "status" SET NOT NULL;
ALTER TABLE "memberships" ALTER COLUMN "updated_at" SET NOT NULL;

CREATE TABLE IF NOT EXISTS "invitations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "email" varchar(255) NOT NULL,
  "role" "user_role" NOT NULL,
  "token_hash" text NOT NULL,
  "invited_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "accepted_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "accepted_at" timestamp with time zone,
  "revoked_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "organization_id" uuid REFERENCES "organizations"("id") ON DELETE CASCADE,
  "refresh_token_hash" text NOT NULL,
  "user_agent" text,
  "ip_address" varchar(80),
  "expires_at" timestamp with time zone NOT NULL,
  "revoked_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "rotated_at" timestamp with time zone
);

ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "company_name" varchar(180);
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "status" "client_status" DEFAULT 'active';
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "assigned_pm_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "activated_at" timestamp with time zone;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "billing_customer_id" varchar(120);
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "metadata" jsonb DEFAULT '{}'::jsonb;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;
UPDATE "clients" SET
  "company_name" = COALESCE("company_name", "name", "company", 'Client'),
  "status" = COALESCE("status", 'active'::"client_status"),
  "metadata" = COALESCE("metadata", '{}'::jsonb);
ALTER TABLE "clients" ALTER COLUMN "name" DROP NOT NULL;
ALTER TABLE "clients" ALTER COLUMN "company_name" SET NOT NULL;
ALTER TABLE "clients" ALTER COLUMN "status" SET NOT NULL;
ALTER TABLE "clients" ALTER COLUMN "metadata" SET NOT NULL;

UPDATE "projects" SET "status" = 'in_design'::"project_status" WHERE "status"::text = 'active';
UPDATE "projects" SET "status" = 'client_review'::"project_status" WHERE "status"::text = 'in_review';
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "assigned_pm_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "created_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "venue" varchar(180);
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "city" varchar(120);
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "country" varchar(120);
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "health" "project_health" DEFAULT 'on_track';
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "budget_cents" integer DEFAULT 0;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "currency" varchar(3) DEFAULT 'EUR';
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "starts_at" timestamp with time zone;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "ends_at" timestamp with time zone;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "deadline_at" timestamp with time zone;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "metadata" jsonb DEFAULT '{}'::jsonb;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "archived_at" timestamp with time zone;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;
UPDATE "projects" SET
  "deadline_at" = COALESCE("deadline_at", "deadline"),
  "health" = COALESCE("health", 'on_track'::"project_health"),
  "budget_cents" = COALESCE("budget_cents", 0),
  "currency" = COALESCE("currency", 'EUR'),
  "metadata" = COALESCE("metadata", '{}'::jsonb);
ALTER TABLE "projects" ALTER COLUMN "health" SET NOT NULL;
ALTER TABLE "projects" ALTER COLUMN "budget_cents" SET NOT NULL;
ALTER TABLE "projects" ALTER COLUMN "currency" SET NOT NULL;
ALTER TABLE "projects" ALTER COLUMN "metadata" SET NOT NULL;
ALTER TABLE "projects" ALTER COLUMN "booth_system" DROP NOT NULL;
ALTER TABLE "projects" ALTER COLUMN "width_mm" DROP NOT NULL;
ALTER TABLE "projects" ALTER COLUMN "depth_mm" DROP NOT NULL;
ALTER TABLE "projects" ALTER COLUMN "height_mm" DROP NOT NULL;

ALTER TABLE "project_members" ALTER COLUMN "role" TYPE "user_role" USING "role"::text::"user_role";
ALTER TABLE "project_members" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();

CREATE TABLE IF NOT EXISTS "milestones" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "title" varchar(180) NOT NULL,
  "description" text,
  "due_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "tasks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "project_id" uuid REFERENCES "projects"("id") ON DELETE CASCADE,
  "milestone_id" uuid REFERENCES "milestones"("id") ON DELETE SET NULL,
  "assigned_to_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "title" varchar(180) NOT NULL,
  "description" text,
  "status" "task_status" DEFAULT 'todo' NOT NULL,
  "priority" "task_priority" DEFAULT 'normal' NOT NULL,
  "due_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "booth_designs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "name" varchar(180) DEFAULT 'Main booth design' NOT NULL,
  "booth_system" "booth_system" DEFAULT 'octanorm' NOT NULL,
  "booth_type" "booth_type" DEFAULT 'inline' NOT NULL,
  "width_mm" integer NOT NULL,
  "depth_mm" integer NOT NULL,
  "height_mm" integer NOT NULL,
  "grid_size_mm" integer DEFAULT 1000 NOT NULL,
  "units" varchar(16) DEFAULT 'metric' NOT NULL,
  "current_version_number" integer DEFAULT 1 NOT NULL,
  "created_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone
);

INSERT INTO "booth_designs" (
  "organization_id", "project_id", "name", "booth_system", "booth_type",
  "width_mm", "depth_mm", "height_mm", "grid_size_mm", "units",
  "current_version_number", "created_by_user_id", "created_at", "updated_at"
)
SELECT
  p."organization_id",
  p."id",
  p."name" || ' booth design',
  CASE lower(p."booth_system")
    WHEN 'maxima' THEN 'maxima'::"booth_system"
    WHEN 'octanorm' THEN 'octanorm'::"booth_system"
    ELSE 'custom'::"booth_system"
  END,
  'island'::"booth_type",
  p."width_mm",
  p."depth_mm",
  p."height_mm",
  1000,
  'metric',
  COALESCE((SELECT max(bl."version") FROM "booth_layouts" bl WHERE bl."project_id" = p."id"), 1),
  p."assigned_pm_user_id",
  p."created_at",
  p."updated_at"
FROM "projects" p
WHERE NOT EXISTS (
  SELECT 1 FROM "booth_designs" bd WHERE bd."project_id" = p."id"
);

CREATE TABLE IF NOT EXISTS "booth_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "design_id" uuid NOT NULL REFERENCES "booth_designs"("id") ON DELETE CASCADE,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "version_number" integer NOT NULL,
  "status" "booth_version_status" DEFAULT 'draft' NOT NULL,
  "title" varchar(180) NOT NULL,
  "layout_json" jsonb NOT NULL,
  "snapshot_url" text,
  "asset_summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "cost_estimate_cents" integer DEFAULT 0 NOT NULL,
  "created_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "submitted_at" timestamp with time zone,
  "locked_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

INSERT INTO "booth_versions" (
  "organization_id", "design_id", "project_id", "version_number", "status",
  "title", "layout_json", "snapshot_url", "asset_summary",
  "cost_estimate_cents", "created_by_user_id", "created_at"
)
SELECT
  p."organization_id",
  bd."id",
  p."id",
  bl."version",
  'draft'::"booth_version_status",
  'Imported layout v' || bl."version",
  bl."layout",
  NULLIF(bl."snapshot_key", ''),
  '{}'::jsonb,
  0,
  bl."created_by_user_id",
  bl."created_at"
FROM "booth_layouts" bl
JOIN "projects" p ON p."id" = bl."project_id"
JOIN "booth_designs" bd ON bd."project_id" = p."id"
WHERE NOT EXISTS (
  SELECT 1 FROM "booth_versions" bv
  WHERE bv."design_id" = bd."id" AND bv."version_number" = bl."version"
);

ALTER TABLE "approvals" ADD COLUMN IF NOT EXISTS "organization_id" uuid REFERENCES "organizations"("id") ON DELETE CASCADE;
ALTER TABLE "approvals" ADD COLUMN IF NOT EXISTS "booth_version_id" uuid REFERENCES "booth_versions"("id") ON DELETE CASCADE;
ALTER TABLE "approvals" ADD COLUMN IF NOT EXISTS "responded_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "approvals" ADD COLUMN IF NOT EXISTS "message" text;
ALTER TABLE "approvals" ADD COLUMN IF NOT EXISTS "response_note" text;
ALTER TABLE "approvals" ADD COLUMN IF NOT EXISTS "responded_at" timestamp with time zone;
ALTER TABLE "approvals" ADD COLUMN IF NOT EXISTS "due_at" timestamp with time zone;
UPDATE "approvals" a
SET
  "organization_id" = COALESCE(a."organization_id", p."organization_id"),
  "booth_version_id" = COALESCE(a."booth_version_id", bv."id"),
  "responded_by_user_id" = COALESCE(a."responded_by_user_id", a."decided_by_user_id"),
  "responded_at" = COALESCE(a."responded_at", a."decided_at"),
  "message" = COALESCE(a."message", a."title")
FROM "projects" p
LEFT JOIN LATERAL (
  SELECT bv."id"
  FROM "booth_versions" bv
  WHERE bv."project_id" = p."id"
  ORDER BY bv."version_number" DESC
  LIMIT 1
) bv ON true
WHERE p."id" = a."project_id";
UPDATE "approvals" SET "status" = 'cancelled'::"approval_status" WHERE "status"::text = 'canceled';

ALTER TABLE "comments" ADD COLUMN IF NOT EXISTS "organization_id" uuid REFERENCES "organizations"("id") ON DELETE CASCADE;
ALTER TABLE "comments" ADD COLUMN IF NOT EXISTS "booth_version_id" uuid REFERENCES "booth_versions"("id") ON DELETE CASCADE;
ALTER TABLE "comments" ADD COLUMN IF NOT EXISTS "parent_comment_id" uuid;
ALTER TABLE "comments" ADD COLUMN IF NOT EXISTS "pin" jsonb;
ALTER TABLE "comments" ADD COLUMN IF NOT EXISTS "resolved_at" timestamp with time zone;
ALTER TABLE "comments" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now();
ALTER TABLE "comments" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;
UPDATE "comments" c
SET
  "organization_id" = COALESCE(c."organization_id", p."organization_id"),
  "booth_version_id" = COALESCE(c."booth_version_id", bv."id"),
  "pin" = COALESCE(c."pin", c."anchor"),
  "resolved_at" = CASE WHEN c."resolved" THEN COALESCE(c."resolved_at", c."created_at") ELSE c."resolved_at" END,
  "updated_at" = COALESCE(c."updated_at", c."created_at")
FROM "projects" p
LEFT JOIN LATERAL (
  SELECT bv."id"
  FROM "booth_versions" bv
  WHERE bv."project_id" = p."id"
  ORDER BY bv."version_number" DESC
  LIMIT 1
) bv ON true
WHERE p."id" = c."project_id";

UPDATE "documents" SET "kind" = 'proposal'::"document_kind" WHERE "kind"::text = 'quote';
UPDATE "documents" SET "kind" = 'other'::"document_kind" WHERE "kind"::text = 'brief';
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "organization_id" uuid REFERENCES "organizations"("id") ON DELETE CASCADE;
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "client_id" uuid REFERENCES "clients"("id") ON DELETE CASCADE;
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "file_name" varchar(255);
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "mime_type" varchar(160);
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "visibility" "file_visibility" DEFAULT 'internal';
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "storage_bucket" varchar(120) DEFAULT 'local';
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "checksum_sha256" varchar(64);
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "approved_at" timestamp with time zone;
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;
UPDATE "documents" d
SET
  "organization_id" = COALESCE(d."organization_id", p."organization_id"),
  "client_id" = COALESCE(d."client_id", p."client_id"),
  "file_name" = COALESCE(d."file_name", d."name"),
  "mime_type" = COALESCE(d."mime_type", d."content_type"),
  "visibility" = COALESCE(d."visibility", 'internal'::"file_visibility"),
  "storage_bucket" = COALESCE(d."storage_bucket", 'local')
FROM "projects" p
WHERE p."id" = d."project_id";

ALTER TABLE "activity_events" ADD COLUMN IF NOT EXISTS "client_id" uuid REFERENCES "clients"("id") ON DELETE CASCADE;
ALTER TABLE "activity_events" ADD COLUMN IF NOT EXISTS "event_type" varchar(80);
UPDATE "activity_events" SET "event_type" = COALESCE("event_type", "type"::text);
ALTER TABLE "activity_events" ALTER COLUMN "type" DROP NOT NULL;

ALTER TABLE "subscriptions" ALTER COLUMN "plan" TYPE varchar(40) USING "plan"::text;
UPDATE "subscriptions" SET "status" = 'cancelled'::"subscription_status" WHERE "status"::text = 'canceled';
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "seats_included" integer DEFAULT 5;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "active_projects_included" integer DEFAULT 10;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "storage_included_mb" integer DEFAULT 10240;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "current_period_start" timestamp with time zone;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "cancel_at_period_end" boolean DEFAULT false;
UPDATE "subscriptions" SET
  "seats_included" = COALESCE("seats_included", 5),
  "active_projects_included" = COALESCE("active_projects_included", 10),
  "storage_included_mb" = COALESCE("storage_included_mb", 10240),
  "cancel_at_period_end" = COALESCE("cancel_at_period_end", false);

CREATE TABLE IF NOT EXISTS "invoices" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "client_id" uuid REFERENCES "clients"("id") ON DELETE SET NULL,
  "subscription_id" uuid REFERENCES "subscriptions"("id") ON DELETE SET NULL,
  "invoice_number" varchar(80) NOT NULL,
  "status" "invoice_status" DEFAULT 'draft' NOT NULL,
  "currency" varchar(3) DEFAULT 'EUR' NOT NULL,
  "subtotal_cents" integer DEFAULT 0 NOT NULL,
  "tax_cents" integer DEFAULT 0 NOT NULL,
  "total_cents" integer DEFAULT 0 NOT NULL,
  "due_at" timestamp with time zone,
  "paid_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "title" varchar(160) NOT NULL,
  "body" text NOT NULL,
  "href" text,
  "read_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "organizations_slug_idx" ON "organizations"("slug");
CREATE INDEX IF NOT EXISTS "users_email_idx" ON "users"("email");
CREATE INDEX IF NOT EXISTS "clients_org_company_idx" ON "clients"("organization_id", "company_name");
CREATE INDEX IF NOT EXISTS "projects_org_status_idx" ON "projects"("organization_id", "status");
CREATE INDEX IF NOT EXISTS "booth_designs_project_idx" ON "booth_designs"("project_id");
CREATE UNIQUE INDEX IF NOT EXISTS "booth_versions_design_version_idx" ON "booth_versions"("design_id", "version_number");
CREATE INDEX IF NOT EXISTS "comments_project_idx" ON "comments"("project_id", "created_at");
CREATE INDEX IF NOT EXISTS "activity_events_org_created_idx" ON "activity_events"("organization_id", "created_at");
CREATE INDEX IF NOT EXISTS "notifications_user_unread_idx" ON "notifications"("user_id", "read_at");
