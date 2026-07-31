import "server-only";

import { createHash, randomUUID } from "node:crypto";

import Stripe from "stripe";

import {
  createMoney,
  type HostedCheckoutAdapter,
  type NormalizedPaymentEventV1,
} from "@rituvia/payments";
import {
  createLocalHostedCheckoutAdapter,
  type LocalHostedCheckoutAdapter,
  type SignedLocalWebhook,
} from "@rituvia/payments/adapters/local";
import {
  createStripeHostedCheckoutAdapter,
  type StripeHostedCheckoutAdapter,
  type StripeGateway,
  type NormalizedSubscriptionEventV1,
} from "@rituvia/payments/adapters/stripe";

import { getWebRuntimeConfiguration } from "../config/server";

export const localHostedCheckoutProviderId = "local_hosted" as const;
export const stripeHostedCheckoutProviderId = "stripe" as const;
export type WebPaymentProviderId =
  typeof localHostedCheckoutProviderId | typeof stripeHostedCheckoutProviderId;

export class WebPaymentProviderError extends Error {
  readonly code: "configuration" | "rejected" | "unavailable";

  constructor(code: "configuration" | "rejected" | "unavailable") {
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
  getStripeSubscription(): StripeHostedCheckoutAdapter;
  requestStripeRefund(input: {
    amountMinor: number;
    idempotencyKey: string;
    orderId: string;
    paymentIntentId: string;
  }): Promise<Readonly<{ providerRefundId: string }>>;
  signLocalEvent(event: NormalizedPaymentEventV1): Promise<SignedLocalWebhook>;
}>;

export const createWebPaymentProviderRegistry = (input: {
  localAccountFingerprint?: string | undefined;
  local?: LocalHostedCheckoutAdapter | undefined;
  stripeAccountAttestation?: (() => Promise<void>) | undefined;
  stripeAccountAttestationIdentity?: string | undefined;
  stripeAccountFingerprint?: string | undefined;
  stripeRefund?:
    | ((input: {
        amountMinor: number;
        idempotencyKey: string;
        orderId: string;
        paymentIntentId: string;
      }) => Promise<Readonly<{ providerRefundId: string }>>)
    | undefined;
  stripe?: StripeHostedCheckoutAdapter | undefined;
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
    getStripeSubscription() {
      if (input.stripe === undefined) throw new WebPaymentProviderError("unavailable");
      return input.stripe;
    },
    async requestStripeRefund(request) {
      if (input.stripeRefund === undefined) {
        throw new WebPaymentProviderError("unavailable");
      }
      return input.stripeRefund(request);
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
  type: NormalizedPaymentEventV1["type"];
}>;

export type VerifiedStripeSubscriptionEvent = NormalizedSubscriptionEventV1;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const metadataOrderId = (value: unknown): string | null => {
  if (!isRecord(value) || !isRecord(value.metadata)) return null;
  return typeof value.metadata.orderId === "string" ? value.metadata.orderId : null;
};

const metadataProductCode = (value: unknown): string | null => {
  if (!isRecord(value) || !isRecord(value.metadata)) return null;
  return typeof value.metadata.productCode === "string" ? value.metadata.productCode : null;
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

const requireStripeProviderId = (value: unknown): string => {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/u.test(value)) {
    throw new WebPaymentProviderError("unavailable");
  }
  return value;
};

const requireStripeProductCode = (value: unknown): string => {
  if (typeof value !== "string" || !/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u.test(value)) {
    throw new WebPaymentProviderError("unavailable");
  }
  return value;
};

const requireStripeUnixInstant = (value: unknown): string => {
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    throw new WebPaymentProviderError("unavailable");
  }
  return new Date((value as number) * 1_000).toISOString();
};

const stripeExpandableId = (value: null | string | { id: string } | undefined): string | null =>
  typeof value === "string" ? value : (value?.id ?? null);

const stripeRecordId = (value: unknown): string | null => {
  if (typeof value === "string") return value;
  if (isRecord(value) && typeof value.id === "string") return value.id;
  return null;
};

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

type StripeSubscriptionContext = Readonly<{
  cancelAtPeriodEnd: boolean;
  orderId: string;
  productCode: string;
  providerCustomerId: string;
  providerSubscriptionId: string;
  subscriptionInterval: "month" | "year";
  subscriptionPeriodEnd: string;
  subscriptionPeriodStart: string;
}>;

const stripeSubscriptionContext = (
  subscription: Stripe.Subscription,
): StripeSubscriptionContext => {
  const record = subscription as unknown as Record<string, unknown>;
  const items = isRecord(record.items) && Array.isArray(record.items.data) ? record.items.data : [];
  const item = items.at(0);
  const price = isRecord(item) && isRecord(item.price) ? item.price : null;
  const recurring = price !== null && isRecord(price.recurring) ? price.recurring : null;
  const interval = recurring?.interval;
  if (items.length !== 1 || (interval !== "month" && interval !== "year")) {
    throw new WebPaymentProviderError("unavailable");
  }
  if (typeof record.cancel_at_period_end !== "boolean") {
    throw new WebPaymentProviderError("unavailable");
  }
  return Object.freeze({
    cancelAtPeriodEnd: record.cancel_at_period_end,
    orderId: requireStripeOrderId(metadataOrderId(subscription)),
    productCode: requireStripeProductCode(metadataProductCode(subscription)),
    providerCustomerId: requireStripeProviderId(stripeRecordId(record.customer)),
    providerSubscriptionId: requireStripeProviderId(record.id),
    subscriptionInterval: interval,
    subscriptionPeriodEnd: requireStripeUnixInstant(record.current_period_end),
    subscriptionPeriodStart: requireStripeUnixInstant(record.current_period_start),
  });
};

const stripeInvoiceSubscriptionId = (invoice: unknown): string | null => {
  if (!isRecord(invoice)) return null;
  const direct = stripeRecordId(invoice.subscription);
  if (direct !== null) return direct;
  if (!isRecord(invoice.parent) || !isRecord(invoice.parent.subscription_details)) return null;
  return stripeRecordId(invoice.parent.subscription_details.subscription);
};

const stripeInvoiceContext = async (
  stripe: Stripe,
  invoice: unknown,
): Promise<Readonly<{ context: StripeSubscriptionContext; invoice: Record<string, unknown> }>> => {
  if (!isRecord(invoice)) throw new WebPaymentProviderError("unavailable");
  const providerSubscriptionId = stripeInvoiceSubscriptionId(invoice);
  if (providerSubscriptionId === null) throw new WebPaymentProviderError("unavailable");
  const context = stripeSubscriptionContext(
    await stripe.subscriptions.retrieve(requireStripeProviderId(providerSubscriptionId)),
  );
  if (
    context.providerSubscriptionId !== providerSubscriptionId ||
    context.providerCustomerId !== requireStripeProviderId(stripeRecordId(invoice.customer))
  ) {
    throw new WebPaymentProviderError("unavailable");
  }
  return Object.freeze({ context, invoice });
};

const subscriptionEvent = (
  context: StripeSubscriptionContext,
  input: Readonly<{
    amountMinor: number | null;
    currencyCode: string | null;
    event: Stripe.Event;
    providerChargeId: string | null;
    providerInvoiceId: string | null;
    providerObjectId: string;
    type: VerifiedStripeSubscriptionEvent["type"];
  }>,
): VerifiedStripeSubscriptionEvent =>
  Object.freeze({
    amount:
      input.amountMinor === null || input.currencyCode === null
        ? null
        : createMoney(input.amountMinor, input.currencyCode),
    cancelAtPeriodEnd: context.cancelAtPeriodEnd,
    eventId: requireStripeProviderId(input.event.id),
    occurredAt: requireStripeUnixInstant(input.event.created),
    orderId: context.orderId,
    productCode: context.productCode,
    providerChargeId: input.providerChargeId,
    providerCustomerId: context.providerCustomerId,
    providerId: stripeHostedCheckoutProviderId,
    providerInvoiceId: input.providerInvoiceId,
    providerObjectId: input.providerObjectId,
    providerSubscriptionId: context.providerSubscriptionId,
    subscriptionInterval: context.subscriptionInterval,
    subscriptionPeriodEnd: context.subscriptionPeriodEnd,
    subscriptionPeriodStart: context.subscriptionPeriodStart,
    type: input.type,
  });

export const verifiedStripeSubscriptionEvent = async (
  stripe: Stripe,
  event: Stripe.Event,
): Promise<VerifiedStripeSubscriptionEvent> => {
  if (event.livemode !== false) throw new WebPaymentProviderError("unavailable");
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const providerSubscriptionId = stripeExpandableId(session.subscription);
      if (session.mode !== "subscription" || providerSubscriptionId === null) {
        throw new WebPaymentProviderError("unavailable");
      }
      const context = stripeSubscriptionContext(
        await stripe.subscriptions.retrieve(requireStripeProviderId(providerSubscriptionId)),
      );
      const orderId = requireStripeOrderId(session.client_reference_id ?? metadataOrderId(session));
      if (context.orderId !== orderId) throw new WebPaymentProviderError("unavailable");
      return subscriptionEvent(context, {
        amountMinor: null,
        currencyCode: null,
        event,
        providerChargeId: null,
        providerInvoiceId: null,
        providerObjectId: requireStripeProviderId(session.id),
        type: "subscription_checkout_completed",
      });
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const context = stripeSubscriptionContext(event.data.object as Stripe.Subscription);
      return subscriptionEvent(context, {
        amountMinor: null,
        currencyCode: null,
        event,
        providerChargeId: null,
        providerInvoiceId: null,
        providerObjectId: context.providerSubscriptionId,
        type:
          event.type === "customer.subscription.created"
            ? "subscription_created"
            : event.type === "customer.subscription.updated"
              ? "subscription_changed"
              : "subscription_canceled",
      });
    }
    case "invoice.paid":
    case "invoice.payment_failed":
    case "invoice.payment_action_required": {
      const { context, invoice } = await stripeInvoiceContext(stripe, event.data.object);
      const amountMinor = requireStripeAmount(
        event.type === "invoice.paid" ? invoice.amount_paid : invoice.amount_due,
      );
      const providerInvoiceId = requireStripeProviderId(invoice.id);
      return subscriptionEvent(context, {
        amountMinor,
        currencyCode: requireStripeCurrency(invoice.currency),
        event,
        providerChargeId: null,
        providerInvoiceId,
        providerObjectId: providerInvoiceId,
        type:
          event.type === "invoice.paid"
            ? "subscription_period_paid"
            : "subscription_payment_failed",
      });
    }
    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      const chargeRecord = charge as unknown as Record<string, unknown>;
      const providerChargeId = requireStripeProviderId(chargeRecord.id);
      const providerInvoiceId = stripeRecordId(chargeRecord.invoice);
      if (providerInvoiceId === null) throw new WebPaymentProviderError("unavailable");
      const { context, invoice } = await stripeInvoiceContext(
        stripe,
        await stripe.invoices.retrieve(requireStripeProviderId(providerInvoiceId)),
      );
      const currencyCode = requireStripeCurrency(chargeRecord.currency);
      const amountMinor = requireStripeAmount(chargeRecord.amount);
      const refundedAmountMinor = requireStripeAmount(chargeRecord.amount_refunded);
      if (currencyCode !== requireStripeCurrency(invoice.currency)) {
        throw new WebPaymentProviderError("unavailable");
      }
      if (refundedAmountMinor !== amountMinor) {
        throw new WebPaymentProviderError("unavailable");
      }
      return subscriptionEvent(context, {
        amountMinor: refundedAmountMinor,
        currencyCode,
        event,
        providerChargeId,
        providerInvoiceId,
        providerObjectId: providerChargeId,
        type: "subscription_refunded",
      });
    }
    default:
      throw new WebPaymentProviderError("unavailable");
  }
};

