import path from "node:path";

import { verifyMigrationPolicy } from "./migration-policy.js";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
process.exitCode = await verifyMigrationPolicy(path.join(repositoryRoot, "packages/db/prisma"));
