const fail = (): never => {
  throw new Error("CI database requires the exact ephemeral GitHub Actions target.");
};

const createUrl = (username: string, password: string, applicationName: string): string => {
  const url = new URL("postgresql://127.0.0.1");
  url.username = username;
  url.password = password;
  url.port = "5432";
  url.pathname = "/rituvia_ci";
  url.searchParams.set("application_name", applicationName);
  url.searchParams.set("connect_timeout", "5");
  url.searchParams.set("schema", "public");
  url.searchParams.set("sslmode", "disable");
  return url.toString();
};

export const assertCiServiceAddress = (serverAddress: string | undefined): void => {
  if (serverAddress === undefined) return fail();
  const parts = serverAddress.split(".").map(Number);
  const privateIpv4 =
    parts.length === 4 &&
    parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255) &&
    (parts[0] === 10 ||
      (parts[0] === 127 && parts[1] === 0 && parts[2] === 0 && parts[3] === 1) ||
      (parts[0] === 172 && (parts[1] ?? 0) >= 16 && (parts[1] ?? 0) <= 31) ||
      (parts[0] === 192 && parts[1] === 168));
  if (!privateIpv4) return fail();
};

export const assertCiDatabaseEnvironment = ({
  adminPassword,
  ci,
  githubActions,
  githubRunAttempt,
  githubRunId,
}: Readonly<{
  adminPassword: string | undefined;
  ci: string | undefined;
  githubActions: string | undefined;
  githubRunAttempt: string | undefined;
  githubRunId: string | undefined;
}>): Readonly<{ adminUrl: string; appPassword: string; appUrl: string }> => {
  if (
    ci !== "true" ||
    githubActions !== "true" ||
    githubRunId === undefined ||
    !/^\d{1,20}$/.test(githubRunId) ||
    githubRunAttempt === undefined ||
    !/^\d{1,10}$/.test(githubRunAttempt) ||
    adminPassword !== `rituvia-ci-${githubRunId}-${githubRunAttempt}-admin`
  ) {
    return fail();
  }

  const appPassword = `${adminPassword}-app`;
  return Object.freeze({
    adminUrl: createUrl("rituvia_ci_admin", adminPassword, "rituvia_ci_admin"),
    appPassword,
    appUrl: createUrl("rituvia_ci_app", appPassword, "rituvia_ci"),
  });
};
