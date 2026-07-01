CREATE TYPE "public"."assignment_target" AS ENUM('project_pm', 'client_pm');--> statement-breakpoint
CREATE TABLE "project_assignment_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"target_type" "assignment_target" NOT NULL,
	"project_id" uuid,
	"client_id" uuid,
	"changed_by_user_id" uuid,
	"previous_pm_user_id" uuid,
	"new_pm_user_id" uuid,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_assignment_history" ADD CONSTRAINT "project_assignment_history_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_assignment_history" ADD CONSTRAINT "project_assignment_history_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_assignment_history" ADD CONSTRAINT "project_assignment_history_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_assignment_history" ADD CONSTRAINT "project_assignment_history_changed_by_user_id_users_id_fk" FOREIGN KEY ("changed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_assignment_history" ADD CONSTRAINT "project_assignment_history_previous_pm_user_id_users_id_fk" FOREIGN KEY ("previous_pm_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_assignment_history" ADD CONSTRAINT "project_assignment_history_new_pm_user_id_users_id_fk" FOREIGN KEY ("new_pm_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_assignment_history_org_created_idx" ON "project_assignment_history" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "project_assignment_history_project_idx" ON "project_assignment_history" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "project_assignment_history_client_idx" ON "project_assignment_history" USING btree ("client_id","created_at");