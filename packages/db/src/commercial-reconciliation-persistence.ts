import { createHash } from "node:crypto";

import { Prisma, type PrismaClient } from "./generated/prisma/client.js";

const reconciliationSchemaVersion = "commercial-reconciliation.v1";
const maximumCandidates = 100;
const accountFingerprintPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;

export type CommercialReconciliationCandidate = Readonly<{
  amountMinor: number;
  creditGrantAmount: number;
  creditGrantCount: number;
  creditsExpected: number;
  currencyCode: string;
  fulfillmentAppliedPaymentStateVersion: number | null;
  fulfillmentStatus: "active" | "disputed" | "refunded" | "review_required" | null;
  orderId: string;
  orderPublicId: string;
  orderStatus:
    | "cancelled"
    | "checkout_created"
    | "created"
    | "disputed"
    | "expired"
    | "failed"
    | "paid"
    | "partially_refunded"
    | "pending"
    | "refund_requested"
    | "refunded";
  paymentAttemptId: string;
  paymentStateVersion: number;
  providerCheckoutId: string;
  providerPaymentIntentId: string | null;
}>;

export type CommercialReconciliationCase = Readonly<{
  caseType:
    | "provider_api_unavailable"
    | "provider_payment_missing"
    | "internal_payment_pending"
    | "payment_state_mismatch"
    | "payment_amount_mismatch"
    | "payment_currency_mismatch"
    | "payment_reference_mismatch"
    | "credit_issuance_missing"
    | "credit_issuance_duplicate"
    | "credit_issuance_amount_mismatch"
    | "fulfillment_state_mismatch"
    | "settlement_availability_missing";
  evidenceDigest: Uint8Array;
  orderId: string;
  paymentAttemptId: string;
  severity: "critical" | "high";
}>;

export type CommercialReconciliationPersistence = Readonly<{
  listCandidates(input: { providerAccountFingerprint: string; slotStartedAt: string }): Promise<
    Readonly<{
      candidates: readonly CommercialReconciliationCandidate[];
      truncated: boolean;
    }>
  >;
  recordRun(input: {
    candidates: number;
    cases: readonly CommercialReconciliationCase[];
    completedAt: string;
    providerAccountFingerprint: string;
    slotStartedAt: string;
    truncated: boolean;
  }): Promise<Readonly<{ cases: number; disposition: "duplicate" | "recorded"; runId: string }>>;
}>;

type CandidateRow = Omit<CommercialReconciliationCandidate, "fulfillmentStatus" | "orderStatus"> & {
  candidateCreatedAt: Date;
  candidateIndex: number;
  fulfillmentStatus: string | null;
  orderStatus: string;
  totalCandidates: number;
};

type ReconciliationPrivilegeRow = Readonly<{
  canCreateInDatabase: boolean;
  canCreateInSchema: boolean;
  canDeleteCase: boolean;
  canDeleteRun: boolean;
  canInsertCase: boolean;
  canInsertFulfillment: boolean;
  canInsertLedger: boolean;
  canInsertRun: boolean;
  canReadAttempt: boolean;
  canReadCase: boolean;
  canReadFulfillment: boolean;
  canReadItem: boolean;
  canReadJournal: boolean;
  canReadLedger: boolean;
  canReadOrder: boolean;
  canReadPaymentEvent: boolean;
  canReadRun: boolean;
  canTruncateCase: boolean;
  canTruncateRun: boolean;
  canUpdateCase: boolean;
  canUpdateOrder: boolean;
  canUpdateRun: boolean;
  privilegedRole: boolean;
  roleName: string;
}>;

const reconciliationPrivilegeAttestations = new WeakMap<PrismaClient, Promise<void>>();

