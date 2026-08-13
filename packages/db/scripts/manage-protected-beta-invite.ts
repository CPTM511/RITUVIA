import { open, realpath, unlink } from "node:fs/promises";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";

import { createDatabaseClient } from "../src/client.js";
import {
  createProtectedBetaInviteControlService,
  ProtectedBetaInviteError,
} from "../src/protected-beta-invite.js";

const policy = Object.freeze({
  cohortLimit: 25 as const,
  policyVersion: "own-019.protected-beta-abuse.v1",
});
const idempotencyKeyPattern =
  /^(?:[A-Za-z0-9_-]{22,128}|[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/u;
const inviteIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

type Command =
  | Readonly<{
      idempotencyKey: string;
      kind: "create";
      outputPath: string;
      ttlSeconds: number;
    }>
  | Readonly<{
      idempotencyKey: string;
      inviteId: string;
      kind: "revoke";
      outputPath: string;
    }>;

const fail = (): never => {
  throw new TypeError("The protected-Beta invite command is invalid.");
};

const parseArguments = (arguments_: readonly string[]): Command => {
  const kind = arguments_[0];
  if (kind !== "create" && kind !== "revoke") return fail();
  const values = new Map<string, string>();
  for (let index = 1; index < arguments_.length; index += 2) {
    const key = arguments_[index];
    const value = arguments_[index + 1];
    if (key === undefined || value === undefined || !key.startsWith("--") || values.has(key)) {
      return fail();
    }
    values.set(key, value);
  }
  const allowed =
    kind === "create"
      ? new Set(["--idempotency-key", "--output", "--ttl-seconds"])
      : new Set(["--idempotency-key", "--invite-id", "--output"]);
  if (values.size !== allowed.size || [...values.keys()].some((key) => !allowed.has(key))) {
    return fail();
  }
  const idempotencyKey = values.get("--idempotency-key");
  const outputPath = values.get("--output");
  if (
    idempotencyKey === undefined ||
    !idempotencyKeyPattern.test(idempotencyKey) ||
    outputPath === undefined ||
    !isAbsolute(outputPath)
  ) {
    return fail();
  }
  if (kind === "create") {
    const rawTtlSeconds = values.get("--ttl-seconds");
    if (rawTtlSeconds === undefined || !/^[1-9][0-9]{2,6}$/u.test(rawTtlSeconds)) return fail();
    const ttlSeconds = Number(rawTtlSeconds);
    if (!Number.isSafeInteger(ttlSeconds) || ttlSeconds < 300 || ttlSeconds > 2_592_000) {
      return fail();
    }
    return Object.freeze({ idempotencyKey, kind, outputPath, ttlSeconds });
  }
  const inviteId = values.get("--invite-id");
  if (inviteId === undefined || !inviteIdPattern.test(inviteId)) return fail();
  return Object.freeze({ idempotencyKey, inviteId, kind, outputPath });
};

const parseDatabaseUrl = (): string => {
  const value = process.env.DATABASE_URL;
  if (value === undefined) return fail();
  try {
    const url = new URL(value);
    if ((url.protocol !== "postgres:" && url.protocol !== "postgresql:") || url.username === "") {
      return fail();
    }
  } catch {
    return fail();
  }
  return value;
};

const openPrivateOutput = async (outputPath: string) => {
  const repository = await realpath(process.cwd());
  const parent = await realpath(dirname(outputPath));
  const relativeToRepository = relative(repository, parent);
  if (
    relativeToRepository === "" ||
    (!relativeToRepository.startsWith("..") && !isAbsolute(relativeToRepository))
  ) {
    return fail();
  }
  return open(resolve(parent, basename(outputPath)), "wx", 0o600);
};

const command = parseArguments(process.argv.slice(2));
const databaseUrl = parseDatabaseUrl();
const output = await openPrivateOutput(command.outputPath);
const database = createDatabaseClient(databaseUrl);
let outputClosed = false;
try {
  const service = createProtectedBetaInviteControlService(database, policy);
  const result =
    command.kind === "create"
      ? await service.createInvite({
          idempotencyKey: command.idempotencyKey,
          ttlSeconds: command.ttlSeconds,
        })
      : await service.revokeInvite({
          idempotencyKey: command.idempotencyKey,
          inviteId: command.inviteId,
        });
  await output.writeFile(
    `${JSON.stringify({
      ...result,
      operation: command.kind,
      policyVersion: policy.policyVersion,
      schemaVersion: "protected-beta-invite-operation.v1",
    })}\n`,
    "utf8",
  );
  await output.sync();
  await output.close();
  outputClosed = true;
  process.stdout.write(`Protected-Beta invite result written to ${command.outputPath}.\n`);
} catch (error) {
  if (!outputClosed) await output.close().catch(() => undefined);
  await unlink(command.outputPath).catch(() => undefined);
  if (error instanceof ProtectedBetaInviteError) {
    process.stderr.write(`Protected-Beta invite operation failed with ${error.code}.\n`);
  } else {
    process.stderr.write("Protected-Beta invite operation failed.\n");
  }
  process.exitCode = 1;
} finally {
  await database.$disconnect();
}
