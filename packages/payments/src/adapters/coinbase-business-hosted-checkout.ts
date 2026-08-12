import { CommerceError } from "../errors.js";
import {
  parseHostedCryptoReconciliationResultV1,
  parseHostedCryptoWebhookEventV1,
  validateCreateHostedCryptoCheckoutInput,
  validateHostedCryptoCheckout,
  validateHostedCryptoReconciliationInput,
  type CreateHostedCryptoCheckoutInput,
  type HostedCryptoCheckout,
  type HostedCryptoCheckoutAdapter,
  type HostedCryptoReconciliationResultV1,
  type HostedCryptoWebhookEventV1,
  type ReconcileHostedCryptoCheckoutInput,
} from "../hosted-crypto-checkout.js";
import { webhookMaximumRawBodyBytes, type RawWebhookRequest } from "../webhook.js";

export const coinbaseBusinessProviderId = "coinbase_usdc_base";
export const coinbaseBusinessHostedCheckoutOrigin = "https://payments.coinbase.com";
export const coinbaseBusinessWebhookSignatureHeaderName = "x-hook0-signature";

export type CoinbaseBusinessCheckoutRequest = Readonly<{
  cancelUrl: string;
  idempotencyKey: string;
  metadata: Readonly<{ orderId: string; productCode: string }>;
  price: Readonly<{
    assetCode: "USDC";
    currencyCode: "USD";
    networkCode: "base";
    usdAmountMinor: number;
    usdcAmountDecimal: string;
  }>;
  productName: string;
  redirectUrl: string;
}>;

export type CoinbaseBusinessCheckoutResult = Readonly<{
  expiresAt: string;
  id: string;
  url: string;
}>;

export type CoinbaseBusinessWebhookVerificationInput = Readonly<{
  headers: Readonly<Record<string, string | undefined>>;
  nowSeconds: number;
  rawBody: Uint8Array;
  signatureHeader: string;
  toleranceSeconds: 300;
}>;

export type CoinbaseBusinessReconciliationRequest = Readonly<{
  checkoutId: string;
  orderId: string;
  providerId: typeof coinbaseBusinessProviderId;
}>;

export interface CoinbaseBusinessGateway {
  createCheckout(request: CoinbaseBusinessCheckoutRequest): Promise<CoinbaseBusinessCheckoutResult>;
  reconcileCheckout(request: CoinbaseBusinessReconciliationRequest): Promise<unknown>;
  verifyWebhook(input: CoinbaseBusinessWebhookVerificationInput): Promise<unknown>;
}

export type CoinbaseBusinessReconciliationMapper = (
  providerResult: unknown,
) => HostedCryptoReconciliationResultV1;

export type CoinbaseBusinessVerifiedWebhookMapper = (
  verifiedProviderEvent: unknown,
) => HostedCryptoWebhookEventV1;

const nowSecondsFromClock = (clock: () => string): number => {
  const value = clock();
  const milliseconds = Date.parse(value);
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value) ||
    !Number.isFinite(milliseconds)
  ) {
    throw new CommerceError("CHECKOUT_CONFIGURATION_INVALID");
  }
  return Math.floor(milliseconds / 1_000);
};

const readWebhookSignatureHeader = (
  headers: Readonly<Record<string, string | undefined>>,
): string => {
  let match: string | undefined;
  for (const [name, value] of Object.entries(headers)) {
    if (name.toLowerCase() !== coinbaseBusinessWebhookSignatureHeaderName || value === undefined) {
      continue;
    }
    if (match !== undefined) throw new CommerceError("WEBHOOK_INVALID");
    match = value;
  }
  if (match === undefined || match.length === 0 || match.length > 4_096) {
    throw new CommerceError("WEBHOOK_INVALID");
  }
  return match;
};

