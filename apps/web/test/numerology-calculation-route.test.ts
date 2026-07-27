import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({ failCalculation: false }));

vi.mock("../server/numerology-calculation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../server/numerology-calculation")>();
  return {
    ...actual,
    calculateWebNumerology: (input: unknown) => {
      if (harness.failCalculation) throw new Error("private-internal-canary");
      return actual.calculateWebNumerology(input);
    },
  };
});

vi.mock("../config/server", () => ({
  getWebRuntimeConfiguration: () => ({
    brand: { canonicalOrigin: "https://example.test" },
  }),
}));

import {
  POST,
  numerologyCalculationApiPath,
  numerologyCalculationMaximumBodyBytes,
} from "../app/api/v1/numerology/calculate/route";

const makeRequest = (
  body: BodyInit | null,
  headers: Readonly<Record<string, string>> = {},
): NextRequest =>
  new NextRequest(`https://example.test${numerologyCalculationApiPath}`, {
    body,
    headers: {
      "content-type": "application/json",
      origin: "https://example.test",
      "sec-fetch-site": "same-origin",
      ...headers,
    },
    method: "POST",
  });

const validInput = JSON.stringify({
  birthDate: "1990-11-28",
  schemaVersion: "numerology-calculation-request.v1",
  targetYear: 2026,
});

describe("numerology calculation route", () => {
  beforeEach(() => {
    harness.failCalculation = false;
  });

  it("returns exact private facts and never enables cross-origin access", async () => {
    const response = await POST(makeRequest(validInput));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow, noarchive");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
    expect(body.input).toEqual({ birthDate: "1990-11-28", targetYear: 2026 });
    expect(body.calculations).toHaveLength(3);
  });

  it.each([
    [{ origin: "https://foreign.example" }, 403, "NUMEROLOGY_REQUEST_REJECTED"],
    [{ origin: "null" }, 403, "NUMEROLOGY_REQUEST_REJECTED"],
    [{ "sec-fetch-site": "cross-site" }, 403, "NUMEROLOGY_REQUEST_REJECTED"],
    [{ "content-type": "text/plain" }, 400, "NUMEROLOGY_BODY_INVALID"],
    [{ "content-type": "application/json; charset=utf-8" }, 400, "NUMEROLOGY_BODY_INVALID"],
    [{ "content-encoding": "gzip" }, 400, "NUMEROLOGY_BODY_INVALID"],
    [{ "transfer-encoding": "chunked" }, 400, "NUMEROLOGY_BODY_INVALID"],
    [{ "content-length": "unknown" }, 400, "NUMEROLOGY_BODY_INVALID"],
    [
      { "content-length": String(numerologyCalculationMaximumBodyBytes + 1) },
      413,
      "NUMEROLOGY_BODY_TOO_LARGE",
    ],
  ] as const)("fails closed for request metadata %#", async (headers, status, code) => {
    const response = await POST(makeRequest(validInput, headers));
    const text = await response.text();

    expect(response.status).toBe(status);
    expect(text).toContain(code);
    expect(text).not.toContain("foreign.example");
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it.each([
    "",
    "{",
    JSON.stringify({ birthDate: "1990-11-28", targetYear: 2026 }),
    JSON.stringify({
      birthDate: "1990-11-28",
      latinName: "private-name-canary",
      schemaVersion: "numerology-calculation-request.v1",
      targetYear: 2026,
    }),
    JSON.stringify({
      birthDate: "1990-02-30",
      schemaVersion: "numerology-calculation-request.v1",
      targetYear: 2026,
    }),
  ])("returns one redacted problem for invalid input %#", async (body) => {
    const response = await POST(makeRequest(body));
    const text = await response.text();

    expect(response.status).toBe(400);
    expect(text).toContain("NUMEROLOGY_BODY_INVALID");
    expect(text).not.toContain("private-name-canary");
    expect(text).not.toContain("1990-02-30");
  });

  it("bounds a stream even when content length is absent", async () => {
    const response = await POST(makeRequest("x".repeat(numerologyCalculationMaximumBodyBytes + 1)));

    expect(response.status).toBe(413);
    expect(await response.text()).toContain("NUMEROLOGY_BODY_TOO_LARGE");
  });

  it("rejects invalid UTF-8 without reflecting bytes", async () => {
    const response = await POST(makeRequest(new Uint8Array([0xc3, 0x28])));

    expect(response.status).toBe(400);
    expect(await response.text()).toContain("NUMEROLOGY_BODY_INVALID");
  });

  it("suppresses unknown internal failures and private input", async () => {
    harness.failCalculation = true;
    const response = await POST(makeRequest(validInput));
    const text = await response.text();

    expect(response.status).toBe(503);
    expect(text).toContain("NUMEROLOGY_UNAVAILABLE");
    expect(text).not.toContain("private-internal-canary");
    expect(text).not.toContain("1990-11-28");
  });
});
