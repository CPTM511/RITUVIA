import { describe, expect, it } from "vitest";

import { assertCiDatabaseEnvironment, assertCiServiceAddress } from "../src/ci-database-safety.js";
import { assertSyntheticSeedTarget } from "../src/local-seed-safety.js";

const runId = "123456789";
const runAttempt = "2";
const adminPassword = `rituvia-ci-${runId}-${runAttempt}-admin`;
const systemIdentifier = "7663118810993884782";

describe("CI database safety", () => {
  it("derives only the exact ephemeral loopback targets", () => {
    const environment = assertCiDatabaseEnvironment({
      adminPassword,
      ci: "true",
      githubActions: "true",
      githubRunAttempt: runAttempt,
      githubRunId: runId,
    });
    const appUrl = new URL(environment.appUrl);
    expect(appUrl.hostname).toBe("127.0.0.1");
    expect(appUrl.port).toBe("5432");
    expect(appUrl.username).toBe("rituvia_ci_app");
    expect(appUrl.pathname).toBe("/rituvia_ci");
    expect(appUrl.searchParams.get("sslmode")).toBe("disable");
    const migratorUrl = new URL(environment.migratorUrl);
    expect(migratorUrl.username).toBe("rituvia_ci_migrator");
    expect(migratorUrl.searchParams.get("application_name")).toBe("rituvia_ci_migrator");
    expect(new URL(environment.controlUrl).username).toBe("rituvia_ci_config_writer");
    expect(
      assertSyntheticSeedTarget({
        appEnvironment: "test",
        ci: "true",
        databaseUrl: environment.migratorUrl,
        expectedClusterName: undefined,
        expectedSystemIdentifier: systemIdentifier,
        githubActions: "true",
        githubRunAttempt: runAttempt,
        githubRunId: runId,
        seedTarget: "ci",
      }),
    ).toEqual({
      databaseName: "rituvia_ci",
      expectedSystemIdentifier: systemIdentifier,
      kind: "ci",
    });
  });

  it.each([
    ["missing CI", undefined, "true", runId, runAttempt, adminPassword],
    ["missing Actions", "true", undefined, runId, runAttempt, adminPassword],
    ["bad run id", "true", "true", "not-a-run", runAttempt, adminPassword],
    ["bad attempt", "true", "true", runId, "x", adminPassword],
    ["wrong password", "true", "true", runId, runAttempt, `${adminPassword}-wrong`],
  ])("rejects %s without exposing credentials", (_name, ci, actions, id, attempt, password) => {
    let diagnostic = "";
    try {
      assertCiDatabaseEnvironment({
        adminPassword: password,
        ci,
        githubActions: actions,
        githubRunAttempt: attempt,
        githubRunId: id,
      });
    } catch (error) {
      diagnostic = error instanceof Error ? error.message : String(error);
    }
    expect(diagnostic).toContain("exact ephemeral GitHub Actions target");
    expect(diagnostic).not.toContain(adminPassword);
  });

  it("rejects remote or mutated seed URLs", () => {
    const environment = assertCiDatabaseEnvironment({
      adminPassword,
      ci: "true",
      githubActions: "true",
      githubRunAttempt: runAttempt,
      githubRunId: runId,
    });
    const remote = new URL(environment.migratorUrl);
    remote.hostname = "198.51.100.10";
    expect(() =>
      assertSyntheticSeedTarget({
        appEnvironment: "test",
        ci: "true",
        databaseUrl: remote.toString(),
        expectedClusterName: undefined,
        expectedSystemIdentifier: systemIdentifier,
        githubActions: "true",
        githubRunAttempt: runAttempt,
        githubRunId: runId,
        seedTarget: "ci",
      }),
    ).toThrow(/attested local database target/);
  });

  it("accepts only loopback or private service-container addresses", () => {
    expect(() => assertCiServiceAddress("127.0.0.1")).not.toThrow();
    expect(() => assertCiServiceAddress("172.17.0.2")).not.toThrow();
    expect(() => assertCiServiceAddress("10.0.0.4")).not.toThrow();
    expect(() => assertCiServiceAddress("192.168.1.5")).not.toThrow();
    expect(() => assertCiServiceAddress("198.51.100.10")).toThrow(
      /exact ephemeral GitHub Actions target/,
    );
    expect(() => assertCiServiceAddress("172.32.0.1")).toThrow(
      /exact ephemeral GitHub Actions target/,
    );
  });
});
