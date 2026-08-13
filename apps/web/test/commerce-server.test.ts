import { createLocalHostedCheckoutAdapter } from "@rituvia/payments/adapters/local";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  CommercePersistence,
  PersistedCommerceOrder,
  PersistedEntitlement,
} from "@rituvia/db";
import type { CommerceTransitionResult } from "@rituvia/db";

import {
  createCommerceApplicationService,
  getWebCommerceCatalog,
  webCommerceLocalPolicyVersions,
} from "../server/commerce";
import {
  createWebPaymentProviderRegistry,
  localHostedCheckoutProviderId,
} from "../server/payment-provider";

const userId = "11111111-1111-4111-8111-111111111111";
const sessionToken = "s".repeat(43);
const canonicalOrigin = "http://127.0.0.1:4175";

const paymentActivation = (
  countryCode: string,
  evaluatedAt: string,
  countryEnabled: boolean,
  checkoutEnabled: boolean,
) => ({
  checkoutActivation: {
    countryCode,
    evaluation: {
      enabled: checkoutEnabled,
      evaluatedAt,
      flagKey: "payments.fiat_checkout" as const,
      reason: checkoutEnabled ? ("enabled" as const) : ("configured-off" as const),
      registryVersion: 3,
      source: "version" as const,
      version: 1,
    },
  },
  countryActivation: {
    countryCode,
    evaluation: {
      enabled: countryEnabled,
      evaluatedAt,
      flagKey: "market.country_activation" as const,
      reason: countryEnabled ? ("enabled" as const) : ("configured-off" as const),
      registryVersion: 3,
      source: "version" as const,
      version: 1,
    },
  },
});

const uuidFactory = () => {
  let sequence = 1;
  return () => `00000000-0000-4000-8000-${String(sequence++).padStart(12, "0")}`;
};