export const createCoinbaseBusinessHostedCheckoutAdapter = (input: {
  clock: () => string;
  gateway: CoinbaseBusinessGateway;
  mapReconciliationResult: CoinbaseBusinessReconciliationMapper;
  mapVerifiedWebhookEvent: CoinbaseBusinessVerifiedWebhookMapper;
}): HostedCryptoCheckoutAdapter =>
  Object.freeze({
    providerId: coinbaseBusinessProviderId,
    createCheckout: async (
      checkoutInput: CreateHostedCryptoCheckoutInput,
    ): Promise<HostedCryptoCheckout> => {
      const urls = validateCreateHostedCryptoCheckoutInput(checkoutInput);
      if (
        checkoutInput.providerId !== coinbaseBusinessProviderId ||
        urls.returnUrl.protocol !== "https:" ||
        urls.cancelUrl.protocol !== "https:"
      ) {
        throw new CommerceError("COMMERCE_INPUT_INVALID");
      }
      let result: CoinbaseBusinessCheckoutResult;
      try {
        result = await input.gateway.createCheckout(
          Object.freeze({
            cancelUrl: urls.cancelUrl.toString(),
            idempotencyKey: checkoutInput.idempotencyKey,
            metadata: Object.freeze({
              orderId: checkoutInput.orderId,
              productCode: checkoutInput.productCode,
            }),
            price: Object.freeze({
              assetCode: urls.settlementQuote.assetCode,
              currencyCode: "USD",
              networkCode: urls.settlementQuote.networkCode,
              usdAmountMinor: urls.settlementQuote.usdAmount.amountMinor,
              usdcAmountDecimal: urls.settlementQuote.usdcAmountDecimal,
            }),
            productName: checkoutInput.productName,
            redirectUrl: urls.returnUrl.toString(),
          }),
        );
      } catch {
        throw new CommerceError("CHECKOUT_PROVIDER_FAILURE");
      }
      const checkout = validateHostedCryptoCheckout(
        {
          checkoutId: result.id,
          expiresAt: result.expiresAt,
          providerId: coinbaseBusinessProviderId,
          settlementQuote: urls.settlementQuote,
          url: result.url,
        },
        coinbaseBusinessProviderId,
      );
      if (new URL(checkout.url).origin !== coinbaseBusinessHostedCheckoutOrigin) {
        throw new CommerceError("CHECKOUT_PROVIDER_FAILURE");
      }
      return checkout;
    },
    reconcileCheckout: async (
      reconcileInput: ReconcileHostedCryptoCheckoutInput,
    ): Promise<HostedCryptoReconciliationResultV1> => {
      const normalized = validateHostedCryptoReconciliationInput(reconcileInput);
      if (normalized.providerId !== coinbaseBusinessProviderId) {
        throw new CommerceError("COMMERCE_INPUT_INVALID");
      }
      let result: unknown;
      try {
        result = await input.gateway.reconcileCheckout(
          Object.freeze({
            checkoutId: normalized.checkoutId,
            orderId: normalized.orderId,
            providerId: coinbaseBusinessProviderId,
          }),
        );
      } catch {
        throw new CommerceError("CHECKOUT_PROVIDER_FAILURE");
      }
      try {
        const reconciliation = parseHostedCryptoReconciliationResultV1(
          input.mapReconciliationResult(result),
        );
        if (
          reconciliation.providerId !== coinbaseBusinessProviderId ||
          reconciliation.orderId !== normalized.orderId ||
          reconciliation.providerCheckoutSessionId !== normalized.checkoutId
        ) {
          throw new CommerceError("WEBHOOK_INVALID");
        }
        return reconciliation;
      } catch {
        throw new CommerceError("WEBHOOK_INVALID");
      }
    },
    verifyWebhook: async (request: RawWebhookRequest) => {
      if (
        !(request.rawBody instanceof Uint8Array) ||
        request.rawBody.byteLength === 0 ||
        request.rawBody.byteLength > webhookMaximumRawBodyBytes
      ) {
        throw new CommerceError("WEBHOOK_INVALID");
      }
      let verified: unknown;
      try {
        verified = await input.gateway.verifyWebhook({
          headers: Object.freeze({ ...request.headers }),
          nowSeconds: nowSecondsFromClock(input.clock),
          rawBody: request.rawBody.slice(),
          signatureHeader: readWebhookSignatureHeader(request.headers),
          toleranceSeconds: 300,
        });
      } catch {
        throw new CommerceError("WEBHOOK_INVALID");
      }
      try {
        const event = parseHostedCryptoWebhookEventV1(input.mapVerifiedWebhookEvent(verified));
        if (event.providerId !== coinbaseBusinessProviderId) {
          throw new CommerceError("WEBHOOK_INVALID");
        }
        return event;
      } catch {
        throw new CommerceError("WEBHOOK_INVALID");
      }
    },
  });
