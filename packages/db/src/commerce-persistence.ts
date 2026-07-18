import { Prisma, type PrismaClient } from "./generated/prisma/client.js";

const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const identifierPattern = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u;
const resourcePattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/u;
const currencyPattern = /^[A-Z]{3}$/u;
const countryPattern = /^[A-Z]{2}$/u;
const maximumMinorAmount = 2_147_483_647;

export const commercePersistenceErrorCodes = Object.freeze([
  "COMMERCE_CONFLICT",
  "COMMERCE_NOT_FOUND",
  "COMMERCE_UNAVAILABLE",
] as const);
export type CommercePersistenceErrorCode = (typeof commercePersistenceErrorCodes)[number];

export class CommercePersistenceError extends Error {
  readonly code: CommercePersistenceErrorCode;

  constructor(code: CommercePersistenceErrorCode) {
    super("The commerce record could not be completed.");
    this.name = "CommercePersistenceError";
    this.code = code;
  }
}

export type PersistedCommerceOrder = Readonly<{
  amountMinor: number;
  checkoutExpiresAt: string | null;
  checkoutSessionId: string | null;
  checkoutUrl: string | null;
  countryCode: string;
  countryPolicyVersion: string;
  createdAt: string;
  currencyCode: string;
  entitlementCode: string;
  exactContents: readonly string[];
  orderId: string;
  orderLineId: string;
  paymentAttemptId: string | null;
  paymentAttemptNumber: number | null;
  priceVersion: string;
  productCode: string;
  productVersion: string;
  providerId: string | null;
  refundPolicyVersion: string;
  state:
    | "canceled"
    | "checkout_created"
    | "disputed"
    | "paid"
    | "payment_failed"
    | "pending_checkout"
    | "processing"
    | "refunded";
  termsVersion: string;
  updatedAt: string;
  userId: string;
}>;

export type PersistedEntitlement = Readonly<{
  code: string;
  entitlementId: string;
  grantedAt: string;
  revokedAt: string | null;
  sourceOrderLineId: string;
  state: "active" | "revoked";
  userId: string;
  version: number;
}>;

export type PreparedCommerceOrder = Readonly<{
  canonicalRequestHash: Uint8Array;
  idempotencyKeyHash: Uint8Array;
  order: Omit<
    PersistedCommerceOrder,
    | "checkoutExpiresAt"
    | "checkoutSessionId"
    | "checkoutUrl"
    | "paymentAttemptId"
    | "paymentAttemptNumber"
    | "providerId"
  >;
}>;

export type PreparedCheckoutAttachment = Readonly<{
  attemptNumber: number;
  checkoutSessionId: string;
  checkoutUrl: string;
  createdAt: string;
  expiresAt: string;
  paymentAttemptId: string;
  providerEnvironment: "live" | "local" | "sandbox";
  providerId: string;
}>;

export type PreparedPaymentEvent = Readonly<{
  apiVersion: string;
  amountMinor: number;
  currencyCode: string;
  eventId: string;
  eventType: string;
  objectId: string;
  occurredAt: string;
  orderId: string;
  payloadDigest: Uint8Array;
  providerAccountFingerprint: string;
  providerCheckoutSessionId: string | null;
  providerId: string;
  providerPaymentIntentId: string | null;
  receivedAt: string;
}>;

export type CommerceTransitionResult = Readonly<{
  disposition: "applied" | "ignored_out_of_order" | "rejected_mismatch";
  entitlementDirective: "grant" | "none" | "revoke";
  nextState: PersistedCommerceOrder["state"];
}>;

export type ProcessedPaymentEvent = Readonly<{
  disposition: CommerceTransitionResult["disposition"] | "duplicate" | "not_found";
  entitlement: PersistedEntitlement | null;
  order: PersistedCommerceOrder | null;
}>;

type OrderRow = Readonly<{
  amountMinor: bigint | number;
  checkoutExpiresAt: Date | null;
  checkoutSessionId: string | null;
  checkoutUrl: string | null;
  countryCode: string;
  countryPolicyVersion: string;
  createdAt: Date;
  currencyCode: string;
  entitlementCode: string;
  exactContents: unknown;
  orderId: string;
  orderLineId: string;
  paymentAttemptId: string | null;
  paymentAttemptNumber: number | null;
  priceVersion: string;
  productCode: string;
  productVersion: string;
  providerId: string | null;
  refundPolicyVersion: string;
  state: string;
  termsVersion: string;
  updatedAt: Date;
  userId: string;
}>;

type EntitlementRow = Readonly<{
  code: string;
  entitlementId: string;
  grantedAt: Date;
  revokedAt: Date | null;
  sourceOrderLineId: string;
  state: string;
  userId: string;
  version: number;
}>;

type PaymentAttemptReferenceRow = Readonly<{
  checkoutExpiresAt: Date;
  checkoutSessionId: string | null;
  checkoutUrl: string | null;
  orderId: string;
  paymentAttemptId: string;
  paymentAttemptNumber: number;
  providerId: string;
  providerPaymentIntentId: string | null;
  state: string;
}>;

type PaymentAttemptAssociation =
  | Readonly<{ kind: "matched"; paymentAttempt: PaymentAttemptReferenceRow }>
  | Readonly<{ kind: "mismatch" | "not_found" }>;

