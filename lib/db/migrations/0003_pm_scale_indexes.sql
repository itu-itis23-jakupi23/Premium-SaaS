ALTER TABLE "direct_conversations" ADD COLUMN IF NOT EXISTS "project_id" uuid REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_conversations" ADD COLUMN IF NOT EXISTS "exhibition_key" text NOT NULL DEFAULT 'general';--> statement-breakpoint
ALTER TABLE "direct_conversations" ADD COLUMN IF NOT EXISTS "exhibition_name" text;--> statement-breakpoint
ALTER TABLE "direct_conversations" DROP CONSTRAINT IF EXISTS "direct_conversations_org_pair_unique";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "direct_conversations_org_pair_scope_unique_idx" ON "direct_conversations" USING btree ("organization_id","participant_one_user_id","participant_two_user_id","exhibition_key");--> statement-breakpoint
ALTER TABLE "direct_messages" ADD COLUMN IF NOT EXISTS "attachments" jsonb NOT NULL DEFAULT '[]'::jsonb;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clients_org_assigned_pm_updated_idx" ON "clients" USING btree ("organization_id","assigned_pm_user_id","updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projects_org_pm_updated_idx" ON "projects" USING btree ("organization_id","assigned_pm_user_id","updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projects_org_pm_deadline_idx" ON "projects" USING btree ("organization_id","assigned_pm_user_id","deadline_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_org_assignee_status_due_idx" ON "tasks" USING btree ("organization_id","assigned_to_user_id","status","due_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_org_project_status_updated_idx" ON "tasks" USING btree ("organization_id","project_id","status","updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "approvals_org_status_requested_idx" ON "approvals" USING btree ("organization_id","status","requested_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "approvals_org_project_status_requested_idx" ON "approvals" USING btree ("organization_id","project_id","status","requested_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activity_events_org_request_metadata_idx" ON "activity_events" USING btree ("organization_id", ((metadata ->> 'requestId')));--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_user_created_idx" ON "notifications" USING btree ("user_id","created_at");
