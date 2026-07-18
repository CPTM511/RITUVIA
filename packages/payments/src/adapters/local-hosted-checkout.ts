import { CommerceError } from "../errors.js";
import {
  validateCreateHostedCheckoutInput,
  type CreateHostedCheckoutInput,
  type HostedCheckout,
  type HostedCheckoutAdapter,
} from "../hosted-checkout.js";
import type { NormalizedPaymentEventV1 } from "../order.js";
import {
  parseNormalizedPaymentEventJson,
  readSignedWebhookEnvelope,
  type RawWebhookRequest,
} from "../webhook.js";

const localProviderId = "local_hosted";
const localSignatureHeaderName = "x-rituvia-local-signature";
const textEncoder = new TextEncoder();

const bytesToHex = (bytes: Uint8Array): string =>
  [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");

const signedPayload = (timestampSeconds: number, body: Uint8Array): Uint8Array => {
  const prefix = textEncoder.encode(`${timestampSeconds}.`);
  const output = new Uint8Array(prefix.byteLength + body.byteLength);
  output.set(prefix, 0);
  output.set(body, prefix.byteLength);
  return output;
};

const ownedBuffer = (bytes: Uint8Array): ArrayBuffer => {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
};

const hmacSha256 = async (secret: Uint8Array, payload: Uint8Array): Promise<Uint8Array> => {
  const key = await crypto.subtle.importKey(
    "raw",
    ownedBuffer(secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, ownedBuffer(payload)));
};

const constantTimeHexMatch = (expected: string, candidates: readonly string[]): boolean => {
  let any = 0;
  for (const candidate of candidates) {
    let difference = expected.length ^ candidate.length;
    const maximum = Math.max(expected.length, candidate.length);
    for (let index = 0; index < maximum; index += 1) {
      difference |= (expected.charCodeAt(index) || 0) ^ (candidate.charCodeAt(index) || 0);
    }
    any |= Number(difference === 0);
  }
  return any === 1;
};

export type SignedLocalWebhook = Readonly<{
  headers: Readonly<Record<typeof localSignatureHeaderName, string>>;
  rawBody: Uint8Array;
}>;

export interface LocalHostedCheckoutAdapter extends HostedCheckoutAdapter {
  createSignedWebhook(event: NormalizedPaymentEventV1): Promise<SignedLocalWebhook>;
}

export const createLocalHostedCheckoutAdapter = (input: {
  clock: () => string;
  environment: "local" | "preview" | "production" | "staging";
  idFactory: () => string;
  origin: string;
  signingSecret: Uint8Array;
}): LocalHostedCheckoutAdapter => {
  if (
    input.environment !== "local" ||
    !(input.signingSecret instanceof Uint8Array) ||
    input.signingSecret.byteLength < 32 ||
    input.signingSecret.byteLength > 128
  ) {
    throw new CommerceError("CHECKOUT_CONFIGURATION_INVALID");
  }
  let origin: URL;
  try {
    origin = new URL(input.origin);
  } catch {
    throw new CommerceError("CHECKOUT_CONFIGURATION_INVALID");
  }
  if (
    origin.protocol !== "http:" ||
    (origin.hostname !== "127.0.0.1" && origin.hostname !== "localhost") ||
    origin.username !== "" ||
    origin.password !== "" ||
    origin.pathname !== "/" ||
    origin.search !== "" ||
    origin.hash !== ""
  ) {
    throw new CommerceError("CHECKOUT_CONFIGURATION_INVALID");
  }
  const secret = input.signingSecret.slice();

  const now = (): Readonly<{ instant: string; seconds: number }> => {
    const instant = input.clock();
    const milliseconds = Date.parse(instant);
    if (
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(instant) ||
      !Number.isFinite(milliseconds)
    ) {
      throw new CommerceError("CHECKOUT_CONFIGURATION_INVALID");
    }
    return Object.freeze({ instant, seconds: Math.floor(milliseconds / 1_000) });
  };

  const createCheckout = async (
    checkoutInput: CreateHostedCheckoutInput,
  ): Promise<HostedCheckout> => {
    const urls = validateCreateHostedCheckoutInput(checkoutInput);
    if (
      checkoutInput.providerId !== localProviderId ||
      urls.returnUrl.origin !== origin.origin ||
      urls.cancelUrl.origin !== origin.origin
    ) {
      throw new CommerceError("COMMERCE_INPUT_INVALID");
    }
    const checkoutId = `local_${input.idFactory()}`;
    if (!/^local_[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(checkoutId)) {
      throw new CommerceError("CHECKOUT_CONFIGURATION_INVALID");
    }
    const timestamp = now();
    const url = new URL("/en/checkout/local", origin);
    url.searchParams.set("checkout_id", checkoutId);
    return Object.freeze({
      checkoutId,
      expiresAt: new Date(Date.parse(timestamp.instant) + 30 * 60 * 1_000).toISOString(),
      providerId: localProviderId,
      url: url.toString(),
    });
  };

  const createSignedWebhook = async (
    event: NormalizedPaymentEventV1,
  ): Promise<SignedLocalWebhook> => {
    if (event.providerId !== localProviderId) throw new CommerceError("COMMERCE_INPUT_INVALID");
    const timestamp = now();
    const rawBody = textEncoder.encode(
      JSON.stringify({
        amount: event.amount,
        eventId: event.eventId,
        occurredAt: event.occurredAt,
        orderId: event.orderId,
        providerCheckoutSessionId: event.providerCheckoutSessionId,
        providerId: event.providerId,
        providerObjectId: event.providerObjectId,
        providerPaymentIntentId: event.providerPaymentIntentId,
        type: event.type,
      }),
    );
    const signature = bytesToHex(
      await hmacSha256(secret, signedPayload(timestamp.seconds, rawBody)),
    );
    return Object.freeze({
      headers: Object.freeze({
        [localSignatureHeaderName]: `t=${timestamp.seconds},v1=${signature}`,
      }) as Readonly<Record<typeof localSignatureHeaderName, string>>,
      rawBody,
    });
  };

  return Object.freeze({
    providerId: localProviderId,
    createCheckout,
    createSignedWebhook,
    verifyWebhook: async (request: RawWebhookRequest) => {
      const timestamp = now();
      const envelope = readSignedWebhookEnvelope(request, {
        nowSeconds: timestamp.seconds,
        signatureHeaderName: localSignatureHeaderName,
      });
      const expected = bytesToHex(
        await hmacSha256(
          secret,
          signedPayload(envelope.signatureTimestampSeconds, envelope.rawBody),
        ),
      );
      if (!constantTimeHexMatch(expected, envelope.signatures)) {
        throw new CommerceError("WEBHOOK_INVALID");
      }
      const event = parseNormalizedPaymentEventJson(envelope.rawBody);
      if (event.providerId !== localProviderId) throw new CommerceError("WEBHOOK_INVALID");
      return event;
    },
  });
};
