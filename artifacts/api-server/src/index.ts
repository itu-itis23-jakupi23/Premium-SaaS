// Must stay first: ES imports evaluate in order, and everything below reads
// process.env as it loads. See lib/load-env.ts for why this matters.
import "./lib/load-env";
import app from "./app";
import { logger } from "./lib/logger";
import { errorReportingConfigured, installProcessErrorHandlers } from "./lib/error-reporting";
import { startTaskReminderWorker, stopTaskReminderWorker } from "./lib/taskReminders";
import { startAutomationSweeps, stopAutomationSweeps } from "./lib/automationSweeps";
import {
  describeLeadIntakeFailure,
  isFatalLeadIntakeFailure,
  resolveLeadIntakeOrganization,
} from "./lib/lead-intake";
import { deploymentProfile } from "./lib/env";
import { createShutdownHandler, resolveGraceMs } from "./lib/shutdown";

const rawPort = process.env.PORT || "5000";
const port = Number(rawPort);

// OP-02: catch failures that never reach Express (background timers,
// detached promises) so they are reported rather than silently swallowed.
installProcessErrorHandlers();

if (!errorReportingConfigured()) {
  logger.warn(
    "ERROR_WEBHOOK_URL is not set: errors are logged but not delivered anywhere. Production deployments should configure a collector.",
  );
}

/**
 * Refuse to start when public lead intake could not work.
 *
 * A slug that names no organization is a deployment fault, and its only
 * symptom used to be a 503 shown to the visitor whose enquiry had just been
 * thrown away. Failing here makes it a deploy-time error instead of a
 * permanent, invisible leak at the top of the sales funnel.
 */
async function start() {
  const profile = deploymentProfile();
  try {
    const intake = await resolveLeadIntakeOrganization();
    if (intake.ok) {
      logger.info({ organizationId: intake.organizationId, slug: intake.slug }, "Lead intake organization resolved");
    } else if (isFatalLeadIntakeFailure(intake.reason, profile)) {
      logger.error(
        { reason: intake.reason, slug: intake.slug, profile },
        `Refusing to start: lead intake is misconfigured. ${describeLeadIntakeFailure(intake)}`,
      );
      process.exit(1);
    } else {
      logger.warn(
        { reason: intake.reason, slug: intake.slug, profile },
        `Lead intake is not usable yet. ${describeLeadIntakeFailure(intake)}`,
      );
    }
  } catch (err) {
    // A database that cannot be reached is not a slug problem; say so plainly
    // rather than blaming the configuration.
    logger.error({ err: (err as Error).message }, "Refusing to start: could not check lead intake (database unreachable)");
    process.exit(1);
  }

  const server = app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
    startTaskReminderWorker();
    startAutomationSweeps();
  });

  const shutdown = createShutdownHandler({
    server,
    stopWorkers: () => {
      stopTaskReminderWorker();
      stopAutomationSweeps();
    },
    log: logger,
    graceMs: resolveGraceMs(process.env.SHUTDOWN_GRACE_MS),
  });
  for (const signal of ["SIGTERM", "SIGINT"] as NodeJS.Signals[]) {
    process.on(signal, () => shutdown(signal));
  }
}

void start();
