import "server-only";

import { createHash } from "node:crypto";

import {
  CommercialCheckoutPersistenceError,
  createCommercialCheckoutPersistence,
  readCountryPolicyVersions,
  type CommercialCheckoutPersistence,
} from "@rituvia/db";
import {
  evaluateCountryPolicyVersion,
  parseCountryPolicyVersionV1,
  type CountryPolicyVersionV1,
} from "@rituvia/country-policy";
import {
  CommerceError,
  createMoney,
  type CatalogVersionV1,
  type HostedCryptoCheckoutAdapter,
} from "@rituvia/payments";
import {
  coinbaseBusinessProviderId,
  createCoinbaseBusinessHostedCheckoutAdapter,
} from "@rituvia/payments/adapters/coinbase-business";

import { getWebRuntimeConfiguration } from "../config/server";
import { loadWebAccountIdentityService } from "./account-auth";
import {
  createRecoveryItem11CoinbaseBusinessGateway,
  mapCoinbaseBusinessReconciliationResult,
  mapCoinbaseBusinessVerifiedWebhookEvent,
} from "./coinbase-business-gateway";
import { WebCommerceError } from "./commerce";
import { loadWebDatabase } from "./database";
import { loadWebProductCatalogApplicationService } from "./product-catalog";

const recoveryScope = "D-098:OWNER:item-11:protected-staging" as const;
const idempotencyKeyPattern =
  /^(?:[A-Za-z0-9_-]{22,128}|[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/u;
const boundedPathPattern = /^\/(?!\/)[A-Za-z0-9._~!$&'()*+,;=:@%/-]{0,299}$/u;
const checkoutRequestSchemaVersion = "coinbase-sandbox-checkout-request.v1";
const sandboxCountryCode = "US";
const sandboxCurrencyCode = "USD";

type AccountGateway = Readonly<{
  getProfile(token: string): Promise<
    Readonly<{
      ageAttested: boolean;
      emailVerified: boolean;
      id: string;
      status: "active";
    }>
  >;
  resolveSession(token: string): Promise<Readonly<{ userId: string }> | null>;
}>;

export type CoinbaseCheckoutApplicationDependencies = Readonly<{
  accounts: AccountGateway;
  canonicalOrigin: string;
  catalog: Readonly<{ readActive(): Promise<CatalogVersionV1> }>;
  clock(): string;
  countryPolicies: Readonly<{
    read(countryCode: string, environment: "staging"): Promise<readonly CountryPolicyVersionV1[]>;
  }>;
  environment: "staging";
  paymentProvider: HostedCryptoCheckoutAdapter;
  persistence: Pick<
    CommercialCheckoutPersistence,
    "attachCoinbaseCheckout" | "createOrReplayCoinbaseCheckout"
  >;
  providerAccountFingerprint: string;
  recoveryScope: typeof recoveryScope;
}>;

export type WebCoinbaseCheckout = Readonly<{
  checkoutUrl: string;
  expiresAt: string;
  kind: "created" | "replayed";
  networkCode: "base";
  orderId: string;
  productCode: "pack_6";
  settlementAsset: "USDC";
  state: "checkout_created";
  usdAmountMinor: number;
}>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parseRequest = (
  value: unknown,
): Readonly<{ cancelPath: string; productCode: "pack_6"; successPath: string }> => {
  if (
    !isRecord(value) ||
    Object.keys(value).sort().join("\0") !==
      ["cancelPath", "productCode", "successPath"].sort().join("\0") ||
    typeof value.cancelPath !== "string" ||
    !boundedPathPattern.test(value.cancelPath) ||
    value.productCode !== "pack_6" ||
    typeof value.successPath !== "string" ||
    !boundedPathPattern.test(value.successPath)
  ) {
    throw new WebCommerceError("input_invalid");
  }
  return Object.freeze({
    cancelPath: value.cancelPath,
    productCode: "pack_6" as const,
    successPath: value.successPath,
  });
};

const parseIdempotencyKey = (value: unknown): string => {
  if (typeof value !== "string" || !idempotencyKeyPattern.test(value)) {
    throw new WebCommerceError("input_invalid");
  }
  return value;
};

const sha256 = (value: string): Uint8Array<ArrayBuffer> =>
  new Uint8Array(createHash("sha256").update(value, "utf8").digest());

const canonicalRequest = (
  request: Readonly<{ cancelPath: string; productCode: "pack_6"; successPath: string }>,
): string =>
  JSON.stringify({
    cancelPath: request.cancelPath,
    productCode: request.productCode,
    recoveryScope,
    schemaVersion: checkoutRequestSchemaVersion,
    successPath: request.successPath,
  });

const requireInstant = (value: string): string => {
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== value) {
    throw new WebCommerceError("unavailable");
  }
  return value;
};

const sandboxReturnUrl = (origin: string, path: string, orderId?: string): string => {
  try {
    const canonicalOrigin = new URL(origin);
    if (
      canonicalOrigin.protocol !== "https:" ||
      canonicalOrigin.pathname !== "/" ||
      canonicalOrigin.search !== "" ||
      canonicalOrigin.hash !== "" ||
      canonicalOrigin.username !== "" ||
      canonicalOrigin.password !== ""
    ) {
      throw new Error();
    }
    const result = new URL(path, canonicalOrigin);
    if (result.origin !== canonicalOrigin.origin || result.hash !== "") throw new Error();
    if (orderId !== undefined) result.searchParams.set("order_id", orderId);
    return result.toString();
  } catch {
    throw new WebCommerceError("unavailable");
  }
};

const mapError = (error: unknown): never => {
  if (error instanceof WebCommerceError) throw error;
  if (error instanceof CommercialCheckoutPersistenceError) {
    throw new WebCommerceError(
      error.code === "COMMERCIAL_CHECKOUT_CONFLICT" ? "conflict" : "unavailable",
    );
  }
  if (error instanceof CommerceError || error instanceof TypeError) {
    throw new WebCommerceError("unavailable");
  }
  throw new WebCommerceError("unavailable");
};

export const createCoinbaseCheckoutApplicationService = (
  dependencies: CoinbaseCheckoutApplicationDependencies,
) => {
  if (
    dependencies.environment !== "staging" ||
    dependencies.recoveryScope !== recoveryScope ||
    dependencies.paymentProvider.providerId !== coinbaseBusinessProviderId
  ) {
    throw new WebCommerceError("unavailable");
  }
  return Object.freeze({
    async createCheckout(input: {
      idempotencyKey: unknown;
      request: unknown;
      sessionToken: string | undefined;
    }): Promise<WebCoinbaseCheckout> {
      try {
        if (input.sessionToken === undefined) throw new WebCommerceError("session_required");
        const request = parseRequest(input.request);
        const idempotencyKey = parseIdempotencyKey(input.idempotencyKey);
        const now = requireInstant(dependencies.clock());
        const session = await dependencies.accounts.resolveSession(input.sessionToken);
        if (session === null) throw new WebCommerceError("session_required");
        const profile = await dependencies.accounts.getProfile(input.sessionToken);
        if (
          session.userId !== profile.id ||
          profile.status !== "active" ||
          !profile.emailVerified ||
          !profile.ageAttested
        ) {
          throw new WebCommerceError("not_eligible");
        }
        const [catalog, policyVersions] = await Promise.all([
          dependencies.catalog.readActive(),
          dependencies.countryPolicies.read(sandboxCountryCode, "staging"),
        ]);
        if (!catalog.version.startsWith("recovery.item11.")) {
          throw new WebCommerceError("not_eligible");
        }
        const product = catalog.products.find(
          (candidate) =>
            candidate.code === "pack_6" &&
            candidate.status === "active" &&
            candidate.kind === "credit_pack" &&
            candidate.subscriptionInterval === null &&
            candidate.creditsGranted === 6 &&
            candidate.creditsPerMonth === null,
        );
        const price = catalog.prices.find(
          (candidate) =>
            product !== undefined &&
            candidate.status === "active" &&
            candidate.productCode === product.code &&
            candidate.productVersion === product.version &&
            candidate.billingInterval === "one_time" &&
            candidate.currencyCode === sandboxCurrencyCode &&
            candidate.countryCodes.includes(sandboxCountryCode) &&
            candidate.providerEligibility.includes(coinbaseBusinessProviderId) &&
            Date.parse(candidate.effectiveFrom) <= Date.parse(now) &&
            (candidate.effectiveUntil === null ||
              Date.parse(now) < Date.parse(candidate.effectiveUntil)),
        );
        const localization = product?.localizations.find(({ locale }) => locale === "en");
        if (product === undefined || price === undefined || localization === undefined) {
          throw new WebCommerceError("not_eligible");
        }

        const policyDecision = evaluateCountryPolicyVersion(
          {
            ageAttested: true,
            asOf: now,
            countryEvidence: {
              billingCountryCode: null,
              declaredCountryCode: sandboxCountryCode,
              geolocationConfidence: "none",
              geolocationCountryCode: null,
              localeCountryCode: null,
            },
            environment: "staging",
            modality: "ritual",
            payment: {
              currencyCode: "USDC",
              kind: "crypto",
              method: null,
              providerId: coinbaseBusinessProviderId,
              recurring: false,
            },
            productCode: product.code,
          },
          policyVersions,
        );
        if (!policyDecision.allowed || policyDecision.snapshot === null) {
          throw new WebCommerceError("not_eligible");
        }
        const policy = policyVersions.find(
          ({ version }) => version === policyDecision.snapshot.policyVersion,
        );
        const terms = policyDecision.snapshot.legalDocumentVersions.filter(
          ({ documentCode }) => documentCode === "terms",
        );
        const termsDocument = terms.at(0);
        if (
          policy === undefined ||
          !policy.version.startsWith("staging.us.coinbase-sandbox.item11.") ||
          policy.refundPolicyVersion !== price.refundPolicyVersion ||
          terms.length !== 1 ||
          termsDocument === undefined
        ) {
          throw new WebCommerceError("not_eligible");
        }

        const prepared = await dependencies.persistence.createOrReplayCoinbaseCheckout({
          amountMinor: price.amountMinor,
          billingInterval: "one_time",
          canonicalRequestHash: sha256(canonicalRequest(request)),
          catalogVersion: catalog.version,
          countryCode: sandboxCountryCode,
          countryPolicyVersion: policy.version,
          createdAt: now,
          creditsGranted: 6,
          creditsPerMonth: null,
          currencyCode: sandboxCurrencyCode,
          exactContents: localization.exactContents,
          fulfillmentCode: product.fulfillmentCode,
          fulfillmentKind: "credit_pack",
          idempotencyKeyHash: sha256(idempotencyKey),
          priceId: price.priceId,
          priceVersion: price.version,
          productCode: product.code,
          productVersion: product.version,
          providerAccountFingerprint: dependencies.providerAccountFingerprint,
          provisionalExpiresAt: new Date(Date.parse(now) + 30 * 60 * 1_000).toISOString(),
          recoveryScope,
          refundPolicyVersion: price.refundPolicyVersion,
          termsVersion: termsDocument.version,
          userId: session.userId,
        });
        if (
          prepared.checkout.state === "checkout_created" &&
          prepared.checkout.checkoutUrl !== null
        ) {
          if (Date.parse(prepared.checkout.checkoutExpiresAt) <= Date.parse(now)) {
            throw new WebCommerceError("conflict");
          }
          return Object.freeze({
            checkoutUrl: prepared.checkout.checkoutUrl,
            expiresAt: prepared.checkout.checkoutExpiresAt,
            kind: "replayed" as const,
            networkCode: "base" as const,
            orderId: prepared.checkout.orderId,
            productCode: "pack_6" as const,
            settlementAsset: "USDC" as const,
            state: "checkout_created" as const,
            usdAmountMinor: prepared.checkout.amountMinor,
          });
        }

        const checkout = await dependencies.paymentProvider.createCheckout({
          accountId: session.userId,
          amount: createMoney(prepared.checkout.amountMinor, sandboxCurrencyCode),
          billingInterval: "one_time",
          cancelUrl: sandboxReturnUrl(dependencies.canonicalOrigin, request.cancelPath),
          countryCode: sandboxCountryCode,
          idempotencyKey: prepared.checkout.providerIdempotencyKey,
          orderId: prepared.checkout.orderId,
          productCode: "pack_6",
          productName: localization.title,
          providerId: coinbaseBusinessProviderId,
          returnUrl: sandboxReturnUrl(
            dependencies.canonicalOrigin,
            request.successPath,
            prepared.checkout.orderId,
          ),
        });
        if (
          checkout.settlementQuote.usdAmount.amountMinor !== prepared.checkout.amountMinor ||
          checkout.settlementQuote.assetCode !== "USDC" ||
          checkout.settlementQuote.networkCode !== "base"
        ) {
          throw new WebCommerceError("unavailable");
        }
        const attached = await dependencies.persistence.attachCoinbaseCheckout({
          attachedAt: now,
          checkoutExpiresAt: checkout.expiresAt,
          checkoutId: checkout.checkoutId,
          checkoutUrl: checkout.url,
          orderId: prepared.checkout.orderId,
          recoveryScope,
          userId: session.userId,
        });
        if (
          attached.state !== "checkout_created" ||
          attached.checkoutUrl === null ||
          attached.checkoutId !== checkout.checkoutId
        ) {
          throw new WebCommerceError("unavailable");
        }
        return Object.freeze({
          checkoutUrl: attached.checkoutUrl,
          expiresAt: attached.checkoutExpiresAt,
          kind: prepared.kind,
          networkCode: "base" as const,
          orderId: attached.orderId,
          productCode: "pack_6" as const,
          settlementAsset: "USDC" as const,
          state: "checkout_created" as const,
          usdAmountMinor: attached.amountMinor,
        });
      } catch (error) {
        return mapError(error);
      }
    },
  });
};

export type CoinbaseCheckoutApplicationService = ReturnType<
  typeof createCoinbaseCheckoutApplicationService
>;

let service: CoinbaseCheckoutApplicationService | undefined;

export const loadWebCoinbaseCheckoutApplicationService = (): CoinbaseCheckoutApplicationService => {
  if (service !== undefined) return service;
  const configuration = getWebRuntimeConfiguration();
  if (
    configuration.deploymentEnvironment !== "staging" ||
    configuration.recoveryItem11Sandbox === undefined
  ) {
    throw new WebCommerceError("unavailable");
  }
  const accounts = loadWebAccountIdentityService();
  const coinbase = configuration.recoveryItem11Sandbox.coinbase;
  const paymentProvider = createCoinbaseBusinessHostedCheckoutAdapter({
    clock: () => new Date().toISOString(),
    gateway: createRecoveryItem11CoinbaseBusinessGateway({
      ...coinbase,
      clock: () => new Date().toISOString(),
      recoveryScope,
    }),
    mapReconciliationResult: mapCoinbaseBusinessReconciliationResult,
    mapVerifiedWebhookEvent: mapCoinbaseBusinessVerifiedWebhookEvent,
  });
  service = createCoinbaseCheckoutApplicationService({
    accounts: {
      getProfile: (token) => accounts.getProfile(token),
      resolveSession: (token) => accounts.resolveSession(token),
    },
    canonicalOrigin: configuration.brand.canonicalOrigin,
    catalog: loadWebProductCatalogApplicationService(),
    clock: () => new Date().toISOString(),
    countryPolicies: {
      read: async (countryCode, environment) =>
        (await readCountryPolicyVersions(loadWebDatabase(), { countryCode, environment })).map(
          (record) => parseCountryPolicyVersionV1(record.policyDocument),
        ),
    },
    environment: "staging",
    paymentProvider,
    persistence: createCommercialCheckoutPersistence(loadWebDatabase()),
    providerAccountFingerprint: `sha256:${createHash("sha256")
      .update(coinbase.apiKeyId, "utf8")
      .digest("hex")}`,
    recoveryScope,
  });
  return service;
};