const requireUuid = (value: string): string => {
  if (!uuidV4Pattern.test(value)) throw new TypeError("Commerce identifier is invalid.");
  return value;
};

const requireResource = (value: string): string => {
  if (!resourcePattern.test(value)) throw new TypeError("Commerce reference is invalid.");
  return value;
};

const requireIdentifier = (value: string): string => {
  if (!identifierPattern.test(value)) throw new TypeError("Commerce identifier is invalid.");
  return value;
};

const requireInstant = (value: string): Date => {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== value) {
    throw new TypeError("Commerce instant is invalid.");
  }
  return new Date(timestamp);
};

const requireMinorAmount = (value: bigint | number): number => {
  const amount = typeof value === "bigint" ? Number(value) : value;
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > maximumMinorAmount) {
    throw new TypeError("Commerce amount is invalid.");
  }
  return amount;
};

const requireAttemptNumber = (value: number): number => {
  if (!Number.isSafeInteger(value) || value < 1 || value > 100) {
    throw new TypeError("Payment attempt is invalid.");
  }
  return value;
};

const requireContents = (value: unknown): readonly string[] => {
  if (
    !Array.isArray(value) ||
    value.length < 1 ||
    value.length > 16 ||
    value.some((item) => typeof item !== "string" || item.length < 1 || item.length > 240)
  ) {
    throw new TypeError("Commerce contents are invalid.");
  }
  return Object.freeze([...value] as string[]);
};

const requireCheckoutUrl = (value: string): string => {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new TypeError("Checkout URL is invalid.");
  }
  const localHttp =
    parsed.protocol === "http:" &&
    (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost");
  if (
    value.length > 2_048 ||
    (parsed.protocol !== "https:" && !localHttp) ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.hash !== ""
  ) {
    throw new TypeError("Checkout URL is invalid.");
  }
  return parsed.toString();
};

const requireOrderState = (value: string): PersistedCommerceOrder["state"] => {
  switch (value) {
    case "canceled":
    case "checkout_created":
    case "disputed":
    case "paid":
    case "payment_failed":
    case "pending_checkout":
    case "processing":
    case "refunded":
      return value;
    default:
      throw new TypeError("Commerce state is invalid.");
  }
};

const mapOrder = (row: OrderRow): PersistedCommerceOrder =>
  Object.freeze({
    amountMinor: requireMinorAmount(row.amountMinor),
    checkoutExpiresAt: row.checkoutExpiresAt?.toISOString() ?? null,
    checkoutSessionId: row.checkoutSessionId,
    checkoutUrl: row.checkoutUrl === null ? null : requireCheckoutUrl(row.checkoutUrl),
    countryCode: row.countryCode,
    countryPolicyVersion: row.countryPolicyVersion,
    createdAt: row.createdAt.toISOString(),
    currencyCode: row.currencyCode,
    entitlementCode: row.entitlementCode,
    exactContents: requireContents(row.exactContents),
    orderId: row.orderId,
    orderLineId: row.orderLineId,
    paymentAttemptId: row.paymentAttemptId,
    paymentAttemptNumber:
      row.paymentAttemptNumber === null ? null : requireAttemptNumber(row.paymentAttemptNumber),
    priceVersion: row.priceVersion,
    productCode: row.productCode,
    productVersion: row.productVersion,
    providerId: row.providerId,
    refundPolicyVersion: row.refundPolicyVersion,
    state: requireOrderState(row.state),
    termsVersion: row.termsVersion,
    updatedAt: row.updatedAt.toISOString(),
    userId: row.userId,
  });

const mapEntitlement = (row: EntitlementRow): PersistedEntitlement => {
  if (row.state !== "active" && row.state !== "revoked") {
    throw new TypeError("Entitlement state is invalid.");
  }
  return Object.freeze({
    code: row.code,
    entitlementId: row.entitlementId,
    grantedAt: row.grantedAt.toISOString(),
    revokedAt: row.revokedAt?.toISOString() ?? null,
    sourceOrderLineId: row.sourceOrderLineId,
    state: row.state,
    userId: row.userId,
    version: row.version,
  });
};

