CREATE INDEX IF NOT EXISTS "clients_org_status_updated_idx" ON "clients" USING btree ("organization_id","status","updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clients_org_updated_idx" ON "clients" USING btree ("organization_id","updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projects_org_status_updated_idx" ON "projects" USING btree ("organization_id","status","updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projects_org_updated_idx" ON "projects" USING btree ("organization_id","updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projects_org_health_updated_idx" ON "projects" USING btree ("organization_id","health","updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_members_user_project_idx" ON "project_members" USING btree ("user_id","project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_members_project_role_idx" ON "project_members" USING btree ("project_id","role");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "booth_designs_project_updated_idx" ON "booth_designs" USING btree ("project_id","updated_at");