export const assertCommercialReconciliationRuntimeDatabasePrivileges = async (
  database: PrismaClient,
): Promise<void> => {
  let attestation = reconciliationPrivilegeAttestations.get(database);
  if (attestation !== undefined) return attestation;
  attestation = (async () => {
    const rows = await database.$queryRaw<ReconciliationPrivilegeRow[]>`
      SELECT
        current_user AS "roleName",
        rolsuper OR rolcreaterole OR rolcreatedb OR rolreplication OR rolbypassrls
          AS "privilegedRole",
        has_database_privilege(current_user, current_database(), 'CREATE')
          AS "canCreateInDatabase",
        has_schema_privilege(current_user, 'public', 'CREATE') AS "canCreateInSchema",
        has_table_privilege(current_user, 'public.commercial_order_v2', 'SELECT')
          AS "canReadOrder",
        has_table_privilege(current_user, 'public.commercial_order_item_v2', 'SELECT')
          AS "canReadItem",
        has_table_privilege(current_user, 'public.commercial_payment_attempt_v2', 'SELECT')
          AS "canReadAttempt",
        has_table_privilege(current_user, 'public.commercial_fulfillment_v2', 'SELECT')
          AS "canReadFulfillment",
        has_table_privilege(current_user, 'public.credit_ledger_entry', 'SELECT')
          AS "canReadLedger",
        has_table_privilege(current_user, 'public.commercial_reconciliation_run_v1', 'SELECT')
          AS "canReadRun",
        has_table_privilege(current_user, 'public.commercial_reconciliation_run_v1', 'INSERT')
          AS "canInsertRun",
        has_table_privilege(current_user, 'public.commercial_reconciliation_run_v1', 'UPDATE')
          OR has_any_column_privilege(
            current_user, 'public.commercial_reconciliation_run_v1', 'UPDATE'
          ) AS "canUpdateRun",
        has_table_privilege(current_user, 'public.commercial_reconciliation_run_v1', 'DELETE')
          AS "canDeleteRun",
        has_table_privilege(current_user, 'public.commercial_reconciliation_run_v1', 'TRUNCATE')
          AS "canTruncateRun",
        has_table_privilege(current_user, 'public.commercial_reconciliation_case_v1', 'SELECT')
          AS "canReadCase",
        has_table_privilege(current_user, 'public.commercial_reconciliation_case_v1', 'INSERT')
          AS "canInsertCase",
        has_table_privilege(current_user, 'public.commercial_reconciliation_case_v1', 'UPDATE')
          OR has_any_column_privilege(
            current_user, 'public.commercial_reconciliation_case_v1', 'UPDATE'
          ) AS "canUpdateCase",
        has_table_privilege(current_user, 'public.commercial_reconciliation_case_v1', 'DELETE')
          AS "canDeleteCase",
        has_table_privilege(current_user, 'public.commercial_reconciliation_case_v1', 'TRUNCATE')
          AS "canTruncateCase",
        has_table_privilege(current_user, 'public.credit_ledger_entry', 'INSERT')
          AS "canInsertLedger",
        has_table_privilege(current_user, 'public.commercial_fulfillment_v2', 'INSERT')
          AS "canInsertFulfillment",
        has_table_privilege(current_user, 'public.commercial_order_v2', 'UPDATE')
          OR has_any_column_privilege(current_user, 'public.commercial_order_v2', 'UPDATE')
          AS "canUpdateOrder",
        has_table_privilege(current_user, 'public.commercial_payment_event_v2', 'SELECT')
          OR has_any_column_privilege(
            current_user, 'public.commercial_payment_event_v2', 'SELECT'
          ) AS "canReadPaymentEvent",
        has_table_privilege(current_user, 'public.journal_entry', 'SELECT')
          OR has_any_column_privilege(current_user, 'public.journal_entry', 'SELECT')
          OR has_table_privilege(current_user, 'public.private_journal_entry', 'SELECT')
          OR has_any_column_privilege(
            current_user, 'public.private_journal_entry', 'SELECT'
          ) AS "canReadJournal"
      FROM pg_roles
      WHERE rolname = current_user
    `;
    const privilege = rows.at(0);
    if (
      rows.length !== 1 ||
      privilege === undefined ||
      privilege.roleName !== "rituvia_payment_reconciliation" ||
      privilege.privilegedRole ||
      privilege.canCreateInDatabase ||
      privilege.canCreateInSchema ||
      !privilege.canReadOrder ||
      !privilege.canReadItem ||
      !privilege.canReadAttempt ||
      !privilege.canReadFulfillment ||
      !privilege.canReadLedger ||
      !privilege.canReadRun ||
      !privilege.canInsertRun ||
      privilege.canUpdateRun ||
      privilege.canDeleteRun ||
      privilege.canTruncateRun ||
      !privilege.canReadCase ||
      !privilege.canInsertCase ||
      privilege.canUpdateCase ||
      privilege.canDeleteCase ||
      privilege.canTruncateCase ||
      privilege.canInsertLedger ||
      privilege.canInsertFulfillment ||
      privilege.canUpdateOrder ||
      privilege.canReadPaymentEvent ||
      privilege.canReadJournal
    ) {
      throw new Error("Commercial reconciliation database role is unavailable.");
    }
  })().catch((error: unknown) => {
    reconciliationPrivilegeAttestations.delete(database);
    throw error;
  });
  reconciliationPrivilegeAttestations.set(database, attestation);
  return attestation;
};

