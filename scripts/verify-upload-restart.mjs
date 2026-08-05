import { spawn, spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, ".env");

if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    )
      value = value.slice(1, -1);
    process.env[key] ??= value;
  }
}

if (!process.env.DATABASE_URL)
  throw new Error(
    "DATABASE_URL is required for upload persistence verification.",
  );
const sourceUrl = new URL(process.env.DATABASE_URL);
if (
  !["localhost", "127.0.0.1", "::1"].includes(sourceUrl.hostname) &&
  process.env.ALLOW_DISPOSABLE_DATABASE_TEST !== "1"
) {
  throw new Error(
    "Refusing to create a persistence database on a non-local host without ALLOW_DISPOSABLE_DATABASE_TEST=1.",
  );
}

const suffix = `${Date.now()}_${randomBytes(3).toString("hex")}`;
const databaseName = `premium_saas_persistence_${suffix}`;
const databaseUrl = new URL(sourceUrl);
databaseUrl.pathname = `/${databaseName}`;
const port = process.env.UPLOAD_PERSISTENCE_API_PORT ?? "5102";
const origin = `http://127.0.0.1:${port}`;
const storageRoot = mkdtempSync(join(tmpdir(), "premium-saas-storage-"));
const requireFromDb = createRequire(resolve(root, "lib/db/package.json"));
const { Pool } = requireFromDb("pg");
const administrationPool = new Pool({ connectionString: sourceUrl.toString() });
const authSecret = randomBytes(32).toString("hex");
const encryptionKey = randomBytes(32).toString("hex");
let apiProcess;
let databaseCreated = false;

function quoteDatabase(value) {
  if (!/^premium_saas_persistence_[a-z0-9_]+$/.test(value))
    throw new Error(`Unsafe persistence database name: ${value}`);
  return `"${value}"`;
}

function run(command, args, env = process.env) {
  const label = [command, ...args].join(" ");
  const result =
    process.platform === "win32"
      ? spawnSync(label, { cwd: root, env, shell: true, stdio: "inherit" })
      : spawnSync(command, args, { cwd: root, env, stdio: "inherit" });
  if (result.status !== 0)
    throw new Error(
      `${label} failed with exit code ${result.status ?? "unknown"}.`,
    );
}

function startApi(env) {
  return spawn(
    process.execPath,
    ["--enable-source-maps", "artifacts/api-server/dist/index.mjs"],
    {
      cwd: root,
      env,
      shell: false,
      stdio: "inherit",
    },
  );
}

async function waitForReadiness(child) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null)
      throw new Error(
        `Production API exited before readiness with code ${child.exitCode}.`,
      );
    try {
      const response = await fetch(`${origin}/api/healthz/ready`);
      if (response.ok) return;
    } catch {
      // The service is still binding.
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }
  throw new Error(
    "Production API did not become ready for persistence verification.",
  );
}

async function stopApi() {
  if (!apiProcess || apiProcess.exitCode !== null) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(apiProcess.pid), "/t", "/f"], {
      stdio: "ignore",
    });
  } else {
    apiProcess.kill("SIGTERM");
    await Promise.race([
      new Promise((resolveExit) => apiProcess.once("exit", resolveExit)),
      new Promise((resolveWait) => setTimeout(resolveWait, 5_000)),
    ]);
    if (apiProcess.exitCode === null) apiProcess.kill("SIGKILL");
  }
  apiProcess = undefined;
}

function cookiesFrom(response) {
  const values =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [response.headers.get("set-cookie")].filter(Boolean);
  return values.map((value) => value.split(";", 1)[0]).join("; ");
}

async function expectResponse(response, label) {
  if (response.ok) return response;
  throw new Error(
    `${label} failed with ${response.status}: ${await response.text()}`,
  );
}

function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

