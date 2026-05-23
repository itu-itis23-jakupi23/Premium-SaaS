CREATE EXTENSION IF NOT EXISTS "pgcrypto";--> statement-breakpoint
CREATE TYPE "public"."approval_status" AS ENUM('requested', 'under_review', 'approved', 'rejected', 'revision_requested', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."booth_system" AS ENUM('octanorm', 'maxima', 'custom');--> statement-breakpoint
CREATE TYPE "public"."booth_type" AS ENUM('inline', 'corner', 'peninsula', 'island');--> statement-breakpoint
CREATE TYPE "public"."booth_version_status" AS ENUM('draft', 'submitted', 'under_review', 'approved', 'rejected', 'revision_requested', 'locked');--> statement-breakpoint
CREATE TYPE "public"."client_status" AS ENUM('lead', 'pending_approval', 'active', 'inactive', 'archived');--> statement-breakpoint
CREATE TYPE "public"."document_kind" AS ENUM('contract', 'proposal', 'invoice', 'render', 'asset', 'export', 'other');--> statement-breakpoint
CREATE TYPE "public"."file_visibility" AS ENUM('internal', 'client_visible', 'public_link');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'open', 'paid', 'void', 'uncollectible');--> statement-breakpoint
CREATE TYPE "public"."membership_status" AS ENUM('invited', 'active', 'suspended', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."project_health" AS ENUM('on_track', 'at_risk', 'blocked', 'delayed');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('draft', 'planning', 'in_design', 'client_review', 'revision', 'approved', 'delayed', 'in_production', 'completed', 'cancelled', 'archived');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('trialing', 'active', 'past_due', 'cancelled', 'unpaid', 'incomplete');--> statement-breakpoint
CREATE TYPE "public"."task_priority" AS ENUM('low', 'normal', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('todo', 'in_progress', 'blocked', 'done', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'owner', 'chief', 'pm', 'client');--> statement-breakpoint
CREATE TABLE "activity_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"project_id" uuid,
	"client_id" uuid,
	"event_type" varchar(80) NOT NULL,
	"message" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"booth_version_id" uuid NOT NULL,
	"requested_by_user_id" uuid,
	"responded_by_user_id" uuid,
	"status" "approval_status" DEFAULT 'requested' NOT NULL,
	"message" text,
	"response_note" text,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responded_at" timestamp with time zone,
	"due_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "booth_designs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"name" varchar(180) DEFAULT 'Main booth design' NOT NULL,
	"booth_system" "booth_system" DEFAULT 'octanorm' NOT NULL,
	"booth_type" "booth_type" DEFAULT 'inline' NOT NULL,
	"width_mm" integer NOT NULL,
	"depth_mm" integer NOT NULL,
	"height_mm" integer NOT NULL,
	"grid_size_mm" integer DEFAULT 1000 NOT NULL,
	"units" varchar(16) DEFAULT 'metric' NOT NULL,
	"current_version_number" integer DEFAULT 1 NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "booth_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"design_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"status" "booth_version_status" DEFAULT 'draft' NOT NULL,
	"title" varchar(180) NOT NULL,
	"layout_json" jsonb NOT NULL,
	"snapshot_url" text,
	"asset_summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"cost_estimate_cents" integer DEFAULT 0 NOT NULL,
	"created_by_user_id" uuid,
	"submitted_at" timestamp with time zone,
	"locked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"company_name" varchar(180) NOT NULL,
	"contact_name" varchar(160) NOT NULL,
	"contact_email" varchar(255) NOT NULL,
	"phone" varchar(80),
	"status" "client_status" DEFAULT 'lead' NOT NULL,
	"assigned_pm_user_id" uuid,
	"activated_at" timestamp with time zone,
	"billing_customer_id" varchar(120),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"booth_version_id" uuid,
	"author_user_id" uuid,
	"parent_comment_id" uuid,
	"body" text NOT NULL,
	"pin" jsonb,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid,
	"client_id" uuid,
	"uploaded_by_user_id" uuid,
	"kind" "document_kind" DEFAULT 'other' NOT NULL,
	"visibility" "file_visibility" DEFAULT 'internal' NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"mime_type" varchar(160) NOT NULL,
	"size_bytes" integer NOT NULL,
	"storage_bucket" varchar(120) NOT NULL,
	"storage_key" text NOT NULL,
	"checksum_sha256" varchar(64),
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"email" varchar(255) NOT NULL,
	"role" "user_role" NOT NULL,
	"token_hash" text NOT NULL,
	"invited_by_user_id" uuid,
	"accepted_by_user_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"client_id" uuid,
	"subscription_id" uuid,
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
--> statement-breakpoint
CREATE TABLE "memberships" (
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "user_role" NOT NULL,
	"status" "membership_status" DEFAULT 'active' NOT NULL,
	"invited_by_user_id" uuid,
	"joined_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "memberships_organization_id_user_id_pk" PRIMARY KEY("organization_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"title" varchar(180) NOT NULL,
	"description" text,
	"due_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(160) NOT NULL,
	"body" text NOT NULL,
	"href" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(160) NOT NULL,
	"slug" varchar(80) NOT NULL,
	"legal_name" varchar(200),
	"website" varchar(255),
	"logo_url" text,
	"brand_color" varchar(32),
	"timezone" varchar(80) DEFAULT 'Europe/Istanbul' NOT NULL,
	"plan" varchar(40) DEFAULT 'starter' NOT NULL,
	"seat_limit" integer DEFAULT 5 NOT NULL,
	"active_project_limit" integer DEFAULT 10 NOT NULL,
	"storage_limit_mb" integer DEFAULT 10240 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "project_members" (
	"project_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "user_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_members_project_id_user_id_pk" PRIMARY KEY("project_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"assigned_pm_user_id" uuid,
	"created_by_user_id" uuid,
	"name" varchar(180) NOT NULL,
	"exhibition_name" varchar(180),
	"venue" varchar(180),
	"city" varchar(120),
	"country" varchar(120),
	"status" "project_status" DEFAULT 'planning' NOT NULL,
	"health" "project_health" DEFAULT 'on_track' NOT NULL,
	"budget_cents" integer DEFAULT 0 NOT NULL,
	"currency" varchar(3) DEFAULT 'EUR' NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"deadline_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid,
	"refresh_token_hash" text NOT NULL,
	"user_agent" text,
	"ip_address" varchar(80),
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"rotated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"stripe_customer_id" varchar(120),
	"stripe_subscription_id" varchar(120),
	"stripe_price_id" varchar(120),
	"plan" varchar(40) NOT NULL,
	"status" "subscription_status" NOT NULL,
	"seats_included" integer DEFAULT 5 NOT NULL,
	"active_projects_included" integer DEFAULT 10 NOT NULL,
	"storage_included_mb" integer DEFAULT 10240 NOT NULL,
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid,
	"milestone_id" uuid,
	"assigned_to_user_id" uuid,
	"created_by_user_id" uuid,
	"title" varchar(180) NOT NULL,
	"description" text,
	"status" "task_status" DEFAULT 'todo' NOT NULL,
	"priority" "task_priority" DEFAULT 'normal' NOT NULL,
	"due_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(160) NOT NULL,
	"role" "user_role" DEFAULT 'client' NOT NULL,
	"password_hash" text,
	"email_verified_at" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"disabled_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_booth_version_id_booth_versions_id_fk" FOREIGN KEY ("booth_version_id") REFERENCES "public"."booth_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_responded_by_user_id_users_id_fk" FOREIGN KEY ("responded_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booth_designs" ADD CONSTRAINT "booth_designs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booth_designs" ADD CONSTRAINT "booth_designs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booth_designs" ADD CONSTRAINT "booth_designs_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booth_versions" ADD CONSTRAINT "booth_versions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booth_versions" ADD CONSTRAINT "booth_versions_design_id_booth_designs_id_fk" FOREIGN KEY ("design_id") REFERENCES "public"."booth_designs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booth_versions" ADD CONSTRAINT "booth_versions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booth_versions" ADD CONSTRAINT "booth_versions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_assigned_pm_user_id_users_id_fk" FOREIGN KEY ("assigned_pm_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_booth_version_id_booth_versions_id_fk" FOREIGN KEY ("booth_version_id") REFERENCES "public"."booth_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_accepted_by_user_id_users_id_fk" FOREIGN KEY ("accepted_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_assigned_pm_user_id_users_id_fk" FOREIGN KEY ("assigned_pm_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_milestone_id_milestones_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."milestones"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_to_user_id_users_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_events_org_created_idx" ON "activity_events" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "activity_events_project_idx" ON "activity_events" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "approvals_org_status_idx" ON "approvals" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "approvals_project_idx" ON "approvals" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "approvals_version_idx" ON "approvals" USING btree ("booth_version_id");--> statement-breakpoint
CREATE INDEX "booth_designs_project_idx" ON "booth_designs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "booth_designs_org_idx" ON "booth_designs" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "booth_versions_design_version_idx" ON "booth_versions" USING btree ("design_id","version_number");--> statement-breakpoint
CREATE INDEX "booth_versions_org_status_idx" ON "booth_versions" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "booth_versions_project_idx" ON "booth_versions" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "clients_org_company_idx" ON "clients" USING btree ("organization_id","company_name");--> statement-breakpoint
CREATE INDEX "clients_org_email_idx" ON "clients" USING btree ("organization_id","contact_email");--> statement-breakpoint
CREATE INDEX "clients_assigned_pm_idx" ON "clients" USING btree ("assigned_pm_user_id");--> statement-breakpoint
CREATE INDEX "comments_project_idx" ON "comments" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "comments_version_idx" ON "comments" USING btree ("booth_version_id");--> statement-breakpoint
CREATE INDEX "comments_author_idx" ON "comments" USING btree ("author_user_id");--> statement-breakpoint
CREATE INDEX "documents_org_kind_idx" ON "documents" USING btree ("organization_id","kind");--> statement-breakpoint
CREATE INDEX "documents_project_idx" ON "documents" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "documents_storage_idx" ON "documents" USING btree ("storage_bucket","storage_key");--> statement-breakpoint
CREATE INDEX "invitations_org_email_idx" ON "invitations" USING btree ("organization_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "invitations_token_hash_idx" ON "invitations" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_org_number_idx" ON "invoices" USING btree ("organization_id","invoice_number");--> statement-breakpoint
CREATE INDEX "invoices_org_status_idx" ON "invoices" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "memberships_org_role_idx" ON "memberships" USING btree ("organization_id","role");--> statement-breakpoint
CREATE INDEX "memberships_user_idx" ON "memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "milestones_project_idx" ON "milestones" USING btree ("project_id","sort_order");--> statement-breakpoint
CREATE INDEX "notifications_user_unread_idx" ON "notifications" USING btree ("user_id","read_at");--> statement-breakpoint
CREATE INDEX "notifications_org_created_idx" ON "notifications" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_slug_idx" ON "organizations" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "project_members_user_idx" ON "project_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "projects_org_status_idx" ON "projects" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "projects_client_idx" ON "projects" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "projects_pm_idx" ON "projects" USING btree ("assigned_pm_user_id");--> statement-breakpoint
CREATE INDEX "projects_deadline_idx" ON "projects" USING btree ("deadline_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_refresh_token_hash_idx" ON "sessions" USING btree ("refresh_token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_active_idx" ON "sessions" USING btree ("user_id","revoked_at");--> statement-breakpoint
CREATE INDEX "subscriptions_org_idx" ON "subscriptions" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_stripe_subscription_idx" ON "subscriptions" USING btree ("stripe_subscription_id");--> statement-breakpoint
CREATE INDEX "tasks_org_status_idx" ON "tasks" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "tasks_project_idx" ON "tasks" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "tasks_assignee_idx" ON "tasks" USING btree ("assigned_to_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");