const runIdempotencyDigest = (input: {
  candidates: number;
  cases: readonly CommercialReconciliationCase[];
  providerAccountFingerprint: string;
  slotStartedAt: string;
  truncated: boolean;
}): Uint8Array<ArrayBuffer> => {
  const hasher = createHash("sha256").update(
    [
      reconciliationSchemaVersion,
      "stripe",
      "sandbox",
      input.providerAccountFingerprint,
      input.slotStartedAt,
      String(input.candidates),
      input.truncated ? "truncated" : "complete",
    ].join(":"),
  );
  const orderedCases = [...input.cases].sort((left, right) =>
    [left.orderId, left.paymentAttemptId, left.caseType, left.severity]
      .join(":")
      .localeCompare(
        [right.orderId, right.paymentAttemptId, right.caseType, right.severity].join(":"),
      ),
  );
  for (const reconciliationCase of orderedCases) {
    hasher
      .update("\0")
      .update(reconciliationCase.orderId)
      .update("\0")
      .update(reconciliationCase.paymentAttemptId)
      .update("\0")
      .update(reconciliationCase.caseType)
      .update("\0")
      .update(reconciliationCase.severity)
      .update("\0")
      .update(reconciliationCase.evidenceDigest);
  }
  return new Uint8Array(hasher.digest());
};

const isSerializationFailure = (error: unknown): boolean => {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code === "P2034") return true;
  if (error.code !== "P2010" || typeof error.meta !== "object" || error.meta === null) return false;
  const adapter = (error.meta as Record<string, unknown>).driverAdapterError;
  if (typeof adapter !== "object" || adapter === null) return false;
  const cause = (adapter as Record<string, unknown>).cause;
  return (
    typeof cause === "object" &&
    cause !== null &&
    (cause as Record<string, unknown>).originalCode === "40001"
  );
};

const requireInstant = (value: string): Date => {
  const parsed = new Date(value);
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value) ||
    !Number.isFinite(parsed.getTime())
  ) {
    throw new TypeError("Commercial reconciliation timestamp is invalid.");
  }
  return parsed;
};

const requireAccountFingerprint = (value: string): string => {
  if (!accountFingerprintPattern.test(value)) {
    throw new TypeError("Commercial reconciliation account is invalid.");
  }
  return value;
};

const readCandidates = async (
  database: PrismaClient,
  accountFingerprint: string,
  slotStartedAt: Date,
): Promise<
  Readonly<{ candidates: readonly CommercialReconciliationCandidate[]; truncated: boolean }>
> => {
  const dailyWindowOffset = Math.floor(slotStartedAt.getTime() / 86_400_000) * maximumCandidates;
  const rows = await database.$queryRaw<CandidateRow[]>`
    WITH candidates AS (
      SELECT
        orders.id AS "orderId",
        orders.public_id AS "orderPublicId",
        orders.status AS "orderStatus",
        orders.total_minor AS "amountMinor",
        orders.currency_code AS "currencyCode",
        orders.payment_state_version AS "paymentStateVersion",
        attempts.id AS "paymentAttemptId",
        attempts.provider_checkout_id AS "providerCheckoutId",
        attempts.provider_payment_intent_id AS "providerPaymentIntentId",
        items.credits_granted AS "creditsExpected",
        fulfillment.status AS "fulfillmentStatus",
        fulfillment.applied_payment_state_version AS "fulfillmentAppliedPaymentStateVersion",
        COALESCE(grants.entry_count, 0)::int AS "creditGrantCount",
        COALESCE(grants.amount, 0)::int AS "creditGrantAmount",
        orders.created_at AS "candidateCreatedAt"
      FROM commercial_payment_attempt_v2 AS attempts
      JOIN commercial_order_v2 AS orders ON orders.id = attempts.order_id
      JOIN commercial_order_item_v2 AS items ON items.order_id = orders.id
      LEFT JOIN commercial_fulfillment_v2 AS fulfillment ON fulfillment.order_id = orders.id
      LEFT JOIN LATERAL (
        SELECT count(*)::int AS entry_count, COALESCE(sum(amount), 0)::int AS amount
        FROM credit_ledger_entry
        WHERE order_id = orders.id
          AND operation = 'credit.grant.purchase'
          AND direction = 'grant'
      ) AS grants ON TRUE
      WHERE attempts.provider = 'stripe'
        AND attempts.environment = 'sandbox'
        AND attempts.provider_account_fingerprint = ${accountFingerprint}
        AND attempts.provider_checkout_id IS NOT NULL
        AND items.fulfillment_kind = 'credit_pack'
        AND items.credits_granted IS NOT NULL
    ),
    numbered_candidates AS (
      SELECT
        candidates.*,
        (row_number() OVER (
          ORDER BY "candidateCreatedAt", "orderId"
        ) - 1)::int AS "candidateIndex",
        count(*) OVER ()::int AS "totalCandidates"
      FROM candidates
    )
    SELECT *
    FROM numbered_candidates
    ORDER BY MOD(
      "candidateIndex"
        - MOD(${dailyWindowOffset}, "totalCandidates")
        + "totalCandidates",
      "totalCandidates"
    )
    LIMIT ${maximumCandidates}
  `;
  const totalCandidates = rows.at(0)?.totalCandidates ?? 0;
  return Object.freeze({
    candidates: Object.freeze(
      rows.slice(0, maximumCandidates).map((row) => {
        const {
          candidateCreatedAt: ignoredCandidateCreatedAt,
          candidateIndex: ignoredCandidateIndex,
          totalCandidates: ignoredTotalCandidates,
          ...candidate
        } = row;
        void ignoredCandidateCreatedAt;
        void ignoredCandidateIndex;
        void ignoredTotalCandidates;
        return Object.freeze(candidate as CommercialReconciliationCandidate);
      }),
    ),
    truncated: totalCandidates > rows.length,
  });
};

