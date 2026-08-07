import { CommerceError } from "./errors.js";
import type { Money } from "./money.js";
import type { NormalizedPaymentEventV1 } from "./order.js";
import { parseIdentifier, parseInstant, parseResourceId } from "./validation.js";
import type { RawWebhookRequest } from "./webhook.js";

export type CreateHostedCheckoutInput = Readonly<{
  accountId: string;
  amount: Money;
  billingInterval?: "month" | "one_time" | "year";
  cancelUrl: string;
  countryCode: string;
  idempotencyKey: string;
  orderId: string;
  productCode: string;
  productName: string;
  providerId: string;
  returnUrl: string;
}>;

export type HostedCheckout = Readonly<{
  checkoutId: string;
  expiresAt: string;
  providerId: string;
  url: string;
}>;

export interface HostedCheckoutAdapter {
  readonly providerId: string;
  createCheckout(input: CreateHostedCheckoutInput): Promise<HostedCheckout>;
  verifyWebhook(request: RawWebhookRequest): Promise<NormalizedPaymentEventV1>;
}

const parseAbsoluteUrl = (value: string): URL => {
  try {
    const parsed = new URL(value);
    if (
      (parsed.protocol !== "https:" && parsed.protocol !== "http:") ||
      parsed.username !== "" ||
      parsed.password !== "" ||
      parsed.hash !== ""
    ) {
      throw new CommerceError("COMMERCE_INPUT_INVALID");
    }
    return parsed;
  } catch {
    throw new CommerceError("COMMERCE_INPUT_INVALID");
  }
};

export const validateCreateHostedCheckoutInput = (
  input: CreateHostedCheckoutInput,
): Readonly<{ cancelUrl: URL; returnUrl: URL }> => {
  parseResourceId(input.accountId);
  parseResourceId(input.orderId);
  parseResourceId(input.idempotencyKey);
  parseIdentifier(input.productCode);
  parseIdentifier(input.providerId);
  if (
    input.amount.amountMinor < 1 ||
    !Number.isSafeInteger(input.amount.amountMinor) ||
    !/^[A-Z]{3}$/u.test(input.amount.currencyCode) ||
    !/^[A-Z]{2}$/u.test(input.countryCode) ||
    !["month", "one_time", "year"].includes(input.billingInterval ?? "one_time") ||
    input.productName.length === 0 ||
    input.productName.length > 120 ||
    /[\r\n]/u.test(input.productName)
  ) {
    throw new CommerceError("COMMERCE_INPUT_INVALID");
  }
  return Object.freeze({
    cancelUrl: parseAbsoluteUrl(input.cancelUrl),
    returnUrl: parseAbsoluteUrl(input.returnUrl),
  });
};

export const validateHostedCheckout = (
  value: HostedCheckout,
  expectedProviderId: string,
): HostedCheckout => {
  const parsed = parseAbsoluteUrl(value.url);
  if (value.providerId !== expectedProviderId || parsed.protocol !== "https:") {
    throw new CommerceError("CHECKOUT_PROVIDER_FAILURE");
  }
  return Object.freeze({
    checkoutId: parseResourceId(value.checkoutId),
    expiresAt: parseInstant(value.expiresAt),
    providerId: parseIdentifier(value.providerId),
    url: parsed.toString(),
  });
};
