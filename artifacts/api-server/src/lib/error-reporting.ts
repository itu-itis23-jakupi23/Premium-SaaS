/**
 * Backend error reporting seam (OP-02).
 *
 * There is no error monitoring today: unhandled failures reach the JSON error
 * handler, get logged, and nothing else happens. Nobody learns that production
 * broke unless they are reading logs at the time.
 *
 * This is deliberately not a vendor integration. Choosing a provider needs an
 * account and a decision that is not ours to make, so this defines the seam
 * and a default sink that always works. Point `ERROR_WEBHOOK_URL` at Sentry,
 * a Slack incoming webhook, or an internal collector to start delivering; with
 * nothing configured, reports still reach the structured log at error level.
 *
 * Rules this module follows, because a monitoring path that misbehaves is
 * worse than none:
 *
 *   - It never throws. A failure while reporting an error must not replace the
 *     original error.
 *   - It never blocks the response. Delivery is fire-and-forget.
 *   - It never sends request bodies, headers, or cookies, which is where
 *     credentials and message plaintext live.
 */

import { logger } from "./logger";

export type ErrorContext = {
  /** Where the failure surfaced, e.g. "http" or "uncaughtException". */
  source: string;
  /** Correlates with the pino-http request id in the operational logs. */
  requestId?: string | number;
  method?: string;
  /** Route path only. Never a full URL, which can carry query parameters. */
  route?: string;
  statusCode?: number;
  organizationId?: string;
  userId?: string;
};

function webhookUrl(): string | null {
  const configured = process.env.ERROR_WEBHOOK_URL?.trim();
  return configured ? configured : null;
}

/** True when reports leave the process. Surfaced by the readiness probe. */
export function errorReportingConfigured(): boolean {
  return webhookUrl() !== null;
}

function serialiseError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  return { name: "NonError", message: String(error), stack: undefined };
}

/**
 * Report an error to the configured sink and the structured log.
 *
 * Safe to call from anywhere, including inside another error handler.
 */
export function reportError(error: unknown, context: ErrorContext): void {
  const serialised = serialiseError(error);

  try {
    logger.error(
      { err: serialised, ...context },
      `Unhandled error (${context.source})`,
    );
  } catch {
    // A logger failure must not escape an error handler.
  }

  const url = webhookUrl();
  if (!url) return;

  try {
    void fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        service: "ens-api",
        environment: process.env.NODE_ENV ?? "development",
        timestamp: new Date().toISOString(),
        error: serialised,
        context,
      }),
      signal: AbortSignal.timeout(5_000),
    }).catch((deliveryError) => {
      // Log and move on: an unreachable collector must not amplify an outage.
      logger.warn(
        { err: serialiseError(deliveryError) },
        "Error report delivery failed",
      );
    });
  } catch {
    // fetch construction can throw on a malformed URL. Never propagate.
  }
}

/**
 * Install process-level handlers for failures that bypass Express entirely.
 *
 * Neither handler exits the process: this API serves multiple tenants, and
 * tearing down every in-flight request because one background promise
 * rejected is a worse outcome than continuing in a known-degraded state. The
 * report is what makes that state visible.
 */
export function installProcessErrorHandlers(): void {
  process.on("uncaughtException", (error) => {
    reportError(error, { source: "uncaughtException" });
  });

  process.on("unhandledRejection", (reason) => {
    reportError(reason, { source: "unhandledRejection" });
  });
}
