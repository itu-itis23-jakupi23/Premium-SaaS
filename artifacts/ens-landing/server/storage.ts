import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, "../.dev-data");

async function poolOrNull() {
  if (!process.env.DATABASE_URL) return null;
  try {
    const db = await import("./db.js");
    return db.pool;
  } catch (error) {
    if (process.env.NODE_ENV === "production") {
      throw error;
    }
    console.warn("[storage] Falling back to file storage; database unavailable.", error);
    return null;
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export async function readJsonStore<T>(key: string, seed: T): Promise<T> {
  const pool = await poolOrNull();
  if (pool) {
    const result = await pool.query<{ value: T }>("SELECT value FROM app_kv WHERE key = $1", [key]);
    if (result.rows[0]) return result.rows[0].value;
    const fresh = clone(seed);
    await writeJsonStore(key, fresh);
    return fresh;
  }

  const storePath = filePathFor(key);
  try {
    const raw = await fs.readFile(storePath, "utf8");
    return JSON.parse(raw) as T;
  } catch (error) {
    if ((error as { code?: string }).code !== "ENOENT") {
      try {
        await fs.mkdir(dataDir, { recursive: true });
        await fs.rename(storePath, `${storePath}.corrupt-${Date.now()}`);
      } catch {
        // Best-effort corrupt store recovery.
      }
    }
    const fresh = clone(seed);
    await writeJsonStore(key, fresh);
    return fresh;
  }
}

export async function writeJsonStore<T>(key: string, value: T) {
  const pool = await poolOrNull();
  if (pool) {
    await pool.query(
      `INSERT INTO app_kv (key, value, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (key)
       DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [key, JSON.stringify(value)],
    );
    return;
  }

  await fs.mkdir(dataDir, { recursive: true });
  const storePath = filePathFor(key);
  const tempPath = `${storePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(value, null, 2), "utf8");
  await replaceFileWithRetry(tempPath, storePath);
}

function filePathFor(key: string) {
  return path.join(dataDir, `${key}.json`);
}

async function replaceFileWithRetry(tempPath: string, storePath: string) {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      await fs.rename(tempPath, storePath);
      return;
    } catch (error) {
      lastError = error;
      const code = (error as { code?: string }).code;
      if (code !== "EPERM" && code !== "EACCES" && code !== "EBUSY") break;
      await delay(25 * (attempt + 1));
    }
  }

  try {
    await fs.copyFile(tempPath, storePath);
    await fs.unlink(tempPath).catch(() => undefined);
    return;
  } catch (copyError) {
    if ((copyError as { code?: string }).code === "ENOENT") {
      try {
        await fs.access(storePath);
        return;
      } catch {
        // Fall through and surface the original write failure.
      }
    }
    await fs.unlink(tempPath).catch(() => undefined);
    throw copyError || lastError;
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
