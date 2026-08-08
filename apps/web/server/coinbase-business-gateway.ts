import "server-only";

import {
  createHmac,
  createPrivateKey,
  randomBytes,
  sign,
  timingSafeEqual,
  type KeyObject,
} from "node:crypto";

import {
  coinbaseBusinessHostedCheckoutOrigin,
  coinbaseBusinessProviderId,
  type CoinbaseBusinessCheckoutRequest,
  type CoinbaseBusinessCheckoutResult,
  type CoinbaseBusinessGateway,
  type CoinbaseBusinessReconciliationRequest,
  type CoinbaseBusinessWebhookVerificationInput,
} from "@rituvia/payments/adapters/coinbase-business";
import type {
  HostedCryptoReconciliationResultV1,
  HostedCryptoWebhookEventV1,
} from "@rituvia/payments";

const recoveryScope = "D-098:OWNER:item-11:protected-staging" as const;
const sandboxBaseUrl = "https://business.coinbase.com/sandbox/api/v1/checkouts" as const;
const sandboxHost = "business.coinbase.com" as const;
const sandboxPath = "/sandbox/api/v1/checkouts" as const;
const checkoutIdPattern = /^[0-9a-f]{24}$/u;
const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

type FetchResponse = Readonly<{
  json(): Promise<unknown>;
  ok: boolean;
  status: number;
}>;
type FetchLike = (
  input: string,
  init: Readonly<{
    body?: string;
    headers: Readonly<Record<string, string>>;
    method: "GET" | "POST";
    signal: AbortSignal;
  }>,
) => Promise<FetchResponse>;

export type RecoveryItem11CoinbaseBusinessGatewayOptions = Readonly<{
  apiKeyId: string;
  apiKeySecret: string;
  clock(): string;
  fetch?: FetchLike;
  recoveryScope: typeof recoveryScope;
  webhookSecret: string;
}>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const requireInstant = (value: unknown): string => {
  if (typeof value !== "string") throw new TypeError("Coinbase sandbox response is invalid.");
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) {
    throw new TypeError("Coinbase sandbox response is invalid.");
  }
  return new Date(milliseconds).toISOString();
};

const normalizeAmount = (value: unknown): string => {
  if (typeof value !== "string" || !/^(?:0|[1-9][0-9]{0,15})(?:\.[0-9]{1,2})?$/u.test(value)) {
    throw new TypeError("Coinbase sandbox amount is invalid.");
  }
  const [whole, fraction = ""] = value.split(".");
  const normalizedFraction = fraction.replace(/0+$/u, "");
  return normalizedFraction === "" ? whole! : `${whole}.${normalizedFraction}`;
};

const requireCheckoutUrl = (value: unknown): string => {
  if (typeof value !== "string") throw new TypeError("Coinbase sandbox URL is invalid.");
  const parsed = new URL(value);
  if (
    parsed.origin !== coinbaseBusinessHostedCheckoutOrigin ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.hash !== ""
  ) {
    throw new TypeError("Coinbase sandbox URL is invalid.");
  }
  return parsed.toString();
};

const requireMetadata = (value: unknown): Readonly<{ orderId: string; productCode: string }> => {
  if (
    !isRecord(value) ||
    typeof value.orderId !== "string" ||
    !uuidV4Pattern.test(value.orderId) ||
    typeof value.productCode !== "string" ||
    !/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u.test(value.productCode)
  ) {
    throw new TypeError("Coinbase sandbox metadata is invalid.");
  }
  return Object.freeze({ orderId: value.orderId, productCode: value.productCode });
};

