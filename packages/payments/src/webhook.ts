import { CommerceError } from "./errors.js";
import { parseNormalizedPaymentEventV1, type NormalizedPaymentEventV1 } from "./order.js";

export const webhookReplayWindowSeconds = 300;
export const webhookMaximumRawBodyBytes = 262_144;

export type RawWebhookRequest = Readonly<{
  headers: Readonly<Record<string, string | undefined>>;
  rawBody: Uint8Array;
}>;

export type SignedWebhookEnvelope = Readonly<{
  rawBody: Uint8Array;
  signatureHeader: string;
  signatureTimestampSeconds: number;
  signatures: readonly string[];
}>;

const headerValue = (
  headers: Readonly<Record<string, string | undefined>>,
  expectedName: string,
): string | undefined => {
  let match: string | undefined;
  for (const [name, value] of Object.entries(headers)) {
    if (name.toLowerCase() !== expectedName.toLowerCase() || value === undefined) continue;
    if (match !== undefined) throw new CommerceError("WEBHOOK_INVALID");
    match = value;
  }
  return match;
};

const parseSignatureHeader = (
  value: string,
): Readonly<{ signatures: readonly string[]; timestampSeconds: number }> => {
  const timestamps: number[] = [];
  const signatures: string[] = [];
  for (const part of value.split(",")) {
    const separator = part.indexOf("=");
    if (separator < 1) throw new CommerceError("WEBHOOK_INVALID");
    const key = part.slice(0, separator).trim();
    const candidate = part.slice(separator + 1).trim();
    if (key === "t") {
      if (!/^[1-9][0-9]{0,11}$/u.test(candidate)) {
        throw new CommerceError("WEBHOOK_INVALID");
      }
      timestamps.push(Number(candidate));
    } else if (key === "v1") {
      if (!/^[0-9a-f]{64}$/u.test(candidate)) throw new CommerceError("WEBHOOK_INVALID");
      signatures.push(candidate);
    }
  }
  if (timestamps.length !== 1 || signatures.length === 0) {
    throw new CommerceError("WEBHOOK_INVALID");
  }
  const timestampSeconds = timestamps.at(0);
  if (timestampSeconds === undefined || !Number.isSafeInteger(timestampSeconds)) {
    throw new CommerceError("WEBHOOK_INVALID");
  }
  return Object.freeze({
    signatures: Object.freeze(signatures),
    timestampSeconds,
  });
};

export const readSignedWebhookEnvelope = (
  request: RawWebhookRequest,
  input: {
    nowSeconds: number;
    signatureHeaderName: string;
  },
): SignedWebhookEnvelope => {
  if (
    !(request.rawBody instanceof Uint8Array) ||
    request.rawBody.byteLength === 0 ||
    request.rawBody.byteLength > webhookMaximumRawBodyBytes ||
    !Number.isSafeInteger(input.nowSeconds) ||
    input.nowSeconds < 1
  ) {
    throw new CommerceError("WEBHOOK_INVALID");
  }
  const signatureHeader = headerValue(request.headers, input.signatureHeaderName);
  if (signatureHeader === undefined || signatureHeader.length > 4_096) {
    throw new CommerceError("WEBHOOK_INVALID");
  }
  const parsed = parseSignatureHeader(signatureHeader);
  if (Math.abs(input.nowSeconds - parsed.timestampSeconds) > webhookReplayWindowSeconds) {
    throw new CommerceError("WEBHOOK_REPLAYED");
  }
  return Object.freeze({
    rawBody: request.rawBody.slice(),
    signatureHeader,
    signatureTimestampSeconds: parsed.timestampSeconds,
    signatures: parsed.signatures,
  });
};

export const parseNormalizedPaymentEventJson = (rawBody: Uint8Array): NormalizedPaymentEventV1 => {
  try {
    const candidate = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(rawBody),
    ) as unknown;
    return parseNormalizedPaymentEventV1(candidate);
  } catch {
    throw new CommerceError("WEBHOOK_INVALID");
  }
};
