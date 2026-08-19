import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Unit tests for the app's browser-free logic. A dedicated config (rather than
// reusing vite.config.ts) keeps the test run light: no React plugin chain, and
// a Node environment since the covered modules are pure and DOM-free.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
