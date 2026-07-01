import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    testTimeout: 15000,
    hookTimeout: 15000,
    // Integration tests mutate process.env (NODE_ENV, AUTH_SECRET) to test
    // production-mode behaviour. Running files in parallel would allow those
    // mutations to race with other test files that share the same Node process.
    // Run files sequentially so env mutations are safely scoped per file.
    fileParallelism: false,
  },
});
