import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { createLocalActionHref } from "@rituvia/ui";

import {
  AstrologyNatalPresentation,
  AstrologyNatalResult,
  astrologyPolarPoint,
} from "../app/_components/astrology-natal-result";
import {
  astrologyNatalViewEndpoint,
  astrologyNatalViewMaximumResponseBytes,
  requestAstrologyNatalView,
} from "../app/_components/astrology-natal-transport";
import {
  createAstrologyNatalViewResponse,
  parseAstrologyNatalViewResponse,
} from "../app/_contracts/astrology-natal-response";
import { getAstrologyMessages } from "../app/_i18n/astrology-messages";
import {
  createApproximateAstrologyFacts,
  createAstrologyCalculationResource,
  createExactAstrologyFacts,
  createUnknownTimeAstrologyFacts,
} from "./fixtures/astrology-natal";

const messages = getAstrologyMessages("en");
const styles = readFileSync("apps/web/app/styles.css", "utf8");

describe("astrology natal response contract and transport", () => {
  it("projects only the reviewed saved-calculation fields", async () => {
    const resource = await createAstrologyCalculationResource();
    const response = createAstrologyNatalViewResponse({
      ...resource,
      birthProfileId: "private-profile-canary",
    } as typeof resource);

    expect(response.item).toMatchObject({
      calculationId: resource.id,
      createdAt: resource.createdAt,
      facts: {
        calculationStatus: resource.facts.calculationStatus,
        placements: resource.facts.placements,
        schemaVersion: "astrology-natal-view-facts.v1",
      },
    });
    expect(JSON.stringify(response)).not.toContain("private-profile-canary");
    expect(JSON.stringify(response)).not.toContain("inputSnapshotSha256");
    expect(JSON.stringify(response)).not.toContain("timeZoneProvenanceSha256");
    expect(JSON.stringify(response)).not.toContain("binarySha256");
    expect(parseAstrologyNatalViewResponse(response)).toEqual(response);
  });

  it("rejects unknown response keys and tampered deterministic facts", async () => {
    const response = createAstrologyNatalViewResponse(await createAstrologyCalculationResource());

    expect(() =>
      parseAstrologyNatalViewResponse({ ...response, privateBirthDate: "2000-01-01" }),
    ).toThrow();
    expect(() =>
      parseAstrologyNatalViewResponse({
        ...response,
        item: {
          ...response.item,
          facts: {
            ...response.item?.facts,
            placements: [
              { ...response.item?.facts.placements[0], sign: "aries" },
              ...(response.item?.facts.placements.slice(1) ?? []),
            ],
          },
        },
      }),
    ).toThrow();
  });

  it("loads one strict same-origin private response without automatic retry", async () => {
    const response = createAstrologyNatalViewResponse(await createAstrologyCalculationResource());
    const fetcher = vi.fn(async () => Response.json(response));
    const result = await requestAstrologyNatalView({
      fetcher: fetcher as typeof fetch,
      isOnline: () => true,
      signal: new AbortController().signal,
    });

    expect(result).toEqual({ item: response.item, kind: "success" });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher).toHaveBeenCalledWith(
      astrologyNatalViewEndpoint,
      expect.objectContaining({
        cache: "no-store",
        credentials: "same-origin",
        headers: { accept: "application/json" },
        method: "GET",
        redirect: "error",
      }),
    );
  });

  it("does not send while offline and maps reviewed availability states", async () => {
    const fetcher = vi.fn();
    await expect(
      requestAstrologyNatalView({
        fetcher: fetcher as typeof fetch,
        isOnline: () => false,
        signal: new AbortController().signal,
      }),
    ).resolves.toEqual({ kind: "offline" });
    expect(fetcher).not.toHaveBeenCalled();

    for (const [status, kind] of [
      [401, "unauthorized"],
      [503, "unavailable"],
      [500, "error"],
    ] as const) {
      await expect(
        requestAstrologyNatalView({
          fetcher: vi.fn(async () => new Response(null, { status })) as typeof fetch,
          isOnline: () => true,
          signal: new AbortController().signal,
        }),
      ).resolves.toEqual({ kind });
    }
  });

  it("rejects malformed, untyped, and oversized responses", async () => {
    const response = createAstrologyNatalViewResponse(await createAstrologyCalculationResource());
    const cases = [
      new Response(JSON.stringify(response), { headers: { "content-type": "text/plain" } }),
      new Response(JSON.stringify(response), {
        headers: {
          "content-length": String(astrologyNatalViewMaximumResponseBytes + 1),
          "content-type": "application/json",
        },
      }),
      new Response("{", { headers: { "content-type": "application/json" } }),
      Response.json({ ...response, sourceBirthTime: "private-time-canary" }),
    ];
    for (const reviewedResponse of cases) {
      await expect(
        requestAstrologyNatalView({
          fetcher: vi.fn(async () => reviewedResponse) as typeof fetch,
          isOnline: () => true,
          signal: new AbortController().signal,
        }),
      ).resolves.toEqual({ kind: "error" });
    }
  });
});