const parseCheckout = (value: unknown) => {
  if (!isRecord(value) || typeof value.id !== "string" || !checkoutIdPattern.test(value.id)) {
    throw new TypeError("Coinbase sandbox checkout is invalid.");
  }
  if (value.currency !== "USDC" || value.network !== "base" || typeof value.status !== "string") {
    throw new TypeError("Coinbase sandbox settlement is invalid.");
  }
  return Object.freeze({
    amount: normalizeAmount(value.amount),
    expiresAt: requireInstant(value.expiresAt),
    failRedirectUrl: typeof value.failRedirectUrl === "string" ? value.failRedirectUrl : null,
    id: value.id,
    metadata: requireMetadata(value.metadata),
    status: value.status,
    successRedirectUrl:
      typeof value.successRedirectUrl === "string" ? value.successRedirectUrl : null,
    updatedAt: requireInstant(value.updatedAt),
    url: requireCheckoutUrl(value.url),
  });
};

const base64UrlJson = (value: unknown): string =>
  Buffer.from(JSON.stringify(value), "utf8").toString("base64url");

const createJwt = (
  key: KeyObject,
  keyId: string,
  method: "GET" | "POST",
  path: string,
  nowSeconds: number,
): string => {
  const header = base64UrlJson({
    alg: "ES256",
    kid: keyId,
    nonce: randomBytes(16).toString("hex"),
    typ: "JWT",
  });
  const payload = base64UrlJson({
    exp: nowSeconds + 120,
    iss: "cdp",
    nbf: nowSeconds,
    sub: keyId,
    uri: `${method} ${sandboxHost}${path}`,
  });
  const signingInput = `${header}.${payload}`;
  const signature = sign("sha256", Buffer.from(signingInput, "utf8"), {
    dsaEncoding: "ieee-p1363",
    key,
  }).toString("base64url");
  return `${signingInput}.${signature}`;
};

const readNow = (clock: () => string): Readonly<{ iso: string; seconds: number }> => {
  const iso = requireInstant(clock());
  return Object.freeze({ iso, seconds: Math.floor(Date.parse(iso) / 1_000) });
};

const requestJson = async (
  fetchImplementation: FetchLike,
  key: KeyObject,
  keyId: string,
  clock: () => string,
  method: "GET" | "POST",
  path: string,
  input?: Readonly<{ body: unknown; idempotencyKey: string }>,
): Promise<unknown> => {
  const now = readNow(clock);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetchImplementation(`https://${sandboxHost}${path}`, {
      ...(input === undefined ? {} : { body: JSON.stringify(input.body) }),
      headers: Object.freeze({
        accept: "application/json",
        authorization: `Bearer ${createJwt(key, keyId, method, path, now.seconds)}`,
        ...(input === undefined
          ? {}
          : { "content-type": "application/json", "x-idempotency-key": input.idempotencyKey }),
      }),
      method,
      signal: controller.signal,
    });
    if (!response.ok) throw new TypeError(`Coinbase sandbox returned ${response.status}.`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
};

const headerValue = (
  headers: Readonly<Record<string, string | undefined>>,
  name: string,
): string | null => {
  const matches = Object.entries(headers).filter(
    ([headerName, value]) => headerName.toLowerCase() === name && value !== undefined,
  );
  return matches.length === 1 ? matches[0]![1]! : null;
};

const verifyWebhook = (
  input: CoinbaseBusinessWebhookVerificationInput,
  secret: string,
): unknown => {
  const parts = input.signatureHeader.split(",");
  const fields = new Map<string, string>();
  for (const part of parts) {
    const separator = part.indexOf("=");
    if (separator < 1) throw new TypeError("Coinbase webhook signature is invalid.");
    const name = part.slice(0, separator);
    const value = part.slice(separator + 1);
    if (!/^(?:t|h|v1)$/u.test(name) || value === "" || fields.has(name)) {
      throw new TypeError("Coinbase webhook signature is invalid.");
    }
    fields.set(name, value);
  }
  const timestamp = fields.get("t");
  const signedHeaderNames = fields.get("h");
  const providedSignature = fields.get("v1");
  if (
    fields.size !== 3 ||
    timestamp === undefined ||
    !/^[1-9][0-9]{0,11}$/u.test(timestamp) ||
    signedHeaderNames === undefined ||
    providedSignature === undefined ||
    !/^[0-9a-f]{64}$/u.test(providedSignature)
  ) {
    throw new TypeError("Coinbase webhook signature is invalid.");
  }
  const timestampSeconds = Number(timestamp);
  if (
    !Number.isSafeInteger(timestampSeconds) ||
    Math.abs(input.nowSeconds - timestampSeconds) > input.toleranceSeconds
  ) {
    throw new TypeError("Coinbase webhook timestamp is invalid.");
  }
  const names = signedHeaderNames.split(" ");
  if (
    names.length < 1 ||
    names.length > 16 ||
    new Set(names).size !== names.length ||
    names.some((name) => !/^[a-z0-9-]{1,64}$/u.test(name)) ||
    !names.includes("x-hook0-id") ||
    !names.includes("content-type")
  ) {
    throw new TypeError("Coinbase webhook signed headers are invalid.");
  }
  const values = names.map((name) => headerValue(input.headers, name));
  if (values.some((value) => value === null)) {
    throw new TypeError("Coinbase webhook signed headers are missing.");
  }
  const contentType = headerValue(input.headers, "content-type");
  const eventId = headerValue(input.headers, "x-hook0-id");
  if (
    contentType === null ||
    !/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(contentType) ||
    eventId === null ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,254}$/u.test(eventId)
  ) {
    throw new TypeError("Coinbase webhook metadata is invalid.");
  }
  const rawBody = new TextDecoder("utf-8", { fatal: true }).decode(input.rawBody);
  const signedPayload = `${timestamp}.${signedHeaderNames}.${values.join(".")}.${rawBody}`;
  const expected = createHmac("sha256", secret).update(signedPayload, "utf8").digest();
  const provided = Buffer.from(providedSignature, "hex");
  if (provided.byteLength !== expected.byteLength || !timingSafeEqual(provided, expected)) {
    throw new TypeError("Coinbase webhook signature is invalid.");
  }
  const parsed = JSON.parse(rawBody) as unknown;
  if (!isRecord(parsed)) throw new TypeError("Coinbase webhook body is invalid.");
  return Object.freeze({ ...parsed, webhookEventId: eventId });
};

