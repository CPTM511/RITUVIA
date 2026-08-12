import "server-only";

import { createHash, randomUUID } from "node:crypto";

import Stripe from "stripe";

import type { HostedCheckoutAdapter, NormalizedPaymentEventV1 } from "@rituvia/payments";
import {
  createLocalHostedCheckoutAdapter,
  type LocalHostedCheckoutAdapter,
  type SignedLocalWebhook,
} from "@rituvia/payments/adapters/local";
import {
  createStripeHostedCheckoutAdapter,
  type StripeGateway,
} from "@rituvia/payments/adapters/stripe";

import { getWebRuntimeConfiguration } from "../config/server";

export const localHostedCheckoutProviderId = "local_hosted" as const;
export const stripeHostedCheckoutProviderId = "stripe" as const;
export type StripePaymentMode = "live" | "test";
export type WebPaymentProviderId =
  typeof localHostedCheckoutProviderId | typeof stripeHostedCheckoutProviderId;

export class WebPaymentProviderError extends Error {
  readonly code: "configuration" | "unavailable";

  constructor(code: "configuration" | "unavailable") {
    super("The payment provider is unavailable.");
    this.name = "WebPaymentProviderError";
    this.code = code;
  }
}

const stripeAccountAttestationStore = (): Set<string> => {
  const processState = globalThis as typeof globalThis & {
    __rituviaStripeAccountAttestationsV1?: Set<string>;
  };
  const existing = processState.__rituviaStripeAccountAttestationsV1;
  if (existing !== undefined) return existing;
  const created = new Set<string>();
  processState.__rituviaStripeAccountAttestationsV1 = created;
  return created;
};

export type WebPaymentProviderRegistry = Readonly<{
  accountFingerprint(providerId: WebPaymentProviderId): string;
  assertAccountAttested(providerId: WebPaymentProviderId): void;
  attestAccount(providerId: WebPaymentProviderId): Promise<void>;
  get(providerId: WebPaymentProviderId): HostedCheckoutAdapter;
  signLocalEvent(event: NormalizedPaymentEventV1): Promise<SignedLocalWebhook>;
}>;

export const createWebPaymentProviderRegistry = (input: {
  localAccountFingerprint?: string | undefined;
  local?: LocalHostedCheckoutAdapter | undefined;
  stripeAccountAttestation?: (() => Promise<void>) | undefined;
  stripeAccountAttestationIdentity?: string | undefined;
  stripeAccountFingerprint?: string | undefined;
  stripe?: HostedCheckoutAdapter | undefined;
}): WebPaymentProviderRegistry => {
  if (input.local !== undefined && input.local.providerId !== localHostedCheckoutProviderId) {
    throw new WebPaymentProviderError("configuration");
  }
  if (input.stripe !== undefined && input.stripe.providerId !== stripeHostedCheckoutProviderId) {
    throw new WebPaymentProviderError("configuration");
  }
  const localAccountFingerprint = input.localAccountFingerprint ?? "local.configured.v1";
  const stripeAccountFingerprint = input.stripeAccountFingerprint ?? "stripe.configured.v1";
  const stripeAccountAttestationIdentity =
    input.stripeAccountAttestationIdentity ?? stripeAccountFingerprint;
  if (
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(localAccountFingerprint) ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(stripeAccountFingerprint) ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(stripeAccountAttestationIdentity)
  ) {
    throw new WebPaymentProviderError("configuration");
  }

  return Object.freeze({
    accountFingerprint(providerId) {
      return providerId === localHostedCheckoutProviderId
        ? localAccountFingerprint
        : stripeAccountFingerprint;
    },
    assertAccountAttested(providerId) {
      if (
        providerId === stripeHostedCheckoutProviderId &&
        !stripeAccountAttestationStore().has(stripeAccountAttestationIdentity)
      ) {
        throw new WebPaymentProviderError("unavailable");
      }
    },
    async attestAccount(providerId) {
      if (providerId === localHostedCheckoutProviderId) return;
      if (input.stripeAccountAttestation === undefined) {
        throw new WebPaymentProviderError("unavailable");
      }
      await input.stripeAccountAttestation();
      stripeAccountAttestationStore().add(stripeAccountAttestationIdentity);
    },
    get(providerId) {
      const provider = providerId === localHostedCheckoutProviderId ? input.local : input.stripe;
      if (provider === undefined) throw new WebPaymentProviderError("unavailable");
      return provider;
    },
    async signLocalEvent(event) {
      if (input.local === undefined) throw new WebPaymentProviderError("unavailable");
      return input.local.createSignedWebhook(event);
    },
  });
};