const bytesEqual = (left: Uint8Array, right: Uint8Array): boolean => {
  if (left.byteLength !== right.byteLength) return false;
  let difference = 0;
  for (let index = 0; index < left.byteLength; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return difference === 0;
};

const selectPaymentAttemptByProviderReferences = async (
  transaction: Prisma.TransactionClient,
  event: PreparedPaymentEvent,
): Promise<PaymentAttemptAssociation> => {
  const checkoutSessionId = event.providerCheckoutSessionId;
  const paymentIntentId = event.providerPaymentIntentId;
  if (checkoutSessionId === null && paymentIntentId === null) {
    return Object.freeze({ kind: "not_found" as const });
  }

  const selection = Prisma.sql`
    SELECT attempt.id AS "paymentAttemptId", attempt.order_id AS "orderId",
           attempt.provider AS "providerId", attempt.attempt_number AS "paymentAttemptNumber",
           attempt.expires_at AS "checkoutExpiresAt",
           attempt.provider_checkout_session_id AS "checkoutSessionId",
           attempt.provider_checkout_url AS "checkoutUrl",
           attempt.provider_payment_intent_id AS "providerPaymentIntentId",
           attempt.state
      FROM payment_attempt AS attempt
  `;
  const rows =
    checkoutSessionId !== null && paymentIntentId !== null
      ? await transaction.$queryRaw<PaymentAttemptReferenceRow[]>`
          ${selection}
           WHERE attempt.provider_checkout_session_id = ${checkoutSessionId}
              OR attempt.provider_payment_intent_id = ${paymentIntentId}
           FOR UPDATE
        `
      : checkoutSessionId !== null
        ? await transaction.$queryRaw<PaymentAttemptReferenceRow[]>`
            ${selection}
             WHERE attempt.provider_checkout_session_id = ${checkoutSessionId}
             FOR UPDATE
          `
        : await transaction.$queryRaw<PaymentAttemptReferenceRow[]>`
            ${selection}
             WHERE attempt.provider_payment_intent_id = ${paymentIntentId}
             FOR UPDATE
          `;

  const paymentAttempt = rows[0];
  if (rows.length === 0 || paymentAttempt === undefined) {
    return Object.freeze({ kind: "not_found" as const });
  }
  if (
    rows.length !== 1 ||
    paymentAttempt.orderId !== event.orderId ||
    paymentAttempt.providerId !== event.providerId ||
    (checkoutSessionId !== null && paymentAttempt.checkoutSessionId !== checkoutSessionId) ||
    (paymentIntentId !== null &&
      paymentAttempt.providerPaymentIntentId !== null &&
      paymentAttempt.providerPaymentIntentId !== paymentIntentId)
  ) {
    return Object.freeze({ kind: "mismatch" as const });
  }

  if (paymentIntentId !== null && paymentAttempt.providerPaymentIntentId === null) {
    await transaction.$executeRaw`
      UPDATE payment_attempt
         SET provider_payment_intent_id = ${paymentIntentId}, updated_at = CURRENT_TIMESTAMP
       WHERE id = ${paymentAttempt.paymentAttemptId}::uuid
         AND provider_payment_intent_id IS NULL
    `;
    return Object.freeze({
      kind: "matched" as const,
      paymentAttempt: Object.freeze({
        ...paymentAttempt,
        providerPaymentIntentId: paymentIntentId,
      }),
    });
  }
  return Object.freeze({ kind: "matched" as const, paymentAttempt });
};

const attachExactPaymentAttempt = (
  order: PersistedCommerceOrder,
  paymentAttempt: PaymentAttemptReferenceRow,
): PersistedCommerceOrder =>
  Object.freeze({
    ...order,
    checkoutExpiresAt: paymentAttempt.checkoutExpiresAt.toISOString(),
    checkoutSessionId: paymentAttempt.checkoutSessionId,
    checkoutUrl:
      paymentAttempt.checkoutUrl === null ? null : requireCheckoutUrl(paymentAttempt.checkoutUrl),
    paymentAttemptId: paymentAttempt.paymentAttemptId,
    paymentAttemptNumber: requireAttemptNumber(paymentAttempt.paymentAttemptNumber),
    providerId: paymentAttempt.providerId,
  });

type PaymentAttemptState =
  | "checkout_created"
  | "created"
  | "disputed"
  | "expired"
  | "paid"
  | "payment_failed"
  | "processing"
  | "refunded";

const requirePaymentAttemptState = (value: string): PaymentAttemptState => {
  switch (value) {
    case "checkout_created":
    case "created":
    case "disputed":
    case "expired":
    case "paid":
    case "payment_failed":
    case "processing":
    case "refunded":
      return value;
    default:
      throw new TypeError("Payment attempt state is invalid.");
  }
};

const nextPaymentAttemptState = (
  current: PaymentAttemptState,
  eventType: string,
  amountMatchesOrder: boolean,
): PaymentAttemptState | null => {
  if (!amountMatchesOrder) return null;
  switch (eventType) {
    case "payment_pending":
      return current === "created" || current === "checkout_created" || current === "payment_failed"
        ? "processing"
        : null;
    case "payment_succeeded":
      return current === "created" ||
        current === "checkout_created" ||
        current === "processing" ||
        current === "payment_failed" ||
        current === "expired"
        ? "paid"
        : null;
    case "payment_failed":
      return current === "created" || current === "checkout_created" || current === "processing"
        ? "payment_failed"
        : null;
    case "payment_refunded":
      return current === "paid" || current === "disputed" ? "refunded" : null;
    case "payment_disputed":
      return current === "paid" ? "disputed" : null;
    default:
      return null;
  }
};

const selectOrder = async (
  database: Prisma.TransactionClient | PrismaClient,
  orderId: string,
  userId?: string,
  lock = false,
): Promise<PersistedCommerceOrder | null> => {
  const rows =
    userId === undefined
      ? await database.$queryRaw<OrderRow[]>`
        SELECT orders.id AS "orderId", orders.user_id AS "userId", orders.status AS state,
               orders.currency AS "currencyCode", orders.total_minor AS "amountMinor",
               orders.country_code AS "countryCode",
               orders.country_policy_version AS "countryPolicyVersion",
               orders.terms_version AS "termsVersion",
               orders.refund_policy_version AS "refundPolicyVersion",
               orders.created_at AS "createdAt", orders.updated_at AS "updatedAt",
               line.id AS "orderLineId", line.product_code AS "productCode",
               line.product_version AS "productVersion", line.price_version AS "priceVersion",
               line.exact_contents_snapshot AS "exactContents",
               line.entitlement_code AS "entitlementCode",
               attempt.id AS "paymentAttemptId",
               attempt.attempt_number AS "paymentAttemptNumber",
               attempt.expires_at AS "checkoutExpiresAt", attempt.provider AS "providerId",
               attempt.provider_checkout_session_id AS "checkoutSessionId",
               attempt.provider_checkout_url AS "checkoutUrl"
          FROM commerce_order AS orders
          JOIN commerce_order_line AS line ON line.order_id = orders.id
          LEFT JOIN LATERAL (
            SELECT candidate.id, candidate.provider, candidate.attempt_number,
                   candidate.expires_at, candidate.provider_checkout_session_id,
                   candidate.provider_checkout_url
              FROM payment_attempt AS candidate
             WHERE candidate.order_id = orders.id
             ORDER BY candidate.attempt_number DESC
             LIMIT 1
          ) AS attempt ON TRUE
         WHERE orders.id = ${orderId}::uuid
         ${lock ? Prisma.sql`FOR UPDATE OF orders` : Prisma.empty}
      `
      : await database.$queryRaw<OrderRow[]>`
        SELECT orders.id AS "orderId", orders.user_id AS "userId", orders.status AS state,
               orders.currency AS "currencyCode", orders.total_minor AS "amountMinor",
               orders.country_code AS "countryCode",
               orders.country_policy_version AS "countryPolicyVersion",
               orders.terms_version AS "termsVersion",
               orders.refund_policy_version AS "refundPolicyVersion",
               orders.created_at AS "createdAt", orders.updated_at AS "updatedAt",
               line.id AS "orderLineId", line.product_code AS "productCode",
               line.product_version AS "productVersion", line.price_version AS "priceVersion",
               line.exact_contents_snapshot AS "exactContents",
               line.entitlement_code AS "entitlementCode",
               attempt.id AS "paymentAttemptId",
               attempt.attempt_number AS "paymentAttemptNumber",
               attempt.expires_at AS "checkoutExpiresAt", attempt.provider AS "providerId",
               attempt.provider_checkout_session_id AS "checkoutSessionId",
               attempt.provider_checkout_url AS "checkoutUrl"
          FROM commerce_order AS orders
          JOIN commerce_order_line AS line ON line.order_id = orders.id
          LEFT JOIN LATERAL (
            SELECT candidate.id, candidate.provider, candidate.attempt_number,
                   candidate.expires_at, candidate.provider_checkout_session_id,
                   candidate.provider_checkout_url
              FROM payment_attempt AS candidate
             WHERE candidate.order_id = orders.id
             ORDER BY candidate.attempt_number DESC
             LIMIT 1
          ) AS attempt ON TRUE
         WHERE orders.id = ${orderId}::uuid
           AND orders.user_id = ${userId}::uuid
         ${lock ? Prisma.sql`FOR UPDATE OF orders` : Prisma.empty}
      `;
  if (rows.length > 1) throw new CommercePersistenceError("COMMERCE_UNAVAILABLE");
  return rows[0] === undefined ? null : mapOrder(rows[0]);
};

const selectEntitlement = async (
  database: Prisma.TransactionClient | PrismaClient,
  userId: string,
  entitlementCode: string,
): Promise<PersistedEntitlement | null> => {
  const rows = await database.$queryRaw<EntitlementRow[]>`
    SELECT id AS "entitlementId", user_id AS "userId", entitlement_code AS code,
           source_order_line_id AS "sourceOrderLineId", status AS state,
           granted_at AS "grantedAt", revoked_at AS "revokedAt", version
      FROM entitlement
     WHERE user_id = ${userId}::uuid
       AND entitlement_code = ${entitlementCode}
     LIMIT 1
  `;
  return rows[0] === undefined ? null : mapEntitlement(rows[0]);
};

export type CommercePersistence = ReturnType<typeof createCommercePersistence>;

export const createCommercePersistence = (database: PrismaClient) => ({
  async authorizeEntitlementForUser(userId: string, entitlementCode: string): Promise<boolean> {
    requireUuid(userId);
    requireIdentifier(entitlementCode);
    const rows = await database.$queryRaw<Readonly<{ allowed: boolean }>[]>`
      SELECT EXISTS (
        SELECT 1
          FROM entitlement AS access
         WHERE access.user_id = ${userId}::uuid
           AND access.entitlement_code = ${entitlementCode}
           AND access.status = 'active'
      ) AS allowed
    `;
    return rows.length === 1 && rows[0]?.allowed === true;
  },

  async attachCheckout(
    userId: string,
    orderId: string,
    attachment: PreparedCheckoutAttachment,
  ): Promise<PersistedCommerceOrder> {
    requireUuid(userId);
    requireUuid(orderId);
    requireUuid(attachment.paymentAttemptId);
    requireIdentifier(attachment.providerId);
    requireResource(attachment.checkoutSessionId);
    const checkoutUrl = requireCheckoutUrl(attachment.checkoutUrl);
    const createdAt = requireInstant(attachment.createdAt);
    const expiresAt = requireInstant(attachment.expiresAt);
    requireAttemptNumber(attachment.attemptNumber);
    if (expiresAt.getTime() <= createdAt.getTime()) {
      throw new TypeError("Payment attempt is invalid.");
    }

    return database.$transaction(
      async (transaction) => {
        const order = await selectOrder(transaction, orderId, userId, true);
        if (order === null) throw new CommercePersistenceError("COMMERCE_NOT_FOUND");
        if (order.checkoutSessionId !== null) {
          if (
            order.checkoutSessionId === attachment.checkoutSessionId &&
            order.providerId === attachment.providerId
          )
            return order;
        }
        const expectedAttemptNumber = (order.paymentAttemptNumber ?? 0) + 1;
        const previousExpired =
          order.checkoutExpiresAt !== null &&
          Date.parse(order.checkoutExpiresAt) <= createdAt.getTime();
        const retryAllowed =
          order.state === "payment_failed" ||
          (order.state === "checkout_created" && previousExpired);
        if (
          attachment.attemptNumber !== expectedAttemptNumber ||
          (order.state !== "pending_checkout" && !retryAllowed)
        ) {
          throw new CommercePersistenceError("COMMERCE_CONFLICT");
        }

        if (order.paymentAttemptId !== null && previousExpired) {
          await transaction.$executeRaw`
          UPDATE payment_attempt
             SET state = 'expired', updated_at = ${createdAt}
           WHERE id = ${order.paymentAttemptId}::uuid
             AND state = 'checkout_created'
        `;
        }

        await transaction.$executeRaw`
        INSERT INTO payment_attempt (
          id, order_id, provider, environment, attempt_number, state,
          provider_checkout_session_id, provider_checkout_url, provider_payment_intent_id,
          amount_minor, currency, expires_at, created_at, updated_at
        ) VALUES (
          ${attachment.paymentAttemptId}::uuid, ${orderId}::uuid, ${attachment.providerId},
          ${attachment.providerEnvironment}, ${attachment.attemptNumber}, 'checkout_created',
          ${attachment.checkoutSessionId}, ${checkoutUrl}, NULL, ${order.amountMinor},
          ${order.currencyCode},
          ${expiresAt}, ${createdAt}, ${createdAt}
        )
      `;
        await transaction.$executeRaw`
        UPDATE commerce_order
           SET status = 'checkout_created', updated_at = ${createdAt}
         WHERE id = ${orderId}::uuid
      `;
        const updated = await selectOrder(transaction, orderId, userId);
        if (updated === null) throw new CommercePersistenceError("COMMERCE_UNAVAILABLE");
        return updated;
      },
      { isolationLevel: "Serializable" },
    );
  },

  async createOrder(
    prepared: PreparedCommerceOrder,
  ): Promise<Readonly<{ kind: "created" | "replayed"; order: PersistedCommerceOrder }>> {
    const order = prepared.order;
    requireUuid(order.orderId);
    requireUuid(order.orderLineId);
    requireUuid(order.userId);
    requireIdentifier(order.productCode);
    requireIdentifier(order.entitlementCode);
    requireResource(order.productVersion);
    requireResource(order.priceVersion);
    requireResource(order.countryPolicyVersion);
    requireResource(order.termsVersion);
    requireResource(order.refundPolicyVersion);
    if (!currencyPattern.test(order.currencyCode) || !countryPattern.test(order.countryCode)) {
      throw new TypeError("Commerce locale is invalid.");
    }
    const amountMinor = requireMinorAmount(order.amountMinor);
    if (amountMinor < 1 || order.state !== "pending_checkout") {
      throw new TypeError("Commerce order is invalid.");
    }
    const createdAt = requireInstant(order.createdAt);
    const updatedAt = requireInstant(order.updatedAt);
    const exactContents = requireContents(order.exactContents);
    if (
      prepared.idempotencyKeyHash.byteLength !== 32 ||
      prepared.canonicalRequestHash.byteLength !== 32
    ) {
      throw new TypeError("Commerce digest is invalid.");
    }

    return database.$transaction(
      async (transaction) => {
        const alreadyOwned = await transaction.$queryRaw<Readonly<{ id: string }>[]>`
          SELECT access.id
            FROM entitlement AS access
           WHERE access.user_id = ${order.userId}::uuid
             AND access.entitlement_code = ${order.entitlementCode}
             AND access.status = 'active'
             AND NOT EXISTS (
               SELECT 1
                 FROM commerce_order AS existing_order
                WHERE existing_order.user_id = ${order.userId}::uuid
                  AND existing_order.idempotency_key_hash = ${prepared.idempotencyKeyHash}
             )
           FOR UPDATE
        `;
        if (alreadyOwned.length > 0) {
          throw new CommercePersistenceError("COMMERCE_CONFLICT");
        }
        const openPurchase = await transaction.$queryRaw<Readonly<{ id: string }>[]>`
          SELECT existing_order.id
            FROM commerce_order AS existing_order
            JOIN commerce_order_line AS existing_line
              ON existing_line.order_id = existing_order.id
           WHERE existing_order.user_id = ${order.userId}::uuid
             AND existing_line.entitlement_code = ${order.entitlementCode}
             AND existing_order.status NOT IN ('canceled', 'refunded')
             AND existing_order.idempotency_key_hash <> ${prepared.idempotencyKeyHash}
           LIMIT 1
           FOR UPDATE OF existing_order
        `;
        if (openPurchase.length > 0) {
          throw new CommercePersistenceError("COMMERCE_CONFLICT");
        }
        const inserted = await transaction.$queryRaw<Readonly<{ id: string }>[]>`
        INSERT INTO commerce_order (
          id, user_id, status, currency, subtotal_minor, tax_minor, total_minor,
          refunded_minor, country_code, country_policy_version, terms_version,
          refund_policy_version, idempotency_key_hash, canonical_request_hash,
          created_at, updated_at
        ) VALUES (
          ${order.orderId}::uuid, ${order.userId}::uuid, 'pending_checkout',
          ${order.currencyCode}, ${amountMinor}, 0, ${amountMinor}, 0,
          ${order.countryCode}, ${order.countryPolicyVersion}, ${order.termsVersion},
          ${order.refundPolicyVersion}, ${prepared.idempotencyKeyHash},
          ${prepared.canonicalRequestHash}, ${createdAt}, ${updatedAt}
        )
        ON CONFLICT (user_id, idempotency_key_hash) DO NOTHING
        RETURNING id
      `;

        if (inserted.length === 0) {
          const existing = await transaction.$queryRaw<
            Readonly<{ canonicalRequestHash: Uint8Array; orderId: string }>[]
          >`
          SELECT id AS "orderId", canonical_request_hash AS "canonicalRequestHash"
            FROM commerce_order
           WHERE user_id = ${order.userId}::uuid
             AND idempotency_key_hash = ${prepared.idempotencyKeyHash}
           FOR UPDATE
        `;
          const replay = existing[0];
          if (
            replay === undefined ||
            !bytesEqual(replay.canonicalRequestHash, prepared.canonicalRequestHash)
          ) {
            throw new CommercePersistenceError("COMMERCE_CONFLICT");
          }
          const replayed = await selectOrder(transaction, replay.orderId, order.userId);
          if (replayed === null) throw new CommercePersistenceError("COMMERCE_UNAVAILABLE");
          return Object.freeze({ kind: "replayed" as const, order: replayed });
        }

        await transaction.$executeRaw`
        INSERT INTO commerce_order_line (
          id, order_id, product_code, product_version, price_version,
          unit_amount_minor, quantity, total_minor, exact_contents_snapshot,
          entitlement_code
        ) VALUES (
          ${order.orderLineId}::uuid, ${order.orderId}::uuid, ${order.productCode},
          ${order.productVersion}, ${order.priceVersion}, ${amountMinor}, 1,
          ${amountMinor}, ${JSON.stringify(exactContents)}::jsonb, ${order.entitlementCode}
        )
      `;
        const created = await selectOrder(transaction, order.orderId, order.userId);
        if (created === null) throw new CommercePersistenceError("COMMERCE_UNAVAILABLE");
        return Object.freeze({ kind: "created" as const, order: created });
      },
      { isolationLevel: "Serializable" },
    );
  },

  async getOrder(userId: string, orderId: string): Promise<PersistedCommerceOrder | null> {
    requireUuid(userId);
    requireUuid(orderId);
    return selectOrder(database, orderId, userId);
  },

  async getOrderByCheckoutSession(
    userId: string,
    providerId: string,
    checkoutSessionId: string,
  ): Promise<PersistedCommerceOrder | null> {
    requireUuid(userId);
    requireIdentifier(providerId);
    requireResource(checkoutSessionId);
    const rows = await database.$queryRaw<Readonly<{ orderId: string }>[]>`
      SELECT attempt.order_id AS "orderId"
        FROM payment_attempt AS attempt
        JOIN commerce_order AS orders ON orders.id = attempt.order_id
       WHERE attempt.provider = ${providerId}
         AND attempt.provider_checkout_session_id = ${checkoutSessionId}
         AND orders.user_id = ${userId}::uuid
       LIMIT 1
    `;
    const row = rows[0];
    return row === undefined ? null : selectOrder(database, row.orderId, userId);
  },

  async listEntitlements(userId: string): Promise<readonly PersistedEntitlement[]> {
    requireUuid(userId);
    const rows = await database.$queryRaw<EntitlementRow[]>`
      SELECT id AS "entitlementId", user_id AS "userId", entitlement_code AS code,
             source_order_line_id AS "sourceOrderLineId", status AS state,
             granted_at AS "grantedAt", revoked_at AS "revokedAt", version
        FROM entitlement
       WHERE user_id = ${userId}::uuid
       ORDER BY granted_at DESC, id DESC
       LIMIT 200
    `;
    return Object.freeze(rows.map(mapEntitlement));
  },

  async processPaymentEvent(
    event: PreparedPaymentEvent,
    ids: Readonly<{ entitlementId: string; ledgerEntryId: string; paymentEventId: string }>,
    transition: (
      order: PersistedCommerceOrder,
      event: PreparedPaymentEvent,
    ) => CommerceTransitionResult,
  ): Promise<ProcessedPaymentEvent> {
    requireUuid(event.orderId);
    requireUuid(ids.entitlementId);
    requireUuid(ids.ledgerEntryId);
    requireUuid(ids.paymentEventId);
    requireIdentifier(event.providerId);
    requireResource(event.eventId);
    requireResource(event.objectId);
    requireResource(event.apiVersion);
    requireResource(event.providerAccountFingerprint);
    if (event.providerCheckoutSessionId !== null) {
      requireResource(event.providerCheckoutSessionId);
    }
    if (event.providerPaymentIntentId !== null) {
      requireResource(event.providerPaymentIntentId);
    }
    requireInstant(event.occurredAt);
    requireInstant(event.receivedAt);
    requireMinorAmount(event.amountMinor);
    if (!currencyPattern.test(event.currencyCode) || event.payloadDigest.byteLength !== 32) {
      throw new TypeError("Payment event is invalid.");
    }

    return database.$transaction(
      async (transaction) => {
        const order = await selectOrder(transaction, event.orderId, undefined, true);
        const attemptAssociation = await selectPaymentAttemptByProviderReferences(
          transaction,
          event,
        );
        const associatedOrder =
          order !== null && attemptAssociation.kind === "matched"
            ? attachExactPaymentAttempt(order, attemptAssociation.paymentAttempt)
            : null;
        const accepted = await transaction.$queryRaw<Readonly<{ id: string }>[]>`
        INSERT INTO payment_event (
          id, provider, provider_account_fingerprint, provider_event_id, event_type,
          object_id, api_version, payload_digest, provider_created_at, received_at,
          processed_at, processing_state, order_id, payment_attempt_id
        ) VALUES (
          ${ids.paymentEventId}::uuid, ${event.providerId}, ${event.providerAccountFingerprint},
          ${event.eventId}, ${event.eventType}, ${event.objectId}, ${event.apiVersion},
          ${event.payloadDigest}, ${requireInstant(event.occurredAt)},
          ${requireInstant(event.receivedAt)}, NULL, 'received',
          ${associatedOrder?.orderId ?? null}::uuid,
          ${associatedOrder?.paymentAttemptId ?? null}::uuid
        )
        ON CONFLICT (provider, provider_account_fingerprint, provider_event_id) DO NOTHING
        RETURNING id
      `;
        let paymentEventId = ids.paymentEventId;
        if (accepted.length === 0) {
          const existingEvents = await transaction.$queryRaw<
            Readonly<{
              id: string;
              payloadDigest: Uint8Array;
              processingState: string;
            }>[]
          >`
          SELECT id, payload_digest AS "payloadDigest", processing_state AS "processingState"
            FROM payment_event
           WHERE provider = ${event.providerId}
             AND provider_account_fingerprint = ${event.providerAccountFingerprint}
             AND provider_event_id = ${event.eventId}
           FOR UPDATE
        `;
          const existingEvent = existingEvents[0];
          if (existingEvents.length !== 1 || existingEvent === undefined) {
            throw new CommercePersistenceError("COMMERCE_UNAVAILABLE");
          }
          if (!bytesEqual(existingEvent.payloadDigest, event.payloadDigest)) {
            return Object.freeze({
              disposition: "rejected_mismatch" as const,
              entitlement: null,
              order: associatedOrder,
            });
          }
          if (existingEvent.processingState === "not_found" && associatedOrder !== null) {
            await transaction.$executeRaw`
            UPDATE payment_event
               SET order_id = ${associatedOrder.orderId}::uuid,
                   payment_attempt_id = ${associatedOrder.paymentAttemptId}::uuid,
                   processed_at = NULL,
                   processing_state = 'received'
             WHERE id = ${existingEvent.id}::uuid
          `;
            paymentEventId = existingEvent.id;
          } else {
            const duplicateOrder =
              associatedOrder === null
                ? null
                : await selectOrder(transaction, associatedOrder.orderId);
            const duplicateEntitlement =
              duplicateOrder === null
                ? null
                : await selectEntitlement(
                    transaction,
                    duplicateOrder.userId,
                    duplicateOrder.entitlementCode,
                  );
            return Object.freeze({
              disposition: "duplicate" as const,
              entitlement: duplicateEntitlement,
              order: duplicateOrder,
            });
          }
        }

        if (associatedOrder === null) {
          const disposition =
            attemptAssociation.kind === "mismatch" ? "rejected_mismatch" : "not_found";
          await transaction.$executeRaw`
          UPDATE payment_event
             SET processed_at = CURRENT_TIMESTAMP, processing_state = ${disposition}
           WHERE id = ${paymentEventId}::uuid
        `;
          return Object.freeze({
            disposition,
            entitlement: null,
            order: null,
          });
        }
        if (attemptAssociation.kind !== "matched") {
          throw new CommercePersistenceError("COMMERCE_UNAVAILABLE");
        }

        const result = transition(associatedOrder, event);
        const amountMatchesOrder =
          event.amountMinor === associatedOrder.amountMinor &&
          event.currencyCode === associatedOrder.currencyCode;
        const attemptNextState = nextPaymentAttemptState(
          requirePaymentAttemptState(attemptAssociation.paymentAttempt.state),
          event.eventType,
          amountMatchesOrder,
        );
        if (attemptNextState !== null) {
          await transaction.$executeRaw`
            UPDATE payment_attempt
               SET state = ${attemptNextState}, updated_at = CURRENT_TIMESTAMP
             WHERE id = ${associatedOrder.paymentAttemptId}::uuid
          `;
        }

        let ledgerKind =
          event.eventType === "payment_refunded"
            ? "refund"
            : event.eventType === "payment_disputed"
              ? "dispute"
              : event.eventType === "payment_succeeded" && attemptNextState === "paid"
                ? "charge"
                : null;
        let ledgerAmountMinor = event.amountMinor;
        if (ledgerKind === "refund") {
          const priorRefunds = await transaction.$queryRaw<
            Readonly<{ refundedMinor: bigint | number }>[]
          >`
            SELECT COALESCE(SUM(entry.amount_minor), 0) AS "refundedMinor"
              FROM ledger_entry AS entry
              JOIN payment_event AS recorded_event ON recorded_event.id = entry.payment_event_id
             WHERE entry.payment_attempt_id = ${associatedOrder.paymentAttemptId}::uuid
               AND entry.kind = 'refund'
               AND recorded_event.provider = ${event.providerId}
               AND recorded_event.object_id = ${event.objectId}
          `;
          if (priorRefunds.length !== 1) {
            throw new CommercePersistenceError("COMMERCE_UNAVAILABLE");
          }
          ledgerAmountMinor =
            event.amountMinor - requireMinorAmount(priorRefunds[0]?.refundedMinor ?? 0);
          if (ledgerAmountMinor <= 0) ledgerKind = null;
        }
        if (ledgerKind !== null) {
          await transaction.$executeRaw`
            INSERT INTO ledger_entry (
              id, order_id, payment_attempt_id, payment_event_id, kind,
              amount_minor, currency, reversal_of_id, created_at
            ) VALUES (
              ${ids.ledgerEntryId}::uuid, ${associatedOrder.orderId}::uuid,
              ${associatedOrder.paymentAttemptId}::uuid, ${paymentEventId}::uuid,
              ${ledgerKind}, ${ledgerAmountMinor}, ${event.currencyCode}, NULL,
              CURRENT_TIMESTAMP
            )
            ON CONFLICT DO NOTHING
          `;
        }

        let effectiveDisposition = result.disposition;
        let effectiveEntitlementDirective = result.entitlementDirective;
        let effectiveNextState = result.nextState;
        if (
          (attemptNextState === "paid" && associatedOrder.state !== "paid") ||
          (result.disposition === "applied" && result.entitlementDirective === "revoke")
        ) {
          const paidAttempts = await transaction.$queryRaw<Readonly<{ exists: boolean }>[]>`
            SELECT EXISTS (
              SELECT 1
                FROM payment_attempt
               WHERE order_id = ${associatedOrder.orderId}::uuid
                 AND state = 'paid'
            ) AS exists
          `;
          if (paidAttempts.length !== 1) {
            throw new CommercePersistenceError("COMMERCE_UNAVAILABLE");
          }
          if (paidAttempts[0]?.exists === true) {
            effectiveDisposition = "applied";
            effectiveEntitlementDirective = attemptNextState === "paid" ? "grant" : "none";
            effectiveNextState = "paid";
          }
        }

        let entitlement = await selectEntitlement(
          transaction,
          associatedOrder.userId,
          associatedOrder.entitlementCode,
        );
        if (effectiveDisposition === "applied") {
          await transaction.$executeRaw`
          UPDATE commerce_order
             SET status = ${effectiveNextState},
                 refunded_minor = CASE WHEN ${effectiveNextState} = 'refunded' THEN total_minor ELSE refunded_minor END,
                 updated_at = GREATEST(updated_at, ${requireInstant(event.occurredAt)})
           WHERE id = ${associatedOrder.orderId}::uuid
        `;

          if (effectiveEntitlementDirective === "grant" && entitlement === null) {
            await transaction.$executeRaw`
            INSERT INTO entitlement (
              id, user_id, entitlement_code, source_order_line_id, status,
              granted_at, revoked_at, version
            ) VALUES (
              ${ids.entitlementId}::uuid, ${associatedOrder.userId}::uuid,
              ${associatedOrder.entitlementCode}, ${associatedOrder.orderLineId}::uuid,
              'active', CURRENT_TIMESTAMP, NULL, 1
            ) ON CONFLICT DO NOTHING
          `;
          } else if (
            effectiveEntitlementDirective === "grant" &&
            entitlement?.state === "revoked"
          ) {
            await transaction.$executeRaw`
              UPDATE entitlement
                 SET source_order_line_id = ${associatedOrder.orderLineId}::uuid,
                     status = 'active', granted_at = CURRENT_TIMESTAMP,
                     revoked_at = NULL, version = version + 1
               WHERE id = ${entitlement.entitlementId}::uuid
                 AND status = 'revoked'
            `;
          } else if (
            effectiveEntitlementDirective === "revoke" &&
            entitlement?.state === "active" &&
            entitlement.sourceOrderLineId === associatedOrder.orderLineId
          ) {
            await transaction.$executeRaw`
            UPDATE entitlement
               SET status = 'revoked', revoked_at = CURRENT_TIMESTAMP, version = version + 1
             WHERE id = ${entitlement.entitlementId}::uuid AND status = 'active'
          `;
          }
          entitlement = await selectEntitlement(
            transaction,
            associatedOrder.userId,
            associatedOrder.entitlementCode,
          );
        }

        await transaction.$executeRaw`
        UPDATE payment_event
           SET processed_at = CURRENT_TIMESTAMP, processing_state = ${effectiveDisposition}
         WHERE id = ${paymentEventId}::uuid
      `;
        const updatedOrder = await selectOrder(transaction, associatedOrder.orderId);
        return Object.freeze({
          disposition: effectiveDisposition,
          entitlement,
          order: updatedOrder,
        });
      },
      { isolationLevel: "Serializable" },
    );
  },
});
