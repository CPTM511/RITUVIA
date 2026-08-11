import "server-only";

import { createHash } from "node:crypto";

import {
  CommercialPaymentEventPersistenceError,
  createCommercialPaymentEventPersistence,
  type CommercialPaymentEventPersistence,
} from "@rituvia/db";
import {
  CommerceError,
  readSignedWebhookEnvelope,
  reduceCommercialPaymentTimeline,
  type HostedCryptoCheckoutAdapter,
  type HostedCryptoSettlementStatus,
  type RawWebhookRequest,
} from "@rituvia/payments";
import {
  coinbaseBusinessProviderId,
  coinbaseBusinessWebhookSignatureHeaderName,
  createCoinbaseBusinessHostedCheckoutAdapter,
} from "@rituvia/payments/adapters/coinbase-business";

import { getWebRuntimeConfiguration } from "../config/server";
import {
  createRecoveryItem11CoinbaseBusinessGateway,
  mapCoinbaseBusinessReconciliationResult,
  mapCoinbaseBusinessVerifiedWebhookEvent,
} from "./coinbase-business-gateway";
import { WebCommerceError } from "./commerce";
import { loadWebPaymentWebhookDatabase } from "./payment-webhook-database";

const recoveryScope = "D-098:OWNER:item-11:protected-staging" as const;
const normalizationVersion = "coinbase-business-sandbox-event.v1";
const verifierVersion = "coinbase-business-hook0-signature.v1";
const maximumMinorAmount = 2_147_483_647;
const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

export type CoinbaseWebhookApplicationDependencies = Readonly<{
  clock(): string;
  paymentProvider: HostedCryptoCheckoutAdapter;
  persistence: CommercialPaymentEventPersistence;
  providerAccountFingerprint: string;
  recoveryScope: typeof recoveryScope;
}>;

const requireInstant = (value: string): string => {
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== value) {
    throw new WebCommerceError("unavailable");
  }
  return value;
};

const sha256 = (value: Uint8Array): Uint8Array<ArrayBuffer> =>
  new Uint8Array(createHash("sha256").update(value).digest());

const amountMinorFromUsdc = (value: string): number => {
  if (!/^(?:0|[1-9][0-9]{0,15})(?:\.[0-9]{1,2})?$/u.test(value)) {
    throw new WebCommerceError("webhook_invalid");
  }
  const [whole, fraction = ""] = value.split(".");
  const amountMinor = Number(`${whole}${fraction.padEnd(2, "0")}`);
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 1 || amountMinor > maximumMinorAmount) {
    throw new WebCommerceError("webhook_invalid");
  }
  return amountMinor;
};

const eventTypeFor = (
  status: HostedCryptoSettlementStatus,
):
  | "payment_expired"
  | "payment_failed"
  | "payment_pending"
  | "payment_refunded"
  | "payment_succeeded" => {
  switch (status) {
    case "pending":
      return "payment_pending";
    case "confirmed":
      return "payment_succeeded";
    case "failed":
      return "payment_failed";
    case "expired":
      return "payment_expired";
    case "refunded":
      return "payment_refunded";
  }
};

const mapError = (error: unknown): never => {
  if (error instanceof WebCommerceError) throw error;
  if (error instanceof CommercialPaymentEventPersistenceError) {
    throw new WebCommerceError(
      error.code === "COMMERCIAL_PAYMENT_EVENT_CONFLICT" ? "webhook_invalid" : "unavailable",
    );
  }
  if (error instanceof CommerceError || error instanceof TypeError) {
    throw new WebCommerceError("webhook_invalid");
  }
  throw new WebCommerceError("unavailable");
};

