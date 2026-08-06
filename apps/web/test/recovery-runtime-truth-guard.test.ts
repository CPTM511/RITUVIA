import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const runtimeVerifier = readFileSync(
  new URL("../../../scripts/verify-recovery-runtime-truth-browser.mjs", import.meta.url),
  "utf8",
);
const tarotVerifier = readFileSync(
  new URL("../../../scripts/verify-recovery-tarot-browser.mjs", import.meta.url),
  "utf8",
);
const item8Verifier = readFileSync(
  new URL("../../../scripts/verify-recovery-item-8-browser.mjs", import.meta.url),
  "utf8",
);
const mockedFullLoopVerifier = readFileSync(
  new URL("../../../scripts/verify-full-loop-browser.mjs", import.meta.url),
  "utf8",
);

describe("Recovery Item 8 preserved runtime-truth guard", () => {
  it("keeps the legacy full-loop browser evidence explicitly classified as mocked", () => {
    expect(mockedFullLoopVerifier).toContain('context.route("**/api/v1/**"');
    expect(mockedFullLoopVerifier).toContain("route.fulfill");
  });

  it("rejects fulfillment or interception APIs from the staging runtime verifier", () => {
    for (const forbidden of [
      "context.route(",
      "page.route(",
      "route.abort(",
      "route.continue(",
      "route.fulfill(",
      "route.fallback(",
    ]) {
      expect(runtimeVerifier).not.toContain(forbidden);
    }
    expect(runtimeVerifier).toContain('page.on("response"');
    expect(runtimeVerifier).toContain('data-runtime-state="passed"');
    expect(runtimeVerifier).toContain("desktop");
    expect(runtimeVerifier).toContain("mobile");
  });

  it("rejects fulfillment, interception, and Provider AI calls from the Item 7 verifier", () => {
    for (const forbidden of [
      "context.route(",
      "page.route(",
      "route.abort(",
      "route.continue(",
      "route.fulfill(",
      "route.fallback(",
    ]) {
      expect(tarotVerifier).not.toContain(forbidden);
    }
    expect(tarotVerifier).toContain('page.on("response"');
    expect(tarotVerifier).toContain("mockFulfillmentCount: 0");
    expect(tarotVerifier).toContain("forbiddenRequestPattern");
    expect(tarotVerifier).toContain("recoveryItem, 7");
  });

  it("rejects fulfillment and interception from the real Item 8 verifier", () => {
    for (const forbidden of [
      "context.route(",
      "page.route(",
      "route.abort(",
      "route.continue(",
      "route.fulfill(",
      "route.fallback(",
    ]) {
      expect(item8Verifier).not.toContain(forbidden);
    }
    expect(item8Verifier).toContain('page.on("response"');
    expect(item8Verifier).toContain("mockFulfillmentCount: 0");
    expect(item8Verifier).toContain("forbiddenRequestPattern");
    expect(item8Verifier).toContain("recoveryItem, 8");
    expect(item8Verifier).toContain("desktop");
    expect(item8Verifier).toContain("mobile");
  });
});