export type VerifiedStripePaymentEvent = Readonly<{
  amountMinor: number;
  currencyCode: string;
  eventId: string;
  occurredAt: string;
  orderId: string;
  providerCheckoutSessionId: string;
  providerObjectId: string;
  providerPaymentIntentId: string | null;
  providerInvoiceId: string | null;
  providerSubscriptionId: string | null;
  subscriptionCancelAtPeriodEnd: boolean | null;
  subscriptionPeriodEnd: string | null;
  subscriptionPeriodStart: string | null;
  subscriptionState: "active" | "cancelled" | "past_due" | null;
  type: NormalizedPaymentEventV1["type"];
}>;

type StripeSubscriptionContext = Pick<
  VerifiedStripePaymentEvent,
  | "providerInvoiceId"
  | "providerSubscriptionId"
  | "subscriptionCancelAtPeriodEnd"
  | "subscriptionPeriodEnd"
  | "subscriptionPeriodStart"
  | "subscriptionState"
>;

const noStripeSubscriptionContext = Object.freeze({
  providerInvoiceId: null,
  providerSubscriptionId: null,
  subscriptionCancelAtPeriodEnd: null,
  subscriptionPeriodEnd: null,
  subscriptionPeriodStart: null,
  subscriptionState: null,
}) satisfies StripeSubscriptionContext;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const metadataOrderId = (value: unknown): string | null => {
  if (!isRecord(value) || !isRecord(value.metadata)) return null;
  return typeof value.metadata.orderId === "string" ? value.metadata.orderId : null;
};

const requireStripeAmount = (value: unknown): number => {
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    throw new WebPaymentProviderError("unavailable");
  }
  return value as number;
};

const requireStripeCurrency = (value: unknown): string => {
  if (typeof value !== "string" || !/^[a-z]{3}$/u.test(value)) {
    throw new WebPaymentProviderError("unavailable");
  }
  return value.toUpperCase();
};

const requireStripeOrderId = (value: string | null): string => {
  if (
    value === null ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(value)
  ) {
    throw new WebPaymentProviderError("unavailable");
  }
  return value;
};

const stripeExpandableId = (value: null | string | { id: string } | undefined): string | null =>
  typeof value === "string" ? value : (value?.id ?? null);

const stripeCheckoutSessionIdForPaymentIntent = async (
  stripe: Stripe,
  paymentIntentId: string,
): Promise<string> => {
  const sessions = await stripe.checkout.sessions.list({
    limit: 2,
    payment_intent: paymentIntentId,
  });
  const session = sessions.data[0];
  if (sessions.data.length !== 1 || session === undefined) {
    throw new WebPaymentProviderError("unavailable");
  }
  return session.id;
};

const stripeCheckoutSessionIdForSubscription = async (
  stripe: Stripe,
  providerSubscriptionId: string,
): Promise<string> => {
  const sessions = await stripe.checkout.sessions.list({
    limit: 2,
    subscription: providerSubscriptionId,
  });
  const session = sessions.data[0];
  if (sessions.data.length !== 1 || session === undefined) {
    throw new WebPaymentProviderError("unavailable");
  }
  return session.id;
};

const normalizedStripeSubscriptionState = (
  status: Stripe.Subscription.Status,
): StripeSubscriptionContext["subscriptionState"] => {
  if (["active", "trialing"].includes(status)) return "active";
  if (["incomplete", "incomplete_expired", "past_due", "unpaid", "paused"].includes(status)) {
    return "past_due";
  }
  if (status === "canceled") return "cancelled";
  throw new WebPaymentProviderError("unavailable");
};

