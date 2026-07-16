import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "tests/**/*.test.ts",
      "apps/worker/test/**/*.test.ts",
      "packages/*/test/**/*.test.ts",
    ],
    passWithNoTests: false,
  },
});
