import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  NumerologyCalculator,
  numerologyFormulaSummary,
  numerologyReductionSummary,
} from "../app/_components/numerology-calculator";
import {
  numerologyCalculationEndpoint,
  numerologyCalculationMaximumResponseBytes,
  requestNumerologyCalculation,
} from "../app/_components/numerology-calculator-transport";
import { getNumerologyMessages } from "../app/_i18n/numerology-messages";
import {
  calculateWebNumerologyAt,
  webNumerologyCatalogAsOf,
} from "../server/numerology-calculation";

const request = {
  birthDate: "1990-11-28",
  schemaVersion: "numerology-calculation-request.v1",
  targetYear: 2026,
} as const;

const facts = calculateWebNumerologyAt(request, webNumerologyCatalogAsOf);
const webStyles = readFileSync("apps/web/app/styles.css", "utf8");

const render = () =>
  renderToStaticMarkup(
    createElement(NumerologyCalculator, { messages: getNumerologyMessages("en") }),
  );

describe("server-rendered numerology calculator", () => {
  it("renders a private POST form, explicit empty state, and no name or persistence surface", () => {
    const html = render();

    expect(html).toContain(`action="${numerologyCalculationEndpoint}"`);
    expect(html).toContain('method="post"');
    expect(html).toContain('type="date"');
    expect(html).toContain('name="birth-date"');
    expect(html).toContain('name="target-year"');
    expect(html).toContain('inputMode="numeric"');
    expect(html).toContain('maxLength="4"');
    expect(html).toContain("Your calculation will unfold here");
    expect(html).toContain("<noscript>");
    expect(html).not.toContain('name="name"');
    expect(html).not.toContain("latinName");
    expect(html).not.toContain("Expression Number");
    expect(html).not.toMatch(/localStorage|sessionStorage|indexedDB/iu);
  });

  it("keeps sensitive controls disabled until hydration", () => {
    const html = render();

    expect(html.match(/<input[^>]*disabled=""/gu)).toHaveLength(2);
    expect(html.match(/<button[^>]*disabled=""/gu) ?? []).toHaveLength(2);
    expect(html).toContain("prevents birth data from being submitted");
  });

  it("keeps mobile, touch-target, and forced-color rules in the reviewed stylesheet", () => {
    expect(webStyles).toMatch(/\.numerology-layout[\s\S]*grid-template-columns/gu);
    expect(webStyles).toMatch(/\.numerology-method summary[\s\S]*min-block-size: 2\.75rem/gu);
    expect(webStyles).toMatch(
      /@media \(forced-colors: active\)[\s\S]*\.numerology-form,[\s\S]*\.numerology-result-card/gu,
    );
  });

  it("formats source digits and every reduction step without interpretation", () => {
    const [lifePath, birthday, personalYear] = facts.calculations;

    expect(numerologyFormulaSummary(lifePath!)).toBe("1 + 9 + 9 + 0 + 1 + 1 + 2 + 8 = 31");
    expect(numerologyReductionSummary(lifePath!)).toBe("31 → 4");
    expect(numerologyFormulaSummary(birthday!)).toBe("28");
    expect(numerologyReductionSummary(birthday!)).toBe("28 → 10 → 1");
    expect(numerologyFormulaSummary(personalYear!)).toBe("1 + 1 + 2 + 8 + 2 + 0 + 2 + 6 = 22");
    expect(numerologyReductionSummary(personalYear!)).toBe("22");
  });
});

describe("numerology calculator transport", () => {
  it("posts exact same-origin no-store JSON and accepts only strict facts", async () => {
    const fetcher = vi.fn(async () => Response.json(facts));
    const controller = new AbortController();
    const result = await requestNumerologyCalculation({
      fetcher: fetcher as typeof fetch,
      isOnline: () => true,
      request,
      signal: controller.signal,
    });

    expect(result).toEqual({ facts, kind: "success" });
    expect(fetcher).toHaveBeenCalledWith(
      numerologyCalculationEndpoint,
      expect.objectContaining({
        body: JSON.stringify(request),
        cache: "no-store",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );
  });

  it("does not send while offline", async () => {
    const fetcher = vi.fn();
    const result = await requestNumerologyCalculation({
      fetcher: fetcher as typeof fetch,
      isOnline: () => false,
      request,
      signal: new AbortController().signal,
    });

    expect(result).toEqual({ kind: "offline" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([
    [400, "invalid"],
    [413, "invalid"],
    [422, "invalid"],
    [503, "unavailable"],
    [500, "error"],
  ] as const)("maps HTTP %s to %s without automatic retry", async (status, kind) => {
    const result = await requestNumerologyCalculation({
      fetcher: vi.fn(async () => new Response(null, { status })) as typeof fetch,
      isOnline: () => true,
      request,
      signal: new AbortController().signal,
    });

    expect(result).toEqual({ kind });
  });

  it("rejects tampered facts as a generic error", async () => {
    const result = await requestNumerologyCalculation({
      fetcher: vi.fn(async () =>
        Response.json({ ...facts, engineVersion: "client-injected" }),
      ) as typeof fetch,
      isOnline: () => true,
      request,
      signal: new AbortController().signal,
    });

    expect(result).toEqual({ kind: "error" });
  });

  it.each([
    new Response(JSON.stringify(facts), { headers: { "content-type": "text/plain" } }),
    new Response(JSON.stringify(facts), {
      headers: {
        "content-length": String(numerologyCalculationMaximumResponseBytes + 1),
        "content-type": "application/json",
      },
    }),
    new Response("x".repeat(numerologyCalculationMaximumResponseBytes + 1), {
      headers: { "content-type": "application/json" },
    }),
    new Response("{", { headers: { "content-type": "application/json" } }),
  ])("rejects malformed or oversized success responses", async (response) => {
    const result = await requestNumerologyCalculation({
      fetcher: vi.fn(async () => response) as typeof fetch,
      isOnline: () => true,
      request,
      signal: new AbortController().signal,
    });

    expect(result).toEqual({ kind: "error" });
  });
});
