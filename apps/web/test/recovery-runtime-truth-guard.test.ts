import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const runtimeVerifier = readFileSync(
  new URL("../../../scripts/verify-recovery-runtime-truth-browser.mjs", import.meta.url),
  "utf8",
);
const mockedFullLoopVerifier = readFileSync(
  new URL("../../../scripts/verify-full-loop-browser.mjs", import.meta.url),
  "utf8",
);

describe("Recovery Item 4 mock detection guard", () => {
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
});
