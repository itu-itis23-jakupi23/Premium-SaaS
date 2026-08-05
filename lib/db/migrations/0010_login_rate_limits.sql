CREATE TABLE IF NOT EXISTS "login_rate_limits" (
  "key" text PRIMARY KEY,
  "attempts" integer NOT NULL DEFAULT 1,
  "window_start" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "login_rate_limits_window_idx" ON "login_rate_limits" USING btree ("window_start");