const stripeSubscriptionContext = (
  subscription: Stripe.Subscription,
  providerInvoiceId: string | null,
): StripeSubscriptionContext => {
  const item = subscription.items.data[0];
  if (subscription.items.data.length !== 1 || item === undefined) {
    throw new WebPaymentProviderError("unavailable");
  }
  return Object.freeze({
    providerInvoiceId,
    providerSubscriptionId: subscription.id,
    subscriptionCancelAtPeriodEnd: subscription.cancel_at_period_end,
    subscriptionPeriodEnd: new Date(item.current_period_end * 1_000).toISOString(),
    subscriptionPeriodStart: new Date(item.current_period_start * 1_000).toISOString(),
    subscriptionState: normalizedStripeSubscriptionState(subscription.status),
  });
};

const stripeInvoiceSubscriptionId = (invoice: Stripe.Invoice): string => {
  const parent = invoice.parent;
  if (parent?.type !== "subscription_details" || parent.subscription_details === null) {
    throw new WebPaymentProviderError("unavailable");
  }
  const subscription = parent.subscription_details.subscription;
  const id = stripeExpandableId(subscription);
  if (id === null) throw new WebPaymentProviderError("unavailable");
  return id;
};

const stripeInvoiceOrderId = (invoice: Stripe.Invoice): string => {
  const parent = invoice.parent;
  if (parent?.type !== "subscription_details" || parent.subscription_details === null) {
    throw new WebPaymentProviderError("unavailable");
  }
  return requireStripeOrderId(metadataOrderId(parent.subscription_details));
};

type StripeChargeContext = Readonly<{
  orderId: string;
  providerCheckoutSessionId: string;
  providerPaymentIntentId: string;
}>;

const stripeChargeContext = async (
  stripe: Stripe,
  charge: Stripe.Charge,
): Promise<StripeChargeContext> => {
  const providerPaymentIntentId = stripeExpandableId(charge.payment_intent);
  if (providerPaymentIntentId === null) throw new WebPaymentProviderError("unavailable");
  const directOrderId = metadataOrderId(charge);
  const orderId =
    directOrderId === null
      ? requireStripeOrderId(
          metadataOrderId(await stripe.paymentIntents.retrieve(providerPaymentIntentId)),
        )
      : requireStripeOrderId(directOrderId);
  return Object.freeze({
    orderId,
    providerCheckoutSessionId: await stripeCheckoutSessionIdForPaymentIntent(
      stripe,
      providerPaymentIntentId,
    ),
    providerPaymentIntentId,
  });
};

