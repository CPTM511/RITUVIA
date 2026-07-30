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
  type HostedCheckoutAdapter,
  type RawWebhookRequest,
} from "@rituvia/payments";

import { getWebRuntimeConfiguration } from "../config/server";
import { WebCommerceError } from "./commerce";
import { loadWebPaymentWebhookDatabase } from "./payment-webhook-database";
import {
  loadWebPaymentProviderRegistry,
  stripeHostedCheckoutProviderId,
  type WebPaymentProviderRegistry,
} from "./payment-provider";

const stripeEventNormalizationVersion = "stripe-commercial-event.v1";
const stripeSignatureVerifierVersion = "stripe-signature.v1";
const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

export type StripeWebhookApplicationDependencies = Readonly<{
  clock(): string;
  paymentProvider: HostedCheckoutAdapter;
  paymentProviders: Pick<WebPaymentProviderRegistry, "accountFingerprint">;
  persistence: CommercialPaymentEventPersistence;
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

const mapError = (error: unknown): never => {
  if (error instanceof WebCommerceError) throw error;
  if (error instanceof CommercialPaymentEventPersistenceError) {
    throw new WebCommerceError(
      error.code === "COMMERCIAL_PAYMENT_EVENT_CONFLICT" ? "webhook_invalid" : "unavailable",
    );
  }
  if (error instanceof CommerceError) {
    throw new WebCommerceError("webhook_invalid");
  }
  throw new WebCommerceError("unavailable");
};

export const createStripeWebhookApplicationService = (
  dependencies: StripeWebhookApplicationDependencies,
) => {
  if (dependencies.paymentProvider.providerId !== stripeHostedCheckoutProviderId) {
    throw new WebCommerceError("unavailable");
  }
  return Object.freeze({
    async processWebhook(request: RawWebhookRequest) {
      try {
        const receivedAt = requireInstant(dependencies.clock());
        const envelope = readSignedWebhookEnvelope(request, {
          nowSeconds: Math.floor(Date.parse(receivedAt) / 1_000),
          signatureHeaderName: "stripe-signature",
        });
        const event = await dependencies.paymentProvider.verifyWebhook(request);
        if (
          event.providerId !== stripeHostedCheckoutProviderId ||
          !uuidV4Pattern.test(event.orderId) ||
          event.providerCheckoutSessionId === null
        ) {
          throw new WebCommerceError("webhook_invalid");
        }
        return await dependencies.persistence.processStripeSandboxEvent(
          {
            amountMinor: event.amount.amountMinor,
            currencyCode: event.amount.currencyCode,
            eventType: event.type,
            normalizationVersion: stripeEventNormalizationVersion,
            occurredAt: event.occurredAt,
            orderId: event.orderId,
            payloadDigest: sha256(request.rawBody),
            providerAccountFingerprint: dependencies.paymentProviders.accountFingerprint(
              stripeHostedCheckoutProviderId,
            ),
            providerCheckoutId: event.providerCheckoutSessionId,
            providerEventId: event.eventId,
            providerObjectId: event.providerObjectId,
            providerPaymentIntentId: event.providerPaymentIntentId,
            receivedAt,
            signatureTimestampSeconds: envelope.signatureTimestampSeconds,
            verifierVersion: stripeSignatureVerifierVersion,
          },
          reduceCommercialPaymentTimeline,
        );
      } catch (error) {
        return mapError(error);
      }
    },
  });
};

export type StripeWebhookApplicationService = ReturnType<
  typeof createStripeWebhookApplicationService
>;

let service: StripeWebhookApplicationService | undefined;

export const loadWebStripeWebhookApplicationService = (): StripeWebhookApplicationService => {
  if (service !== undefined) return service;
  const configuration = getWebRuntimeConfiguration();
  if (
    configuration.deploymentEnvironment === "production" ||
    configuration.payment?.provider !== "stripe"
  ) {
    throw new WebCommerceError("unavailable");
  }
  const paymentProviders = loadWebPaymentProviderRegistry();
  paymentProviders.assertAccountAttested(stripeHostedCheckoutProviderId);
  service = createStripeWebhookApplicationService({
    clock: () => new Date().toISOString(),
    paymentProvider: paymentProviders.get(stripeHostedCheckoutProviderId),
    paymentProviders,
    persistence: createCommercialPaymentEventPersistence(loadWebPaymentWebhookDatabase()),
  });
  return service;
};
