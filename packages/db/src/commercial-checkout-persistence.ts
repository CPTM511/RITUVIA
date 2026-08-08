import { Prisma, type PrismaClient } from "./generated/prisma/client.js";

const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const identifierPattern = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u;
const resourcePattern = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/u;
const checkoutResourcePattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,254}$/u;
const countryPattern = /^[A-Z]{2}$/u;
const currencyPattern = /^[A-Z]{3}$/u;
const maximumMinorAmount = 2_147_483_647;
type CommercialHostedCheckoutProvider = "coinbase_usdc_base" | "stripe";
type CheckoutProfile = Readonly<{
  apiIdempotencyKeyVersion: string;
  expectedAsset: "USDC" | null;
  expectedNetwork: "base" | null;
  provider: CommercialHostedCheckoutProvider;
  providerIdempotencyKeyVersion: string;
  recoveryScope: "D-098:OWNER:item-11:protected-staging" | null;
}>;

const stripeCheckoutProfile: CheckoutProfile = Object.freeze({
  apiIdempotencyKeyVersion: "stripe.checkout.api.v1",
  expectedAsset: null,
  expectedNetwork: null,
  provider: "stripe",
  providerIdempotencyKeyVersion: "stripe.checkout.provider.v1",
  recoveryScope: null,
});
const coinbaseCheckoutProfile: CheckoutProfile = Object.freeze({
  apiIdempotencyKeyVersion: "coinbase.checkout.api.v1",
  expectedAsset: "USDC",
  expectedNetwork: "base",
  provider: "coinbase_usdc_base",
  providerIdempotencyKeyVersion: "coinbase.checkout.provider.v1",
  recoveryScope: "D-098:OWNER:item-11:protected-staging",
});

export const commercialCheckoutPersistenceErrorCodes = Object.freeze([
  "COMMERCIAL_CHECKOUT_CONFLICT",
  "COMMERCIAL_CHECKOUT_NOT_FOUND",
  "COMMERCIAL_CHECKOUT_UNAVAILABLE",
] as const);
export type CommercialCheckoutPersistenceErrorCode =
  (typeof commercialCheckoutPersistenceErrorCodes)[number];

export class CommercialCheckoutPersistenceError extends Error {
  readonly code: CommercialCheckoutPersistenceErrorCode;

  constructor(code: CommercialCheckoutPersistenceErrorCode) {
    super("The commercial checkout record could not be completed.");
    this.name = "CommercialCheckoutPersistenceError";
    this.code = code;
  }
}

export type PreparedCommercialStripeCheckout = Readonly<{
  amountMinor: number;
  billingInterval: "month" | "one_time" | "year";
  canonicalRequestHash: Uint8Array;
  catalogVersion: string;
  countryCode: string;
  countryPolicyVersion: string;
  createdAt: string;
  creditsGranted: number | null;
  creditsPerMonth: number | null;
  currencyCode: string;
  exactContents: readonly string[];
  fulfillmentCode: string;
  fulfillmentKind: "credit_pack" | "subscription";
  idempotencyKeyHash: Uint8Array;
  priceId: string;
  priceVersion: string;
  productCode: string;
  productVersion: string;
  providerAccountFingerprint: string;
  provisionalExpiresAt: string;
  refundPolicyVersion: string;
  termsVersion: string;
  userId: string;
}>;

export type PreparedCommercialCoinbaseCheckout = PreparedCommercialStripeCheckout &
  Readonly<{ recoveryScope: "D-098:OWNER:item-11:protected-staging" }>;

export type PersistedCommercialStripeCheckout = Readonly<{
  amountMinor: number;
  checkoutExpiresAt: string;
  checkoutId: string | null;
  checkoutUrl: string | null;
  countryCode: string;
  currencyCode: string;
  orderId: string;
  productCode: string;
  providerIdempotencyKey: string;
  state: "checkout_created" | "created";
}>;

