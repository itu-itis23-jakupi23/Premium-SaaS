import { Router, type IRouter } from "express";
import { logger } from "../lib/logger";

/**
 * Collector for frontend error reports (OP-02).
 *
 * The browser's error-reporting seam (ens-landing/src/lib/error-reporting.ts)
 * beacons render crashes, unhandled rejections, and window.onerror here. This
 * endpoint lands them in the same structured pino stream as backend errors, so
 * a crash in a customer's browser is finally visible to the team without any
 * third-party monitoring vendor.
 *
 * It is intentionally defensive: a monitoring path that misbehaves is worse
 * than none.
 *   - Public (no auth): crashes happen before login and on public pages.
 *   - Never trusts the payload: every field is length-capped before logging.
 *   - Rate limited per IP so a render loop cannot flood the logs.
 *   - Always answers 204, even on garbage input — the client never blocks on it.
 */

const router: IRouter = Router();

// Per-process, per-IP sliding window. The client already dedups and caps at 20
// reports per session; this is defense in depth against a hostile caller.
const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW_MS = 60_000;
const hits = new Map<string, { count: number; windowStart: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    hits.set(ip, { count: 1, windowStart: now });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT_MAX;
}

// Opportunistically evict stale windows so the map cannot grow unbounded.
function sweep() {
  const now = Date.now();
  for (const [ip, entry] of hits) {
    if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS) hits.delete(ip);
  }
}

function str(value: unknown, max: number): string | undefined {
  if (typeof value !== "string" || value.length === 0) return undefined;
  return value.length > max ? `${value.slice(0, max)}…[truncated]` : value;
}

router.post("/client-errors", (req, res) => {
  // Answer immediately; logging is best-effort and must never surface to the user.
  res.status(204).end();

  try {
    const ip = req.ip ?? "unknown";
    if (rateLimited(ip)) return;
    if (hits.size > 1000) sweep();

    const body = (req.body ?? {}) as Record<string, unknown>;
    const error = (body.error ?? {}) as Record<string, unknown>;
    const context = (body.context ?? {}) as Record<string, unknown>;

    logger.error(
      {
        source: "frontend",
        frontendSource: str(context.source, 100),
        path: str(body.path, 500),
        userAgent: str(body.userAgent, 500),
        clientTimestamp: str(body.timestamp, 40),
        err: {
          message: str(error.message, 2000),
          stack: str(error.stack, 8000),
        },
        componentStack: str(context.componentStack, 8000),
      },
      "Frontend error report",
    );
  } catch {
    // A collector that throws while collecting is worse than a lost report.
  }
});

export default router;