export const verifiedStripePaymentEvent = async (
  stripe: Stripe,
  event: Stripe.Event,
  mode: StripePaymentMode,
): Promise<VerifiedStripePaymentEvent> => {
  if (event.livemode !== (mode === "live")) throw new WebPaymentProviderError("unavailable");
  const occurredAt = new Date(event.created * 1_000).toISOString();
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
    case "checkout.session.async_payment_failed":
    case "checkout.session.expired": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== "payment" && session.mode !== "subscription") {
        throw new WebPaymentProviderError("unavailable");
      }
      const subscriptionId = stripeExpandableId(session.subscription);
      const subscriptionContext =
        session.mode === "subscription"
          ? subscriptionId === null
            ? (() => {
                throw new WebPaymentProviderError("unavailable");
              })()
            : stripeSubscriptionContext(await stripe.subscriptions.retrieve(subscriptionId), null)
          : noStripeSubscriptionContext;
      const type =
        event.type === "checkout.session.completed"
          ? session.payment_status === "paid" || session.mode === "subscription"
            ? "payment_succeeded"
            : "payment_pending"
          : event.type === "checkout.session.async_payment_succeeded"
            ? "payment_succeeded"
            : event.type === "checkout.session.expired"
              ? "payment_expired"
              : "payment_failed";
      return Object.freeze({
        amountMinor: requireStripeAmount(session.amount_total),
        currencyCode: requireStripeCurrency(session.currency),
        eventId: event.id,
        occurredAt,
        orderId: requireStripeOrderId(session.client_reference_id ?? metadataOrderId(session)),
        providerCheckoutSessionId: session.id,
        providerObjectId: session.id,
        providerPaymentIntentId: stripeExpandableId(session.payment_intent),
        ...subscriptionContext,
        type,
      });
    }
    case "payment_intent.processing":
    case "payment_intent.succeeded":
    case "payment_intent.payment_failed": {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const providerCheckoutSessionId = await stripeCheckoutSessionIdForPaymentIntent(
        stripe,
        paymentIntent.id,
      );
      return Object.freeze({
        amountMinor: requireStripeAmount(paymentIntent.amount),
        currencyCode: requireStripeCurrency(paymentIntent.currency),
        eventId: event.id,
        occurredAt,
        orderId: requireStripeOrderId(metadataOrderId(paymentIntent)),
        providerCheckoutSessionId,
        providerObjectId: paymentIntent.id,
        providerPaymentIntentId: paymentIntent.id,
        ...noStripeSubscriptionContext,
        type:
          event.type === "payment_intent.processing"
            ? "payment_pending"
            : event.type === "payment_intent.succeeded"
              ? "payment_succeeded"
              : "payment_failed",
      });
    }
    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      const context = await stripeChargeContext(stripe, charge);
      return Object.freeze({
        // A partial refund intentionally carries the refunded amount. The order
        // state machine records it as a verified mismatch and keeps access until
        // a full-price refund arrives; the provider is still acknowledged once.
        amountMinor: requireStripeAmount(charge.amount_refunded),
        currencyCode: requireStripeCurrency(charge.currency),
        eventId: event.id,
        occurredAt,
        orderId: context.orderId,
        providerCheckoutSessionId: context.providerCheckoutSessionId,
        providerObjectId: charge.id,
        providerPaymentIntentId: context.providerPaymentIntentId,
        ...noStripeSubscriptionContext,
        type: "payment_refunded",
      });
    }
    case "charge.dispute.created": {
      const dispute = event.data.object as Stripe.Dispute;
      const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge.id;
      const charge = await stripe.charges.retrieve(chargeId);
      if (charge.refunded) throw new WebPaymentProviderError("unavailable");
      const context = await stripeChargeContext(stripe, charge);
      return Object.freeze({
        amountMinor: requireStripeAmount(dispute.amount),
        currencyCode: requireStripeCurrency(dispute.currency),
        eventId: event.id,
        occurredAt,
        orderId: context.orderId,
        providerCheckoutSessionId: context.providerCheckoutSessionId,
        providerObjectId: dispute.id,
        providerPaymentIntentId: context.providerPaymentIntentId,
        ...noStripeSubscriptionContext,
        type: "payment_disputed",
      });
    }
    case "invoice.paid":
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const providerSubscriptionId = stripeInvoiceSubscriptionId(invoice);
      const subscription = await stripe.subscriptions.retrieve(providerSubscriptionId);
      return Object.freeze({
        amountMinor: requireStripeAmount(
          event.type === "invoice.paid" ? invoice.amount_paid : invoice.amount_due,
        ),
        currencyCode: requireStripeCurrency(invoice.currency),
        eventId: event.id,
        occurredAt,
        orderId: stripeInvoiceOrderId(invoice),
        providerCheckoutSessionId: await stripeCheckoutSessionIdForSubscription(
          stripe,
          providerSubscriptionId,
        ),
        providerObjectId: invoice.id,
        providerPaymentIntentId: null,
        ...stripeSubscriptionContext(subscription, invoice.id),
        type: event.type === "invoice.paid" ? "payment_succeeded" : "payment_failed",
      });
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const item = subscription.items.data[0];
      if (
        subscription.items.data.length !== 1 ||
        item === undefined ||
        item.price.unit_amount === null
      ) {
        throw new WebPaymentProviderError("unavailable");
      }
      return Object.freeze({
        amountMinor: requireStripeAmount(item.price.unit_amount),
        currencyCode: requireStripeCurrency(item.price.currency),
        eventId: event.id,
        occurredAt,
        orderId: requireStripeOrderId(metadataOrderId(subscription)),
        providerCheckoutSessionId: await stripeCheckoutSessionIdForSubscription(
          stripe,
          subscription.id,
        ),
        providerObjectId: subscription.id,
        providerPaymentIntentId: null,
        ...stripeSubscriptionContext(subscription, null),
        type: "payment_pending",
      });
    }
    default:
      throw new WebPaymentProviderError("unavailable");
  }
};

