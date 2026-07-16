import { createDatabaseClient } from "../src/client.js";
import { assertCiServiceAddress } from "../src/ci-database-safety.js";
import { assertSyntheticSeedTarget } from "../src/local-seed-safety.js";

const FOUNDATION_SEED = Object.freeze({
  id: "6d393ec1-2019-4abc-9cf8-62f58c72efe8",
  datasetKey: "foundation-synthetic",
  version: 1,
  checksumSha256: "921224db98642ee1f9abc307c710066eb3a94a59c3caba29ffda110ee1928937",
  isSynthetic: true,
  createdAt: new Date("2026-07-16T00:00:00.000Z"),
});

const databaseUrl = process.env.DATABASE_URL?.trim();
const target = assertSyntheticSeedTarget({
  appEnvironment: process.env.APP_ENV,
  ci: process.env.CI,
  databaseUrl,
  expectedClusterName: process.env.RITUVIA_LOCAL_POSTGRES_CLUSTER_NAME,
  expectedSystemIdentifier: process.env.RITUVIA_CI_POSTGRES_SYSTEM_IDENTIFIER,
  githubActions: process.env.GITHUB_ACTIONS,
  githubRunAttempt: process.env.GITHUB_RUN_ATTEMPT,
  githubRunId: process.env.GITHUB_RUN_ID,
  seedTarget: process.env.RITUVIA_SEED_TARGET,
});
if (databaseUrl === undefined) {
  throw new Error("Synthetic seed requires an attested local database target.");
}

const prisma = createDatabaseClient(databaseUrl);

try {
  if (target.kind === "local") {
    const [attestation] = await prisma.$queryRaw<
      Array<{
        clusterName: string;
        databaseName: string;
        serverAddress: string;
        serverPort: number;
        userName: string;
      }>
    >`SELECT current_database() AS "databaseName",
             current_user AS "userName",
             current_setting('cluster_name') AS "clusterName",
             host(inet_server_addr()) AS "serverAddress",
             inet_server_port() AS "serverPort"`;

    if (
      attestation?.databaseName !== target.databaseName ||
      attestation.userName !== "rituvia_app" ||
      attestation.clusterName !== target.expectedClusterName ||
      attestation.serverAddress !== "127.0.0.1" ||
      attestation.serverPort !== 55432
    ) {
      throw new Error("Synthetic seed requires an attested local database target.");
    }
  } else {
    const [attestation] = await prisma.$queryRaw<
      Array<{
        databaseName: string;
        inRecovery: boolean;
        serverAddress: string;
        serverPort: number;
        serverVersionNumber: number;
        systemIdentifier: string;
        userName: string;
      }>
    >`SELECT current_database() AS "databaseName",
             current_user AS "userName",
             host(inet_server_addr()) AS "serverAddress",
             inet_server_port() AS "serverPort",
             current_setting('server_version_num')::int AS "serverVersionNumber",
             pg_is_in_recovery() AS "inRecovery",
             (SELECT system_identifier::text FROM pg_control_system()) AS "systemIdentifier"`;

    if (
      attestation?.databaseName !== target.databaseName ||
      attestation.userName !== "rituvia_ci_app" ||
      attestation.serverPort !== 5432 ||
      Math.trunc(attestation.serverVersionNumber / 10_000) !== 17 ||
      attestation.inRecovery ||
      attestation.systemIdentifier !== target.expectedSystemIdentifier
    ) {
      throw new Error("Synthetic seed requires an attested local database target.");
    }
    assertCiServiceAddress(attestation.serverAddress);
  }

  await prisma.seedManifest.createMany({
    data: [FOUNDATION_SEED],
    skipDuplicates: true,
  });

  const persisted = await prisma.seedManifest.findUniqueOrThrow({
    where: {
      datasetKey_version: {
        datasetKey: FOUNDATION_SEED.datasetKey,
        version: FOUNDATION_SEED.version,
      },
    },
  });

  if (
    persisted.id !== FOUNDATION_SEED.id ||
    persisted.checksumSha256 !== FOUNDATION_SEED.checksumSha256 ||
    persisted.isSynthetic !== FOUNDATION_SEED.isSynthetic ||
    persisted.createdAt.getTime() !== FOUNDATION_SEED.createdAt.getTime()
  ) {
    throw new Error("Synthetic seed provenance does not match the committed dataset.");
  }
} finally {
  await prisma.$disconnect();
}