export const verifiedStripePaymentEvent = async (
  stripe: Stripe,
  event: Stripe.Event,
): Promise<VerifiedStripePaymentEvent> => {
  if (event.livemode !== false) throw new WebPaymentProviderError("unavailable");
  const occurredAt = new Date(event.created * 1_000).toISOString();
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
    case "checkout.session.async_payment_failed":
    case "checkout.session.expired": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== "payment") throw new WebPaymentProviderError("unavailable");
      const type =
        event.type === "checkout.session.completed"
          ? session.payment_status === "paid"
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
        type: "payment_disputed",
      });
    }
    default:
      throw new WebPaymentProviderError("unavailable");
  }
};

const stripeSandboxWebhookEventTypes = new Set([
  "charge.dispute.created",
  "charge.refunded",
  "checkout.session.async_payment_failed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.completed",
  "checkout.session.expired",
]);

const stripeSandboxSubscriptionWebhookEventTypes = new Set([
  "charge.refunded",
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.deleted",
  "customer.subscription.updated",
  "invoice.paid",
  "invoice.payment_action_required",
  "invoice.payment_failed",
]);

export const createStripeGateway = (
  input: {
    accountId: string;
    priceIds: Readonly<Record<string, string>>;
    secretKey: string;
    webhookSecret: string;
  },
  stripe = new Stripe(input.secretKey, { maxNetworkRetries: 2, timeout: 10_000 }),
): Readonly<{
  attestAccount: () => Promise<void>;
  gateway: StripeGateway;
  mapVerifiedEvent: (value: unknown) => NormalizedPaymentEventV1;
  mapVerifiedSubscriptionEvent: (value: unknown) => NormalizedSubscriptionEventV1;
  requestRefund: WebPaymentProviderRegistry["requestStripeRefund"];
}> => {
  let accountVerification: Promise<void> | undefined;
  const verifyAccount = async (): Promise<void> => {
    accountVerification ??= stripe.accounts.retrieveCurrent().then((account) => {
      if (account.id !== input.accountId) {
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
        price.livemode ||
        !price.active ||
        price.type !== "one_time" ||
        price.currency.toUpperCase() !== request.currencyCode ||
        price.unit_amount !== request.unitAmountMinor
      ) {
        throw new WebPaymentProviderError("configuration");
      }
      const session = await stripe.checkout.sessions.create(
        {
          cancel_url: request.cancelUrl,
          client_reference_id: request.clientReferenceId,
          line_items: [{ price: price.id, quantity: 1 }],
          metadata: request.metadata,
          mode: "payment",
          payment_intent_data: { metadata: request.metadata },
          success_url: request.returnUrl,
        },
        { idempotencyKey: request.idempotencyKey },
      );
      if (session.url === null || session.livemode || !session.id.startsWith("cs_test_")) {
        throw new WebPaymentProviderError("unavailable");
      }
      return Object.freeze({
        expiresAt: new Date(session.expires_at * 1_000).toISOString(),
        id: session.id,
        url: session.url,
      });
    },
    async createSubscriptionCheckoutSession(
      request: Parameters<NonNullable<StripeGateway["createSubscriptionCheckoutSession"]>>[0],
    ) {
      await verifyAccount();
      const priceId = input.priceIds[request.metadata.productCode];
      if (priceId === undefined) throw new WebPaymentProviderError("configuration");
      const price = await stripe.prices.retrieve(priceId);
      if (
        price.livemode ||
        !price.active ||
        price.type !== "recurring" ||
        price.currency.toUpperCase() !== request.currencyCode ||
        price.unit_amount !== request.unitAmountMinor ||
        price.recurring?.interval !== request.subscriptionInterval
      ) {
        throw new WebPaymentProviderError("configuration");
      }
      const session = await stripe.checkout.sessions.create(
        {
          cancel_url: request.cancelUrl,
          client_reference_id: request.clientReferenceId,
          line_items: [{ price: price.id, quantity: 1 }],
          metadata: request.metadata,
          mode: "subscription",
          subscription_data: { metadata: request.metadata },
          success_url: request.returnUrl,
        },
        { idempotencyKey: request.idempotencyKey },
      );
      if (session.url === null || session.livemode || !session.id.startsWith("cs_test_")) {
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
      return verifiedStripePaymentEvent(stripe, event);
    },
    async verifySubscriptionWebhook({
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
      if (!stripeSandboxSubscriptionWebhookEventTypes.has(event.type)) {
        throw new WebPaymentProviderError("unavailable");
      }
      return verifiedStripeSubscriptionEvent(stripe, event);
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
        type: value.type as NormalizedPaymentEventV1["type"],
      });
    },
    mapVerifiedSubscriptionEvent(value): NormalizedSubscriptionEventV1 {
      if (!isRecord(value)) throw new WebPaymentProviderError("unavailable");
      return Object.freeze({
        amount:
          value.amount === null
            ? null
            : createMoney(
                isRecord(value.amount) ? value.amount.amountMinor : undefined,
                isRecord(value.amount) ? value.amount.currencyCode : undefined,
              ),
        cancelAtPeriodEnd: value.cancelAtPeriodEnd as boolean,
        eventId: value.eventId as string,
        occurredAt: value.occurredAt as string,
        orderId: value.orderId as string,
        productCode: value.productCode as string,
        providerChargeId: value.providerChargeId as string | null,
        providerCustomerId: value.providerCustomerId as string,
        providerId: value.providerId as string,
        providerInvoiceId: value.providerInvoiceId as string | null,
        providerObjectId: value.providerObjectId as string,
        providerSubscriptionId: value.providerSubscriptionId as string,
        subscriptionInterval: value.subscriptionInterval as "month" | "year",
        subscriptionPeriodEnd: value.subscriptionPeriodEnd as string,
        subscriptionPeriodStart: value.subscriptionPeriodStart as string,
        type: value.type as NormalizedSubscriptionEventV1["type"],
      });
    },
    async requestRefund(request) {
      await verifyAccount();
      let refund: Stripe.Refund;
      try {
        refund = await stripe.refunds.create(
          {
            amount: request.amountMinor,
            metadata: { orderId: request.orderId },
            payment_intent: request.paymentIntentId,
          },
          { idempotencyKey: request.idempotencyKey },
        );
      } catch (error) {
        if (error instanceof Stripe.errors.StripeInvalidRequestError) {
          throw new WebPaymentProviderError("rejected");
        }
        throw new WebPaymentProviderError("unavailable");
      }
      const paymentIntentId = stripeExpandableId(refund.payment_intent);
      if (
        refund.amount !== request.amountMinor ||
        refund.metadata?.orderId !== request.orderId ||
        paymentIntentId !== request.paymentIntentId ||
        !refund.id.startsWith("re_") ||
        !["pending", "requires_action", "succeeded"].includes(refund.status ?? "")
      ) {
        if (["canceled", "failed"].includes(refund.status ?? "")) {
          throw new WebPaymentProviderError("rejected");
        }
        throw new WebPaymentProviderError("unavailable");
      }
      return Object.freeze({ providerRefundId: refund.id });
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
        mapVerifiedSubscriptionEvent: stripeRuntime.mapVerifiedSubscriptionEvent,
      }),
      stripeAccountAttestation: stripeRuntime.attestAccount,
      stripeAccountAttestationIdentity: configurationFingerprint(
        `${configuration.payment.accountId}\0${configuration.payment.secretKey}`,
      ),
      stripeAccountFingerprint: configuration.payment.accountId,
      stripeRefund: stripeRuntime.requestRefund,
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