const createHarness = (
  input: {
    ageAttested?: boolean;
    checkoutEnabled?: boolean;
    countryEnabled?: boolean;
    paymentControlFailure?: boolean;
    policyVersions?: typeof webCommerceLocalPolicyVersions;
  } = {},
) => {
  let now = "2026-07-18T12:00:00.000Z";
  let checkoutEnabled = input.checkoutEnabled ?? true;
  let countryEnabled = input.countryEnabled ?? true;
  let order: PersistedCommerceOrder | null = null;
  let entitlement: PersistedEntitlement | null = null;
  let orderIdempotencyHash: string | null = null;
  const createCheckout = vi.fn();
  const processPaymentEvent = vi.fn(async (event, _ids, transition) => {
    if (order === null) {
      return { disposition: "not_found", entitlement: null, order: null } as const;
    }
    const result = transition(order, event) as CommerceTransitionResult;
    if (result.disposition === "applied") {
      order = Object.freeze({ ...order, state: result.nextState, updatedAt: event.occurredAt });
      if (result.entitlementDirective === "grant") {
        entitlement = Object.freeze({
          code: order.entitlementCode,
          entitlementId: "99999999-9999-4999-8999-999999999999",
          grantedAt: event.occurredAt,
          revokedAt: null,
          sourceOrderLineId: order.orderLineId,
          state: "active",
          userId,
          version: 1,
        });
      } else if (result.entitlementDirective === "revoke" && entitlement !== null) {
        entitlement = Object.freeze({
          ...entitlement,
          revokedAt: event.occurredAt,
          state: "revoked",
          version: entitlement.version + 1,
        });
      }
    }
    return Object.freeze({ disposition: result.disposition, entitlement, order });
  });
  const persistence = {
    attachCheckout: vi.fn(async (_userId, _orderId, attachment) => {
      if (order === null) throw new Error("missing synthetic order");
      order = Object.freeze({
        ...order,
        checkoutExpiresAt: attachment.expiresAt,
        checkoutSessionId: attachment.checkoutSessionId,
        checkoutUrl: attachment.checkoutUrl,
        paymentAttemptId: attachment.paymentAttemptId,
        paymentAttemptNumber: attachment.attemptNumber,
        providerId: attachment.providerId,
        state: "checkout_created",
        updatedAt: attachment.createdAt,
      });
      return order;
    }),
    authorizeEntitlementForUser: vi.fn(async () => entitlement?.state === "active"),
    createOrder: vi.fn(async (prepared) => {
      const nextHash = Buffer.from(prepared.idempotencyKeyHash).toString("hex");
      if (order !== null) {
        if (orderIdempotencyHash === nextHash) {
          return Object.freeze({ kind: "replayed" as const, order });
        }
        throw Object.assign(new Error("synthetic open purchase conflict"), {
          code: "COMMERCE_CONFLICT",
        });
      }
      orderIdempotencyHash = nextHash;
      order = Object.freeze({
        ...prepared.order,
        checkoutExpiresAt: null,
        checkoutSessionId: null,
        checkoutUrl: null,
        paymentAttemptId: null,
        paymentAttemptNumber: null,
        providerId: null,
      });
      return Object.freeze({ kind: "created" as const, order });
    }),
    getOrder: vi.fn(async () => order),
    getOrderByCheckoutSession: vi.fn(async () => order),
    listEntitlements: vi.fn(async () => (entitlement === null ? [] : [entitlement])),
    processPaymentEvent,
  } as unknown as CommercePersistence;
  const localAdapter = createLocalHostedCheckoutAdapter({
    clock: () => now,
    environment: "local",
    idFactory: () => "checkout_1",
    origin: canonicalOrigin,
    signingSecret: new Uint8Array(32).fill(7),
  });
  createCheckout.mockImplementation(localAdapter.createCheckout);
  const registry = createWebPaymentProviderRegistry({
    local: Object.freeze({ ...localAdapter, createCheckout }),
    localAccountFingerprint: "cfg_11111111111111111111111111111111",
  });
  const service = createCommerceApplicationService({
    accounts: {
      getProfile: async () => ({
        ageAttested: input.ageAttested ?? true,
        emailVerified: true,
        id: userId,
        status: "active" as const,
      }),
      resolveSession: async (token) => (token === sessionToken ? { userId } : null),
    },
    canonicalOrigin,
    clock: () => now,
    countryPolicies: {
      read: async () => input.policyVersions ?? webCommerceLocalPolicyVersions,
    },
    environment: "local",
    idFactory: uuidFactory(),
    paymentControls: {
      read: async ({ countryCode }) => {
        if (input.paymentControlFailure === true) throw new Error("synthetic control read failure");
        return paymentActivation(countryCode, now, countryEnabled, checkoutEnabled);
      },
    },
    paymentProviders: registry,
    persistence,
    providerId: localHostedCheckoutProviderId,
  });
  return {
    createCheckout,
    get entitlement() {
      return entitlement;
    },
    get order() {
      return order;
    },
    persistence,
    registry,
    service,
    setPaymentControls(input: { checkoutEnabled: boolean; countryEnabled: boolean }) {
      checkoutEnabled = input.checkoutEnabled;
      countryEnabled = input.countryEnabled;
    },
    setNow(value: string) {
      now = value;
    },
  };
};

