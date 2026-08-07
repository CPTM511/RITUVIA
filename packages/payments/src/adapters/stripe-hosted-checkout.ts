import { CommerceError } from "../errors.js";
import {
  validateCreateHostedCheckoutInput,
  validateHostedCheckout,
  type CreateHostedCheckoutInput,
  type HostedCheckout,
  type HostedCheckoutAdapter,
} from "../hosted-checkout.js";
import { parseNormalizedPaymentEventV1, type NormalizedPaymentEventV1 } from "../order.js";
import { readSignedWebhookEnvelope, type RawWebhookRequest } from "../webhook.js";

export type StripeCheckoutSessionRequest = Readonly<{
  billingInterval: "month" | "one_time" | "year";
  cancelUrl: string;
  clientReferenceId: string;
  countryCode: string;
  currencyCode: string;
  idempotencyKey: string;
  metadata: Readonly<{ orderId: string; productCode: string }>;
  mode: "payment" | "subscription";
  productName: string;
  quantity: 1;
  returnUrl: string;
  unitAmountMinor: number;
}>;

export type StripeCheckoutSessionResult = Readonly<{
  expiresAt: string;
  id: string;
  url: string;
}>;

export interface StripeGateway {
  createCheckoutSession(
    request: StripeCheckoutSessionRequest,
  ): Promise<StripeCheckoutSessionResult>;
  verifyWebhook(input: {
    nowSeconds: number;
    rawBody: Uint8Array;
    signatureHeader: string;
    toleranceSeconds: 300;
  }): Promise<unknown>;
}

export type StripeVerifiedEventMapper = (
  verifiedProviderEvent: unknown,
) => NormalizedPaymentEventV1;

export const createStripeHostedCheckoutAdapter = (input: {
  clock: () => string;
  gateway: StripeGateway;
  mapVerifiedEvent: StripeVerifiedEventMapper;
}): HostedCheckoutAdapter => {
  const nowSeconds = (): number => {
    const value = input.clock();
    const milliseconds = Date.parse(value);
    if (
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value) ||
      !Number.isFinite(milliseconds)
    ) {
      throw new CommerceError("CHECKOUT_CONFIGURATION_INVALID");
    }
    return Math.floor(milliseconds / 1_000);
  };

  return Object.freeze({
    providerId: "stripe",
    createCheckout: async (checkoutInput: CreateHostedCheckoutInput): Promise<HostedCheckout> => {
      const urls = validateCreateHostedCheckoutInput(checkoutInput);
      if (
        checkoutInput.providerId !== "stripe" ||
        urls.returnUrl.protocol !== "https:" ||
        urls.cancelUrl.protocol !== "https:"
      ) {
        throw new CommerceError("COMMERCE_INPUT_INVALID");
      }
      let result: StripeCheckoutSessionResult;
      try {
        const mode =
          checkoutInput.billingInterval === undefined ||
          checkoutInput.billingInterval === "one_time"
            ? "payment"
            : "subscription";
        result = await input.gateway.createCheckoutSession(
          Object.freeze({
            cancelUrl: urls.cancelUrl.toString(),
            billingInterval: checkoutInput.billingInterval ?? "one_time",
            clientReferenceId: checkoutInput.orderId,
            countryCode: checkoutInput.countryCode,
            currencyCode: checkoutInput.amount.currencyCode,
            idempotencyKey: checkoutInput.idempotencyKey,
            metadata: Object.freeze({
              orderId: checkoutInput.orderId,
              productCode: checkoutInput.productCode,
            }),
            mode,
            productName: checkoutInput.productName,
            quantity: 1,
            returnUrl: urls.returnUrl.toString(),
            unitAmountMinor: checkoutInput.amount.amountMinor,
          }),
        );
      } catch {
        throw new CommerceError("CHECKOUT_PROVIDER_FAILURE");
      }
      return validateHostedCheckout(
        {
          checkoutId: result.id,
          expiresAt: result.expiresAt,
          providerId: "stripe",
          url: result.url,
        },
        "stripe",
      );
    },
    verifyWebhook: async (request: RawWebhookRequest) => {
      const receivedAtSeconds = nowSeconds();
      const envelope = readSignedWebhookEnvelope(request, {
        nowSeconds: receivedAtSeconds,
        signatureHeaderName: "stripe-signature",
      });
      let verified: unknown;
      try {
        verified = await input.gateway.verifyWebhook({
          nowSeconds: receivedAtSeconds,
          rawBody: envelope.rawBody,
          signatureHeader: envelope.signatureHeader,
          toleranceSeconds: 300,
        });
      } catch {
        throw new CommerceError("WEBHOOK_INVALID");
      }
      try {
        const event = parseNormalizedPaymentEventV1(input.mapVerifiedEvent(verified));
        if (event.providerId !== "stripe") throw new CommerceError("WEBHOOK_INVALID");
        return event;
      } catch {
        throw new CommerceError("WEBHOOK_INVALID");
      }
    },
  });
};