export const createCommercialReconciliationPersistence = (
  database: PrismaClient,
): CommercialReconciliationPersistence =>
  Object.freeze({
    async listCandidates(input) {
      await assertCommercialReconciliationRuntimeDatabasePrivileges(database);
      return readCandidates(
        database,
        requireAccountFingerprint(input.providerAccountFingerprint),
        requireInstant(input.slotStartedAt),
      );
    },

    async recordRun(input) {
      await assertCommercialReconciliationRuntimeDatabasePrivileges(database);
      const providerAccountFingerprint = requireAccountFingerprint(
        input.providerAccountFingerprint,
      );
      const slotStartedAt = requireInstant(input.slotStartedAt);
      const completedAt = requireInstant(input.completedAt);
      if (
        completedAt < slotStartedAt ||
        !Number.isSafeInteger(input.candidates) ||
        input.candidates < 0 ||
        input.candidates > maximumCandidates ||
        input.cases.length > 1200 ||
        input.cases.some(
          (reconciliationCase) => reconciliationCase.evidenceDigest.byteLength !== 32,
        )
      ) {
        throw new TypeError("Commercial reconciliation run is invalid.");
      }
      const idempotencyKeyHash = runIdempotencyDigest({
        ...input,
        providerAccountFingerprint,
      });

      for (let attempt = 1; attempt <= 5; attempt += 1) {
        try {
          return await database.$transaction(
            async (transaction) => {
              const inserted = await transaction.$queryRaw<Readonly<{ id: string }>[]>`
            INSERT INTO commercial_reconciliation_run_v1 (
              provider, environment, provider_account_fingerprint, schema_version,
              slot_started_at, idempotency_key_hash, candidate_count, case_count,
              scan_state, created_at
            ) VALUES (
              'stripe', 'sandbox', ${providerAccountFingerprint}, ${reconciliationSchemaVersion},
              ${slotStartedAt}, ${idempotencyKeyHash}, ${input.candidates}, ${input.cases.length},
              ${input.truncated ? "truncated" : "complete"}, ${completedAt}
            )
            ON CONFLICT (
              provider, environment, provider_account_fingerprint,
              schema_version, idempotency_key_hash
            ) DO NOTHING
            RETURNING id
          `;
              const runId = inserted.at(0)?.id;
              if (runId === undefined) {
                const existing = await transaction.$queryRaw<
                  Readonly<{ caseCount: number; id: string }>[]
                >`
              SELECT id, case_count AS "caseCount"
              FROM commercial_reconciliation_run_v1
              WHERE provider = 'stripe'
                AND environment = 'sandbox'
                AND provider_account_fingerprint = ${providerAccountFingerprint}
                AND schema_version = ${reconciliationSchemaVersion}
                AND idempotency_key_hash = ${idempotencyKeyHash}
            `;
                const row = existing.at(0);
                if (existing.length !== 1 || row === undefined) {
                  throw new Error("Commercial reconciliation run is unavailable.");
                }
                return Object.freeze({
                  cases: row.caseCount,
                  disposition: "duplicate" as const,
                  runId: row.id,
                });
              }

              for (const reconciliationCase of input.cases) {
                await transaction.$executeRaw`
              INSERT INTO commercial_reconciliation_case_v1 (
                run_id, order_id, payment_attempt_id, case_type,
                severity, evidence_digest, created_at
              ) VALUES (
                ${runId}::uuid, ${reconciliationCase.orderId}::uuid,
                ${reconciliationCase.paymentAttemptId}::uuid,
                ${reconciliationCase.caseType}, ${reconciliationCase.severity},
                ${reconciliationCase.evidenceDigest}, ${completedAt}
              )
            `;
              }
              return Object.freeze({
                cases: input.cases.length,
                disposition: "recorded" as const,
                runId,
              });
            },
            { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
          );
        } catch (error) {
          if (!isSerializationFailure(error) || attempt === 5) throw error;
          await new Promise((resolve) => setTimeout(resolve, attempt * 5));
        }
      }
      throw new Error("Commercial reconciliation run is unavailable.");
    },
  });
