const LOCAL_HOST = "127.0.0.1";
const LOCAL_PORT = "55432";
const LOCAL_ROLE = "rituvia_app";
const DEVELOPMENT_DATABASE = "rituvia_local";
const TEST_DATABASE_PATTERN = /^rituvia_test_[a-f0-9]{24}$/;
const CLUSTER_NAME_PATTERN = /^rituvia_\d{10,}$/;
const REQUIRED_QUERY_PARAMETERS = Object.freeze({
  application_name: "rituvia_local",
  connect_timeout: "5",
  schema: "public",
  sslmode: "disable",
});

const CI_HOST = "127.0.0.1";
const CI_PORT = "5432";
const CI_ROLE = "rituvia_ci_app";
const CI_DATABASE = "rituvia_ci";
const CI_QUERY_PARAMETERS = Object.freeze({
  application_name: "rituvia_ci",
  connect_timeout: "5",
  schema: "public",
  sslmode: "disable",
});
const SYSTEM_IDENTIFIER_PATTERN = /^\d{10,}$/;

const fail = (): never => {
  throw new Error("Synthetic seed requires an attested local database target.");
};

export type SyntheticSeedTarget =
  | Readonly<{ databaseName: string; expectedClusterName: string; kind: "local" }>
  | Readonly<{ databaseName: string; expectedSystemIdentifier: string; kind: "ci" }>;

export const assertSyntheticSeedTarget = ({
  appEnvironment,
  ci,
  databaseUrl,
  expectedClusterName,
  expectedSystemIdentifier,
  githubActions,
  githubRunAttempt,
  githubRunId,
  seedTarget,
}: Readonly<{
  appEnvironment: string | undefined;
  ci?: string | undefined;
  databaseUrl: string | undefined;
  expectedClusterName: string | undefined;
  expectedSystemIdentifier?: string | undefined;
  githubActions?: string | undefined;
  githubRunAttempt?: string | undefined;
  githubRunId?: string | undefined;
  seedTarget: string | undefined;
}>): SyntheticSeedTarget => {
  if (databaseUrl === undefined) return fail();

  try {
    const parsed = new URL(databaseUrl);
    const databaseName = parsed.pathname.slice(1);
    if (seedTarget === "local") {
      if (
        appEnvironment !== "local" ||
        expectedClusterName === undefined ||
        !CLUSTER_NAME_PATTERN.test(expectedClusterName) ||
        parsed.protocol !== "postgresql:" ||
        parsed.hostname !== LOCAL_HOST ||
        parsed.port !== LOCAL_PORT ||
        parsed.username !== LOCAL_ROLE ||
        parsed.password === "" ||
        parsed.hash !== "" ||
        (databaseName !== DEVELOPMENT_DATABASE && !TEST_DATABASE_PATTERN.test(databaseName)) ||
        parsed.searchParams.size !== Object.keys(REQUIRED_QUERY_PARAMETERS).length ||
        Object.entries(REQUIRED_QUERY_PARAMETERS).some(
          ([key, value]) => parsed.searchParams.get(key) !== value,
        )
      ) {
        return fail();
      }
      return Object.freeze({ databaseName, expectedClusterName, kind: "local" });
    }

    const expectedPassword = `rituvia-ci-${githubRunId ?? ""}-${githubRunAttempt ?? ""}-admin-app`;
    if (
      seedTarget !== "ci" ||
      appEnvironment !== "test" ||
      ci !== "true" ||
      githubActions !== "true" ||
      githubRunId === undefined ||
      !/^\d{1,20}$/.test(githubRunId) ||
      githubRunAttempt === undefined ||
      !/^\d{1,10}$/.test(githubRunAttempt) ||
      expectedSystemIdentifier === undefined ||
      !SYSTEM_IDENTIFIER_PATTERN.test(expectedSystemIdentifier) ||
      parsed.protocol !== "postgresql:" ||
      parsed.hostname !== CI_HOST ||
      parsed.port !== CI_PORT ||
      parsed.username !== CI_ROLE ||
      parsed.password !== expectedPassword ||
      parsed.hash !== "" ||
      databaseName !== CI_DATABASE ||
      parsed.searchParams.size !== Object.keys(CI_QUERY_PARAMETERS).length ||
      Object.entries(CI_QUERY_PARAMETERS).some(
        ([key, value]) => parsed.searchParams.get(key) !== value,
      )
    ) {
      return fail();
    }
    return Object.freeze({ databaseName, expectedSystemIdentifier, kind: "ci" });
  } catch {
    return fail();
  }
};
