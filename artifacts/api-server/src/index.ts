import app from "./app";
import { logger } from "./lib/logger";
import { errorReportingConfigured, installProcessErrorHandlers } from "./lib/error-reporting";
import { startTaskReminderWorker } from "./lib/taskReminders";
import { startAutomationSweeps } from "./lib/automationSweeps";

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

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  startTaskReminderWorker();
  startAutomationSweeps();
});