export const createRecoveryItem11CoinbaseBusinessGateway = (
  options: RecoveryItem11CoinbaseBusinessGatewayOptions,
): CoinbaseBusinessGateway => {
  if (
    options.recoveryScope !== recoveryScope ||
    !/^organizations\/[A-Za-z0-9_-]{1,128}\/apiKeys\/[A-Za-z0-9_-]{1,128}$/u.test(
      options.apiKeyId,
    ) ||
    options.webhookSecret.length < 16
  ) {
    throw new TypeError("Coinbase sandbox configuration is invalid.");
  }
  const key = createPrivateKey(options.apiKeySecret);
  if (key.asymmetricKeyType !== "ec" || key.asymmetricKeyDetails?.namedCurve !== "prime256v1") {
    throw new TypeError("Coinbase sandbox key is invalid.");
  }
  const fetchImplementation = options.fetch ?? (globalThis.fetch as FetchLike);
  if (typeof fetchImplementation !== "function") {
    throw new TypeError("Coinbase sandbox fetch is unavailable.");
  }
  return Object.freeze({
    async createCheckout(
      request: CoinbaseBusinessCheckoutRequest,
    ): Promise<CoinbaseBusinessCheckoutResult> {
      if (!uuidV4Pattern.test(request.idempotencyKey)) {
        throw new TypeError("Coinbase sandbox idempotency key is invalid.");
      }
      const now = readNow(options.clock);
      const expiresAt = new Date(Date.parse(now.iso) + 30 * 60 * 1_000).toISOString();
      const body = Object.freeze({
        amount: request.price.usdcAmountDecimal,
        currency: "USDC",
        description: `${request.productName} — protected staging only`,
        expiresAt,
        failRedirectUrl: request.cancelUrl,
        metadata: request.metadata,
        successRedirectUrl: request.redirectUrl,
      });
      const parsed = parseCheckout(
        await requestJson(
          fetchImplementation,
          key,
          options.apiKeyId,
          options.clock,
          "POST",
          sandboxPath,
          { body, idempotencyKey: request.idempotencyKey },
        ),
      );
      if (
        parsed.status !== "ACTIVE" ||
        parsed.amount !== normalizeAmount(request.price.usdcAmountDecimal) ||
        parsed.metadata.orderId !== request.metadata.orderId ||
        parsed.metadata.productCode !== request.metadata.productCode ||
        parsed.successRedirectUrl !== request.redirectUrl ||
        parsed.failRedirectUrl !== request.cancelUrl ||
        Date.parse(parsed.expiresAt) !== Date.parse(expiresAt)
      ) {
        throw new TypeError("Coinbase sandbox checkout mismatch.");
      }
      return Object.freeze({ expiresAt: parsed.expiresAt, id: parsed.id, url: parsed.url });
    },
    async reconcileCheckout(request: CoinbaseBusinessReconciliationRequest): Promise<unknown> {
      if (
        !checkoutIdPattern.test(request.checkoutId) ||
        request.providerId !== coinbaseBusinessProviderId
      ) {
        throw new TypeError("Coinbase sandbox reconciliation is invalid.");
      }
      return requestJson(
        fetchImplementation,
        key,
        options.apiKeyId,
        options.clock,
        "GET",
        `${sandboxPath}/${request.checkoutId}`,
      );
    },
    verifyWebhook: async (input: CoinbaseBusinessWebhookVerificationInput) =>
      verifyWebhook(input, options.webhookSecret),
  });
};

