import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({ failEvaluation: false }));

vi.mock("@rituvia/domain", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@rituvia/domain")>();
  return {
    ...actual,
    evaluateQuestionIntake: (input: unknown) => {
      if (harness.failEvaluation) throw new Error("private-internal-canary");
      return actual.evaluateQuestionIntake(input);
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
  questionIntakeApiPath,
  questionIntakeMaximumBodyBytes,
} from "../app/api/v1/intake/evaluate/route";

const makeRequest = (
  body: BodyInit | null,
  headers: Readonly<Record<string, string>> = {},
): NextRequest =>
  new NextRequest(`https://example.test${questionIntakeApiPath}`, {
    body,
    headers: {
      "content-type": "application/json",
      origin: "https://example.test",
      "sec-fetch-site": "same-origin",
      "x-rituvia-correlation-id": "req_11111111111111111111111111111111",
      ...headers,
    },
    method: "POST",
  });

const input = (question?: string) =>
  JSON.stringify({
    locale: "en",
    ...(question === undefined ? {} : { question }),
    schemaVersion: "1",
    themeCode: "open_reflection",
  });

describe("question intake route", () => {
  beforeEach(() => {
    harness.failEvaluation = false;
  });

  it.each([
    [undefined, "allowed", true, null],
    ["Tell me my future.", "reframed", false, "agency_general"],
    ["Can you diagnose whether I have cancer?", "blocked", false, "professional_preparation"],
    ["I am planning to end my life.", "crisis", false, null],
  ] as const)(
    "returns a private public DTO for %s as %s",
    async (question, state, canContinue, code) => {
      const response = await POST(makeRequest(input(question)));
      const text = await response.text();
      const body = JSON.parse(text) as Record<string, unknown>;

      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
      expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow, noarchive");
      expect(response.headers.get("access-control-allow-origin")).toBeNull();
      expect(body).toEqual({
        canContinue,
        locale: "en",
        policyVersion: "question-intake.en.v1",
        schemaVersion: "1",
        state,
        suggestedQuestionCode: code,
        themeCode: "open_reflection",
      });
      expect(text).not.toContain("riskCategories");
      if (question !== undefined) expect(text).not.toContain(question);
    },
  );

  it.each([
    [{ origin: "https://foreign.example" }, 403, "INTAKE_REQUEST_REJECTED"],
    [{ origin: "null" }, 403, "INTAKE_REQUEST_REJECTED"],
    [{ "sec-fetch-site": "cross-site" }, 403, "INTAKE_REQUEST_REJECTED"],
    [{ "content-type": "text/plain" }, 400, "INTAKE_BODY_INVALID"],
    [{ "content-type": "application/json; charset=utf-8" }, 400, "INTAKE_BODY_INVALID"],
    [{ "content-encoding": "gzip" }, 400, "INTAKE_BODY_INVALID"],
    [{ "transfer-encoding": "chunked" }, 400, "INTAKE_BODY_INVALID"],
    [{ "content-length": "unknown" }, 400, "INTAKE_BODY_INVALID"],
    [
      { "content-length": String(questionIntakeMaximumBodyBytes + 1) },
      413,
      "INTAKE_BODY_TOO_LARGE",
    ],
  ] as const)("fails closed for request metadata %#", async (headers, status, code) => {
    const response = await POST(makeRequest(input(), headers));
    const text = await response.text();

    expect(response.status).toBe(status);
    expect(text).toContain(code);
    expect(text).not.toContain("foreign.example");
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it.each([
    "",
    "{",
    JSON.stringify({ locale: "en", schemaVersion: "1", themeCode: "unknown" }),
    JSON.stringify({
      locale: "en",
      question: "private-canary",
      schemaVersion: "1",
      themeCode: "self",
      unexpected: true,
    }),
  ])("returns one redacted problem for invalid input %#", async (body) => {
    const response = await POST(makeRequest(body));
    const text = await response.text();

    expect(response.status).toBe(400);
    expect(text).toContain("INTAKE_BODY_INVALID");
    expect(text).not.toContain("private-canary");
    expect(text).not.toContain("unknown");
  });

  it("bounds a stream even when content length is absent", async () => {
    const response = await POST(makeRequest("x".repeat(questionIntakeMaximumBodyBytes + 1)));

    expect(response.status).toBe(413);
    expect(await response.text()).toContain("INTAKE_BODY_TOO_LARGE");
  });

  it("rejects invalid UTF-8 without reflecting bytes", async () => {
    const response = await POST(makeRequest(new Uint8Array([0xc3, 0x28])));

    expect(response.status).toBe(400);
    expect(await response.text()).toContain("INTAKE_BODY_INVALID");
  });

  it("suppresses unknown internal failures", async () => {
    harness.failEvaluation = true;
    const response = await POST(makeRequest(input("private-question-canary")));
    const text = await response.text();

    expect(response.status).toBe(503);
    expect(text).toContain("INTAKE_UNAVAILABLE");
    expect(text).not.toContain("private-internal-canary");
    expect(text).not.toContain("private-question-canary");
  });
});
