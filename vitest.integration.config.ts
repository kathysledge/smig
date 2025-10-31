import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    environment: "node",
    testTimeout: 60000, // Longer timeout for integration tests
    setupFiles: ["./tests/integration/setup.ts"],
    include: ["tests/integration/**/*.test.ts", "tests/integration/**/*.spec.ts"],
    exclude: ["node_modules/**/*"],
    // Integration tests should run sequentially to avoid database and file conflicts
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    fileParallelism: false, // Prevent test files from running in parallel
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
});
