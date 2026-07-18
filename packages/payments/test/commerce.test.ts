import { describe, expect, it } from "vitest";

import {
  applyEntitlementDirective,
  applyPaymentEvent,
  attachHostedCheckout,
  cancelOrder,
  CommerceError,
  createDigitalProductV1,
  createMoney,
  createOrderV1,
  createProductPriceV1,
  paidRitualObjectCodes,
  parseRitualObjectEntitlementCode,
  ritualObjectEntitlementCodeFor,
  type NormalizedPaymentEventV1,
  type OrderV1,
} from "../src/index.js";

const now = "2026-07-18T12:00:00.000Z";
const product = () =>
  createDigitalProductV1({
    code: "mindful_incense",
    entitlementCode: ritualObjectEntitlementCodeFor("mindful_incense"),
    exactContents: ["One reusable digital incense object", "One ambient visual treatment"],
    kind: "digital_item",
    publishedAt: "2026-07-18T00:00:00.000Z",
    status: "active",
    version: "1.0.0",
  });
const price = () =>
  createProductPriceV1({
    amountMinor: 99,
    currencyCode: "USD",
    effectiveFrom: "2026-07-18T00:00:00.000Z",
    effectiveUntil: null,
    priceId: "price.mindful_incense.usd",
    productCode: "mindful_incense",
    productVersion: "1.0.0",
    status: "active",
    version: "1.0.0",
  });
const order = (): OrderV1 =>
  createOrderV1({
    accountId: "account_11111111",
    asOf: now,
    countryPolicy: {
      countryCode: "US",
      evaluatedAt: now,
      ruleVersion: "local.us.v1",
    },
    orderId: "order_11111111",
    price: price(),
    product: product(),
    providerId: "local_hosted",
  });
const event = (
  type: NormalizedPaymentEventV1["type"],
  overrides: Partial<NormalizedPaymentEventV1> = {},
): NormalizedPaymentEventV1 => ({
  amount: createMoney(99, "USD"),
  eventId: `event_${type}`,
  occurredAt: "2026-07-18T12:01:00.000Z",
  orderId: "order_11111111",
  providerCheckoutSessionId: "checkout_11111111",
  providerId: "local_hosted",
  providerObjectId: "checkout_11111111",
  providerPaymentIntentId: null,
  type,
  ...overrides,
});

describe("commerce values", () => {
  it("uses integer minor units and rejects floats, negative values, and invalid currency", () => {
    expect(createMoney(99, "USD")).toEqual({ amountMinor: 99, currencyCode: "USD" });
    expect(() => createMoney(0.99, "USD")).toThrow(CommerceError);
    expect(() => createMoney(-1, "USD")).toThrow(CommerceError);
    expect(() => createMoney(2_147_483_648, "USD")).toThrow(CommerceError);
    expect(() => createMoney(99, "usd")).toThrow(CommerceError);
  });

  it("derives the order amount and immutable entitlement snapshot from active catalog data", () => {
    const created = order();
    expect(created).toMatchObject({
      amount: { amountMinor: 99, currencyCode: "USD" },
      entitlementCode: "sanctuary.mindful_incense",
      state: "pending_checkout",
    });
    expect(Object.isFrozen(created)).toBe(true);
    expect(Object.isFrozen(created.amount)).toBe(true);
  });

  it("rejects inactive, mismatched, expired, and free checkout prices", () => {
    expect(() =>
      createOrderV1({
        ...orderInput(),
        product: createDigitalProductV1({
          ...product(),
          status: "retired",
        }),
      }),
    ).toThrow(CommerceError);
    expect(() =>
      createOrderV1({
        ...orderInput(),
        price: createProductPriceV1({
          ...price(),
          amountMinor: 0,
          currencyCode: "USD",
        }),
      }),
    ).toThrow(CommerceError);
  });

  it("rejects catalog entries that would grant the wrong sanctuary object", () => {
    expect(() =>
      createDigitalProductV1({
        ...product(),
        entitlementCode: "sanctuary.moonlit_lotus",
      }),
    ).toThrow(CommerceError);
    expect(() =>
      createDigitalProductV1({
        ...product(),
        code: "ordinary_report",
      }),
    ).toThrow(CommerceError);
  });
});

const orderInput = () => ({
  accountId: "account_11111111",
  asOf: now,
  countryPolicy: { countryCode: "US", evaluatedAt: now, ruleVersion: "local.us.v1" },
  orderId: "order_11111111",
  price: price(),
  product: product(),
  providerId: "local_hosted",
});

