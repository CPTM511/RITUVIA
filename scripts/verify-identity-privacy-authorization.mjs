import { spawnSync } from "node:child_process";

const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

const focusedTests = [
  "packages/observability/test/context.test.ts",
  "packages/observability/test/redaction.test.ts",
  "packages/observability/test/runtime.test.ts",
  "packages/analytics/test/core-loop-analytics.test.ts",
  "packages/security/test/admin-authorization.test.ts",
  "packages/db/test/account-identity.test.ts",
  "packages/db/test/ci-database-safety.test.ts",
  "apps/web/test/account-auth-provider.test.ts",
  "apps/web/test/account-auth-server.test.ts",
  "apps/web/test/account-control.test.ts",
  "apps/web/test/account-history-route.test.ts",
  "apps/web/test/account-logout-routes.test.ts",
  "apps/web/test/account-me-route.test.ts",
  "apps/web/test/account-merge-route.test.ts",
  "apps/web/test/account-reading-history-route.test.ts",
  "apps/web/test/account-session-routes.test.ts",
  "apps/web/test/anonymous-session-route.test.ts",
  "apps/web/test/anonymous-session-server.test.ts",
  "apps/web/test/auth-callback-route.test.ts",
  "apps/web/test/auth-local-preview-route.test.ts",
  "apps/web/test/auth-start-route.test.ts",
  "apps/web/test/commerce-route.test.ts",
  "apps/web/test/core-loop-analytics.test.ts",
  "apps/web/test/metadata.test.ts",
  "apps/web/test/privacy-deletion-route.test.ts",
  "apps/web/test/privacy-export-crypto.test.ts",
  "apps/web/test/privacy-export-routes.test.ts",
  "apps/web/test/privacy-export-service.test.ts",
  "apps/web/test/proxy.test.ts",
  "apps/web/test/reflection-intention-route.test.ts",
  "apps/web/test/reflection-journal-route.test.ts",
  "apps/web/test/reflection-ritual-route.test.ts",
  "apps/web/test/revisit-route.test.ts",
  "apps/web/test/session-csrf.test.ts",
  "apps/web/test/state-consumer-contract.test.ts",
  "apps/web/test/tarot-reading-route.test.ts",
  "apps/web/test/tarot-reading-server.test.ts",
];

const commands = [
  {
    args: ["exec", "vitest", "run", ...focusedTests],
    label: "focused identity, privacy, authorization, and leakage tests",
  },
  {
    args: ["test:configuration-boundary"],
    label: "server-only configuration and secret isolation",
  },
  {
    args: ["test:account-merge-database"],
    label: "anonymous-to-account merge database boundary",
  },
  {
    args: ["test:account-control-database"],
    label: "account ownership and session-control database boundary",
  },
  {
    args: ["test:privacy-export-database"],
    label: "privacy export database boundary",
  },
  {
    args: ["test:privacy-deletion-database"],
    label: "privacy deletion and recovery database boundary",
  },
  {
    args: ["test:admin-security-database"],
    label: "admin authorization and audit database boundary",
  },
  {
    args: ["test:account-auth-browser"],
    label: "account authentication browser boundary",
  },
  {
    args: ["test:account-control-browser"],
    label: "account control and privacy browser boundary",
  },
  {
    args: ["test:privacy-control-browser"],
    label: "privacy export-to-deletion browser boundary",
  },
];

for (const [index, command] of commands.entries()) {
  process.stdout.write(`\n[RIT-057 ${index + 1}/${commands.length}] ${command.label}\n`);
  const result = spawnSync(pnpm, command.args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `RIT-057 security suite failed during ${command.label} with exit code ${result.status ?? "unknown"}.`,
    );
  }
}

process.stdout.write(
  "\nVerified the focused identity, privacy, authorization, database-recovery, browser, metadata, analytics, and private-log boundaries.\n",
);
