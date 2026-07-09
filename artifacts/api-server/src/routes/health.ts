import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

// Shallow health: responds instantly. /health is an alias for smoke-test compatibility.
router.get("/healthz", (_req, res) => {
  res.json(HealthCheckResponse.parse({ status: "ok" }));
});

router.get("/health", (_req, res) => {
  res.json(HealthCheckResponse.parse({ status: "ok" }));
});

// Deep health: verifies the Postgres connection, used by readiness probes and CI smoke tests.
router.get("/healthz/ready", async (_req, res) => {
  try {
    await db.execute(sql`select 1`);
    res.json({ status: "ok", db: "connected" });
  } catch (err) {
    res.status(503).json({ status: "error", db: "unavailable", detail: String(err) });
  }
});

export default router;
