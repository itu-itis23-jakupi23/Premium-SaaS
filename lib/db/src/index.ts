import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

export async function checkDatabaseConnection() {
  const startedAt = Date.now();
  const result = await db.execute(sql<{ now: string }>`select now()::text as now`);

  return {
    connected: true,
    latencyMs: Date.now() - startedAt,
    serverTime: result.rows[0]?.now ?? null,
  };
}

export * from "./schema";
