import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";

import { Client } from "pg";

import {
  createAccountIdentityService,
  type AccountIdentityPolicy,
} from "../src/account-identity.js";
import { createDatabaseClient } from "../src/client.js";
import { createWalletIdentityService, WalletIdentityError } from "../src/wallet-identity.js";
import {
  ensureRuntimeDatabasePrivileges,
  runLocalPrisma,
  stopLeaseOwnedRuntime,
  verifyLogicalDumpRestore,
  withLocalPostgresLease,
} from "./local-postgres.mjs";

const accountPolicy: AccountIdentityPolicy = Object.freeze({
  challengeTtlSeconds: 600,
  emailEncryptionKey: new Uint8Array(32).fill(17),
  encryptionKeyVersion: "test.wallet-identity-email.v1",
  providerSubjectHmacKey: new Uint8Array(32).fill(29),
  sessionTtlSeconds: 3_600,
  startGlobalLimit: 100,
  startIdentifierLimit: 20,
  startWindowSeconds: 600,
});
const walletPolicy = Object.freeze({
  allowedChainIds: Object.freeze([84_532]),
  challengeTtlSeconds: 300,
  recentAuthenticationSeconds: 900,
  sessionTtlSeconds: 3_600,
});
const address = "0x1111111111111111111111111111111111111111";
const signature = `0x${"11".repeat(65)}`;
const productionSiweNonce = "a".repeat(96);
const bearer = (): string => randomBytes(32).toString("base64url");

const expectWalletError = async (
  operation: () => Promise<unknown>,
  code: WalletIdentityError["code"],
): Promise<void> => {
  await assert.rejects(operation, (error: unknown) => {
    assert.ok(error instanceof WalletIdentityError);
    assert.equal(error.code, code);
    return true;
  });
};

const expectPostgresError = async (
  operation: () => Promise<unknown>,
  code: string,
): Promise<void> => {
  try {
    await operation();
    assert.fail(`Expected PostgreSQL error ${code}.`);
  } catch (error) {
    assert.equal((error as { code?: unknown }).code, code);
  }
};

