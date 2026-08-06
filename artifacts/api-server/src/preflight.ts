import { validateRuntimeEnvironment } from "./lib/env";

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

console.log(`Runtime environment preflight passed (${result.profile}).`);