export type PreparedCommercialCheckoutAttachment = Readonly<{
  attachedAt: string;
  checkoutExpiresAt: string;
  checkoutId: string;
  checkoutUrl: string;
  orderId: string;
  userId: string;
}>;

export type PreparedCommercialCoinbaseCheckoutAttachment = PreparedCommercialCheckoutAttachment &
  Readonly<{ recoveryScope: "D-098:OWNER:item-11:protected-staging" }>;

export type CommercialCheckoutPersistence = Readonly<{
  attachCoinbaseCheckout(
    input: PreparedCommercialCoinbaseCheckoutAttachment,
  ): Promise<PersistedCommercialStripeCheckout>;
  attachStripeCheckout(
    input: PreparedCommercialCheckoutAttachment,
  ): Promise<PersistedCommercialStripeCheckout>;
  createOrReplayStripeCheckout(input: PreparedCommercialStripeCheckout): Promise<
    Readonly<{
      checkout: PersistedCommercialStripeCheckout;
      kind: "created" | "replayed";
    }>
  >;
  createOrReplayCoinbaseCheckout(input: PreparedCommercialCoinbaseCheckout): Promise<
    Readonly<{
      checkout: PersistedCommercialStripeCheckout;
      kind: "created" | "replayed";
    }>
  >;
}>;

type CheckoutRecord = Readonly<{
  attempt: Readonly<{
    amountMinor: number;
    canonicalRequestHash: Uint8Array;
    currencyCode: string;
    expiresAt: Date;
    idempotencyKeyHash: Uint8Array;
    idempotencyKeyVersion: string;
    expectedAsset: string | null;
    expectedNetwork: string | null;
    provider: string;
    providerAccountFingerprint: string | null;
    providerCheckoutId: string | null;
    providerCheckoutUrl: string | null;
    state: string;
  }>;
  item: Readonly<{
    productCode: string;
  }>;
  order: Readonly<{
    canonicalRequestHash: Uint8Array;
    countryCode: string;
    countryPolicyVersion: string;
    currencyCode: string;
    id: string;
    publicId: string;
    status: string;
    totalMinor: number;
    userId: string;
  }>;
}>;

const requireUuid = (value: string): string => {
  if (!uuidV4Pattern.test(value)) throw new TypeError("Commercial checkout identifier is invalid.");
  return value;
};

const requireIdentifier = (value: string): string => {
  if (!identifierPattern.test(value)) {
    throw new TypeError("Commercial checkout identifier is invalid.");
  }
  return value;
};

const requireResource = (value: string): string => {
  if (!resourcePattern.test(value)) {
    throw new TypeError("Commercial checkout reference is invalid.");
  }
  return value;
};

const requireInstant = (value: string): Date => {
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== value) {
    throw new TypeError("Commercial checkout instant is invalid.");
  }
  return new Date(milliseconds);
};

const requireDigest = (value: Uint8Array): Uint8Array<ArrayBuffer> => {
  if (value.byteLength !== 32) throw new TypeError("Commercial checkout digest is invalid.");
  return new Uint8Array(value);
};

const digestsEqual = (left: Uint8Array, right: Uint8Array): boolean => {
  if (left.byteLength !== right.byteLength) return false;
  let difference = 0;
  for (let index = 0; index < left.byteLength; index += 1) {
    difference |= (left.at(index) ?? 0) ^ (right.at(index) ?? 0);
  }
  return difference === 0;
};

const sha256 = async (value: string): Promise<Uint8Array<ArrayBuffer>> =>
  new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  ) as Uint8Array<ArrayBuffer>;

const providerIdempotencyKey = (profile: CheckoutProfile, orderId: string): string =>
  profile.provider === "stripe" ? `stripe:${orderId}:1` : orderId;

