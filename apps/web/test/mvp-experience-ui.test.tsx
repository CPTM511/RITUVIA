import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { AccountExperience, parseAccountSummary } from "../app/_components/account-experience";
import { CheckoutReturn, resolveCheckoutOrderStatus } from "../app/_components/checkout-return";
import {
  completedLocalOrderId,
  LocalCheckout,
  localCheckoutCompletionEndpoint,
} from "../app/_components/local-checkout";
import {
  parseCatalogResponse,
  parseFreeRitualCatalogResponse,
  resolveLatestReadingId,
  SanctuaryFlow,
  sanctuaryEndpoints,
} from "../app/_components/sanctuary-flow";
import {
  sanctuaryReadingHandoffStorageKey,
  storeSanctuaryReadingHandoff,
} from "../app/_components/reading-sanctuary-handoff";
import { SignInForm } from "../app/_components/sign-in-form";
import { safeLocalReturnTo } from "../app/_contracts/reviewed-return-to";
import { getAccountMessages } from "../app/_i18n/account-messages";
import { getCommerceMessages } from "../app/_i18n/commerce-messages";
import {
  localeAccountPath,
  localeCheckoutReturnPath,
  localeLocalCheckoutPath,
  localeRevisitPath,
  localeSanctuaryPath,
  localeSignInPath,
  localeTarotOneCardPath,
  localeTarotThreeCardPath,
} from "../app/_i18n/routing";
import { getSanctuaryMessages } from "../app/_i18n/sanctuary-messages";
import { getWebRitualCatalog } from "../server/ritual-catalog";

const uuid = "00000000-0000-4000-8000-000000000001";

describe("MVP client boundaries", () => {
  it("accepts only the server-authoritative commerce catalog shape", () => {
    const parsed = parseCatalogResponse({
      items: [
        {
          exactContents: ["One moonlit lotus", "Private sanctuary use"],
          name: "Moonlit lotus",
          price: { amountMinor: 199, currencyCode: "USD" },
          productCode: "moonlit_lotus",
        },
      ],
      schemaVersion: 1,
    });

    expect(parsed).toEqual([
      {
        access: "purchase",
        code: "moonlit_lotus",
        description: "One moonlit lotus · Private sanctuary use",
        name: "Moonlit lotus",
        objectCode: "moonlit_lotus",
        owned: false,
        price: { amountMinor: 199, currency: "USD" },
      },
    ]);
    expect(
      parseCatalogResponse({
        items: [{ amountMinor: 1, code: "client_price", currency: "USD" }],
        schemaVersion: 1,
      }),
    ).toBeNull();
  });

  it("accepts only the approved canonical free ritual definitions", () => {
    expect(parseFreeRitualCatalogResponse(getWebRitualCatalog())).toBe(true);
    expect(parseFreeRitualCatalogResponse({ schemaVersion: "ritual-catalog.v1" })).toBe(false);
  });

  it("requires a valid private account response before showing account data", () => {
    const account = {
      ageAttested: false,
      displayName: null,
      emailVerified: true,
      id: uuid,
      locale: "en",
      profileVersion: 1,
      schemaVersion: 1,
      status: "active",
      timeZone: "UTC",
    };

    expect(parseAccountSummary(account)).toMatchObject({ adultAttested: false, id: uuid });
    expect(parseAccountSummary({ ...account, displayName: "𠮷".repeat(80) })?.displayName).toBe(
      "𠮷".repeat(80),
    );
    expect(parseAccountSummary({ ...account, emailVerified: false })).toBeNull();
    expect(parseAccountSummary({ ...account, id: "not-an-account-id" })).toBeNull();
  });

  it("never treats a browser redirect or an unentitled paid order as success", () => {
    expect(resolveCheckoutOrderStatus({ entitlementGranted: false, state: "paid" })).toBe(
      "pending",
    );
    expect(resolveCheckoutOrderStatus({ entitlementGranted: true, state: "paid" })).toBe("success");
    expect(resolveCheckoutOrderStatus({ entitlementGranted: true, state: "refunded" })).toBe(
      "failed",
    );
    expect(resolveCheckoutOrderStatus({ state: "pending_checkout" })).toBe("pending");
    expect(resolveCheckoutOrderStatus({ state: "payment_failed" })).toBe("failed");
    expect(resolveCheckoutOrderStatus({ redirect: "success" })).toBeNull();
  });

  it("keeps passwordless return paths on reviewed local English routes", () => {
    expect(safeLocalReturnTo("/en/sanctuary", "/en/account")).toBe("/en/sanctuary");
    expect(
      safeLocalReturnTo("/en/checkout/local?checkout_id=local_checkout.123", "/en/account"),
    ).toBe("/en/checkout/local?checkout_id=local_checkout.123");
    for (const candidate of [
      null,
      "https://example.com",
      "//example.com",
      "/fr/account",
      "/en/checkout/local?checkout_id=bad&next=https://foreign.test",
    ]) {
      expect(safeLocalReturnTo(candidate, "/en/account")).toBe("/en/account");
    }
  });

  it("accepts local completion only after paid state and active entitlement", () => {
    expect(
      completedLocalOrderId({
        entitlementGranted: true,
        orderId: uuid,
        schemaVersion: 1,
        state: "paid",
      }),
    ).toBe(uuid);
    expect(
      completedLocalOrderId({
        entitlementGranted: false,
        orderId: uuid,
        schemaVersion: 1,
        state: "paid",
      }),
    ).toBeNull();
    expect(localCheckoutCompletionEndpoint).toBe("/api/v1/checkout/local/complete");
  });

  it("uses first-party API paths for the complete sanctuary loop", () => {
    expect(sanctuaryEndpoints).toEqual({
      anonymousSession: "/api/v1/anonymous/session",
      catalog: "/api/v1/catalog",
      entitlements: "/api/v1/entitlements",
      intentions: "/api/v1/intentions",
      journalEntries: "/api/v1/journal-entries",
      orders: "/api/v1/orders",
      ritualObjects: "/api/v1/ritual-objects",
      ritualSessions: "/api/v1/ritual-sessions",
    });
  });

  it("links the newest valid saved reading", async () => {
    const older = "00000000-0000-4000-8000-000000000002";
    const newer = "00000000-0000-4000-8000-000000000003";
    const storage = {
      getItem: (key: string) =>
        key.endsWith("one_card") ? older : key.endsWith("three_card") ? newer : null,
    };
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const readingId = String(input).split("/").at(-1);
      return Response.json({
        createdAt: readingId === older ? "2026-07-18T11:00:00.000Z" : "2026-07-18T12:00:00.000Z",
        readingId,
      });
    }) as unknown as typeof fetch;

    await expect(resolveLatestReadingId(fetcher, storage)).resolves.toBe(newer);
  });

  it("prefers the exact displayed reading handed to Sanctuary", async () => {
    const selected = "00000000-0000-4000-8000-000000000004";
    const newer = "00000000-0000-4000-8000-000000000005";
    const values = new Map<string, string>([
      ["rituvia.tarot.resume.one_card.v1", selected],
      ["rituvia.tarot.resume.three_card.v1", newer],
    ]);
    expect(
      storeSanctuaryReadingHandoff({ setItem: (key, value) => values.set(key, value) }, selected),
    ).toBe(true);
    expect(values.get(sanctuaryReadingHandoffStorageKey)).toBe(selected);

    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const candidate = String(input).split("/").at(-1);
      return Response.json({
        createdAt: candidate === newer ? "2026-07-18T12:00:00.000Z" : "2026-07-18T11:00:00.000Z",
        readingId: candidate,
      });
    }) as unknown as typeof fetch;

    await expect(
      resolveLatestReadingId(fetcher, { getItem: (key) => values.get(key) ?? null }),
    ).resolves.toBe(selected);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("ignores stale saved reading identifiers", async () => {
    const stale = "00000000-0000-4000-8000-000000000004";
    const storage = { getItem: () => stale };
    const fetcher = vi.fn(
      async () => new Response(null, { status: 404 }),
    ) as unknown as typeof fetch;

    await expect(resolveLatestReadingId(fetcher, storage)).resolves.toBeNull();
  });
});

