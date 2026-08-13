import "server-only";

import { createHash, randomUUID } from "node:crypto";

import {
  createCommercePersistence,
  readCountryPolicyVersions,
  type CommercePersistence,
  type PersistedCommerceOrder,
  type PersistedEntitlement,
  type PreparedPaymentEvent,
} from "@rituvia/db";
import {
  evaluateCountryPolicyVersion,
  parseCountryPolicyVersionV1,
  type CountryPolicySnapshotV2,
  type CountryPolicyVersionV1,
} from "@rituvia/country-policy";
import {
  applyPaymentEvent,
  CommerceError,
  createDigitalProductV1,
  createMoney,
  createOrderV1,
  createProductPriceV1,
  evaluatePaymentRouteControl,
  normalizedPaymentEventTypes,
  type DigitalProductV1,
  type NormalizedPaymentEventV1,
  type OrderV1,
  type ProductPriceV1,
  type RawWebhookRequest,
} from "@rituvia/payments";

import { getWebRuntimeConfiguration } from "../config/server";
import { loadWebAccountIdentityService } from "./account-auth";
import { loadWebDatabase } from "./database";
import {
  loadWebPaymentProviderRegistry,
  localHostedCheckoutProviderId,
  stripeHostedCheckoutProviderId,
  WebPaymentProviderError,
  type WebPaymentProviderId,
  type WebPaymentProviderRegistry,
} from "./payment-provider";
import {
  webPaymentActivationControlReader,
  type WebPaymentActivationControlReader,
} from "./payment-route-controls";