const requireMoney = (amountMinor: number, currencyCode: string): void => {
  if (
    !Number.isSafeInteger(amountMinor) ||
    amountMinor < 1 ||
    amountMinor > maximumMinorAmount ||
    !currencyPattern.test(currencyCode)
  ) {
    throw new TypeError("Commercial checkout money is invalid.");
  }
};

const requireContents = (value: readonly string[]): readonly string[] => {
  if (
    value.length < 1 ||
    value.length > 32 ||
    value.some(
      (entry) =>
        typeof entry !== "string" ||
        entry.trim() !== entry ||
        entry.length < 1 ||
        entry.length > 500,
    )
  ) {
    throw new TypeError("Commercial checkout contents are invalid.");
  }
  return Object.freeze([...value]);
};

const requireHttpsCheckoutUrl = (value: string): string => {
  try {
    const parsed = new URL(value);
    if (
      parsed.protocol !== "https:" ||
      parsed.username !== "" ||
      parsed.password !== "" ||
      parsed.hostname === ""
    ) {
      throw new TypeError();
    }
    return parsed.toString();
  } catch {
    throw new TypeError("Commercial checkout URL is invalid.");
  }
};

const requireCheckoutId = (value: string): string => {
  if (!checkoutResourcePattern.test(value)) {
    throw new TypeError("Commercial checkout provider reference is invalid.");
  }
  return value;
};

const readCheckoutRecord = async (
  database: Prisma.TransactionClient | PrismaClient,
  profile: CheckoutProfile,
  input:
    | Readonly<{ idempotencyKeyHash: Uint8Array<ArrayBuffer>; userId: string }>
    | Readonly<{ orderId: string; userId: string }>,
): Promise<CheckoutRecord | null> => {
  const order =
    "orderId" in input
      ? await database.commercialOrderV2.findFirst({
          where: { publicId: input.orderId, userId: input.userId },
        })
      : await database.commercialOrderV2.findFirst({
          where: {
            idempotencyKeyHash: input.idempotencyKeyHash,
            idempotencyKeyVersion: profile.apiIdempotencyKeyVersion,
            userId: input.userId,
          },
        });
  if (order === null) return null;
  const [item, attempt] = await Promise.all([
    database.commercialOrderItemV2.findUnique({ where: { orderId: order.id } }),
    database.commercialPaymentAttemptV2.findUnique({
      where: {
        orderId_attemptNumber: {
          attemptNumber: 1,
          orderId: order.id,
        },
      },
    }),
  ]);
  if (item === null || attempt === null) {
    throw new CommercialCheckoutPersistenceError("COMMERCIAL_CHECKOUT_UNAVAILABLE");
  }
  return Object.freeze({ attempt, item, order });
};

const mapCheckout = async (
  record: CheckoutRecord,
  profile: CheckoutProfile,
): Promise<PersistedCommercialStripeCheckout> => {
  if (
    record.order.userId.length === 0 ||
    record.order.totalMinor !== record.attempt.amountMinor ||
    record.order.currencyCode !== record.attempt.currencyCode ||
    record.attempt.provider !== profile.provider ||
    record.attempt.providerAccountFingerprint === null ||
    record.attempt.idempotencyKeyVersion !== profile.providerIdempotencyKeyVersion ||
    record.attempt.expectedNetwork !== profile.expectedNetwork ||
    record.attempt.expectedAsset !== profile.expectedAsset ||
    (profile.provider === "coinbase_usdc_base" &&
      !record.order.countryPolicyVersion.startsWith("staging.us.coinbase-sandbox.item11.")) ||
    !["created", "checkout_created"].includes(record.order.status) ||
    record.order.status !== record.attempt.state
  ) {
    throw new CommercialCheckoutPersistenceError("COMMERCIAL_CHECKOUT_UNAVAILABLE");
  }
  const expectedProviderKey = providerIdempotencyKey(profile, record.order.publicId);
  if (
    !digestsEqual(record.attempt.idempotencyKeyHash, await sha256(expectedProviderKey)) ||
    !digestsEqual(record.attempt.canonicalRequestHash, record.order.canonicalRequestHash)
  ) {
    throw new CommercialCheckoutPersistenceError("COMMERCIAL_CHECKOUT_UNAVAILABLE");
  }
  const checkoutAttached =
    record.attempt.providerCheckoutId !== null && record.attempt.providerCheckoutUrl !== null;
  if (
    (record.order.status === "checkout_created") !== checkoutAttached ||
    (record.attempt.providerCheckoutId === null) !== (record.attempt.providerCheckoutUrl === null)
  ) {
    throw new CommercialCheckoutPersistenceError("COMMERCIAL_CHECKOUT_UNAVAILABLE");
  }
  return Object.freeze({
    amountMinor: record.order.totalMinor,
    checkoutExpiresAt: record.attempt.expiresAt.toISOString(),
    checkoutId: record.attempt.providerCheckoutId,
    checkoutUrl: record.attempt.providerCheckoutUrl,
    countryCode: record.order.countryCode,
    currencyCode: record.order.currencyCode,
    orderId: record.order.publicId,
    productCode: record.item.productCode,
    providerIdempotencyKey: expectedProviderKey,
    state: record.order.status as PersistedCommercialStripeCheckout["state"],
  });
};