describe("MVP server-rendered initial states", () => {
  it("renders an accessible passwordless sign-in form", () => {
    const html = renderToStaticMarkup(
      createElement(SignInForm, {
        messages: getAccountMessages("en").signIn,
        returnTo: localeAccountPath("en"),
      }),
    );

    expect(html).toContain('type="email"');
    expect(html).toContain('autoComplete="email"');
    expect(html).toContain("Sign in without a password");
    expect(html).not.toContain('type="password"');
  });

  it("renders private account and checkout verification loading states", () => {
    const accountHtml = renderToStaticMarkup(
      createElement(AccountExperience, {
        locale: "en",
        messages: getAccountMessages("en").account,
        oneCardHref: localeTarotOneCardPath("en"),
        sanctuaryHref: localeSanctuaryPath("en"),
        signInHref: localeSignInPath("en"),
        threeCardHref: localeTarotThreeCardPath("en"),
      }),
    );
    const checkoutHtml = renderToStaticMarkup(
      createElement(CheckoutReturn, {
        accountHref: localeAccountPath("en"),
        messages: getCommerceMessages("en").checkoutReturn,
        orderId: uuid,
        sanctuaryHref: localeSanctuaryPath("en"),
      }),
    );

    expect(accountHtml).toContain('aria-busy="true"');
    expect(accountHtml).toContain("Loading your private account");
    expect(checkoutHtml).toContain('aria-busy="true"');
    expect(checkoutHtml).toContain("Checking the verified order status");
  });

  it("renders an explicit, non-card local checkout confirmation", () => {
    const html = renderToStaticMarkup(
      createElement(LocalCheckout, {
        checkoutId: "local_checkout_11111111",
        checkoutReturnHref: localeCheckoutReturnPath("en"),
        localCheckoutHref: localeLocalCheckoutPath("en"),
        messages: getCommerceMessages("en").localCheckout,
        sanctuaryHref: localeSanctuaryPath("en"),
        signInHref: localeSignInPath("en"),
      }),
    );

    expect(html).toContain("Complete a local test payment");
    expect(html).toContain("no real payment is taken");
    expect(html).not.toMatch(/<input\b/u);
  });

  it("renders the sanctuary with a labelled formal image and degraded-safe catalog state", () => {
    const html = renderToStaticMarkup(
      createElement(SanctuaryFlow, {
        accountHref: localeAccountPath("en"),
        locale: "en",
        messages: getSanctuaryMessages("en"),
        readingHref: localeTarotOneCardPath("en"),
        revisitHref: localeRevisitPath("en"),
        sanctuaryHref: localeSanctuaryPath("en"),
        signInHref: localeSignInPath("en"),
      }),
    );

    expect(html).toContain("rituvia-sanctuary-orb.png");
    expect(html).toContain("Loading available ritual objects");
    expect(html).toContain("Free static ritual steps");
    expect(html).toContain("Quiet candle");
    expect(html).toContain("Quiet incense");
    expect(html).toContain("Set an intention");
    expect(html).toContain("Private reflection");
  });
});
