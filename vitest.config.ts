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
      "@rituvia/ai": fileURLToPath(new URL("./packages/ai/src/index.ts", import.meta.url)),
      "@rituvia/analytics": fileURLToPath(
        new URL("./packages/analytics/src/index.ts", import.meta.url),
      ),
      "@rituvia/astrology-engine-native": fileURLToPath(
        new URL("./packages/astrology-engine-native/src/index.ts", import.meta.url),
      ),
      "@rituvia/config/feature-flags": fileURLToPath(
        new URL("./packages/config/src/feature-flags.ts", import.meta.url),
      ),
      "@rituvia/content": fileURLToPath(
        new URL("./packages/content/src/index.ts", import.meta.url),
      ),
      "@rituvia/country-policy": fileURLToPath(
        new URL("./packages/country-policy/src/index.ts", import.meta.url),
      ),
      "@rituvia/db": fileURLToPath(new URL("./packages/db/src/index.ts", import.meta.url)),
      "@rituvia/divination": fileURLToPath(
        new URL("./packages/divination/src/index.ts", import.meta.url),
      ),
      "@rituvia/domain": fileURLToPath(new URL("./packages/domain/src/index.ts", import.meta.url)),
      "@rituvia/i18n/testing": fileURLToPath(
        new URL("./packages/i18n/src/pseudolocale.ts", import.meta.url),
      ),
      "@rituvia/i18n/locale": fileURLToPath(
        new URL("./packages/i18n/src/locale.ts", import.meta.url),
      ),
      "@rituvia/i18n/lifecycle": fileURLToPath(
        new URL("./packages/i18n/src/lifecycle.ts", import.meta.url),
      ),
      "@rituvia/i18n/messages": fileURLToPath(
        new URL("./packages/i18n/src/messages.ts", import.meta.url),
      ),
      "@rituvia/i18n": fileURLToPath(new URL("./packages/i18n/src/index.ts", import.meta.url)),
      "@rituvia/payments/adapters/local": fileURLToPath(
        new URL("./packages/payments/src/adapters/local-hosted-checkout.ts", import.meta.url),
      ),
      "@rituvia/payments/adapters/stripe": fileURLToPath(
        new URL("./packages/payments/src/adapters/stripe-hosted-checkout.ts", import.meta.url),
      ),
      "@rituvia/payments": fileURLToPath(
        new URL("./packages/payments/src/index.ts", import.meta.url),
      ),
      "@rituvia/ui": fileURLToPath(new URL("./packages/ui/src/index.ts", import.meta.url)),
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
      "packages/*/test/**/*.test.tsx",
    ],
    passWithNoTests: false,
  },
});