const isRetryableCreationConflict = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  (error.code === "P2002" || error.code === "P2034");

export const createCommercialCheckoutPersistence = (
  database: PrismaClient,
): CommercialCheckoutPersistence => {
  const createOrReplayCheckout = async (
    input: PreparedCommercialStripeCheckout | PreparedCommercialCoinbaseCheckout,
    profile: CheckoutProfile,
  ) => {
    if (
      profile.provider === "coinbase_usdc_base" &&
      (profile.recoveryScope === null ||
        !("recoveryScope" in input) ||
        input.recoveryScope !== profile.recoveryScope ||
        !input.countryPolicyVersion.startsWith("staging.us.coinbase-sandbox.item11.") ||
        input.fulfillmentKind !== "credit_pack" ||
        input.billingInterval !== "one_time")
    ) {
      throw new TypeError("Commercial checkout recovery scope is invalid.");
    }
    requireUuid(input.userId);
    requireMoney(input.amountMinor, input.currencyCode);
    if (!countryPattern.test(input.countryCode)) {
      throw new TypeError("Commercial checkout country is invalid.");
    }
    const canonicalRequestHash = requireDigest(input.canonicalRequestHash);
    const idempotencyKeyHash = requireDigest(input.idempotencyKeyHash);
    const createdAt = requireInstant(input.createdAt);
    const provisionalExpiresAt = requireInstant(input.provisionalExpiresAt);
    if (provisionalExpiresAt.getTime() <= createdAt.getTime()) {
      throw new TypeError("Commercial checkout expiry is invalid.");
    }
    const exactContents = requireContents(input.exactContents);
    const validCreditPack =
      input.fulfillmentKind === "credit_pack" &&
      input.billingInterval === "one_time" &&
      Number.isSafeInteger(input.creditsGranted) &&
      (input.creditsGranted ?? 0) > 0 &&
      input.creditsPerMonth === null;
    const validSubscription =
      input.fulfillmentKind === "subscription" &&
      ["month", "year"].includes(input.billingInterval) &&
      input.creditsGranted === null &&
      Number.isSafeInteger(input.creditsPerMonth) &&
      (input.creditsPerMonth ?? 0) > 0;
    if (!validCreditPack && !validSubscription) {
      throw new TypeError("Commercial checkout fulfillment is invalid.");
    }
    for (const reference of [
      input.catalogVersion,
      input.countryPolicyVersion,
      input.priceId,
      input.priceVersion,
      input.productVersion,
      input.refundPolicyVersion,
      input.termsVersion,
    ]) {
      requireResource(reference);
    }
    requireResource(input.providerAccountFingerprint);
    requireIdentifier(input.productCode);
    requireIdentifier(input.fulfillmentCode);

    const existing = await readCheckoutRecord(database, profile, {
      idempotencyKeyHash,
      userId: input.userId,
    });
    if (existing !== null) {
      if (
        !digestsEqual(existing.order.canonicalRequestHash, canonicalRequestHash) ||
        existing.attempt.providerAccountFingerprint !== input.providerAccountFingerprint
      ) {
        throw new CommercialCheckoutPersistenceError("COMMERCIAL_CHECKOUT_CONFLICT");
      }
      return Object.freeze({
        checkout: await mapCheckout(existing, profile),
        kind: "replayed" as const,
      });
    }

    try {
      const created = await database.$transaction(
        async (transaction) => {
          const order = await transaction.commercialOrderV2.create({
            data: {
              canonicalRequestHash,
              catalogVersion: input.catalogVersion,
              countryCode: input.countryCode,
              countryPolicyVersion: input.countryPolicyVersion,
              createdAt,
              currencyCode: input.currencyCode,
              idempotencyKeyHash,
              idempotencyKeyVersion: profile.apiIdempotencyKeyVersion,
              priceId: input.priceId,
              priceVersion: input.priceVersion,
              refundPolicyVersion: input.refundPolicyVersion,
              status: "created",
              subtotalMinor: input.amountMinor,
              taxMinor: 0,
              termsVersion: input.termsVersion,
              totalMinor: input.amountMinor,
              updatedAt: createdAt,
              userId: input.userId,
            },
          });
          const providerKey = providerIdempotencyKey(profile, order.publicId);
          const [item, attempt] = await Promise.all([
            transaction.commercialOrderItemV2.create({
              data: {
                catalogVersion: input.catalogVersion,
                creditsGranted: input.creditsGranted,
                creditsPerMonth: input.creditsPerMonth,
                exactContentsSnapshot: [...exactContents],
                fulfillmentCode: input.fulfillmentCode,
                fulfillmentKind: input.fulfillmentKind,
                orderId: order.id,
                productCode: input.productCode,
                productVersion: input.productVersion,
                quantity: 1,
                totalMinor: input.amountMinor,
                unitAmountMinor: input.amountMinor,
              },
            }),
            transaction.commercialPaymentAttemptV2.create({
              data: {
                amountMinor: input.amountMinor,
                attemptNumber: 1,
                canonicalRequestHash,
                createdAt,
                currencyCode: input.currencyCode,
                environment: "sandbox",
                expiresAt: provisionalExpiresAt,
                idempotencyKeyHash: await sha256(providerKey),
                expectedAsset: profile.expectedAsset,
                expectedNetwork: profile.expectedNetwork,
                idempotencyKeyVersion: profile.providerIdempotencyKeyVersion,
                orderId: order.id,
                provider: profile.provider,
                providerAccountFingerprint: input.providerAccountFingerprint,
                state: "created",
                updatedAt: createdAt,
              },
            }),
          ]);
          return Object.freeze({ attempt, item, order });
        },
        { isolationLevel: "Serializable" },
      );
      return Object.freeze({
        checkout: await mapCheckout(created, profile),
        kind: "created" as const,
      });
    } catch (error) {
      if (!isRetryableCreationConflict(error)) throw error;
      const winner = await readCheckoutRecord(database, profile, {
        idempotencyKeyHash,
        userId: input.userId,
      });
      if (winner === null) {
        throw new CommercialCheckoutPersistenceError("COMMERCIAL_CHECKOUT_UNAVAILABLE");
      }
      if (!digestsEqual(winner.order.canonicalRequestHash, canonicalRequestHash)) {
        throw new CommercialCheckoutPersistenceError("COMMERCIAL_CHECKOUT_CONFLICT");
      }
      return Object.freeze({
        checkout: await mapCheckout(winner, profile),
        kind: "replayed" as const,
      });
    }
  };

  const attachCheckout = async (
    input: PreparedCommercialCheckoutAttachment | PreparedCommercialCoinbaseCheckoutAttachment,
    profile: CheckoutProfile,
  ) => {
    if (
      profile.provider === "coinbase_usdc_base" &&
      (profile.recoveryScope === null ||
        !("recoveryScope" in input) ||
        input.recoveryScope !== profile.recoveryScope)
    ) {
      throw new TypeError("Commercial checkout recovery scope is invalid.");
    }
    requireUuid(input.userId);
    requireUuid(input.orderId);
    const attachedAt = requireInstant(input.attachedAt);
    const checkoutExpiresAt = requireInstant(input.checkoutExpiresAt);
    if (checkoutExpiresAt.getTime() <= attachedAt.getTime()) {
      throw new TypeError("Commercial checkout expiry is invalid.");
    }
    const checkoutId = requireCheckoutId(input.checkoutId);
    const checkoutUrl = requireHttpsCheckoutUrl(input.checkoutUrl);

    return database.$transaction(
      async (transaction) => {
        const current = await readCheckoutRecord(transaction, profile, {
          orderId: input.orderId,
          userId: input.userId,
        });
        if (current === null) {
          throw new CommercialCheckoutPersistenceError("COMMERCIAL_CHECKOUT_NOT_FOUND");
        }
        if (current.order.status === "checkout_created") {
          if (
            current.attempt.providerCheckoutId === checkoutId &&
            current.attempt.providerCheckoutUrl === checkoutUrl &&
            current.attempt.expiresAt.getTime() === checkoutExpiresAt.getTime()
          ) {
            return mapCheckout(current, profile);
          }
          throw new CommercialCheckoutPersistenceError("COMMERCIAL_CHECKOUT_CONFLICT");
        }
        if (
          current.order.status !== "created" ||
          current.attempt.state !== "created" ||
          current.attempt.providerCheckoutId !== null ||
          current.attempt.providerCheckoutUrl !== null
        ) {
          throw new CommercialCheckoutPersistenceError("COMMERCIAL_CHECKOUT_CONFLICT");
        }
        const attemptUpdate = await transaction.commercialPaymentAttemptV2.updateMany({
          data: {
            expiresAt: checkoutExpiresAt,
            providerCheckoutId: checkoutId,
            providerCheckoutUrl: checkoutUrl,
            state: "checkout_created",
            updatedAt: attachedAt,
          },
          where: {
            attemptNumber: 1,
            orderId: current.order.id,
            providerCheckoutId: null,
            providerCheckoutUrl: null,
            state: "created",
          },
        });
        const orderUpdate = await transaction.commercialOrderV2.updateMany({
          data: { status: "checkout_created", updatedAt: attachedAt },
          where: { id: current.order.id, status: "created" },
        });
        if (attemptUpdate.count !== 1 || orderUpdate.count !== 1) {
          throw new CommercialCheckoutPersistenceError("COMMERCIAL_CHECKOUT_CONFLICT");
        }
        const attached = await readCheckoutRecord(transaction, profile, {
          orderId: input.orderId,
          userId: input.userId,
        });
        if (attached === null) {
          throw new CommercialCheckoutPersistenceError("COMMERCIAL_CHECKOUT_UNAVAILABLE");
        }
        return mapCheckout(attached, profile);
      },
      { isolationLevel: "Serializable" },
    );
  };

  return Object.freeze({
    attachCoinbaseCheckout: (input) => attachCheckout(input, coinbaseCheckoutProfile),
    attachStripeCheckout: (input) => attachCheckout(input, stripeCheckoutProfile),
    createOrReplayCoinbaseCheckout: (input) =>
      createOrReplayCheckout(input, coinbaseCheckoutProfile),
    createOrReplayStripeCheckout: (input) => createOrReplayCheckout(input, stripeCheckoutProfile),
  });
};
