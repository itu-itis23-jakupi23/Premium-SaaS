import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { webhookRouter } from "./routes/billing";
import { logger } from "./lib/logger";
import { validateMessageEncryptionConfig } from "./lib/messageCrypto";
import { assertRuntimeEnvironment } from "./lib/env";

const app: Express = express();
assertRuntimeEnvironment();
validateMessageEncryptionConfig();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(
  cors({
    origin: corsOrigin(),
    credentials: true,
  }),
);
app.use(cookieParser());

// Stripe webhook needs the raw, unparsed body to verify signatures — it must be
// mounted before express.json() or the body will already be consumed.
app.use(webhookRouter);

// Structured workspace saves can include panel/room graphics, so keep the limit
// configurable. File uploads still use express.raw() on specific routes
// (/documents/upload, /messages/attachments) with their own limits.
app.use(express.json({ limit: apiJsonLimit() }));
app.use(express.urlencoded({ extended: true, limit: apiJsonLimit() }));

app.get("/.well-known/appspecific/com.chrome.devtools.json", (_req, res) => {
  res.status(204).end();
});

app.get("/api", (_req, res) => {
  res.json({
    ok: true,
    service: "ENS Premium SaaS API",
    health: "/api/health",
    readiness: "/api/healthz/ready",
  });
});

app.use("/api", router);

// Global error handler: always returns JSON so test assertions can read the
// error message. The error detail is intentionally verbose in non-production
// environments; production gets a generic message.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const error = err as {
    type?: string;
    status?: number;
    statusCode?: number;
    message?: string;
  };
  if (
    error?.type === "entity.too.large" ||
    error?.status === 413 ||
    error?.statusCode === 413
  ) {
    res.status(413).json({
      error: {
        code: "payload_too_large",
        message: `The request exceeded the API JSON limit (${apiJsonLimit()}). Use smaller workspace images or increase API_JSON_LIMIT.`,
      },
    });
    return;
  }

  const message = err instanceof Error ? err.message : "Internal server error";
  const status = error.status ?? error.statusCode ?? 500;
  const verbose = process.env.NODE_ENV !== "production" || process.env.VITEST;
  res.status(status).json({
    error: {
      code: "internal_error",
      message: verbose ? message : "An unexpected error occurred.",
    },
  });
});

export default app;

function corsOrigin() {
  const configured = process.env.CORS_ORIGIN;
  if (configured) {
    const origins = configured
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean);
    return origins.length > 1 ? origins : origins[0];
  }
  return process.env.NODE_ENV === "production" ? false : true;
}

function apiJsonLimit() {
  return process.env.API_JSON_LIMIT?.trim() || "75mb";
}