const stripeSandboxWebhookEventTypes = new Set([
  "checkout.session.async_payment_failed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.completed",
  "checkout.session.expired",
  "charge.dispute.created",
  "charge.refunded",
  "customer.subscription.deleted",
  "customer.subscription.updated",
  "invoice.paid",
  "invoice.payment_failed",
  "payment_intent.payment_failed",
  "payment_intent.processing",
  "payment_intent.succeeded",
]);

export const createStripeGateway = (
  input: {
    accountId: string;
    mode: StripePaymentMode;
    priceIds: Readonly<Record<string, string>>;
    secretKey: string;
    webhookSecret: string;
  },
  stripe = new Stripe(input.secretKey, { maxNetworkRetries: 2, timeout: 10_000 }),
): Readonly<{
  attestAccount: () => Promise<void>;
  gateway: StripeGateway;
  mapVerifiedEvent: (value: unknown) => NormalizedPaymentEventV1;
}> => {
  const expectedLivemode = input.mode === "live";
  const expectedSecretPrefixes = expectedLivemode
    ? (["rk_live_"] as const)
    : (["rk_test_", "sk_test_"] as const);
  const expectedSessionPrefix = expectedLivemode ? "cs_live_" : "cs_test_";
  if (!expectedSecretPrefixes.some((prefix) => input.secretKey.startsWith(prefix))) {
    throw new WebPaymentProviderError("configuration");
  }
  let accountVerification: Promise<void> | undefined;
  const verifyAccount = async (): Promise<void> => {
    accountVerification ??= stripe.accounts.retrieveCurrent().then((account) => {
      if (
        account.id !== input.accountId ||
        (expectedLivemode && (!account.charges_enabled || !account.details_submitted))
      ) {
        throw new WebPaymentProviderError("configuration");
      }
    });
    try {
      await accountVerification;
    } catch (error) {
      accountVerification = undefined;
      throw error;
    }
  };
  const gateway: StripeGateway = Object.freeze({
    async createCheckoutSession(request: Parameters<StripeGateway["createCheckoutSession"]>[0]) {
      await verifyAccount();
      const priceId = input.priceIds[request.metadata.productCode];
      if (priceId === undefined) throw new WebPaymentProviderError("configuration");
      const price = await stripe.prices.retrieve(priceId);
      if (
        price.livemode !== expectedLivemode ||
        !price.active ||
        (request.mode === "payment"
          ? price.type !== "one_time"
          : price.type !== "recurring" || price.recurring?.interval !== request.billingInterval) ||
        price.currency.toUpperCase() !== request.currencyCode ||
        price.unit_amount !== request.unitAmountMinor
      ) {
        throw new WebPaymentProviderError("configuration");
      }
      const session = await stripe.checkout.sessions.create(
        {
          billing_address_collection: "required",
          cancel_url: request.cancelUrl,
          client_reference_id: request.clientReferenceId,
          line_items: [{ price: price.id, quantity: 1 }],
          metadata: { ...request.metadata, countryCode: request.countryCode },
          mode: request.mode,
          ...(request.mode === "payment"
            ? {
                payment_intent_data: {
                  metadata: { ...request.metadata, countryCode: request.countryCode },
                },
              }
            : {
                subscription_data: {
                  metadata: { ...request.metadata, countryCode: request.countryCode },
                },
              }),
          success_url: request.returnUrl,
        },
        { idempotencyKey: request.idempotencyKey },
      );
      if (
        session.url === null ||
        session.livemode !== expectedLivemode ||
        !session.id.startsWith(expectedSessionPrefix)
      ) {
        throw new WebPaymentProviderError("unavailable");
      }
      return Object.freeze({
        expiresAt: new Date(session.expires_at * 1_000).toISOString(),
        id: session.id,
        url: session.url,
      });
    },
    async verifyWebhook({
      nowSeconds,
      rawBody,
      signatureHeader,
      toleranceSeconds,
    }: Parameters<StripeGateway["verifyWebhook"]>[0]) {
      const event = await stripe.webhooks.constructEventAsync(
        rawBody,
        signatureHeader,
        input.webhookSecret,
        toleranceSeconds,
        undefined,
        nowSeconds * 1_000,
      );
      if (!stripeSandboxWebhookEventTypes.has(event.type)) {
        throw new WebPaymentProviderError("unavailable");
      }
      return verifiedStripePaymentEvent(stripe, event, input.mode);
    },
  });
  return Object.freeze({
    attestAccount: verifyAccount,
    gateway,
    mapVerifiedEvent(value): NormalizedPaymentEventV1 {
      if (!isRecord(value)) throw new WebPaymentProviderError("unavailable");
      return Object.freeze({
        amount: Object.freeze({
          amountMinor: value.amountMinor as number,
          currencyCode: value.currencyCode as string,
        }),
        eventId: value.eventId as string,
        occurredAt: value.occurredAt as string,
        orderId: value.orderId as string,
        providerCheckoutSessionId: value.providerCheckoutSessionId as string,
        providerId: stripeHostedCheckoutProviderId,
        providerObjectId: value.providerObjectId as string,
        providerPaymentIntentId: value.providerPaymentIntentId as string | null,
        providerInvoiceId: value.providerInvoiceId as string | null,
        providerSubscriptionId: value.providerSubscriptionId as string | null,
        subscriptionCancelAtPeriodEnd: value.subscriptionCancelAtPeriodEnd as boolean | null,
        subscriptionPeriodEnd: value.subscriptionPeriodEnd as string | null,
        subscriptionPeriodStart: value.subscriptionPeriodStart as string | null,
        subscriptionState: value.subscriptionState as "active" | "cancelled" | "past_due" | null,
        type: value.type as NormalizedPaymentEventV1["type"],
      });
    },
  });
};

