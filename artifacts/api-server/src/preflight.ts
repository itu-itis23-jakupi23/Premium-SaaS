import "./lib/load-env";
import { validateRuntimeEnvironment } from "./lib/env";
import { describeLeadIntakeFailure, resolveLeadIntakeOrganization } from "./lib/lead-intake";

const result = validateRuntimeEnvironment();

if (result.warnings.length > 0) {
  for (const warning of result.warnings) {
    console.warn(`[deployment:${result.profile}] ${warning}`);
  }
}

if (result.errors.length > 0) {
  console.error(`Invalid ${result.profile} deployment environment:`);
  for (const error of result.errors) console.error(`- ${error}`);
  process.exit(1);
}

/**
 * The half the synchronous env pass cannot do: prove the configured lead-intake
 * slug names a real organization.
 *
 * This needs a database, and this gate also runs in CI's verify job, which has
 * no Postgres service. So a database that cannot be reached is reported and
 * skipped rather than failed - it is not evidence of a misconfigured slug, and
 * turning "no database here" into a red gate would only teach people to ignore
 * it. The guarantee that a misconfigured slug never reaches production is held
 * by the server entrypoint, which refuses to listen; this is the earlier,
 * best-effort warning.
 */
async function checkLeadIntake() {
  if (!process.env.DATABASE_URL) {
    console.warn("[deployment] Skipping lead-intake organization check: DATABASE_URL is not set.");
    return;
  }

  let resolution;
  try {
    resolution = await resolveLeadIntakeOrganization();
  } catch (error) {
    console.warn(
      `[deployment] Skipping lead-intake organization check: database unreachable (${(error as Error).message}).`,
    );
    return;
  }

  if (!resolution.ok) {
    console.error("Lead intake cannot work with this configuration:");
    console.error(`- ${describeLeadIntakeFailure(resolution)}`);
    process.exit(1);
  }

  console.log(`Lead intake organization resolved: ${resolution.slug}`);
}

await checkLeadIntake();

console.log(`Runtime environment preflight passed (${result.profile}).`);
