/**
 * ENS Agency — Express API server
 *
 * Development:  npm run server        (port 5000, Vite dev server on 5173 proxies /api here)
 * Production:   npm run build && npm start  (serves built frontend + API on same port)
 */
import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import authRouter, { accountRouter } from "./routes/auth.js";
import messagesRouter from "./routes/messages.js";
import platformCoreRouter from "./routes/platform-core.js";
import { apiJsonLimit, productionConfigProblems } from "./config-readiness.js";
import { workspaceAssetDir } from "./workspace-assets.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IS_PROD   = process.env.NODE_ENV === "production";
const PORT      = Number(process.env.PORT ?? 5000);
const APP_URL   = (process.env.APP_URL ?? `http://localhost:${PORT}`).replace(/\/$/, "");

if (IS_PROD) {
  const problems = productionConfigProblems();
  if (problems.length) {
    console.error(`[prod] Refusing to start with incomplete configuration:\n- ${problems.join("\n- ")}`);
    process.exit(1);
  }
}

// Warn early if Resend key is missing
if (!process.env.RESEND_API_KEY) {
  console.warn(
    "\n  RESEND_API_KEY is not set — invitation emails will NOT be delivered.\n" +
    "   Get a free key at https://resend.com and add it to your .env.staff file.\n"
  );
}

const app = express();

// ── Middleware ────────────────────────────────────────────────────────────────

// In development allow requests from the Vite dev server (port 5173 / 5174 / 5175)
const allowedOrigins = IS_PROD
  ? [APP_URL]
  : ["http://localhost:5173", "http://localhost:5174", "http://localhost:5175"];

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: apiJsonLimit() }));
app.use("/workspace-assets", express.static(workspaceAssetDir, {
  maxAge: IS_PROD ? "7d" : "0",
  index: false,
}));

app.get("/.well-known/appspecific/com.chrome.devtools.json", (_req, res) => {
  res.status(204).end();
});

// ── Health check ──────────────────────────────────────────────────────────────

app.get("/api", (_req, res) => {
  res.json({
    ok: true,
    service: "ENS Premium SaaS local API",
    health: "/api/health",
    readiness: "/api/platform/system/readiness",
  });
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", ts: new Date().toISOString() });
});

// ── API routes ────────────────────────────────────────────────────────────────

app.use("/api/platform/messages", messagesRouter);
app.use("/api/platform", platformCoreRouter);
app.use("/api/platform/account", accountRouter);
app.use("/api/auth", authRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  const error = err as { type?: string; status?: number; message?: string };
  if (error?.type === "entity.too.large" || error?.status === 413) {
    return res.status(413).json({
      error: "Payload too large.",
      detail: `The request exceeded the API JSON limit (${apiJsonLimit()}). Use smaller images or configure API_JSON_LIMIT for larger workspace uploads.`,
    });
  }
  return next(err);
});

// ── Serve built frontend in production ───────────────────────────────────────
// (In development, Vite own server handles the frontend.)

if (IS_PROD) {
  // Try to serve the staff portal build; fall back to public build
  const staffDist  = path.resolve(__dirname, "../dist/staff");
  const publicDist = path.resolve(__dirname, "../dist/public");
  const distDir    = fs.existsSync(staffDist) ? staffDist : publicDist;

  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    // SPA fallback — return index.html for any non-API route
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api")) return next();
      res.sendFile(path.join(distDir, "index.html"));
    });
  } else {
    console.warn(`[prod] No frontend build found. Run 'npm run build:staff' first.`);
  }
}

// ── Start ─────────────────────────────────────────────────────────────────────
// Run schema migration first, then open the HTTP port.

async function start() {
  let pool: { end: () => Promise<void> } | null = null;

  if (process.env.DATABASE_URL) {
    try {
      const db = await import("./db.js");
      const invitationsRouter = (await import("./routes/invitations.js")).default;
      await db.initSchema();
      pool = db.pool;
      app.use("/api/platform/managers/invitations", invitationsRouter);
    } catch (err) {
      console.error("[db] Invitations disabled; database connection failed.\n", err);
    }
  } else {
    console.warn("[db] DATABASE_URL is not set; database-backed invitation routes are disabled.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`\n  ENS API server running on http://localhost:${PORT}`);
    if (!IS_PROD) {
      console.log(`   Frontend dev server: http://localhost:5173  (proxies /api here)`);
    }
    console.log(`   API health: http://localhost:${PORT}/api/health\n`);
  });

  async function shutdown(signal: string) {
    console.log(`\n[server] ${signal} received — shutting down`);
    if (pool) await pool.end();
    process.exit(0);
  }
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT",  () => shutdown("SIGINT"));
}

start();