const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const idempotencyKeyPattern =
  /^(?:[A-Za-z0-9_-]{22,128}|[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/u;
const resourcePattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/u;
const termsVersion = "local.terms.v1";
const refundPolicyVersion = "local.refund.v1";
const localCountryCode = "US";
const catalogEffectiveFrom = "2020-01-01T00:00:00.000Z";

export const webCommerceErrorCodes = Object.freeze([
  "conflict",
  "input_invalid",
  "not_eligible",
  "not_found",
  "session_required",
  "unavailable",
  "webhook_invalid",
] as const);
export type WebCommerceErrorCode = (typeof webCommerceErrorCodes)[number];

export class WebCommerceError extends Error {
  readonly code: WebCommerceErrorCode;

  constructor(code: WebCommerceErrorCode) {
    super("The commerce operation could not be completed.");
    this.name = "WebCommerceError";
    this.code = code;
  }
}

type CatalogDefinition = Readonly<{
  name: string;
  price: ProductPriceV1;
  product: DigitalProductV1;
}>;

const catalogDefinitions: readonly CatalogDefinition[] = Object.freeze(
  [
    {
      amountMinor: 99,
      exactContents: [
        "One mindful incense virtual ritual object",
        "Private use in the digital sanctuary",
      ],
      name: "Mindful incense",
      productCode: "mindful_incense",
    },
    {
      amountMinor: 199,
      exactContents: [
        "One moonlit lotus virtual ritual object",
        "Private use in the digital sanctuary",
      ],
      name: "Moonlit lotus",
      productCode: "moonlit_lotus",
    },
    {
      amountMinor: 399,
      exactContents: [
        "One amethyst guardian virtual ritual object",
        "Private use in the digital sanctuary",
      ],
      name: "Amethyst guardian",
      productCode: "amethyst_guardian",
    },
    {
      amountMinor: 599,
      exactContents: [
        "One golden intention bowl virtual ritual object",
        "Private use in the digital sanctuary",
      ],
      name: "Golden intention bowl",
      productCode: "golden_intention_bowl",
    },
  ].map((definition) => {
    const product = createDigitalProductV1({
      code: definition.productCode,
      entitlementCode: `sanctuary.${definition.productCode}`,
      exactContents: definition.exactContents,
      kind: "digital_item",
      publishedAt: catalogEffectiveFrom,
      status: "active",
      version: "1.0.0",
    });
    const price = createProductPriceV1({
      amountMinor: definition.amountMinor,
      currencyCode: "USD",
      effectiveFrom: catalogEffectiveFrom,
      effectiveUntil: null,
      priceId: `price.${definition.productCode}.usd.1`,
      productCode: product.code,
      productVersion: product.version,
      status: "active",
      version: "usd.1",
    });
    return Object.freeze({ name: definition.name, price, product });
  }),
);
const paidRitualObjectCodes = Object.freeze(
  catalogDefinitions.map((definition) => definition.product.code),
);

export type WebCommerceCatalogItem = Readonly<{
  amountMinor: number;
  currencyCode: string;
  exactContents: readonly string[];
  name: string;
  productCode: string;
}>;

export type WebCommerceOrder = Readonly<{
  amountMinor: number;
  checkoutExpiresAt: string | null;
  checkoutUrl: string | null;
  createdAt: string;
  currencyCode: string;
  entitlementGranted: boolean;
  exactContents: readonly string[];
  orderId: string;
  productCode: string;
  state: PersistedCommerceOrder["state"];
  updatedAt: string;
}>;

export type WebCommerceEntitlement = Readonly<{
  code: string;
  grantedAt: string;
  revokedAt: string | null;
  state: "active" | "revoked";
}>;

type CommerceAccountGateway = Readonly<{
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

export type CommerceApplicationDependencies = Readonly<{
  accounts: CommerceAccountGateway;
  canonicalOrigin: string;
  clock: () => string;
  countryPolicies: Readonly<{
    read(
      countryCode: string,
      environment: CountryPolicyVersionV1["environment"],
    ): Promise<readonly CountryPolicyVersionV1[]>;
  }>;
  environment: CountryPolicyVersionV1["environment"];
  idFactory: () => string;
  paymentControls: WebPaymentActivationControlReader;
  paymentProviders: WebPaymentProviderRegistry;
  persistence: CommercePersistence;
  providerId: WebPaymentProviderId | null;
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

const requireUuid = (value: unknown): string => {
  if (typeof value !== "string" || !uuidV4Pattern.test(value)) {
    throw new WebCommerceError("input_invalid");
  }
  return value;
};

const requireResource = (value: unknown): string => {
  if (typeof value !== "string" || !resourcePattern.test(value)) {
    throw new WebCommerceError("input_invalid");
  }
  return value;
};

export const requireCommerceIdempotencyKey = (value: unknown): string => {
  if (typeof value !== "string" || !idempotencyKeyPattern.test(value)) {
    throw new WebCommerceError("input_invalid");
  }
  return value;
};

const requireInstant = (value: string): string => {
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== value) {
    throw new WebCommerceError("unavailable");
  }
  return value;
};

const sha256 = (value: string | Uint8Array): Uint8Array =>
  Uint8Array.from(createHash("sha256").update(value).digest());

const findCatalogDefinition = (productCode: unknown): CatalogDefinition => {
  if (typeof productCode !== "string") throw new WebCommerceError("input_invalid");
  const definition = catalogDefinitions.find((entry) => entry.product.code === productCode);
  if (definition === undefined) throw new WebCommerceError("input_invalid");
  return definition;
};

export const webCommerceLocalPolicyVersions: readonly CountryPolicyVersionV1[] = Object.freeze([
  parseCountryPolicyVersionV1({
    approvalMode: "local_test",
    countryCode: localCountryCode,
    crypto: { assets: [], enabled: false, providerRoute: null },
    dataFlags: ["private_by_default"],
    effectiveFrom: catalogEffectiveFrom,
    effectiveUntil: null,
    environment: "local",
    evidence: {
      cryptoApprovalReference: null,
      fiatApprovalReference: "test:local:fiat",
      legalReference: "test:local:legal",
      ownerReference: "test:own-010:local",
      providerReference: "test:local:hosted-checkout",
    },
    fiat: {
      currencies: ["USD"],
      enabled: true,
      methods: ["card"],
      providerRoutes: [localHostedCheckoutProviderId],
      recurringAllowed: false,
    },
    legalDocumentVersions: [
      { documentCode: "privacy", version: "local.privacy.v1" },
      { documentCode: "terms", version: termsVersion },
    ],
    localeTags: ["en"],
    marketingFlags: ["no_fear_upsell"],
    minimumAge: 18,
    modalities: ["ritual"],
    nextReviewAt: "2099-01-01T00:00:00.000Z",
    prohibitedClaims: ["guaranteed_outcome"],
    products: [...catalogDefinitions]
      .map((definition) => ({
        access: "paid" as const,
        productCode: definition.product.code,
        subscriptionAllowed: false,
      }))
      .sort((left, right) => left.productCode.localeCompare(right.productCode)),
    refundPolicyVersion,
    requiredDisclosures: ["digital_contents", "reflective_not_predictive"],
    schemaVersion: "country-policy-version.v1",
    status: "paid",
    supersedesVersion: null,
    supportAvailable: true,
    taxMode: "not_applicable",
    version: "local.us.commerce.v1",
  }),
]);

export const getWebCommerceCatalog = (): readonly WebCommerceCatalogItem[] =>
  Object.freeze(
    catalogDefinitions.map((definition) =>
      Object.freeze({
        amountMinor: definition.price.money.amountMinor,
        currencyCode: definition.price.money.currencyCode,
        exactContents: definition.product.exactContents,
        name: definition.name,
        productCode: definition.product.code,
      }),
    ),
  );

const publicOrder = (order: PersistedCommerceOrder): WebCommerceOrder =>
  Object.freeze({
    amountMinor: order.amountMinor,
    checkoutExpiresAt: order.checkoutExpiresAt,
    checkoutUrl: order.checkoutUrl,
    createdAt: order.createdAt,
    currencyCode: order.currencyCode,
    entitlementGranted: order.state === "paid",
    exactContents: order.exactContents,
    orderId: order.orderId,
    productCode: order.productCode,
    state: order.state,
    updatedAt: order.updatedAt,
  });

const publicEntitlement = (entitlement: PersistedEntitlement): WebCommerceEntitlement =>
  Object.freeze({
    code: entitlement.code,
    grantedAt: entitlement.grantedAt,
    revokedAt: entitlement.revokedAt,
    state: entitlement.state,
  });

const errorCode = (error: unknown): string | undefined => {
  if (!isRecord(error)) return undefined;
  return typeof error.code === "string" ? error.code : undefined;
};

const mapError = (
  error: unknown,
  fallback: "input_invalid" | "unavailable" | "webhook_invalid",
): never => {
  if (error instanceof WebCommerceError) throw error;
  if (error instanceof WebPaymentProviderError) throw new WebCommerceError("unavailable");
  if (error instanceof CommerceError) {
    if (error.code === "WEBHOOK_INVALID" || error.code === "WEBHOOK_REPLAYED") {
      throw new WebCommerceError("webhook_invalid");
    }
    if (error.code === "COMMERCE_INPUT_INVALID") {
      throw new WebCommerceError(fallback === "webhook_invalid" ? fallback : "input_invalid");
    }
    if (error.code === "COMMERCE_STATE_CONFLICT") {
      throw new WebCommerceError("conflict");
    }
    throw new WebCommerceError("unavailable");
  }
  switch (errorCode(error)) {
    case "COMMERCE_CONFLICT":
      throw new WebCommerceError("conflict");
    case "COMMERCE_NOT_FOUND":
      throw new WebCommerceError("not_found");
    case "ACCOUNT_AUTH_INVALID":
    case "ACCOUNT_SESSION_UNAVAILABLE":
      throw new WebCommerceError("session_required");
    default:
      // Unclassified storage, network, serialization, and programming failures
      // are outages. They must remain retryable and must never be mislabeled as
      // user input or an invalid provider signature.
      throw new WebCommerceError("unavailable");
  }
};

const validateCheckoutUrl = (
  url: string,
  providerId: WebPaymentProviderId,
  canonicalOrigin: string,
): string => {
  let parsed: URL;
  let origin: URL;
  try {
    parsed = new URL(url);
    origin = new URL(canonicalOrigin);
  } catch {
    throw new WebCommerceError("unavailable");
  }
  const validLocal =
    providerId === localHostedCheckoutProviderId &&
    parsed.protocol === "http:" &&
    (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost") &&
    parsed.origin === origin.origin;
  if (
    (providerId === stripeHostedCheckoutProviderId && parsed.protocol !== "https:") ||
    (providerId === localHostedCheckoutProviderId && !validLocal) ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.hash !== ""
  ) {
    throw new WebCommerceError("unavailable");
  }
  return parsed.toString();
};

const persistedToDomainOrder = (
  persisted: PersistedCommerceOrder,
  providerId: WebPaymentProviderId,
): OrderV1 => {
  const definition = findCatalogDefinition(persisted.productCode);
  return Object.freeze({
    accountId: persisted.userId,
    amount: createMoney(persisted.amountMinor, persisted.currencyCode),
    checkoutId: persisted.checkoutSessionId,
    countryPolicy: Object.freeze({
      countryCode: persisted.countryCode,
      evaluatedAt: persisted.createdAt,
      ruleVersion: persisted.countryPolicyVersion,
    }),
    createdAt: persisted.createdAt,
    entitlementCode: persisted.entitlementCode,
    orderId: persisted.orderId,
    priceId: definition.price.priceId,
    priceVersion: persisted.priceVersion,
    productCode: persisted.productCode,
    productVersion: persisted.productVersion,
    providerId,
    state: persisted.state,
    updatedAt: persisted.updatedAt,
  });
};

const transitionFor = (order: PersistedCommerceOrder, event: PreparedPaymentEvent) => {
  if (!normalizedPaymentEventTypes.includes(event.eventType as never)) {
    throw new WebCommerceError("webhook_invalid");
  }
  const providerId = order.providerId;
  if (
    providerId !== localHostedCheckoutProviderId &&
    providerId !== stripeHostedCheckoutProviderId
  ) {
    throw new WebCommerceError("unavailable");
  }
  const application = applyPaymentEvent({
    alreadyRecorded: false,
    event: Object.freeze({
      amount: createMoney(event.amountMinor, event.currencyCode),
      eventId: event.eventId,
      occurredAt: event.occurredAt,
      orderId: event.orderId,
      providerCheckoutSessionId: event.providerCheckoutSessionId,
      providerId: event.providerId,
      providerObjectId: event.objectId,
      providerPaymentIntentId: event.providerPaymentIntentId,
      type: event.eventType as NormalizedPaymentEventV1["type"],
    }),
    order: persistedToDomainOrder(order, providerId),
  });
  return Object.freeze({
    disposition:
      application.disposition === "duplicate"
        ? ("ignored_out_of_order" as const)
        : application.disposition,
    entitlementDirective: application.entitlementDirective,
    nextState: application.order.state,
  });
};

export const createCommerceApplicationService = (dependencies: CommerceApplicationDependencies) => {
  const requireSession = async (
    token: string | undefined,
  ): Promise<Readonly<{ userId: string }>> => {
    if (token === undefined) throw new WebCommerceError("session_required");
    try {
      const session = await dependencies.accounts.resolveSession(token);
      if (session === null) throw new WebCommerceError("session_required");
      requireUuid(session.userId);
      return session;
    } catch (error) {
      return mapError(error, "unavailable");
    }
  };

  const requirePurchasingAccount = async (
    token: string | undefined,
  ): Promise<Readonly<{ userId: string }>> => {
    const session = await requireSession(token);
    try {
      const profile = await dependencies.accounts.getProfile(token!);
      if (profile.id !== session.userId || profile.status !== "active") {
        throw new WebCommerceError("unavailable");
      }
      if (!profile.emailVerified || !profile.ageAttested) {
        throw new WebCommerceError("not_eligible");
      }
      return session;
    } catch (error) {
      return mapError(error, "unavailable");
    }
  };

  const evaluatePolicy = async (
    definition: CatalogDefinition,
    providerId: WebPaymentProviderId,
  ): Promise<Readonly<{ evaluatedAt: string; policy: CountryPolicySnapshotV2 }>> => {
    const [versions, activation] = await Promise.all([
      dependencies.countryPolicies.read(localCountryCode, dependencies.environment),
      dependencies.paymentControls.read({
        countryCode: localCountryCode,
        kind: "fiat",
      }),
    ]);
    const asOf = activation.countryActivation.evaluation.evaluatedAt;
    const route = Object.freeze({
      countryCode: localCountryCode,
      currencyCode: definition.price.money.currencyCode,
      evaluatedAt: asOf,
      kind: "fiat" as const,
      method: "card" as const,
      providerId,
      recurring: false,
    });
    const decision = evaluateCountryPolicyVersion(
      {
        ageAttested: true,
        asOf,
        countryEvidence: {
          billingCountryCode: null,
          declaredCountryCode: localCountryCode,
          geolocationConfidence: "none",
          geolocationCountryCode: null,
          localeCountryCode: null,
        },
        environment: dependencies.environment,
        modality: "ritual",
        payment: {
          currencyCode: definition.price.money.currencyCode,
          kind: "fiat",
          method: "card",
          providerId,
          recurring: false,
        },
        productCode: definition.product.code,
      },
      versions,
    );
    const routeControl = evaluatePaymentRouteControl({
      activation,
      fallbackProviderIds: [],
      policyDecision: decision,
      route,
    });
    if (!routeControl.allowed) {
      const operationalFailure = [
        "checkout_disabled",
        "fallback_forbidden",
        "invalid_input",
        "policy_mismatch",
      ].includes(routeControl.reason);
      throw new WebCommerceError(operationalFailure ? "unavailable" : "not_eligible");
    }
    if (!decision.allowed) throw new WebCommerceError("not_eligible");
    return Object.freeze({ evaluatedAt: asOf, policy: decision.snapshot });
  };

  const getOwnedOrder = async (
    token: string | undefined,
    orderIdInput: unknown,
    hideAuthenticationFailure: boolean,
  ): Promise<PersistedCommerceOrder> => {
    let session: Readonly<{ userId: string }>;
    try {
      session = await requireSession(token);
    } catch (error) {
      if (hideAuthenticationFailure) throw new WebCommerceError("not_found");
      throw error;
    }
    const orderId = requireUuid(orderIdInput);
    try {
      const order = await dependencies.persistence.getOrder(session.userId, orderId);
      if (order === null) throw new WebCommerceError("not_found");
      return order;
    } catch (error) {
      return mapError(error, "unavailable");
    }
  };

  const processWebhook = async (input: {
    providerId: WebPaymentProviderId;
    request: RawWebhookRequest;
  }) => {
    try {
      const provider = dependencies.paymentProviders.get(input.providerId);
      const event = await provider.verifyWebhook(input.request);
      if (event.providerId !== input.providerId || !uuidV4Pattern.test(event.orderId)) {
        throw new WebCommerceError("webhook_invalid");
      }
      const receivedAt = requireInstant(dependencies.clock());
      const prepared: PreparedPaymentEvent = Object.freeze({
        apiVersion:
          input.providerId === localHostedCheckoutProviderId
            ? "local.payment-event.v1"
            : "stripe.verified-event.v1",
        amountMinor: event.amount.amountMinor,
        currencyCode: event.amount.currencyCode,
        eventId: event.eventId,
        eventType: event.type,
        objectId: event.providerObjectId,
        occurredAt: event.occurredAt,
        orderId: event.orderId,
        payloadDigest: sha256(input.request.rawBody),
        providerAccountFingerprint: dependencies.paymentProviders.accountFingerprint(
          input.providerId,
        ),
        providerCheckoutSessionId: event.providerCheckoutSessionId,
        providerId: input.providerId,
        providerPaymentIntentId: event.providerPaymentIntentId,
        receivedAt,
      });
      return await dependencies.persistence.processPaymentEvent(
        prepared,
        {
          entitlementId: dependencies.idFactory(),
          ledgerEntryId: dependencies.idFactory(),
          paymentEventId: dependencies.idFactory(),
        },
        transitionFor,
      );
    } catch (error) {
      return mapError(error, "webhook_invalid");
    }
  };

  return Object.freeze({
    async authorizePaidRitualObject(input: {
      accountSessionToken: string | undefined;
      anonymousSessionToken?: string | undefined;
      objectCode: unknown;
    }): Promise<boolean> {
      if (
        input.accountSessionToken === undefined ||
        typeof input.objectCode !== "string" ||
        !paidRitualObjectCodes.includes(input.objectCode)
      ) {
        return false;
      }
      try {
        const session = await requireSession(input.accountSessionToken);
        return await dependencies.persistence.authorizeEntitlementForUser(
          session.userId,
          `sanctuary.${input.objectCode}`,
        );
      } catch {
        return false;
      }
    },

    async completeLocalCheckout(input: {
      checkoutSessionId: unknown;
      sessionToken: string | undefined;
    }): Promise<WebCommerceOrder> {
      if (dependencies.providerId !== localHostedCheckoutProviderId) {
        throw new WebCommerceError("unavailable");
      }
      const account = await requirePurchasingAccount(input.sessionToken);
      const checkoutSessionId = requireResource(input.checkoutSessionId);
      try {
        const order = await dependencies.persistence.getOrderByCheckoutSession(
          account.userId,
          localHostedCheckoutProviderId,
          checkoutSessionId,
        );
        if (
          order === null ||
          order.providerId !== localHostedCheckoutProviderId ||
          order.checkoutSessionId !== checkoutSessionId
        ) {
          throw new WebCommerceError("not_found");
        }
        if (order.state === "paid") return publicOrder(order);
        if (order.state !== "checkout_created" && order.state !== "processing") {
          throw new WebCommerceError("conflict");
        }
        const occurredAt = requireInstant(dependencies.clock());
        const signed = await dependencies.paymentProviders.signLocalEvent(
          Object.freeze({
            amount: createMoney(order.amountMinor, order.currencyCode),
            eventId: `local_event_${dependencies.idFactory()}`,
            occurredAt,
            orderId: order.orderId,
            providerCheckoutSessionId: checkoutSessionId,
            providerId: localHostedCheckoutProviderId,
            providerObjectId: checkoutSessionId,
            providerPaymentIntentId: null,
            type: "payment_succeeded",
          }),
        );
        const result = await processWebhook({
          providerId: localHostedCheckoutProviderId,
          request: { headers: signed.headers, rawBody: signed.rawBody },
        });
        if (result.order === null) throw new WebCommerceError("unavailable");
        return publicOrder(result.order);
      } catch (error) {
        return mapError(error, "unavailable");
      }
    },

    async createOrder(input: {
      idempotencyKey: unknown;
      request: unknown;
      sessionToken: string | undefined;
    }): Promise<Readonly<{ kind: "created" | "replayed"; order: WebCommerceOrder }>> {
      try {
        if (!isRecord(input.request) || !exactKeys(input.request, ["productCode"])) {
          throw new WebCommerceError("input_invalid");
        }
        const idempotencyKey = requireCommerceIdempotencyKey(input.idempotencyKey);
        const definition = findCatalogDefinition(input.request.productCode);
        const account = await requirePurchasingAccount(input.sessionToken);
        const providerId = dependencies.providerId;
        if (providerId === null) throw new WebCommerceError("unavailable");
        const authorization = await evaluatePolicy(definition, providerId);
        const policy = authorization.policy;
        const domainOrder = createOrderV1({
          accountId: account.userId,
          asOf: authorization.evaluatedAt,
          countryPolicy: {
            countryCode: policy.selectedCountryCode,
            evaluatedAt: policy.evaluatedAt,
            ruleVersion: policy.policyVersion,
          },
          orderId: dependencies.idFactory(),
          price: definition.price,
          product: definition.product,
          providerId,
        });
        const canonicalRequest = JSON.stringify({
          countryPolicyVersion: policy.policyVersion,
          currencyCode: domainOrder.amount.currencyCode,
          productCode: domainOrder.productCode,
          productVersion: domainOrder.productVersion,
          providerId,
          quantity: 1,
        });
        const persisted = await dependencies.persistence.createOrder({
          canonicalRequestHash: sha256(canonicalRequest),
          idempotencyKeyHash: sha256(idempotencyKey),
          order: {
            amountMinor: domainOrder.amount.amountMinor,
            countryCode: policy.selectedCountryCode,
            countryPolicyVersion: policy.policyVersion,
            createdAt: domainOrder.createdAt,
            currencyCode: domainOrder.amount.currencyCode,
            entitlementCode: domainOrder.entitlementCode,
            exactContents: definition.product.exactContents,
            orderId: domainOrder.orderId,
            orderLineId: dependencies.idFactory(),
            priceVersion: domainOrder.priceVersion,
            productCode: domainOrder.productCode,
            productVersion: domainOrder.productVersion,
            refundPolicyVersion,
            state: "pending_checkout",
            termsVersion,
            updatedAt: domainOrder.updatedAt,
            userId: account.userId,
          },
        });
        return Object.freeze({ kind: persisted.kind, order: publicOrder(persisted.order) });
      } catch (error) {
        return mapError(error, "unavailable");
      }
    },

    async getOrder(input: {
      orderId: unknown;
      sessionToken: string | undefined;
    }): Promise<WebCommerceOrder> {
      return publicOrder(await getOwnedOrder(input.sessionToken, input.orderId, true));
    },

    async listEntitlements(
      sessionToken: string | undefined,
    ): Promise<readonly WebCommerceEntitlement[]> {
      const account = await requireSession(sessionToken);
      try {
        const entitlements = await dependencies.persistence.listEntitlements(account.userId);
        return Object.freeze(entitlements.map(publicEntitlement));
      } catch (error) {
        return mapError(error, "unavailable");
      }
    },

    processWebhook,

    async startCheckout(input: {
      idempotencyKey: unknown;
      orderId: unknown;
      sessionToken: string | undefined;
    }): Promise<Readonly<{ order: WebCommerceOrder; url: string }>> {
      requireCommerceIdempotencyKey(input.idempotencyKey);
      const account = await requirePurchasingAccount(input.sessionToken);
      const orderId = requireUuid(input.orderId);
      try {
        let order = await dependencies.persistence.getOrder(account.userId, orderId);
        if (order === null) throw new WebCommerceError("not_found");
        const definition = findCatalogDefinition(order.productCode);
        const providerId = dependencies.providerId;
        if (providerId === null) throw new WebCommerceError("unavailable");
        const authorization = await evaluatePolicy(definition, providerId);
        const now = authorization.evaluatedAt;
        const activeCheckout =
          order.checkoutUrl !== null &&
          order.checkoutExpiresAt !== null &&
          Date.parse(order.checkoutExpiresAt) > Date.parse(now) &&
          (order.state === "checkout_created" || order.state === "processing");
        if (activeCheckout) {
          return Object.freeze({ order: publicOrder(order), url: order.checkoutUrl! });
        }
        if (
          order.state !== "pending_checkout" &&
          order.state !== "payment_failed" &&
          !(order.state === "checkout_created" && order.checkoutExpiresAt !== null)
        ) {
          throw new WebCommerceError("conflict");
        }
        const provider = dependencies.paymentProviders.get(providerId);
        const returnUrl = new URL("/en/checkout/return", dependencies.canonicalOrigin);
        returnUrl.searchParams.set("order_id", order.orderId);
        const cancelUrl = new URL("/en/sanctuary", dependencies.canonicalOrigin);
        cancelUrl.searchParams.set("checkout", "canceled");
        cancelUrl.searchParams.set("order_id", order.orderId);
        const checkout = await provider.createCheckout({
          accountId: account.userId,
          amount: createMoney(order.amountMinor, order.currencyCode),
          cancelUrl: cancelUrl.toString(),
          countryCode: order.countryCode,
          idempotencyKey: `checkout.${order.orderId}`,
          orderId: order.orderId,
          productCode: order.productCode,
          productName: definition.name,
          providerId,
          returnUrl: returnUrl.toString(),
        });
        if (
          checkout.providerId !== providerId ||
          !resourcePattern.test(checkout.checkoutId) ||
          Date.parse(checkout.expiresAt) <= Date.parse(now)
        ) {
          throw new WebCommerceError("unavailable");
        }
        const checkoutUrl = validateCheckoutUrl(
          checkout.url,
          providerId,
          dependencies.canonicalOrigin,
        );
        try {
          order = await dependencies.persistence.attachCheckout(account.userId, order.orderId, {
            attemptNumber: (order.paymentAttemptNumber ?? 0) + 1,
            checkoutSessionId: checkout.checkoutId,
            checkoutUrl,
            createdAt: now,
            expiresAt: checkout.expiresAt,
            paymentAttemptId: dependencies.idFactory(),
            providerEnvironment:
              dependencies.environment === "local"
                ? "local"
                : dependencies.environment === "production"
                  ? "live"
                  : "sandbox",
            providerId,
          });
        } catch (error) {
          if (errorCode(error) !== "COMMERCE_CONFLICT") throw error;
          const recovered = await dependencies.persistence.getOrder(account.userId, order.orderId);
          if (recovered?.checkoutUrl === null || recovered?.checkoutUrl === undefined) throw error;
          order = recovered;
        }
        if (order.checkoutUrl === null) throw new WebCommerceError("unavailable");
        return Object.freeze({ order: publicOrder(order), url: order.checkoutUrl });
      } catch (error) {
        return mapError(error, "unavailable");
      }
    },
  });
};

export type CommerceApplicationService = ReturnType<typeof createCommerceApplicationService>;

let service: CommerceApplicationService | undefined;

export const loadWebCommerceApplicationService = (): CommerceApplicationService => {
  if (service !== undefined) return service;
  const configuration = getWebRuntimeConfiguration();
  const accountService = loadWebAccountIdentityService();
  service = createCommerceApplicationService({
    accounts: {
      getProfile: (token) => accountService.getProfile(token),
      resolveSession: (token) => accountService.resolveSession(token),
    },
    canonicalOrigin: configuration.brand.canonicalOrigin,
    clock: () => new Date().toISOString(),
    countryPolicies: {
      read: async (countryCode, environment) =>
        (
          await readCountryPolicyVersions(loadWebDatabase(), {
            countryCode,
            environment,
          })
        ).map((persisted) => parseCountryPolicyVersionV1(persisted.policyDocument)),
    },
    environment: configuration.deploymentEnvironment,
    idFactory: randomUUID,
    paymentControls: webPaymentActivationControlReader,
    paymentProviders: loadWebPaymentProviderRegistry(),
    persistence: createCommercePersistence(loadWebDatabase()),
    providerId:
      configuration.payment?.provider === "local"
        ? localHostedCheckoutProviderId
        : configuration.payment?.provider === "stripe"
          ? stripeHostedCheckoutProviderId
          : null,
  });
  return service;
};

export const authorizePaidRitualObject = (input: {
  accountSessionToken: string | undefined;
  anonymousSessionToken?: string | undefined;
  objectCode: unknown;
}): Promise<boolean> => loadWebCommerceApplicationService().authorizePaidRitualObject(input);
