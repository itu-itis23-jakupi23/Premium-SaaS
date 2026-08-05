import app from "./app";
import { logger } from "./lib/logger";
import { startTaskReminderWorker } from "./lib/taskReminders";
import { startAutomationSweeps } from "./lib/automationSweeps";

const rawPort = process.env.PORT || "5000";
const port = Number(rawPort);

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  startTaskReminderWorker();
  startAutomationSweeps();
});