const mapStatus = (value: string): HostedCryptoWebhookEventV1["status"] => {
  if (value === "ACTIVE" || value === "PENDING") return "pending";
  if (value === "COMPLETED") return "confirmed";
  if (value === "FAILED") return "failed";
  if (value === "EXPIRED") return "expired";
  if (value === "REFUNDED") return "refunded";
  throw new TypeError("Coinbase sandbox status is invalid.");
};

export const mapCoinbaseBusinessReconciliationResult = (
  value: unknown,
): HostedCryptoReconciliationResultV1 => {
  const parsed = parseCheckout(value);
  return Object.freeze({
    checkedAt: parsed.updatedAt,
    orderId: parsed.metadata.orderId,
    providerCheckoutSessionId: parsed.id,
    providerId: coinbaseBusinessProviderId,
    providerObjectId: parsed.id,
    settlement: Object.freeze({
      amountDecimal: parsed.amount,
      assetCode: "USDC" as const,
      networkCode: "base" as const,
    }),
    status: mapStatus(parsed.status),
  });
};

export const mapCoinbaseBusinessVerifiedWebhookEvent = (
  value: unknown,
): HostedCryptoWebhookEventV1 => {
  const parsed = parseCheckout(value);
  if (!isRecord(value) || typeof value.webhookEventId !== "string") {
    throw new TypeError("Coinbase webhook event ID is invalid.");
  }
  const eventType = value.eventType;
  const status =
    eventType === "checkout.payment.success"
      ? "confirmed"
      : eventType === "checkout.payment.failed"
        ? "failed"
        : eventType === "checkout.payment.expired"
          ? "expired"
          : eventType === "checkout.refund.success"
            ? "refunded"
            : eventType === "checkout.refund.failed"
              ? "confirmed"
              : null;
  if (status === null) throw new TypeError("Coinbase webhook event type is invalid.");
  return Object.freeze({
    eventId: value.webhookEventId,
    occurredAt: parsed.updatedAt,
    orderId: parsed.metadata.orderId,
    providerCheckoutSessionId: parsed.id,
    providerId: coinbaseBusinessProviderId,
    providerObjectId: parsed.id,
    settlement: Object.freeze({
      amountDecimal: parsed.amount,
      assetCode: "USDC" as const,
      networkCode: "base" as const,
    }),
    status,
  });
};

export const recoveryItem11CoinbaseSandboxUrl = sandboxBaseUrl;