const configurationFingerprint = (value: string | Uint8Array): string =>
  `cfg_${createHash("sha256").update(value).digest("hex").slice(0, 32)}`;

let registry: WebPaymentProviderRegistry | undefined;

export const loadWebPaymentProviderRegistry = (): WebPaymentProviderRegistry => {
  if (registry !== undefined) return registry;
  const configuration = getWebRuntimeConfiguration();
  if (configuration.payment === undefined) {
    registry = createWebPaymentProviderRegistry({});
    return registry;
  }

  try {
    if (configuration.payment.provider === "local") {
      registry = createWebPaymentProviderRegistry({
        local: createLocalHostedCheckoutAdapter({
          clock: () => new Date().toISOString(),
          environment: configuration.deploymentEnvironment,
          idFactory: randomUUID,
          origin: configuration.brand.canonicalOrigin,
          signingSecret: configuration.payment.localSigningSecret,
        }),
        localAccountFingerprint: configurationFingerprint(configuration.payment.localSigningSecret),
      });
      return registry;
    }
    const stripeRuntime = createStripeGateway(configuration.payment);
    registry = createWebPaymentProviderRegistry({
      stripe: createStripeHostedCheckoutAdapter({
        clock: () => new Date().toISOString(),
        gateway: stripeRuntime.gateway,
        mapVerifiedEvent: stripeRuntime.mapVerifiedEvent,
      }),
      stripeAccountAttestation: stripeRuntime.attestAccount,
      stripeAccountAttestationIdentity: configurationFingerprint(
        `${configuration.payment.accountId}\0${configuration.payment.secretKey}`,
      ),
      stripeAccountFingerprint: configuration.payment.accountId,
    });
    return registry;
  } catch {
    throw new WebPaymentProviderError("configuration");
  }
};

export const attestConfiguredWebPaymentProvider = async (): Promise<void> => {
  const configuration = getWebRuntimeConfiguration();
  if (configuration.payment?.provider !== "stripe") return;
  await loadWebPaymentProviderRegistry().attestAccount(stripeHostedCheckoutProviderId);
};