describe("commerce application service", () => {
  beforeEach(() => vi.clearAllMocks());

  it("publishes exactly the four prototype prices in integer USD minor units", () => {
    expect(
      getWebCommerceCatalog().map(({ amountMinor, productCode }) => ({
        amountMinor,
        productCode,
      })),
    ).toEqual([
      { amountMinor: 99, productCode: "mindful_incense" },
      { amountMinor: 199, productCode: "moonlit_lotus" },
      { amountMinor: 399, productCode: "amethyst_guardian" },
      { amountMinor: 599, productCode: "golden_intention_bowl" },
    ]);
  });

  it("requires persisted age attestation and rejects client-controlled money fields", async () => {
    const ineligible = createHarness({ ageAttested: false });
    await expect(
      ineligible.service.createOrder({
        idempotencyKey: "abcdefghijklmnopqrstuv",
        request: { productCode: "mindful_incense" },
        sessionToken,
      }),
    ).rejects.toMatchObject({ code: "not_eligible" });
    expect(ineligible.persistence.createOrder).not.toHaveBeenCalled();

    const eligible = createHarness();
    await expect(
      eligible.service.createOrder({
        idempotencyKey: "abcdefghijklmnopqrstuv",
        request: { amountMinor: 1, productCode: "mindful_incense" },
        sessionToken,
      }),
    ).rejects.toMatchObject({ code: "input_invalid" });
    const created = await eligible.service.createOrder({
      idempotencyKey: "abcdefghijklmnopqrstuv",
      request: { productCode: "mindful_incense" },
      sessionToken,
    });
    expect(created.order).toMatchObject({ amountMinor: 99, currencyCode: "USD" });
    expect(eligible.order?.entitlementCode).toBe("sanctuary.mindful_incense");
    expect(eligible.order?.countryPolicyVersion).toBe("local.us.commerce.v1");
  });

  it("fails closed when the country policy registry has no active version", async () => {
    const harness = createHarness({ policyVersions: [] });
    await expect(
      harness.service.createOrder({
        idempotencyKey: "abcdefghijklmnopqrstuv",
        request: { productCode: "mindful_incense" },
        sessionToken,
      }),
    ).rejects.toMatchObject({ code: "not_eligible" });
    expect(harness.persistence.createOrder).not.toHaveBeenCalled();
  });

  it("keeps new orders and existing Checkout URLs safe-off before provider use", async () => {
    const countryOff = createHarness({ countryEnabled: false });
    await expect(
      countryOff.service.createOrder({
        idempotencyKey: "abcdefghijklmnopqrstuv",
        request: { productCode: "mindful_incense" },
        sessionToken,
      }),
    ).rejects.toMatchObject({ code: "not_eligible" });
    expect(countryOff.persistence.createOrder).not.toHaveBeenCalled();
    expect(countryOff.createCheckout).not.toHaveBeenCalled();

    const checkoutInitiallyOff = createHarness({ checkoutEnabled: false });
    await expect(
      checkoutInitiallyOff.service.createOrder({
        idempotencyKey: "abcdefghijklmnopqrstuv",
        request: { productCode: "mindful_incense" },
        sessionToken,
      }),
    ).rejects.toMatchObject({ code: "unavailable" });
    expect(checkoutInitiallyOff.persistence.createOrder).not.toHaveBeenCalled();
    expect(checkoutInitiallyOff.createCheckout).not.toHaveBeenCalled();

    const checkoutOff = createHarness();
    const created = await checkoutOff.service.createOrder({
      idempotencyKey: "abcdefghijklmnopqrstuv",
      request: { productCode: "moonlit_lotus" },
      sessionToken,
    });
    const attached = await checkoutOff.service.startCheckout({
      idempotencyKey: "zyxwvutsrqponmlkjihgfe",
      orderId: created.order.orderId,
      sessionToken,
    });
    expect(attached.url).toContain("/en/checkout/local?checkout_id=");
    checkoutOff.setPaymentControls({ checkoutEnabled: false, countryEnabled: true });
    await expect(
      checkoutOff.service.startCheckout({
        idempotencyKey: "1234567890123456789012",
        orderId: created.order.orderId,
        sessionToken,
      }),
    ).rejects.toMatchObject({ code: "unavailable" });
    expect(checkoutOff.createCheckout).toHaveBeenCalledOnce();
    expect(checkoutOff.persistence.attachCheckout).toHaveBeenCalledOnce();
  });

  it("maps payment-control read failure to a redacted unavailable result", async () => {
    const harness = createHarness({ paymentControlFailure: true });
    await expect(
      harness.service.createOrder({
        idempotencyKey: "abcdefghijklmnopqrstuv",
        request: { productCode: "mindful_incense" },
        sessionToken,
      }),
    ).rejects.toMatchObject({ code: "unavailable" });
    expect(harness.persistence.createOrder).not.toHaveBeenCalled();
    expect(harness.createCheckout).not.toHaveBeenCalled();
  });

  it("reuses one active hosted checkout instead of creating another provider session", async () => {
    const harness = createHarness();
    const created = await harness.service.createOrder({
      idempotencyKey: "abcdefghijklmnopqrstuv",
      request: { productCode: "moonlit_lotus" },
      sessionToken,
    });
    const first = await harness.service.startCheckout({
      idempotencyKey: "zyxwvutsrqponmlkjihgfe",
      orderId: created.order.orderId,
      sessionToken,
    });
    const replay = await harness.service.startCheckout({
      idempotencyKey: "1234567890123456789012",
      orderId: created.order.orderId,
      sessionToken,
    });

    expect(replay.url).toBe(first.url);
    expect(harness.createCheckout).toHaveBeenCalledOnce();
    expect(harness.persistence.attachCheckout).toHaveBeenCalledOnce();
  });

  it("replays the same key but rejects a second open order for the same entitlement", async () => {
    const harness = createHarness();
    const first = await harness.service.createOrder({
      idempotencyKey: "abcdefghijklmnopqrstuv",
      request: { productCode: "mindful_incense" },
      sessionToken,
    });
    const replay = await harness.service.createOrder({
      idempotencyKey: "abcdefghijklmnopqrstuv",
      request: { productCode: "mindful_incense" },
      sessionToken,
    });
    expect(replay).toMatchObject({ kind: "replayed", order: { orderId: first.order.orderId } });

    await expect(
      harness.service.createOrder({
        idempotencyKey: "zyxwvutsrqponmlkjihgfe",
        request: { productCode: "mindful_incense" },
        sessionToken,
      }),
    ).rejects.toMatchObject({ code: "conflict" });
  });

  it("grants access only after the signed local event traverses webhook verification", async () => {
    const harness = createHarness();
    const created = await harness.service.createOrder({
      idempotencyKey: "abcdefghijklmnopqrstuv",
      request: { productCode: "amethyst_guardian" },
      sessionToken,
    });
    const checkout = await harness.service.startCheckout({
      idempotencyKey: "zyxwvutsrqponmlkjihgfe",
      orderId: created.order.orderId,
      sessionToken,
    });
    expect(checkout.order.entitlementGranted).toBe(false);

    const completed = await harness.service.completeLocalCheckout({
      checkoutSessionId: harness.order?.checkoutSessionId,
      sessionToken,
    });
    expect(completed).toMatchObject({ entitlementGranted: true, state: "paid" });
    expect(harness.persistence.processPaymentEvent).toHaveBeenCalledOnce();
    expect(harness.persistence.processPaymentEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        objectId: harness.order?.checkoutSessionId,
        providerCheckoutSessionId: harness.order?.checkoutSessionId,
        providerPaymentIntentId: null,
      }),
      expect.any(Object),
      expect.any(Function),
    );
    await expect(
      harness.service.authorizePaidRitualObject({
        accountSessionToken: sessionToken,
        anonymousSessionToken: undefined,
        objectCode: "amethyst_guardian",
      }),
    ).resolves.toBe(true);
  });

  it("keeps refund-before-success terminal and never grants the entitlement", async () => {
    const harness = createHarness();
    const created = await harness.service.createOrder({
      idempotencyKey: "abcdefghijklmnopqrstuv",
      request: { productCode: "golden_intention_bowl" },
      sessionToken,
    });
    await harness.service.startCheckout({
      idempotencyKey: "zyxwvutsrqponmlkjihgfe",
      orderId: created.order.orderId,
      sessionToken,
    });
    const order = harness.order!;
    const refunded = await harness.registry.signLocalEvent({
      amount: { amountMinor: order.amountMinor, currencyCode: order.currencyCode },
      eventId: "local_refund_before_success",
      occurredAt: "2026-07-18T12:01:00.000Z",
      orderId: order.orderId,
      providerCheckoutSessionId: order.checkoutSessionId,
      providerId: localHostedCheckoutProviderId,
      providerObjectId: order.checkoutSessionId!,
      providerPaymentIntentId: null,
      type: "payment_refunded",
    });
    const refundResult = await harness.service.processWebhook({
      providerId: localHostedCheckoutProviderId,
      request: refunded,
    });
    expect(refundResult.order?.state).toBe("refunded");

    const succeeded = await harness.registry.signLocalEvent({
      amount: { amountMinor: order.amountMinor, currencyCode: order.currencyCode },
      eventId: "local_success_after_refund",
      occurredAt: "2026-07-18T12:02:00.000Z",
      orderId: order.orderId,
      providerCheckoutSessionId: order.checkoutSessionId,
      providerId: localHostedCheckoutProviderId,
      providerObjectId: order.checkoutSessionId!,
      providerPaymentIntentId: null,
      type: "payment_succeeded",
    });
    const successResult = await harness.service.processWebhook({
      providerId: localHostedCheckoutProviderId,
      request: succeeded,
    });
    expect(successResult).toMatchObject({ disposition: "ignored_out_of_order" });
    expect(successResult.order?.state).toBe("refunded");
    expect(harness.entitlement).toBeNull();
  });
});