describe("astrology natal presentation", () => {
  const item = async (facts: Awaited<ReturnType<typeof createExactAstrologyFacts>>) => ({
    ...createAstrologyNatalViewResponse({
      createdAt: "2026-07-27T08:00:00.000Z",
      facts,
      id: "22222222-2222-4222-8222-222222222222",
    }).item!,
  });

  it("renders loading fail-closed markup without input or browser persistence", () => {
    const html = renderToStaticMarkup(
      createElement(AstrologyNatalResult, {
        messages,
        signInHref: createLocalActionHref("/en/sign-in"),
      }),
    );

    expect(html).toContain("Loading your saved chart");
    expect(html).toContain("<noscript>");
    expect(html).not.toMatch(/<form|<input|<textarea/iu);
    expect(html).not.toMatch(/localStorage|sessionStorage|indexedDB/iu);
  });

  it("renders exact facts with an auxiliary wheel and authoritative complete tables", async () => {
    const facts = await createExactAstrologyFacts();
    const html = renderToStaticMarkup(
      createElement(AstrologyNatalPresentation, { item: await item(facts), messages }),
    );

    expect(html).toContain("Exact-time facts");
    expect(html).toContain("Natal fact wheel");
    expect(html).toContain("House cusps");
    expect(html).toContain("Angles");
    expect(html).toContain("Major aspects");
    expect(html.match(/<tr/gu)?.length).toBeGreaterThanOrEqual(28);
    expect(html).not.toContain("private-profile-canary");
  });

  it("suppresses houses, angles, and aspects for approximate time", async () => {
    const facts = await createApproximateAstrologyFacts();
    const html = renderToStaticMarkup(
      createElement(AstrologyNatalPresentation, { item: await item(facts), messages }),
    );

    expect(html).toContain("Approximate-time facts");
    expect(html).toContain("90 minutes");
    expect(html).toContain("Placements");
    expect(html).not.toContain("House cusps");
    expect(html).not.toContain("Major aspects");
  });

  it("shows the unknown-time boundary without inventing a chart", async () => {
    const facts = await createUnknownTimeAstrologyFacts();
    const html = renderToStaticMarkup(
      createElement(AstrologyNatalPresentation, { item: await item(facts), messages }),
    );

    expect(html).toContain("Unknown-time boundary");
    expect(html).not.toContain("<svg");
    expect(html).not.toContain("<table");
  });

  it("keeps polar geometry and non-color-only responsive styling deterministic", () => {
    expect(astrologyPolarPoint(0, 100)).toEqual({ x: 160, y: 60 });
    expect(astrologyPolarPoint(90, 100)).toEqual({ x: 260, y: 160 });
    expect(styles).toMatch(/\.astrology-table-scroll[\s\S]*overflow-x: auto/gu);
    expect(styles).toMatch(/\.astrology-wheel-aspect--square[\s\S]*stroke-dasharray/gu);
    expect(styles).toMatch(/@media \(forced-colors: active\)[\s\S]*\.astrology-wheel-boundary/gu);
    expect(styles).toMatch(/@media \(width <= 40rem\)[\s\S]*\.astrology-result/gu);
  });
});