describe("order and entitlement state machines", () => {
  it("moves checkout -> pending -> paid and grants exactly one entitlement", () => {
    const withCheckout = attachHostedCheckout(order(), {
      checkoutId: "local_checkout_1",
      createdAt: now,
      providerId: "local_hosted",
    });
    expect(withCheckout.state).toBe("checkout_created");
    const pending = applyPaymentEvent({
      alreadyRecorded: false,
      event: event("payment_pending"),
      order: withCheckout,
    });
    expect(pending.order.state).toBe("processing");
    expect(pending.entitlementDirective).toBe("none");

    const paid = applyPaymentEvent({
      alreadyRecorded: false,
      event: event("payment_succeeded", {
        eventId: "event_success",
        occurredAt: "2026-07-18T12:02:00.000Z",
      }),
      order: pending.order,
    });
    expect(paid).toMatchObject({
      disposition: "applied",
      entitlementDirective: "grant",
      order: { state: "paid" },
      recordEvent: true,
    });
    const granted = applyEntitlementDirective({
      at: paid.order.updatedAt,
      directive: paid.entitlementDirective,
      entitlementId: "entitlement_1",
      existing: null,
      order: paid.order,
    });
    expect(granted).toMatchObject({
      disposition: "granted",
      entitlement: { state: "active", sourceOrderId: "order_11111111" },
    });
    expect(
      applyEntitlementDirective({
        at: paid.order.updatedAt,
        directive: paid.entitlementDirective,
        entitlementId: "entitlement_1",
        existing: granted.entitlement,
        order: paid.order,
      }).disposition,
    ).toBe("ignored");
  });

  it("marks duplicate events without another transition or entitlement directive", () => {
    expect(
      applyPaymentEvent({
        alreadyRecorded: true,
        event: event("payment_succeeded"),
        order: order(),
      }),
    ).toMatchObject({
      disposition: "duplicate",
      entitlementDirective: "none",
      recordEvent: false,
    });
  });

  it("records a refund arriving before success as terminal and never grants later", () => {
    const result = applyPaymentEvent({
      alreadyRecorded: false,
      event: event("payment_refunded"),
      order: order(),
    });
    expect(result).toMatchObject({
      disposition: "applied",
      entitlementDirective: "revoke",
      order: { state: "refunded" },
      recordEvent: true,
    });
    expect(
      applyPaymentEvent({
        alreadyRecorded: false,
        event: event("payment_succeeded", { eventId: "event_success_after_refund" }),
        order: result.order,
      }),
    ).toMatchObject({
      disposition: "ignored_out_of_order",
      entitlementDirective: "none",
      order: { state: "refunded" },
      recordEvent: true,
    });
  });

  it("records a dispute arriving before success as terminal and never grants later", () => {
    const disputed = applyPaymentEvent({
      alreadyRecorded: false,
      event: event("payment_disputed"),
      order: order(),
    });
    expect(disputed).toMatchObject({
      disposition: "applied",
      entitlementDirective: "revoke",
      order: { state: "disputed" },
    });
    expect(
      applyPaymentEvent({
        alreadyRecorded: false,
        event: event("payment_succeeded", { eventId: "event_success_after_dispute" }),
        order: disputed.order,
      }),
    ).toMatchObject({
      disposition: "ignored_out_of_order",
      entitlementDirective: "none",
      order: { state: "disputed" },
    });
  });

  it("rejects amount, currency, provider, and order mismatches without recording them", () => {
    for (const mismatch of [
      { amount: createMoney(100, "USD") },
      { amount: createMoney(99, "EUR") },
      { providerId: "stripe" },
      { orderId: "order_other" },
    ]) {
      expect(
        applyPaymentEvent({
          alreadyRecorded: false,
          event: event("payment_succeeded", mismatch),
          order: order(),
        }),
      ).toMatchObject({ disposition: "rejected_mismatch", recordEvent: false });
    }
  });

  it("revokes an active entitlement on refund or dispute", () => {
    const paid = applyPaymentEvent({
      alreadyRecorded: false,
      event: event("payment_succeeded"),
      order: order(),
    });
    const granted = applyEntitlementDirective({
      at: paid.order.updatedAt,
      directive: "grant",
      entitlementId: "entitlement_1",
      existing: null,
      order: paid.order,
    }).entitlement;
    const refunded = applyPaymentEvent({
      alreadyRecorded: false,
      event: event("payment_refunded", {
        eventId: "event_refund",
        occurredAt: "2026-07-18T12:03:00.000Z",
      }),
      order: paid.order,
    });
    expect(refunded.order.state).toBe("refunded");
    expect(
      applyEntitlementDirective({
        at: refunded.order.updatedAt,
        directive: refunded.entitlementDirective,
        entitlementId: "entitlement_1",
        existing: granted,
        order: refunded.order,
      }),
    ).toMatchObject({ disposition: "revoked", entitlement: { state: "revoked" } });
  });

  it("allows a verified late success to recover failed or canceled checkout", () => {
    const failed = applyPaymentEvent({
      alreadyRecorded: false,
      event: event("payment_failed"),
      order: order(),
    }).order;
    expect(failed.state).toBe("payment_failed");
    expect(
      applyPaymentEvent({
        alreadyRecorded: false,
        event: event("payment_succeeded", { eventId: "event_late_success" }),
        order: failed,
      }).order.state,
    ).toBe("paid");

    const canceled = cancelOrder(order(), "2026-07-18T12:00:30.000Z");
    expect(
      applyPaymentEvent({
        alreadyRecorded: false,
        event: event("payment_succeeded", { eventId: "event_after_cancel" }),
        order: canceled,
      }).order.state,
    ).toBe("paid");
  });
});

describe("paid ritual-object entitlement contract", () => {
  it.each(paidRitualObjectCodes)("round-trips the owned %s object code", (objectCode) => {
    const entitlementCode = ritualObjectEntitlementCodeFor(objectCode);
    expect(entitlementCode).toBe(`sanctuary.${objectCode}`);
    expect(parseRitualObjectEntitlementCode(entitlementCode)).toBe(objectCode);
  });

  it("does not treat the always-free incense ritual as a paid object", () => {
    expect(() => parseRitualObjectEntitlementCode("sanctuary.incense")).toThrow(CommerceError);
  });
});
