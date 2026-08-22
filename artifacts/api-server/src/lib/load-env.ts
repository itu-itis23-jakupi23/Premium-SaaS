import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Loads the repository `.env` before anything else reads `process.env`.
 *
 * The API used to take its whole configuration from whatever the launching
 * shell happened to export - `replit.md` still says DATABASE_URL is needed "in
 * the shell". For most settings that is merely inconvenient. For
 * MESSAGE_ENCRYPTION_KEY it is destructive: a message encrypted under one
 * run's key cannot be read back under another's, and AES-GCM failure is not
 * recoverable. Messages written by a server started one way became permanently
 * unreadable to a server started another way, and the UI showed a placeholder
 * with no indication why.
 *
 * Values already present in the environment win, so a deployment that sets real
 * secrets is never overridden by a local file. This only fills the gaps.
 *
 * Imported for its side effect, and it must be the first import in the entry
 * point: ES module imports are evaluated in order, so anything importing this
 * after `./app` would run too late to matter.
 */

const here = dirname(fileURLToPath(import.meta.url));

function findEnvFile(): string | null {
  let dir = here;
  for (let depth = 0; depth < 6; depth += 1) {
    const candidate = resolve(dir, ".env");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function parseEnv(contents: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    if (!key) continue;
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

const envPath = findEnvFile();
if (envPath) {
  for (const [key, value] of Object.entries(parseEnv(readFileSync(envPath, "utf8")))) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

export const loadedEnvPath = envPath;
