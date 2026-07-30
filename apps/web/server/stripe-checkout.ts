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
  type CatalogEnvironment,
  type CatalogVersionV1,
  type HostedCheckoutAdapter,
} from "@rituvia/payments";

import { getWebRuntimeConfiguration } from "../config/server";
import { loadWebAccountIdentityService } from "./account-auth";
import { WebCommerceError } from "./commerce";
import { loadWebDatabase } from "./database";
import {
  loadWebPaymentProviderRegistry,
  stripeHostedCheckoutProviderId,
  WebPaymentProviderError,
} from "./payment-provider";
import { loadWebProductCatalogApplicationService } from "./product-catalog";

const idempotencyKeyPattern =
  /^(?:[A-Za-z0-9_-]{22,128}|[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/u;
const productCodePattern = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u;
const boundedPathPattern = /^\/(?!\/)[A-Za-z0-9._~!$&'()*+,;=:@%/-]{0,299}$/u;
const sandboxCountryCode = "US";
const sandboxCurrencyCode = "USD";
const checkoutRequestSchemaVersion = "stripe-checkout-request.v1";

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

export type StripeCheckoutApplicationDependencies = Readonly<{
  accounts: AccountGateway;
  canonicalOrigin: string;
  catalog: Readonly<{ readActive(): Promise<CatalogVersionV1> }>;
  clock(): string;
  countryPolicies: Readonly<{
    read(
      countryCode: string,
      environment: CountryPolicyVersionV1["environment"],
    ): Promise<readonly CountryPolicyVersionV1[]>;
  }>;
  environment: CatalogEnvironment;
  providerAccountFingerprint: string;
  paymentProvider: HostedCheckoutAdapter;
  persistence: CommercialCheckoutPersistence;
}>;

export type WebStripeCheckout = Readonly<{
  amountMinor: number;
  checkoutUrl: string;
  currencyCode: string;
  expiresAt: string;
  kind: "created" | "replayed";
  orderId: string;
  productCode: string;
  state: "checkout_created";
}>;

const exactKeys = (value: Record<string, unknown>, expected: readonly string[]): boolean => {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return (
    actual.length === sortedExpected.length &&
    actual.every((key, index) => key === sortedExpected.at(index))
  );
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parseRequest = (
  value: unknown,
): Readonly<{ cancelPath: string; productCode: string; successPath: string }> => {
  if (
    !isRecord(value) ||
    !exactKeys(value, ["cancelPath", "productCode", "successPath"]) ||
    typeof value.cancelPath !== "string" ||
    typeof value.productCode !== "string" ||
    typeof value.successPath !== "string" ||
    !boundedPathPattern.test(value.cancelPath) ||
    !boundedPathPattern.test(value.successPath) ||
    !productCodePattern.test(value.productCode)
  ) {
    throw new WebCommerceError("input_invalid");
  }
  return Object.freeze({
    cancelPath: value.cancelPath,
    productCode: value.productCode,
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
  request: Readonly<{ cancelPath: string; productCode: string; successPath: string }>,
): string =>
  JSON.stringify({
    cancelPath: request.cancelPath,
    productCode: request.productCode,
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
      canonicalOrigin.username !== "" ||
      canonicalOrigin.password !== "" ||
      canonicalOrigin.pathname !== "/" ||
      canonicalOrigin.search !== "" ||
      canonicalOrigin.hash !== ""
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
  if (error instanceof WebPaymentProviderError || error instanceof CommerceError) {
    throw new WebCommerceError("unavailable");
  }
  throw new WebCommerceError("unavailable");
};

export const createStripeCheckoutApplicationService = (
  dependencies: StripeCheckoutApplicationDependencies,
) => {
  if (
    dependencies.environment === "production" ||
    dependencies.paymentProvider.providerId !== stripeHostedCheckoutProviderId
  ) {
    throw new WebCommerceError("unavailable");
  }

  return Object.freeze({
    async createCheckout(input: {
      idempotencyKey: unknown;
      request: unknown;
      sessionToken: string | undefined;
    }): Promise<WebStripeCheckout> {
      try {
        if (input.sessionToken === undefined) throw new WebCommerceError("session_required");
        const request = parseRequest(input.request);
        const idempotencyKey = parseIdempotencyKey(input.idempotencyKey);
        const now = requireInstant(dependencies.clock());
        const session = await dependencies.accounts.resolveSession(input.sessionToken);
        if (session === null) {
          throw new WebCommerceError("session_required");
        }
        const profile = await dependencies.accounts.getProfile(input.sessionToken);
        if (session.userId !== profile.id || profile.status !== "active") {
          throw new WebCommerceError("session_required");
        }
        if (!profile.emailVerified || !profile.ageAttested) {
          throw new WebCommerceError("not_eligible");
        }
        const [catalog, policyVersions] = await Promise.all([
          dependencies.catalog.readActive(),
          dependencies.countryPolicies.read(sandboxCountryCode, dependencies.environment),
        ]);

        const product = catalog.products.find(
          (candidate) =>
            candidate.code === request.productCode &&
            candidate.status === "active" &&
            candidate.kind === "credit_pack" &&
            candidate.subscriptionInterval === null &&
            candidate.creditsGranted !== null,
        );
        if (product === undefined) throw new WebCommerceError("not_eligible");
        const creditsGranted = product.creditsGranted;
        if (creditsGranted === null) throw new WebCommerceError("not_eligible");
        const prices = catalog.prices.filter(
          (candidate) =>
            candidate.status === "active" &&
            candidate.productCode === product.code &&
            candidate.productVersion === product.version &&
            candidate.billingInterval === "one_time" &&
            candidate.currencyCode === sandboxCurrencyCode &&
            candidate.countryCodes.includes(sandboxCountryCode) &&
            candidate.providerEligibility.includes("stripe") &&
            Date.parse(candidate.effectiveFrom) <= Date.parse(now) &&
            (candidate.effectiveUntil === null ||
              Date.parse(now) < Date.parse(candidate.effectiveUntil)),
        );
        const price = prices.at(0);
        const localization = product.localizations.find(({ locale }) => locale === "en");
        if (prices.length !== 1 || price === undefined || localization === undefined) {
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
            environment: dependencies.environment,
            modality: "ritual",
            payment: {
              currencyCode: sandboxCurrencyCode,
              kind: "fiat",
              method: "card",
              providerId: stripeHostedCheckoutProviderId,
              recurring: false,
            },
            productCode: product.code,
          },
          policyVersions,
        );
        if (!policyDecision.allowed) throw new WebCommerceError("not_eligible");
        const policy = policyVersions.find(
          ({ version }) => version === policyDecision.snapshot.policyVersion,
        );
        const terms = policyDecision.snapshot.legalDocumentVersions.filter(
          ({ documentCode }) => documentCode === "terms",
        );
        const termsDocument = terms.at(0);
        if (
          policy === undefined ||
          policy.refundPolicyVersion !== price.refundPolicyVersion ||
          terms.length !== 1 ||
          termsDocument === undefined
        ) {
          throw new WebCommerceError("not_eligible");
        }

        const canonical = canonicalRequest(request);
        const prepared = await dependencies.persistence.createOrReplayStripeCheckout({
          amountMinor: price.amountMinor,
          canonicalRequestHash: sha256(canonical),
          catalogVersion: catalog.version,
          countryCode: sandboxCountryCode,
          countryPolicyVersion: policyDecision.snapshot.policyVersion,
          createdAt: now,
          creditsGranted,
          currencyCode: sandboxCurrencyCode,
          exactContents: localization.exactContents,
          fulfillmentCode: product.fulfillmentCode,
          idempotencyKeyHash: sha256(idempotencyKey),
          priceId: price.priceId,
          priceVersion: price.version,
          productCode: product.code,
          productVersion: product.version,
          providerAccountFingerprint: dependencies.providerAccountFingerprint,
          provisionalExpiresAt: new Date(Date.parse(now) + 86_400_000).toISOString(),
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
            amountMinor: prepared.checkout.amountMinor,
            checkoutUrl: prepared.checkout.checkoutUrl,
            currencyCode: prepared.checkout.currencyCode,
            expiresAt: prepared.checkout.checkoutExpiresAt,
            kind: "replayed",
            orderId: prepared.checkout.orderId,
            productCode: prepared.checkout.productCode,
            state: "checkout_created",
          });
        }

        const checkout = await dependencies.paymentProvider.createCheckout({
          accountId: session.userId,
          amount: createMoney(prepared.checkout.amountMinor, prepared.checkout.currencyCode),
          cancelUrl: sandboxReturnUrl(dependencies.canonicalOrigin, request.cancelPath),
          countryCode: sandboxCountryCode,
          idempotencyKey: prepared.checkout.providerIdempotencyKey,
          orderId: prepared.checkout.orderId,
          productCode: prepared.checkout.productCode,
          productName: localization.title,
          providerId: stripeHostedCheckoutProviderId,
          returnUrl: sandboxReturnUrl(
            dependencies.canonicalOrigin,
            request.successPath,
            prepared.checkout.orderId,
          ),
        });
        const attached = await dependencies.persistence.attachStripeCheckout({
          attachedAt: now,
          checkoutExpiresAt: checkout.expiresAt,
          checkoutId: checkout.checkoutId,
          checkoutUrl: checkout.url,
          orderId: prepared.checkout.orderId,
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
          amountMinor: attached.amountMinor,
          checkoutUrl: attached.checkoutUrl,
          currencyCode: attached.currencyCode,
          expiresAt: attached.checkoutExpiresAt,
          kind: prepared.kind,
          orderId: attached.orderId,
          productCode: attached.productCode,
          state: "checkout_created",
        });
      } catch (error) {
        return mapError(error);
      }
    },
  });
};

export type StripeCheckoutApplicationService = ReturnType<
  typeof createStripeCheckoutApplicationService
>;

let service: StripeCheckoutApplicationService | undefined;

export const loadWebStripeCheckoutApplicationService = (): StripeCheckoutApplicationService => {
  if (service !== undefined) return service;
  const configuration = getWebRuntimeConfiguration();
  if (
    configuration.deploymentEnvironment === "production" ||
    configuration.payment?.provider !== "stripe"
  ) {
    throw new WebCommerceError("unavailable");
  }
  const accounts = loadWebAccountIdentityService();
  const paymentProviders = loadWebPaymentProviderRegistry();
  const paymentProvider = paymentProviders.get(stripeHostedCheckoutProviderId);
  service = createStripeCheckoutApplicationService({
    accounts: {
      getProfile: (token) => accounts.getProfile(token),
      resolveSession: (token) => accounts.resolveSession(token),
    },
    canonicalOrigin: configuration.brand.canonicalOrigin,
    catalog: loadWebProductCatalogApplicationService(),
    clock: () => new Date().toISOString(),
    countryPolicies: {
      read: async (countryCode, environment) =>
        (
          await readCountryPolicyVersions(loadWebDatabase(), {
            countryCode,
            environment,
          })
        ).map((record) => parseCountryPolicyVersionV1(record.policyDocument)),
    },
    environment: configuration.deploymentEnvironment,
    providerAccountFingerprint: paymentProviders.accountFingerprint(stripeHostedCheckoutProviderId),
    paymentProvider,
    persistence: createCommercialCheckoutPersistence(loadWebDatabase()),
  });
  return service;
};
