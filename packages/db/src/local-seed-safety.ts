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

const fail = (): never => {
  throw new Error("Synthetic seed requires an attested local database target.");
};

export const assertSyntheticSeedTarget = ({
  appEnvironment,
  databaseUrl,
  expectedClusterName,
}: Readonly<{
  appEnvironment: string | undefined;
  databaseUrl: string | undefined;
  expectedClusterName: string | undefined;
}>): Readonly<{ databaseName: string; expectedClusterName: string }> => {
  if (
    appEnvironment !== "local" ||
    databaseUrl === undefined ||
    expectedClusterName === undefined ||
    !CLUSTER_NAME_PATTERN.test(expectedClusterName)
  ) {
    return fail();
  }

  try {
    const parsed = new URL(databaseUrl);
    const databaseName = parsed.pathname.slice(1);
    const parameters = Object.fromEntries(parsed.searchParams.entries());
    if (
      parsed.protocol !== "postgresql:" ||
      parsed.hostname !== LOCAL_HOST ||
      parsed.port !== LOCAL_PORT ||
      parsed.username !== LOCAL_ROLE ||
      parsed.password === "" ||
      parsed.hash !== "" ||
      (databaseName !== DEVELOPMENT_DATABASE && !TEST_DATABASE_PATTERN.test(databaseName)) ||
      parsed.searchParams.size !== Object.keys(REQUIRED_QUERY_PARAMETERS).length ||
      Object.entries(REQUIRED_QUERY_PARAMETERS).some(([key, value]) => parameters[key] !== value)
    ) {
      return fail();
    }

    return Object.freeze({ databaseName, expectedClusterName });
  } catch {
    return fail();
  }
};
