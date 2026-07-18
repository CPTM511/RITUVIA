export const commerceErrorCodes = Object.freeze([
  "CHECKOUT_CONFIGURATION_INVALID",
  "CHECKOUT_PROVIDER_FAILURE",
  "COMMERCE_INPUT_INVALID",
  "COMMERCE_STATE_CONFLICT",
  "PAYMENT_EVENT_MISMATCH",
  "WEBHOOK_INVALID",
  "WEBHOOK_REPLAYED",
] as const);

export type CommerceErrorCode = (typeof commerceErrorCodes)[number];

export class CommerceError extends Error {
  readonly code: CommerceErrorCode;

  constructor(code: CommerceErrorCode) {
    super("The commerce operation could not be completed.");
    this.name = "CommerceError";
    this.code = code;
  }
}
