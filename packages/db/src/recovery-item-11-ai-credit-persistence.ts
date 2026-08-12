import { Prisma, type PrismaClient } from "./generated/prisma/client.js";

const recoveryScope = "D-098:OWNER:item-11:protected-staging" as const;
const idempotencyKeyVersion = "recovery-item11-ai-credit.v1";
const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

export class RecoveryItem11AiCreditPersistenceError extends Error {
  readonly code: "conflict" | "insufficient_credits" | "unavailable";

  constructor(code: "conflict" | "insufficient_credits" | "unavailable") {
    super("The protected-staging AI Credit operation failed.");
    this.name = "RecoveryItem11AiCreditPersistenceError";
    this.code = code;
  }
}

export type RecoveryItem11AiCreditReservation = Readonly<{
  amount: 1;
  kind: "created" | "replayed";
  reservationId: string;
  status: "active" | "consumed" | "released";
}>;

export type RecoveryItem11AiCreditPersistence = Readonly<{
  countConsumedToday(input: {
    asOf: string;
    recoveryScope: typeof recoveryScope;
    userId: string;
  }): Promise<number>;
  consume(input: {
    asOf: string;
    generationId: string;
    recoveryScope: typeof recoveryScope;
    reservationId: string;
    userId: string;
  }): Promise<"consumed" | "replayed">;
  release(input: {
    asOf: string;
    recoveryScope: typeof recoveryScope;
    reservationId: string;
    userId: string;
  }): Promise<"released" | "replayed">;
  reserve(input: {
    asOf: string;
    canonicalRequestHash: Uint8Array;
    catalogVersion: string;
    expiresAt: string;
    idempotencyKeyHash: Uint8Array;
    productCode: "deep_one";
    productVersion: string;
    recoveryScope: typeof recoveryScope;
    userId: string;
  }): Promise<RecoveryItem11AiCreditReservation>;
}>;

type CreditSourceRow = Readonly<{
  available: number;
  creditType: "promotional_credit" | "purchased_credit" | "subscription_credit";
  sourceEntryId: string;
}>;

type PrivilegeRow = Readonly<{
  canCreateInDatabase: boolean;
  canCreateInSchema: boolean;
  canDeleteCredits: boolean;
  canInsertAllocation: boolean;
  canInsertLedger: boolean;
  canInsertReservation: boolean;
  canReadAllocation: boolean;
  canReadLedger: boolean;
  canReadProjection: boolean;
  canReadReservation: boolean;
  canUpdateProjection: boolean;
  canUpdateReservation: boolean;
  inheritedRole: boolean;
  nonCreditTableAccess: boolean;
  privilegedRole: boolean;
  roleName: string;
}>;

const privilegeAttestations = new WeakMap<PrismaClient, Promise<void>>();