const serviceEnv = {
  ...process.env,
  DATABASE_URL: databaseUrl.toString(),
  NODE_ENV: "test",
  PORT: port,
  AUTH_SECRET: authSecret,
  MESSAGE_ENCRYPTION_KEY: encryptionKey,
  STAFF_SIGNUP_KEY: "persistence-test-staff-key",
  APP_URL: origin,
  CORS_ORIGIN: origin,
  STORAGE_PROVIDER: "local",
  DOCUMENT_STORAGE_DIR: join(storageRoot, "documents"),
  MESSAGE_ATTACHMENT_DIR: join(storageRoot, "message-attachments"),
};

try {
  await administrationPool.query(
    `create database ${quoteDatabase(databaseName)}`,
  );
  databaseCreated = true;
  run("pnpm", ["--filter", "@workspace/db", "run", "migrate"], serviceEnv);
  if (process.env.UPLOAD_PERSISTENCE_SKIP_BUILD !== "1") {
    run(
      "pnpm",
      ["--filter", "@workspace/api-server", "run", "build"],
      serviceEnv,
    );
  }

  apiProcess = startApi(serviceEnv);
  await waitForReadiness(apiProcess);

  const email = `persistence-${suffix}@example.test`;
  const password = "PersistenceTest2026!";
  const signup = await expectResponse(
    await fetch(`${origin}/api/auth/signup-staff`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Persistence Chief",
        company: `Persistence ${suffix}`,
        email,
        password,
        role: "chief",
        setupKey: serviceEnv.STAFF_SIGNUP_KEY,
      }),
    }),
    "Chief signup",
  );
  let cookie = cookiesFrom(signup);
  if (!cookie) {
    const signupBody = await signup.json();
    const login = await expectResponse(
      await fetch(`${origin}/api/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          organizationSlug: signupBody.user?.organizationSlug ?? null,
        }),
      }),
      "Chief login",
    );
    cookie = cookiesFrom(login);
  }
  if (!cookie)
    throw new Error("Authentication did not return a session cookie.");

  const documentBytes = Buffer.from(`durable-document-${suffix}`);
  const documentUpload = await expectResponse(
    await fetch(`${origin}/api/platform/documents/upload`, {
      method: "POST",
      headers: {
        cookie,
        "content-type": "application/pdf",
        "x-content-type": "application/pdf",
        "x-file-name": "restart-proof.pdf",
        "x-document-kind": "other",
        "x-visibility": "internal",
      },
      body: documentBytes,
    }),
    "Document upload",
  );
  const document = await documentUpload.json();

  const messageBytes = Buffer.from(`durable-message-attachment-${suffix}`);
  const messageUpload = await expectResponse(
    await fetch(`${origin}/api/platform/messages/attachments`, {
      method: "POST",
      headers: {
        cookie,
        "content-type": "application/pdf",
        "x-file-name": "restart-message.pdf",
      },
      body: messageBytes,
    }),
    "Message attachment upload",
  );
  const messageAttachment = (await messageUpload.json()).attachment;

  await stopApi();
  apiProcess = startApi(serviceEnv);
  await waitForReadiness(apiProcess);

  const documentDownload = await expectResponse(
    await fetch(`${origin}${document.downloadUrl}`, { headers: { cookie } }),
    "Document download after restart",
  );
  const downloadedDocument = Buffer.from(await documentDownload.arrayBuffer());
  if (digest(downloadedDocument) !== digest(documentBytes))
    throw new Error("Document checksum changed across API restart.");

  const messageDownload = await expectResponse(
    await fetch(`${origin}/api${messageAttachment.url}`, {
      headers: { cookie },
    }),
    "Message attachment download after restart",
  );
  const downloadedMessage = Buffer.from(await messageDownload.arrayBuffer());
  if (digest(downloadedMessage) !== digest(messageBytes))
    throw new Error("Message attachment checksum changed across API restart.");

  console.log(
    "Document and encrypted message attachment persistence passed across a production API restart.",
  );
} finally {
  await stopApi();
  if (databaseCreated)
    await administrationPool.query(
      `drop database if exists ${quoteDatabase(databaseName)} with (force)`,
    );
  await administrationPool.end();
  rmSync(storageRoot, { recursive: true, force: true });
}