export const createCoinbaseWebhookApplicationService = (
  dependencies: CoinbaseWebhookApplicationDependencies,
) => {
  if (
    dependencies.recoveryScope !== recoveryScope ||
    dependencies.paymentProvider.providerId !== coinbaseBusinessProviderId
  ) {
    throw new WebCommerceError("unavailable");
  }
  return Object.freeze({
    async processWebhook(request: RawWebhookRequest) {
      try {
        const receivedAt = requireInstant(dependencies.clock());
        const envelope = readSignedWebhookEnvelope(request, {
          nowSeconds: Math.floor(Date.parse(receivedAt) / 1_000),
          signatureHeaderName: coinbaseBusinessWebhookSignatureHeaderName,
        });
        const event = await dependencies.paymentProvider.verifyWebhook(request);
        if (event.providerId !== coinbaseBusinessProviderId || !uuidV4Pattern.test(event.orderId)) {
          throw new WebCommerceError("webhook_invalid");
        }
        const reconciliation = await dependencies.paymentProvider.reconcileCheckout({
          checkoutId: event.providerCheckoutSessionId,
          orderId: event.orderId,
          providerId: coinbaseBusinessProviderId,
        });
        if (
          reconciliation.providerId !== event.providerId ||
          reconciliation.orderId !== event.orderId ||
          reconciliation.providerCheckoutSessionId !== event.providerCheckoutSessionId ||
          reconciliation.providerObjectId !== event.providerObjectId ||
          reconciliation.status !== event.status ||
          reconciliation.settlement.assetCode !== event.settlement.assetCode ||
          reconciliation.settlement.networkCode !== event.settlement.networkCode ||
          reconciliation.settlement.amountDecimal !== event.settlement.amountDecimal
        ) {
          throw new WebCommerceError("webhook_invalid");
        }
        return await dependencies.persistence.processCoinbaseSandboxEvent(
          {
            amountMinor: amountMinorFromUsdc(reconciliation.settlement.amountDecimal),
            currencyCode: "USD",
            eventType: eventTypeFor(reconciliation.status),
            normalizationVersion,
            observedAsset: "USDC",
            observedNetwork: "base",
            occurredAt: event.occurredAt,
            orderId: event.orderId,
            payloadDigest: sha256(request.rawBody),
            providerAccountFingerprint: dependencies.providerAccountFingerprint,
            providerCheckoutId: event.providerCheckoutSessionId,
            providerEventId: event.eventId,
            providerInvoiceId: null,
            providerObjectId: event.providerObjectId,
            providerPaymentIntentId: null,
            providerEnvironment: "sandbox",
            providerSubscriptionId: null,
            receivedAt,
            recoveryScope,
            signatureTimestampSeconds: envelope.signatureTimestampSeconds,
            subscriptionCancelAtPeriodEnd: null,
            subscriptionPeriodEnd: null,
            subscriptionPeriodStart: null,
            subscriptionState: null,
            verifierVersion,
          },
          reduceCommercialPaymentTimeline,
        );
      } catch (error) {
        return mapError(error);
      }
    },
  });
};

export type CoinbaseWebhookApplicationService = ReturnType<
  typeof createCoinbaseWebhookApplicationService
>;

let service: CoinbaseWebhookApplicationService | undefined;

export const loadWebCoinbaseWebhookApplicationService = (): CoinbaseWebhookApplicationService => {
  if (service !== undefined) return service;
  const configuration = getWebRuntimeConfiguration();
  if (
    configuration.deploymentEnvironment !== "staging" ||
    configuration.recoveryItem11Sandbox === undefined
  ) {
    throw new WebCommerceError("unavailable");
  }
  const coinbase = configuration.recoveryItem11Sandbox.coinbase;
  const clock = () => new Date().toISOString();
  const paymentProvider = createCoinbaseBusinessHostedCheckoutAdapter({
    clock,
    gateway: createRecoveryItem11CoinbaseBusinessGateway({
      ...coinbase,
      clock,
      recoveryScope,
    }),
    mapReconciliationResult: mapCoinbaseBusinessReconciliationResult,
    mapVerifiedWebhookEvent: mapCoinbaseBusinessVerifiedWebhookEvent,
  });
  service = createCoinbaseWebhookApplicationService({
    clock,
    paymentProvider,
    persistence: createCommercialPaymentEventPersistence(loadWebPaymentWebhookDatabase()),
    providerAccountFingerprint: `sha256:${createHash("sha256")
      .update(coinbase.apiKeyId, "utf8")
      .digest("hex")}`,
    recoveryScope,
  });
  return service;
};