export const assertRecoveryItem11AiGenerationRuntimeDatabasePrivileges = async (
  database: PrismaClient,
): Promise<void> => {
  const existing = privilegeAttestations.get(database);
  if (existing !== undefined) return existing;
  const attestation = database.$queryRaw<PrivilegeRow[]>`
      SELECT current_user AS "roleName",
             has_database_privilege(current_user, current_database(), 'CREATE')
               AS "canCreateInDatabase",
             has_schema_privilege(current_user, 'public', 'CREATE') AS "canCreateInSchema",
             has_table_privilege(current_user, 'public.credit_reservation', 'SELECT')
               AS "canReadReservation",
             has_table_privilege(current_user, 'public.credit_reservation', 'INSERT')
               AS "canInsertReservation",
             has_any_column_privilege(current_user, 'public.credit_reservation', 'UPDATE')
               AS "canUpdateReservation",
             has_table_privilege(current_user, 'public.credit_ledger_entry', 'SELECT')
               AS "canReadLedger",
             has_table_privilege(current_user, 'public.credit_ledger_entry', 'INSERT')
               AS "canInsertLedger",
             has_table_privilege(current_user, 'public.credit_allocation', 'SELECT')
               AS "canReadAllocation",
             has_table_privilege(current_user, 'public.credit_allocation', 'INSERT')
               AS "canInsertAllocation",
             has_table_privilege(current_user, 'public.credit_projection', 'SELECT')
               AS "canReadProjection",
             has_any_column_privilege(current_user, 'public.credit_projection', 'UPDATE')
               AS "canUpdateProjection",
             (
               has_table_privilege(current_user, 'public.credit_reservation', 'DELETE')
               OR has_table_privilege(current_user, 'public.credit_ledger_entry', 'DELETE')
               OR has_table_privilege(current_user, 'public.credit_allocation', 'DELETE')
               OR has_table_privilege(current_user, 'public.credit_projection', 'DELETE')
             ) AS "canDeleteCredits",
             EXISTS (
               SELECT 1
                 FROM pg_roles AS reachable
                WHERE reachable.rolname <> current_user
                  AND pg_has_role(current_user, reachable.oid, 'MEMBER')
             ) AS "inheritedRole",
             EXISTS (
               SELECT 1
                 FROM unnest(ARRAY[
                   'public.app_user',
                   'public.account_session',
                   'public.auth_identity',
                   'public.birth_profile',
                   'public.reading',
                   'public.interpretation',
                   'public.journal_entry',
                   'public.private_journal_entry',
                   'public.commercial_order_v2',
                   'public.commercial_payment_event_v2'
                 ]) AS protected(table_name)
                WHERE has_table_privilege(
                  current_user,
                  protected.table_name,
                  'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN'
                )
                   OR has_any_column_privilege(
                     current_user,
                     protected.table_name,
                     'SELECT,INSERT,UPDATE,REFERENCES'
                   )
             ) AS "nonCreditTableAccess",
             (
               SELECT role.rolsuper OR role.rolcreatedb OR role.rolcreaterole
                 OR role.rolreplication OR role.rolbypassrls
                 FROM pg_roles AS role
                WHERE role.rolname = current_user
             ) AS "privilegedRole"
    `
    .then((rows) => {
      const privilege = rows.at(0);
      if (
        rows.length !== 1 ||
        privilege === undefined ||
        privilege.roleName !== "rituvia_ai_generation" ||
        privilege.canCreateInDatabase ||
        privilege.canCreateInSchema ||
        privilege.canDeleteCredits ||
        privilege.inheritedRole ||
        privilege.nonCreditTableAccess ||
        privilege.privilegedRole ||
        !privilege.canReadReservation ||
        !privilege.canInsertReservation ||
        !privilege.canUpdateReservation ||
        !privilege.canReadLedger ||
        !privilege.canInsertLedger ||
        !privilege.canReadAllocation ||
        !privilege.canInsertAllocation ||
        !privilege.canReadProjection ||
        !privilege.canUpdateProjection
      ) {
        throw new RecoveryItem11AiCreditPersistenceError("unavailable");
      }
    })
    .catch((error: unknown) => {
      privilegeAttestations.delete(database);
      if (error instanceof RecoveryItem11AiCreditPersistenceError) throw error;
      throw new RecoveryItem11AiCreditPersistenceError("unavailable");
    });
  privilegeAttestations.set(database, attestation);
  return attestation;
};

const requireScope = (value: string): void => {
  if (value !== recoveryScope) throw new TypeError("Recovery Item 11 scope is invalid.");
};

const requireInstant = (value: string): Date => {
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== value) {
    throw new TypeError("Recovery Item 11 instant is invalid.");
  }
  return new Date(milliseconds);
};

const requireDigest = (value: Uint8Array): Uint8Array<ArrayBuffer> => {
  if (!(value instanceof Uint8Array) || value.byteLength !== 32) {
    throw new TypeError("Recovery Item 11 digest is invalid.");
  }
  return Uint8Array.from(value);
};

const digestEquals = (left: Uint8Array, right: Uint8Array): boolean => {
  if (left.byteLength !== right.byteLength) return false;
  let difference = 0;
  for (let index = 0; index < left.byteLength; index += 1) {
    difference |= (left.at(index) ?? 0) ^ (right.at(index) ?? 0);
  }
  return difference === 0;
};

const sha256Text = async (value: string): Promise<Uint8Array<ArrayBuffer>> =>
  new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  ) as Uint8Array<ArrayBuffer>;

const isSerializationFailure = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  (error.code === "P2034" || error.code === "P2002");

const retrySerializable = async <Value>(operation: () => Promise<Value>): Promise<Value> => {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!isSerializationFailure(error) || attempt === 5) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 5));
    }
  }
  throw new RecoveryItem11AiCreditPersistenceError("unavailable");
};

