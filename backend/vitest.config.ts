import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    // Tests never touch the real database or keys
    env: {
      NODE_ENV: "test",
      DATABASE_FILE: ":memory:",
      ENCRYPTION_KEY: "33".repeat(32),
      BLIND_INDEX_KEY: "44".repeat(32),
    },
  },
});
