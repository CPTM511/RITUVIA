import { describe, expect, it } from "vitest";

import { assertSyntheticSeedTarget } from "../src/local-seed-safety.js";

const clusterName = "rituvia_7663118810993884782";
const passwordCanary = "seed-password-canary";

const createUrl = () => {
  const url = new URL("postgresql://127.0.0.1");
  url.username = "rituvia_app";
  url.password = passwordCanary;
  url.port = "55432";
  url.pathname = "/rituvia_local";
  url.searchParams.set("application_name", "rituvia_local");
  url.searchParams.set("connect_timeout", "5");
  url.searchParams.set("schema", "public");
  url.searchParams.set("sslmode", "disable");
  return url;
};

describe("synthetic seed target", () => {
  it("accepts only the exact repository-local URL shape", () => {
    const url = createUrl();
    expect(
      assertSyntheticSeedTarget({
        appEnvironment: "local",
        databaseUrl: url.toString(),
        expectedClusterName: clusterName,
        seedTarget: "local",
      }),
    ).toEqual({ databaseName: "rituvia_local", expectedClusterName: clusterName, kind: "local" });
  });

  it.each([
    ["production environment", (url: URL) => url, "production", clusterName],
    ["wrong port", (url: URL) => ((url.port = "5432"), url), "local", clusterName],
    ["localhost alias", (url: URL) => ((url.hostname = "localhost"), url), "local", clusterName],
    ["remote host", (url: URL) => ((url.hostname = "198.51.100.10"), url), "local", clusterName],
    ["wrong role", (url: URL) => ((url.username = "postgres"), url), "local", clusterName],
    ["wrong database", (url: URL) => ((url.pathname = "/production"), url), "local", clusterName],
    ["URL fragment", (url: URL) => ((url.hash = "unsafe"), url), "local", clusterName],
    [
      "extra query option",
      (url: URL) => (url.searchParams.set("options", "unsafe"), url),
      "local",
      clusterName,
    ],
    ["wrong cluster", (url: URL) => url, "local", "other_cluster"],
  ])("rejects %s without exposing the password", (_name, mutate, appEnvironment, expected) => {
    const url = mutate(createUrl());
    let diagnostic = "";
    try {
      assertSyntheticSeedTarget({
        appEnvironment,
        databaseUrl: url.toString(),
        expectedClusterName: expected,
        seedTarget: "local",
      });
    } catch (error) {
      diagnostic = `${error instanceof Error ? error.message : String(error)}\n${
        error instanceof Error ? error.stack : ""
      }`;
    }
    expect(diagnostic).not.toContain(passwordCanary);
    expect(diagnostic).toContain("attested local database target");
  });
});
