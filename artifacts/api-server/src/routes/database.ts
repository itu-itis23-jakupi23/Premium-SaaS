import { count } from "drizzle-orm";
import type { AnyPgTable } from "drizzle-orm/pg-core";
import { Router, type IRouter, type Request } from "express";
import {
  activityEvents,
  approvals,
  boothDesigns,
  boothVersions,
  checkDatabaseConnection,
  clients,
  db,
  documents,
  organizations,
  projects,
  users,
} from "@workspace/db";
import { requireAuth, requireRoles } from "../middlewares/session";

const router: IRouter = Router();

router.get("/db/status", requireAuth, requireRoles(["admin", "owner", "chief"]), async (_req, res) => {
  try {
    const [
      connection,
      organizationCount,
      userCount,
      clientCount,
      projectCount,
      designCount,
      versionCount,
      approvalCount,
      documentCount,
      activityCount,
    ] = await Promise.all([
      checkDatabaseConnection(),
      tableCount(organizations),
      tableCount(users),
      tableCount(clients),
      tableCount(projects),
      tableCount(boothDesigns),
      tableCount(boothVersions),
      tableCount(approvals),
      tableCount(documents),
      tableCount(activityEvents),
    ]);

    res.json({
      status: "ok",
      database: connection,
      tables: {
        organizations: organizationCount,
        users: userCount,
        clients: clientCount,
        projects: projectCount,
        boothDesigns: designCount,
        boothVersions: versionCount,
        approvals: approvalCount,
        documents: documentCount,
        activityEvents: activityCount,
      },
    });
  } catch (error) {
    reqLogError(_req, error);
    res.status(503).json({
      status: "error",
      database: {
        connected: false,
      },
    });
  }
});

async function tableCount(table: AnyPgTable) {
  const result = await db.select({ value: count() }).from(table);
  return result[0]?.value ?? 0;
}

function reqLogError(req: Request, error: unknown) {
  const log = (req as Request & { log?: { error: (data: unknown, message: string) => void } }).log;
  log?.error({ err: error }, "Database status check failed");
}

export default router;
