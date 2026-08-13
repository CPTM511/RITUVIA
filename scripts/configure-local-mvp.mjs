import { randomBytes } from "node:crypto";
import { chmod, lstat, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const requestedPort = process.env.RITUVIA_LOCAL_POSTGRES_PORT?.trim() || "55432";
if (!/^\d{4,5}$/u.test(requestedPort)) {
  throw new Error("RITUVIA_LOCAL_POSTGRES_PORT is invalid.");
}
const port = Number(requestedPort);
if (!Number.isSafeInteger(port) || port < 1_024 || port > 65_535) {
  throw new Error("RITUVIA_LOCAL_POSTGRES_PORT is invalid.");
}

const localStateDirectory = path.join(
  repositoryRoot,
  ".local",
  port === 55_432 ? "postgres" : `postgres-${port}`,
);
const databaseUrlPath = path.join(localStateDirectory, "database-url");
const environmentPath = path.join(repositoryRoot, ".env.local");
const temporaryPath = `${environmentPath}.tmp`;

try {
  const existing = await lstat(environmentPath);
  if (existing.isSymbolicLink() || existing.isFile()) {
    throw new Error(
      ".env.local already exists; preserve its encryption keys and update it intentionally.",
    );
  }
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

const databaseUrl = (await readFile(databaseUrlPath, "utf8")).trim();
const parsedDatabaseUrl = new URL(databaseUrl);
if (
  parsedDatabaseUrl.protocol !== "postgresql:" ||
  parsedDatabaseUrl.hostname !== "127.0.0.1" ||
  parsedDatabaseUrl.port !== String(port) ||
  parsedDatabaseUrl.username !== "rituvia_app" ||
  parsedDatabaseUrl.password === "" ||
  parsedDatabaseUrl.pathname !== "/rituvia_local"
) {
  throw new Error("The attested local database URL is unavailable.");
}

const secret = () => randomBytes(32).toString("base64url");
const lines = [
  "# Generated local-only MVP configuration. Never commit this file.",
  "APP_ENV=local",
  "BRAND_NAME=RITUVIA",
  "BRAND_SHORT_NAME=RITUVIA",
  "BRAND_CANONICAL_ORIGIN=http://127.0.0.1:4175",
  `DATABASE_URL=${databaseUrl}`,
  "RITUVIA_OPERATION_MODE=normal",
  "RITUVIA_ANONYMOUS_SESSION_ISSUANCE_LIMIT=30",
  "RITUVIA_ANONYMOUS_SESSION_ISSUANCE_WINDOW_SECONDS=60",
  "RITUVIA_ANONYMOUS_SESSION_POLICY_VERSION=local.anonymous.v1",
  "RITUVIA_ANONYMOUS_SESSION_TTL_SECONDS=2592000",
  "RITUVIA_PROTECTED_BETA_ABUSE_POLICY_VERSION=local.protected-beta-abuse.v1",
  "RITUVIA_PROTECTED_BETA_MUTATION_LIMIT=120",
  "RITUVIA_PROTECTED_BETA_MUTATION_WINDOW_SECONDS=86400",
  "RITUVIA_QUESTION_INTAKE_RATE_LIMIT=12",
  "RITUVIA_QUESTION_INTAKE_RATE_WINDOW_SECONDS=60",
  "RITUVIA_QUESTION_INTAKE_ACTIVATION_REFERENCE=test.local-mvp",
  `RITUVIA_AUTH_DATA_KEY_V1=${secret()}`,
  `RITUVIA_AUTH_SUBJECT_HMAC_KEY_V1=${secret()}`,
  "RITUVIA_AUTH_CHALLENGE_TTL_SECONDS=900",
  "RITUVIA_ACCOUNT_SESSION_TTL_SECONDS=2592000",
  `RITUVIA_PRIVATE_CONTENT_KEY_V1=${secret()}`,
  "RITUVIA_REFLECTION_POLICY_VERSION=reflection-loop.en.v1",
  "RITUVIA_REFLECTION_RETENTION_SECONDS=7776000",
  "RITUVIA_REFLECTION_REVISIT_DELAY_SECONDS=86400",
  `RITUVIA_TAROT_INTEGRITY_KEY_V1=${secret()}`,
  "RITUVIA_PAYMENT_PROVIDER=local",
  `RITUVIA_LOCAL_CHECKOUT_SIGNING_SECRET_V1=${secret()}`,
  `RITUVIA_LOCAL_POSTGRES_PORT=${port}`,
  "",
];

await writeFile(temporaryPath, lines.join("\n"), { encoding: "utf8", flag: "wx", mode: 0o600 });
await rename(temporaryPath, environmentPath);
await chmod(environmentPath, 0o600);
process.stdout.write("Created repository-root .env.local for the attested local MVP runtime.\n");