const creditColumn = (
  creditType: CreditSourceRow["creditType"],
): "promotionalAvailable" | "purchasedAvailable" | "subscriptionAvailable" => {
  if (creditType === "subscription_credit") return "subscriptionAvailable";
  if (creditType === "promotional_credit") return "promotionalAvailable";
  return "purchasedAvailable";
};

const availableForCreditType = (
  projection: Readonly<{
    promotionalAvailable: number;
    purchasedAvailable: number;
    subscriptionAvailable: number;
  }>,
  creditType: CreditSourceRow["creditType"],
): number => {
  if (creditType === "subscription_credit") return projection.subscriptionAvailable;
  if (creditType === "promotional_credit") return projection.promotionalAvailable;
  return projection.purchasedAvailable;
};

const reserveInTransaction = async (
  database: Prisma.TransactionClient,
  input: Parameters<RecoveryItem11AiCreditPersistence["reserve"]>[0],
): Promise<RecoveryItem11AiCreditReservation> => {
  const asOf = requireInstant(input.asOf);
  const expiresAt = requireInstant(input.expiresAt);
  const canonicalRequestHash = requireDigest(input.canonicalRequestHash);
  const idempotencyKeyHash = requireDigest(input.idempotencyKeyHash);
  if (
    !uuidV4Pattern.test(input.userId) ||
    input.productCode !== "deep_one" ||
    expiresAt <= asOf ||
    expiresAt.getTime() - asOf.getTime() > 15 * 60 * 1_000 ||
    !input.catalogVersion.startsWith("recovery.item11.")
  ) {
    throw new TypeError("Recovery Item 11 reservation is invalid.");
  }

  const existing = await database.creditReservation.findFirst({
    where: { idempotencyKeyHash, idempotencyKeyVersion, userId: input.userId },
  });
  if (existing !== null) {
    if (!digestEquals(existing.canonicalRequestHash, canonicalRequestHash)) {
      throw new RecoveryItem11AiCreditPersistenceError("conflict");
    }
    if (!["active", "consumed", "released"].includes(existing.status)) {
      throw new RecoveryItem11AiCreditPersistenceError("conflict");
    }
    return Object.freeze({
      amount: 1,
      kind: "replayed" as const,
      reservationId: existing.id,
      status: existing.status as RecoveryItem11AiCreditReservation["status"],
    });
  }

  const projectionRows = await database.$queryRaw<
    Readonly<{
      promotionalAvailable: number;
      purchasedAvailable: number;
      reserved: number;
      subscriptionAvailable: number;
    }>[]
  >`
    SELECT promotional_available AS "promotionalAvailable",
           purchased_available AS "purchasedAvailable",
           reserved,
           subscription_available AS "subscriptionAvailable"
      FROM credit_projection
     WHERE user_id = ${input.userId}::uuid
     FOR UPDATE
  `;
  const projection = projectionRows.at(0);
  if (
    projection === undefined ||
    projection.subscriptionAvailable +
      projection.promotionalAvailable +
      projection.purchasedAvailable <
      1
  ) {
    throw new RecoveryItem11AiCreditPersistenceError("insufficient_credits");
  }

  const sources = await database.$queryRaw<CreditSourceRow[]>`
    SELECT grants.id AS "sourceEntryId",
           grants.credit_type AS "creditType",
           grants.amount
             - COALESCE((
                 SELECT SUM(allocations.amount)
                   FROM credit_allocation AS allocations
                   JOIN credit_reservation AS reservations
                     ON reservations.id = allocations.reservation_id
                  WHERE allocations.source_entry_id = grants.id
                    AND reservations.status IN ('active', 'consumed')
               ), 0)::integer
             - COALESCE((
                 SELECT SUM(reversals.amount)
                   FROM credit_ledger_entry AS reversals
                  WHERE reversals.source_entry_id = grants.id
                    AND reversals.direction IN ('reverse', 'expire')
               ), 0)::integer AS available
      FROM credit_ledger_entry AS grants
     WHERE grants.user_id = ${input.userId}::uuid
       AND grants.direction = 'grant'
       AND grants.credit_type IN ('subscription_credit', 'promotional_credit', 'purchased_credit')
       AND (grants.expires_at IS NULL OR grants.expires_at > ${asOf})
       AND grants.amount
             - COALESCE((
                 SELECT SUM(allocations.amount)
                   FROM credit_allocation AS allocations
                   JOIN credit_reservation AS reservations
                     ON reservations.id = allocations.reservation_id
                  WHERE allocations.source_entry_id = grants.id
                    AND reservations.status IN ('active', 'consumed')
               ), 0)::integer
             - COALESCE((
                 SELECT SUM(reversals.amount)
                   FROM credit_ledger_entry AS reversals
                  WHERE reversals.source_entry_id = grants.id
                    AND reversals.direction IN ('reverse', 'expire')
               ), 0)::integer > 0
     ORDER BY CASE grants.credit_type
                WHEN 'subscription_credit' THEN 0
                WHEN 'promotional_credit' THEN 1
                ELSE 2
              END,
              grants.expires_at NULLS LAST,
              grants.created_at,
              grants.id
     LIMIT 1
  `;
  const source = sources.at(0);
  if (
    source === undefined ||
    source.available < 1 ||
    availableForCreditType(projection, source.creditType) < 1
  ) {
    throw new RecoveryItem11AiCreditPersistenceError("insufficient_credits");
  }

  const reservation = await database.creditReservation.create({
    data: {
      amount: 1,
      canonicalRequestHash,
      catalogVersion: input.catalogVersion,
      createdAt: asOf,
      expiresAt,
      idempotencyKeyHash,
      idempotencyKeyVersion,
      productCode: input.productCode,
      productVersion: input.productVersion,
      status: "active",
      userId: input.userId,
    },
  });
  await database.creditLedgerEntry.create({
    data: {
      amount: 1,
      canonicalRequestHash,
      catalogVersion: input.catalogVersion,
      createdAt: asOf,
      creditType: source.creditType,
      direction: "reserve",
      idempotencyKeyHash: await sha256Text(`item11.reserve\0${reservation.id}`),
      idempotencyKeyVersion,
      operation: "ai.interpretation.reserve",
      policyVersion: "recovery.item11.ai-credit.v1",
      productCode: input.productCode,
      productVersion: input.productVersion,
      reason: "provider_ai_interpretation",
      reservationId: reservation.id,
      termsVersion: "staging_only.terms.item11.v1",
      userId: input.userId,
    },
  });
  await database.creditAllocation.create({
    data: {
      allocationOrder: 1,
      amount: 1,
      createdAt: asOf,
      creditType: source.creditType,
      reservationId: reservation.id,
      sourceEntryId: source.sourceEntryId,
    },
  });
  const column = creditColumn(source.creditType);
  await database.creditProjection.update({
    data: {
      [column]: { decrement: 1 },
      reserved: { increment: 1 },
      updatedAt: asOf,
      version: { increment: 1n },
    },
    where: { userId: input.userId },
  });
  return Object.freeze({
    amount: 1,
    kind: "created" as const,
    reservationId: reservation.id,
    status: "active" as const,
  });
};

