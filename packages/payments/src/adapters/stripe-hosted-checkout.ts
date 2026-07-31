import { CommerceError } from "../errors.js";
import {
  parseNormalizedSubscriptionEventV1,
  validateCreateHostedCheckoutInput,
  validateCreateSubscriptionCheckoutInput,
  validateHostedCheckout,
  type CreateHostedCheckoutInput,
  type CreateSubscriptionCheckoutInput,
  type HostedCheckout,
  type HostedCheckoutAdapter,
  type NormalizedSubscriptionEventV1,
  type SubscriptionHostedCheckoutAdapter,
} from "../hosted-checkout.js";
import { parseNormalizedPaymentEventV1, type NormalizedPaymentEventV1 } from "../order.js";
import { readSignedWebhookEnvelope, type RawWebhookRequest } from "../webhook.js";

export type StripeCheckoutSessionRequest = Readonly<{
  cancelUrl: string;
  clientReferenceId: string;
  countryCode: string;
  currencyCode: string;
  idempotencyKey: string;
  metadata: Readonly<{ orderId: string; productCode: string }>;
  mode: "payment";
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

export type StripeSubscriptionCheckoutSessionRequest = Readonly<{
  cancelUrl: string;
  clientReferenceId: string;
  countryCode: string;
  currencyCode: string;
  idempotencyKey: string;
  metadata: Readonly<{ orderId: string; productCode: string }>;
  mode: "subscription";
  productName: string;
  quantity: 1;
  returnUrl: string;
  subscriptionInterval: CreateSubscriptionCheckoutInput["subscriptionInterval"];
  unitAmountMinor: number;
}>;

export interface StripeGateway {
  createCheckoutSession(
    request: StripeCheckoutSessionRequest,
  ): Promise<StripeCheckoutSessionResult>;
  createSubscriptionCheckoutSession?(
    request: StripeSubscriptionCheckoutSessionRequest,
  ): Promise<StripeCheckoutSessionResult>;
  verifyWebhook(input: {
    nowSeconds: number;
    rawBody: Uint8Array;
    signatureHeader: string;
    toleranceSeconds: 300;
  }): Promise<unknown>;
  verifySubscriptionWebhook?(input: {
    nowSeconds: number;
    rawBody: Uint8Array;
    signatureHeader: string;
    toleranceSeconds: 300;
  }): Promise<unknown>;
}

export type StripeVerifiedEventMapper = (
  verifiedProviderEvent: unknown,
) => NormalizedPaymentEventV1;

export type StripeVerifiedSubscriptionEventMapper = (
  verifiedProviderEvent: unknown,
) => NormalizedSubscriptionEventV1;

export type StripeHostedCheckoutAdapter = HostedCheckoutAdapter & SubscriptionHostedCheckoutAdapter;

export const createStripeHostedCheckoutAdapter = (input: {
  clock: () => string;
  gateway: StripeGateway;
  mapVerifiedEvent: StripeVerifiedEventMapper;
  mapVerifiedSubscriptionEvent?: StripeVerifiedSubscriptionEventMapper;
}): StripeHostedCheckoutAdapter => {
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

  const verifiedProviderEvent = async (
    request: RawWebhookRequest,
    verify:
      NonNullable<StripeGateway["verifySubscriptionWebhook"]> | StripeGateway["verifyWebhook"],
  ): Promise<unknown> => {
    const receivedAtSeconds = nowSeconds();
    const envelope = readSignedWebhookEnvelope(request, {
      nowSeconds: receivedAtSeconds,
      signatureHeaderName: "stripe-signature",
    });
    try {
      return await verify({
        nowSeconds: receivedAtSeconds,
        rawBody: envelope.rawBody,
        signatureHeader: envelope.signatureHeader,
        toleranceSeconds: 300,
      });
    } catch {
      throw new CommerceError("WEBHOOK_INVALID");
    }
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
        result = await input.gateway.createCheckoutSession(
          Object.freeze({
            cancelUrl: urls.cancelUrl.toString(),
            clientReferenceId: checkoutInput.orderId,
            countryCode: checkoutInput.countryCode,
            currencyCode: checkoutInput.amount.currencyCode,
            idempotencyKey: checkoutInput.idempotencyKey,
            metadata: Object.freeze({
              orderId: checkoutInput.orderId,
              productCode: checkoutInput.productCode,
            }),
            mode: "payment",
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
    createSubscriptionCheckout: async (
      checkoutInput: CreateSubscriptionCheckoutInput,
    ): Promise<HostedCheckout> => {
      const urls = validateCreateSubscriptionCheckoutInput(checkoutInput);
      if (
        checkoutInput.providerId !== "stripe" ||
        urls.returnUrl.protocol !== "https:" ||
        urls.cancelUrl.protocol !== "https:"
      ) {
        throw new CommerceError("COMMERCE_INPUT_INVALID");
      }
      let result: StripeCheckoutSessionResult;
      try {
        const createSubscriptionCheckoutSession = input.gateway.createSubscriptionCheckoutSession;
        if (createSubscriptionCheckoutSession === undefined) {
          throw new CommerceError("CHECKOUT_PROVIDER_FAILURE");
        }
        result = await createSubscriptionCheckoutSession(
          Object.freeze({
            cancelUrl: urls.cancelUrl.toString(),
            clientReferenceId: checkoutInput.orderId,
            countryCode: checkoutInput.countryCode,
            currencyCode: checkoutInput.amount.currencyCode,
            idempotencyKey: checkoutInput.idempotencyKey,
            metadata: Object.freeze({
              orderId: checkoutInput.orderId,
              productCode: checkoutInput.productCode,
            }),
            mode: "subscription",
            productName: checkoutInput.productName,
            quantity: 1,
            returnUrl: urls.returnUrl.toString(),
            subscriptionInterval: checkoutInput.subscriptionInterval,
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
      const verified = await verifiedProviderEvent(
        request,
        input.gateway.verifyWebhook.bind(input.gateway),
      );
      try {
        const event = parseNormalizedPaymentEventV1(input.mapVerifiedEvent(verified));
        if (event.providerId !== "stripe") throw new CommerceError("WEBHOOK_INVALID");
        return event;
      } catch {
        throw new CommerceError("WEBHOOK_INVALID");
      }
    },
    verifySubscriptionWebhook: async (request: RawWebhookRequest) => {
      const verifySubscriptionWebhook = input.gateway.verifySubscriptionWebhook;
      if (
        verifySubscriptionWebhook === undefined ||
        input.mapVerifiedSubscriptionEvent === undefined
      ) {
        throw new CommerceError("WEBHOOK_INVALID");
      }
      const verified = await verifiedProviderEvent(
        request,
        verifySubscriptionWebhook.bind(input.gateway),
      );
      try {
        const event = parseNormalizedSubscriptionEventV1(
          input.mapVerifiedSubscriptionEvent(verified),
        );
        if (event.providerId !== "stripe") throw new CommerceError("WEBHOOK_INVALID");
        return event;
      } catch {
        throw new CommerceError("WEBHOOK_INVALID");
      }
    },
  });
};

export type {
  CreateSubscriptionCheckoutInput,
  NormalizedSubscriptionEventV1,
  SubscriptionHostedCheckoutAdapter,
  SubscriptionInterval,
} from "../hosted-checkout.js";
