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
import { initSchema, pool } from "./db.js";
import invitationsRouter from "./routes/invitations.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IS_PROD   = process.env.NODE_ENV === "production";
const PORT      = Number(process.env.PORT ?? 5000);
const APP_URL   = (process.env.APP_URL ?? `http://localhost:${PORT}`).replace(/\/$/, "");

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
app.use(express.json());

// ── Health check ──────────────────────────────────────────────────────────────

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", ts: new Date().toISOString() });
});

// ── API routes ────────────────────────────────────────────────────────────────

app.use("/api/platform/managers/invitations", invitationsRouter);

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
  try {
    await initSchema();
  } catch (err) {
    console.error("[db] Failed to connect or migrate — check DATABASE_URL.\n", err);
    process.exit(1);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`\n  ENS API server running on http://localhost:${PORT}`);
    if (!IS_PROD) {
      console.log(`   Frontend dev server: http://localhost:5173  (proxies /api here)`);
    }
    console.log(`   API health: http://localhost:${PORT}/api/health\n`);
  });
}

start();

// Graceful shutdown — drain the PG connection pool on SIGTERM / SIGINT
async function shutdown(signal: string) {
  console.log(`\n[server] ${signal} received — shutting down`);
  await pool.end();
  process.exit(0);
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));