const settleInTransaction = async (
  database: Prisma.TransactionClient,
  input: Readonly<{
    asOf: string;
    generationId?: string;
    reservationId: string;
    userId: string;
  }>,
  direction: "consume" | "release",
): Promise<"replayed" | "consumed" | "released"> => {
  const asOf = requireInstant(input.asOf);
  if (
    !uuidV4Pattern.test(input.userId) ||
    !uuidV4Pattern.test(input.reservationId) ||
    (direction === "consume" &&
      (input.generationId === undefined || !uuidV4Pattern.test(input.generationId)))
  ) {
    throw new TypeError("Recovery Item 11 settlement is invalid.");
  }
  const rows = await database.$queryRaw<
    Readonly<{
      canonicalRequestHash: Uint8Array;
      catalogVersion: string;
      creditType: CreditSourceRow["creditType"];
      expiresAt: Date;
      productCode: string;
      productVersion: string;
      status: string;
    }>[]
  >`
    SELECT reservations.canonical_request_hash AS "canonicalRequestHash",
           reservations.catalog_version AS "catalogVersion",
           allocations.credit_type AS "creditType",
           reservations.expires_at AS "expiresAt",
           reservations.product_code AS "productCode",
           reservations.product_version AS "productVersion",
           reservations.status
      FROM credit_reservation AS reservations
      JOIN credit_allocation AS allocations ON allocations.reservation_id = reservations.id
     WHERE reservations.id = ${input.reservationId}::uuid
       AND reservations.user_id = ${input.userId}::uuid
     FOR UPDATE OF reservations
  `;
  const reservation = rows.at(0);
  if (reservation === undefined) throw new RecoveryItem11AiCreditPersistenceError("conflict");
  if (
    reservation.status === direction + "d" ||
    (direction === "release" && reservation.status === "released")
  ) {
    return "replayed";
  }
  if (
    reservation.status !== "active" ||
    (direction === "consume" && reservation.expiresAt <= asOf)
  ) {
    throw new RecoveryItem11AiCreditPersistenceError("conflict");
  }
  await database.creditLedgerEntry.create({
    data: {
      amount: 1,
      canonicalRequestHash: Uint8Array.from(
        reservation.canonicalRequestHash,
      ) as Uint8Array<ArrayBuffer>,
      catalogVersion: reservation.catalogVersion,
      createdAt: asOf,
      creditType: reservation.creditType,
      direction,
      ...(direction === "consume" ? { generationId: input.generationId } : {}),
      idempotencyKeyHash: await sha256Text(`item11.${direction}\0${input.reservationId}`),
      idempotencyKeyVersion,
      operation: `ai.interpretation.${direction}`,
      policyVersion: "recovery.item11.ai-credit.v1",
      productCode: reservation.productCode,
      productVersion: reservation.productVersion,
      reason: direction === "consume" ? "provider_ai_succeeded" : "provider_ai_failed",
      reservationId: input.reservationId,
      termsVersion: "staging_only.terms.item11.v1",
      userId: input.userId,
    },
  });
  await database.creditReservation.update({
    data:
      direction === "consume"
        ? { consumedAt: asOf, status: "consumed" }
        : { releasedAt: asOf, status: "released" },
    where: { id: input.reservationId },
  });
  const column = creditColumn(reservation.creditType);
  await database.creditProjection.update({
    data: {
      ...(direction === "release" ? { [column]: { increment: 1 } } : {}),
      reserved: { decrement: 1 },
      updatedAt: asOf,
      version: { increment: 1n },
    },
    where: { userId: input.userId },
  });
  return direction === "consume" ? "consumed" : "released";
};

