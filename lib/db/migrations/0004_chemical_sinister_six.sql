ALTER TABLE "clients" ADD COLUMN "workspace_editor_subscription_active" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "workspace_editor_subscription_plan" varchar(40);--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "workspace_editor_subscription_status" varchar(40) DEFAULT 'inactive' NOT NULL;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "workspace_editor_extra_revision_rounds" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "workspace_editor_subscription_reference" varchar(120);--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "workspace_editor_subscription_updated_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "approvals_org_status_requested_idx" ON "approvals" USING btree ("organization_id","status","requested_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "approvals_org_project_status_requested_idx" ON "approvals" USING btree ("organization_id","project_id","status","requested_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "booth_designs_project_updated_idx" ON "booth_designs" USING btree ("project_id","updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clients_org_assigned_pm_updated_idx" ON "clients" USING btree ("organization_id","assigned_pm_user_id","updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clients_org_status_updated_idx" ON "clients" USING btree ("organization_id","status","updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clients_org_updated_idx" ON "clients" USING btree ("organization_id","updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_user_created_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_members_user_project_idx" ON "project_members" USING btree ("user_id","project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_members_project_role_idx" ON "project_members" USING btree ("project_id","role");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projects_org_status_updated_idx" ON "projects" USING btree ("organization_id","status","updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projects_org_updated_idx" ON "projects" USING btree ("organization_id","updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projects_org_health_updated_idx" ON "projects" USING btree ("organization_id","health","updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projects_org_pm_updated_idx" ON "projects" USING btree ("organization_id","assigned_pm_user_id","updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projects_org_pm_deadline_idx" ON "projects" USING btree ("organization_id","assigned_pm_user_id","deadline_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_org_assignee_status_due_idx" ON "tasks" USING btree ("organization_id","assigned_to_user_id","status","due_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_org_project_status_updated_idx" ON "tasks" USING btree ("organization_id","project_id","status","updated_at");