await withLocalPostgresLease(async (lease) => {
  const databases: Array<Awaited<ReturnType<typeof lease.createTestDatabase>>> = [];
  let primaryError: unknown;
  try {
    const source = await lease.createTestDatabase();
    const restored = await lease.createTestDatabase();
    databases.push(source, restored);
    runLocalPrisma(lease.runtime, source.migrationDatabaseUrl, ["generate"]);
    runLocalPrisma(lease.runtime, source.migrationDatabaseUrl, ["migrate", "deploy"]);
    await ensureRuntimeDatabasePrivileges(lease.runtime, source.databaseName);

    const runtime = createDatabaseClient(source.databaseUrl);
    const runtimeSql = new Client({ connectionString: source.databaseUrl });
    const migrator = new Client({ connectionString: source.migrationDatabaseUrl });
    await Promise.all([runtimeSql.connect(), migrator.connect()]);
    try {
      const accounts = createAccountIdentityService(runtime, accountPolicy);
      const wallets = createWalletIdentityService(runtime, walletPolicy);
      const createAccount = async (email: string) => {
        const challengeId = randomUUID();
        const state = bearer();
        const token = bearer();
        const sessionToken = bearer();
        await accounts.createChallenge({
          challengeId,
          email,
          expiresAt: new Date(Date.now() + 300_000).toISOString(),
          providerKey: "local.passwordless.v1",
          returnTo: "/en/account",
          state,
          token,
        });
        const completed = await accounts.consumeChallenge({
          challengeId,
          sessionToken,
          state,
          token,
        });
        return Object.freeze({ ...completed.context, sessionToken });
      };

      const owner = await createAccount("wallet-owner@example.test");
      const other = await createAccount("wallet-other@example.test");
      const linkRequestId = randomUUID();
      const linkMessage = `RITUVIA wallet link ${linkRequestId}`;
      const linkedChallenge = await wallets.createChallenge({
        address,
        chainId: 84_532,
        idempotencyKey: bearer(),
        message: linkMessage,
        nonce: productionSiweNonce,
        purpose: "link_wallet",
        requestId: linkRequestId,
        sessionToken: owner.sessionToken,
      });
      assert.equal(linkedChallenge.requestId, linkRequestId);
      const linked = await wallets.verifyChallenge({
        message: linkMessage,
        requestId: linkRequestId,
        sessionToken: owner.sessionToken,
        signature,
      });
      assert.equal(linked.purpose, "link_wallet");
      if (linked.purpose !== "link_wallet") assert.fail("Expected wallet link result.");
      assert.equal(linked.wallet.address, address);
      assert.deepEqual(await wallets.listWallets(owner.sessionToken), [linked.wallet]);
      assert.deepEqual(await wallets.listWallets(other.sessionToken), []);

      const signInRequestId = randomUUID();
      const signInMessage = `RITUVIA wallet sign in ${signInRequestId}`;
      await wallets.createChallenge({
        address,
        chainId: 84_532,
        idempotencyKey: bearer(),
        message: signInMessage,
        nonce: "SignNonce123",
        purpose: "sign_in",
        requestId: signInRequestId,
      });
      const walletSessionToken = bearer();
      const signedIn = await wallets.verifyChallenge({
        message: signInMessage,
        requestId: signInRequestId,
        signature,
        successorSessionToken: walletSessionToken,
      });
      assert.equal(signedIn.purpose, "sign_in");
      assert.equal((await accounts.resolveSession(walletSessionToken))?.userId, owner.userId);
      await expectWalletError(
        () =>
          wallets.verifyChallenge({
            message: signInMessage,
            requestId: signInRequestId,
            signature,
            successorSessionToken: bearer(),
          }),
        "WALLET_AUTH_REPLAYED",
      );

      const conflictRequestId = randomUUID();
      const conflictMessage = `RITUVIA wallet conflict ${conflictRequestId}`;
      await wallets.createChallenge({
        address,
        chainId: 84_532,
        idempotencyKey: bearer(),
        message: conflictMessage,
        nonce: "ConflictNonce123",
        purpose: "link_wallet",
        requestId: conflictRequestId,
        sessionToken: other.sessionToken,
      });
      await expectWalletError(
        () =>
          wallets.verifyChallenge({
            message: conflictMessage,
            requestId: conflictRequestId,
            sessionToken: other.sessionToken,
            signature,
          }),
        "WALLET_AUTH_CONFLICT",
      );
      assert.equal(
        await wallets.revokeWallet({
          sessionToken: other.sessionToken,
          walletIdentityId: linked.wallet.id,
        }),
        false,
      );

      const audit = await migrator.query<{
        accepted: number;
        hashed: number;
        rejected: number;
      }>(`
        SELECT count(*) FILTER (WHERE outcome = 'accepted')::int AS accepted,
               count(*) FILTER (WHERE outcome = 'rejected')::int AS rejected,
               count(*) FILTER (WHERE octet_length(signature_hash) = 32)::int AS hashed
          FROM wallet_auth_event
      `);
      assert.deepEqual(audit.rows[0], { accepted: 2, hashed: 4, rejected: 2 });
      const forbiddenColumns = await migrator.query<{ count: number }>(`
        SELECT count(*)::int AS count
          FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name IN ('wallet_identity', 'wallet_auth_challenge', 'wallet_auth_event')
           AND column_name ~ '(private_key|raw_signature|seed_phrase|mnemonic)'
      `);
      assert.equal(forbiddenColumns.rows[0]?.count, 0);
      await expectPostgresError(
        () =>
          runtimeSql.query("UPDATE wallet_identity SET address = $1 WHERE id = $2::uuid", [
            "0x2222222222222222222222222222222222222222",
            linked.wallet.id,
          ]),
        "42501",
      );
      await expectPostgresError(() => runtimeSql.query("DELETE FROM wallet_auth_event"), "42501");

      assert.equal(
        await wallets.revokeWallet({
          sessionToken: owner.sessionToken,
          walletIdentityId: linked.wallet.id,
        }),
        true,
      );
      assert.equal(await accounts.resolveSession(walletSessionToken), null);
      assert.ok(await accounts.resolveSession(owner.sessionToken));
      await expectWalletError(
        () =>
          wallets.verifyChallenge({
            message: signInMessage,
            requestId: signInRequestId,
            signature,
            successorSessionToken: bearer(),
          }),
        "WALLET_AUTH_REPLAYED",
      );

      await verifyLogicalDumpRestore(lease.runtime, source, restored);
      const restoredClient = new Client({ connectionString: restored.migrationDatabaseUrl });
      await restoredClient.connect();
      try {
        const snapshot = await restoredClient.query<{
          events: number;
          revokedWallets: number;
          walletSessions: number;
        }>(`
          SELECT (SELECT count(*)::int FROM wallet_auth_event) AS events,
                 (SELECT count(*)::int FROM wallet_identity WHERE revoked_at IS NOT NULL)
                   AS "revokedWallets",
                 (SELECT count(*)::int FROM account_session WHERE wallet_identity_id IS NOT NULL)
                   AS "walletSessions"
        `);
        assert.deepEqual(snapshot.rows[0], {
          events: 5,
          revokedWallets: 1,
          walletSessions: 1,
        });
      } finally {
        await restoredClient.end();
      }
    } finally {
      await Promise.allSettled([runtime.$disconnect(), runtimeSql.end(), migrator.end()]);
    }
  } catch (error) {
    primaryError = error;
    throw error;
  } finally {
    const cleanupErrors: unknown[] = [];
    for (const database of databases.reverse()) {
      try {
        await database.drop();
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
    try {
      await stopLeaseOwnedRuntime(lease);
    } catch (error) {
      cleanupErrors.push(error);
    }
    if (primaryError === undefined && cleanupErrors.length > 0) {
      throw new AggregateError(cleanupErrors, "Wallet identity cleanup failed.");
    }
  }
});

console.log(
  "Verified wallet linking, sign-in, replay denial, cross-account isolation, least privilege, revocation, and logical restore.",
);
