import { createDatabaseClient } from "../src/client.js";
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
const { databaseName, expectedClusterName } = assertSyntheticSeedTarget({
  appEnvironment: process.env.APP_ENV,
  databaseUrl,
  expectedClusterName: process.env.RITUVIA_LOCAL_POSTGRES_CLUSTER_NAME,
});
if (databaseUrl === undefined) {
  throw new Error("Synthetic seed requires an attested local database target.");
}

const prisma = createDatabaseClient(databaseUrl);

try {
  const [attestation] = await prisma.$queryRaw<
    Array<{
      databaseName: string;
      clusterName: string;
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
    attestation?.databaseName !== databaseName ||
    attestation.userName !== "rituvia_app" ||
    attestation.clusterName !== expectedClusterName ||
    attestation.serverAddress !== "127.0.0.1" ||
    attestation.serverPort !== 55432
  ) {
    throw new Error("Synthetic seed requires an attested local database target.");
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