export const createRecoveryItem11AiCreditPersistence = (
  database: PrismaClient,
): RecoveryItem11AiCreditPersistence =>
  Object.freeze({
    async countConsumedToday(input) {
      requireScope(input.recoveryScope);
      await assertRecoveryItem11AiGenerationRuntimeDatabasePrivileges(database);
      const asOf = requireInstant(input.asOf);
      if (!uuidV4Pattern.test(input.userId))
        throw new TypeError("Recovery Item 11 user is invalid.");
      const day = new Date(asOf);
      day.setUTCHours(0, 0, 0, 0);
      return database.creditLedgerEntry.count({
        where: {
          createdAt: { gte: day, lte: asOf },
          direction: "consume",
          operation: "ai.interpretation.consume",
          userId: input.userId,
        },
      });
    },
    async consume(input) {
      requireScope(input.recoveryScope);
      await assertRecoveryItem11AiGenerationRuntimeDatabasePrivileges(database);
      const result = await retrySerializable(() =>
        database.$transaction((transaction) => settleInTransaction(transaction, input, "consume"), {
          isolationLevel: "Serializable",
        }),
      );
      if (result === "released") throw new RecoveryItem11AiCreditPersistenceError("unavailable");
      return result;
    },
    async release(input) {
      requireScope(input.recoveryScope);
      await assertRecoveryItem11AiGenerationRuntimeDatabasePrivileges(database);
      const result = await retrySerializable(() =>
        database.$transaction((transaction) => settleInTransaction(transaction, input, "release"), {
          isolationLevel: "Serializable",
        }),
      );
      if (result === "consumed") throw new RecoveryItem11AiCreditPersistenceError("unavailable");
      return result;
    },
    async reserve(input) {
      requireScope(input.recoveryScope);
      await assertRecoveryItem11AiGenerationRuntimeDatabasePrivileges(database);
      return retrySerializable(() =>
        database.$transaction((transaction) => reserveInTransaction(transaction, input), {
          isolationLevel: "Serializable",
        }),
      );
    },
  });
