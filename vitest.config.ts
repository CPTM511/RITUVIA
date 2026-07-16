import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  oxc: {
    jsx: {
      importSource: "react",
      runtime: "automatic",
    },
  },
  resolve: {
    alias: {
      "@rituvia/config/feature-flags": fileURLToPath(
        new URL("./packages/config/src/feature-flags.ts", import.meta.url),
      ),
      "@rituvia/db": fileURLToPath(new URL("./packages/db/src/index.ts", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    include: [
      "tests/**/*.test.ts",
      "apps/web/test/**/*.test.ts",
      "apps/web/test/**/*.test.tsx",
      "apps/worker/test/**/*.test.ts",
      "packages/*/test/**/*.test.ts",
    ],
    passWithNoTests: false,
  },
});
