import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { webhookRouter } from "./routes/billing";
import { logger } from "./lib/logger";

const app: Express = express();

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
app.use(cors({
  origin: corsOrigin(),
  credentials: true,
}));
app.use(cookieParser());

// Stripe webhook needs the raw, unparsed body to verify signatures — it must be
// mounted before express.json() or the body will already be consumed.
app.use(webhookRouter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Global error handler: always returns JSON so test assertions can read the
// error message. The error detail is intentionally verbose in non-production
// environments; production gets a generic message.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const message = err instanceof Error ? err.message : "Internal server error";
  const status = (err as { status?: number; statusCode?: number }).status ??
    (err as { status?: number; statusCode?: number }).statusCode ?? 500;
  const verbose = process.env.NODE_ENV !== "production" || process.env.VITEST;
  res.status(status).json({ error: { code: "internal_error", message: verbose ? message : "An unexpected error occurred." } });
});

export default app;

function corsOrigin() {
  const configured = process.env.CORS_ORIGIN;
  if (configured) {
    const origins = configured.split(",").map((origin) => origin.trim()).filter(Boolean);
    return origins.length > 1 ? origins : origins[0];
  }
  return process.env.NODE_ENV === "production" ? false : true;
}
