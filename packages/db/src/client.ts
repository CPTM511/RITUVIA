import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "./generated/prisma/client.js";

const DATABASE_URL_MAX_LENGTH = 4_096;

export const assertDatabaseUrl = (databaseUrl: string): void => {
  if (databaseUrl.length === 0 || databaseUrl.length > DATABASE_URL_MAX_LENGTH) {
    throw new TypeError("Database URL is invalid.");
  }

  try {
    const parsed = new URL(databaseUrl);
    const databaseName = parsed.pathname.slice(1);

    if (
      (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") ||
      parsed.hostname === "" ||
      parsed.username === "" ||
      databaseName === "" ||
      parsed.hash !== ""
    ) {
      throw new TypeError("Database URL is invalid.");
    }
  } catch {
    throw new TypeError("Database URL is invalid.");
  }
};

export const createDatabaseClient = (databaseUrl: string): PrismaClient => {
  assertDatabaseUrl(databaseUrl);

  const adapter = new PrismaPg({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 10_000,
    max: 10,
  });

  return new PrismaClient({ adapter });
};
