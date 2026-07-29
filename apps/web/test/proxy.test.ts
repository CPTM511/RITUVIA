import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  deploymentEnvironment: "local" as "local" | "preview" | "production" | "staging",
  end: vi.fn(),
  intakeAvailability: "disabled" as "disabled" | "enabled",
  numerologyAvailability: "disabled" as "disabled" | "enabled",
  tarotReadingAvailability: "disabled" as "disabled" | "enabled",
}));

vi.mock("../server/question-intake-state", () => ({
  loadQuestionIntakeAvailability: () => harness.intakeAvailability,
}));

vi.mock("../server/numerology-state", () => ({
  loadNumerologyAvailability: () => harness.numerologyAvailability,
}));

vi.mock("../server/tarot-reading-state", () => ({
  loadTarotReadingAvailability: () => harness.tarotReadingAvailability,
}));

vi.mock("../config/server", () => ({
  getWebRuntimeConfiguration: () => ({
    brand: { canonicalOrigin: "https://example.test" },
    deploymentEnvironment: harness.deploymentEnvironment,
  }),
}));

vi.mock("../server/request-observability", () => ({
  classifyHttpMethod: (method: string) => method,
  startWebRequestObservability: () => ({
    context: { correlationId: "req_11111111111111111111111111111111" },
    end: harness.end,
    toTraceHeaders: () => ({
      traceparent: "00-11111111111111111111111111111111-1111111111111111-01",
    }),
  }),
}));

import { proxy } from "../proxy";

const request = (pathname: string, init?: ConstructorParameters<typeof NextRequest>[1]) =>
  new NextRequest(`http://localhost${pathname}`, init);

const noIndex = "noindex, nofollow, noarchive";

describe("public shell request and crawl gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    harness.deploymentEnvironment = "local";
    harness.intakeAvailability = "disabled";
    harness.numerologyAvailability = "enabled";
    harness.tarotReadingAvailability = "disabled";
  });

  it("allows an explicitly enabled canonical shell with restrictive response headers", async () => {
    const response = await proxy(request("/en"));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("x-request-id")).toBe("req_11111111111111111111111111111111");
    expect(response.headers.get("content-security-policy")).toContain("connect-src 'self'");
    expect(response.headers.get("content-security-policy")).toContain("font-src 'none'");
    expect(response.headers.get("content-security-policy")).toContain("object-src 'none'");
    expect(response.headers.get("content-security-policy")).toContain("script-src-attr 'none'");
    expect(response.headers.get("content-security-policy")).toContain(
      "style-src-attr 'unsafe-hashes' 'sha256-zlqnbDt84zf1iSefLU/ImC54isoprH/MRiVZGskwexk='",
    );
    expect(response.headers.get("permissions-policy")).toContain("payment=()");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-robots-tag")).toBe(noIndex);
    expect(harness.end).toHaveBeenCalledWith({ outcome: "success" });
  });

  it.each([
    "/en/account",
    "/en/readings/astrology",
    "/en/sanctuary",
    "/en/sanctuary?checkout=canceled&order_id=33333333-3333-4333-8333-333333333333",
    "/en/sign-in",
    "/en/sign-in?returnTo=%2Fen%2Fsanctuary",
    "/en/checkout/local?checkout_id=local_checkout.123",
    "/en/checkout/return?order_id=33333333-3333-4333-8333-333333333333",
  ])("allows an enabled exact private MVP document without indexing: %s", async (pathname) => {
    const response = await proxy(request(pathname));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("x-robots-tag")).toBe(noIndex);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
  });

  it("allows only the exact saved astrology page and read API", async () => {
    const page = await proxy(request("/en/readings/astrology"));
    const reviewedRsc = await proxy(
      request("/en/readings/astrology?_rsc=abc_123", { headers: { rsc: "1" } }),
    );
    const api = await proxy(request("/api/v1/readings/astrology/natal"));

    for (const response of [page, reviewedRsc, api]) {
      expect(response.status).toBe(200);
      expect(response.headers.get("x-middleware-next")).toBe("1");
      expect(response.headers.get("x-robots-tag")).toBe(noIndex);
      expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    }
  });

  it.each([
    ["POST", "/api/v1/readings/astrology/natal"],
    ["GET", "/api/v1/readings/astrology/natal/"],
    ["GET", "/api/v1/readings/astrology/natal?birthDate=private-canary"],
    ["GET", "/api/v1/readings/astrology/natal.rsc"],
    ["POST", "/en/readings/astrology"],
    ["GET", "/en/readings/astrology/"],
    ["GET", "/en/readings/astrology?birthDate=private-canary"],
    ["GET", "/en/readings/astrology.rsc"],
  ])("rejects unreviewed astrology variant %s %s before lookup", async (method, pathname) => {
    const response = await proxy(request(pathname, { method }));

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("");
    expect(response.headers.get("x-robots-tag")).toBe(noIndex);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("allows only the exact local authentication preview endpoint", async () => {
    const reviewed = await proxy(request("/api/v1/auth/local-preview"));
    const query = await proxy(request("/api/v1/auth/local-preview?token=private-canary"));
    const post = await proxy(request("/api/v1/auth/local-preview", { method: "POST" }));
    const trailingSlash = await proxy(request("/api/v1/auth/local-preview/"));

    expect(reviewed.status).toBe(200);
    expect(reviewed.headers.get("x-middleware-next")).toBe("1");
    expect(reviewed.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    for (const rejected of [query, post, trailingSlash]) {
      expect(rejected.status).toBe(404);
      expect(await rejected.text()).toBe("");
    }
  });

  it("allows only bounded account history and reading-list queries", async () => {
    for (const pathname of [
      "/api/v1/me/history",
      "/api/v1/me/history?limit=10",
      "/api/v1/me/history?limit=10&cursor=abc_123",
      "/api/v1/me/readings?cursor=abc_123",
    ]) {
      const response = await proxy(request(pathname));
      expect(response.status).toBe(200);
      expect(response.headers.get("x-middleware-next")).toBe("1");
      expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    }
    for (const pathname of [
      "/api/v1/me/history?limit=0",
      "/api/v1/me/history?limit=51",
      "/api/v1/me/history?cursor=private%20canary",
      "/api/v1/me/history?limit=10&limit=9",
      "/api/v1/me/history?userId=33333333-3333-4333-8333-333333333333",
    ]) {
      const response = await proxy(request(pathname));
      expect(response.status).toBe(404);
      expect(await response.text()).toBe("");
    }
  });

  it("allows only exact account consent read and mutation shapes", async () => {
    for (const method of ["GET", "POST"] as const) {
      const response = await proxy(request("/api/v1/me/consents", { method }));
      expect(response.status).toBe(200);
      expect(response.headers.get("x-middleware-next")).toBe("1");
      expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    }
    for (const [method, pathname] of [
      ["PATCH", "/api/v1/me/consents"],
      ["GET", "/api/v1/me/consents?purpose=ai_personalization"],
      ["POST", "/api/v1/me/consents/"],
    ] as const) {
      const response = await proxy(request(pathname, { method }));
      expect(response.status).toBe(404);
      expect(await response.text()).toBe("");
    }
  });

  it("allows only exact privacy export and deletion API shapes", async () => {
    const exportId = "33333333-3333-4333-8333-333333333333";
    for (const [method, pathname] of [
      ["POST", "/api/v1/privacy/export"],
      ["GET", `/api/v1/privacy/exports/${exportId}`],
      ["POST", `/api/v1/privacy/exports/${exportId}/download`],
      ["POST", "/api/v1/privacy/deletions"],
    ] as const) {
      const response = await proxy(request(pathname, { method }));
      expect(response.status).toBe(200);
      expect(response.headers.get("x-middleware-next")).toBe("1");
      expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    }
    for (const [method, pathname] of [
      ["GET", "/api/v1/privacy/export"],
      ["POST", `/api/v1/privacy/exports/${exportId}`],
      ["GET", `/api/v1/privacy/exports/${exportId}/download`],
      ["GET", "/api/v1/privacy/deletions"],
      ["POST", "/api/v1/privacy/export/"],
      ["GET", "/api/v1/privacy/exports/not-a-uuid"],
      ["POST", `/api/v1/privacy/exports/${exportId}/download?private=canary`],
    ] as const) {
      const response = await proxy(request(pathname, { method }));
      expect(response.status).toBe(404);
      expect(await response.text()).toBe("");
    }
  });

  it("permits indexing only for production canonical HTML, never framework representations", async () => {
    harness.deploymentEnvironment = "production";

    const canonical = await proxy(request("/en/privacy", { headers: { accept: "text/html" } }));
    const numerologyCanonical = await proxy(
      request("/en/numerology/life-path-number", { headers: { accept: "text/html" } }),
    );
    const astrologyReviewCandidate = await proxy(
      request("/en/astrology/natal-chart-calculation", {
        headers: { accept: "text/html" },
      }),
    );
    const profileDoorway = await proxy(
      request("/en/numerology/number-1", { headers: { accept: "text/html" } }),
    );
    const reviewedRsc = await proxy(
      request("/en/privacy", {
        headers: { accept: "text/x-component", "next-router-prefetch": "1", rsc: "1" },
      }),
    );
    const bareRsc = await proxy(request("/en/privacy", { headers: { rsc: "1" } }));
    const directRsc = await proxy(request("/en/privacy.rsc"));

    expect(canonical.status).toBe(200);
    expect(canonical.headers.get("x-robots-tag")).toBeNull();
    expect(numerologyCanonical.status).toBe(200);
    expect(numerologyCanonical.headers.get("x-robots-tag")).toBeNull();
    expect(astrologyReviewCandidate.status).toBe(200);
    expect(astrologyReviewCandidate.headers.get("x-robots-tag")).toBeNull();
    expect(profileDoorway.status).toBe(404);
    expect(profileDoorway.headers.get("x-robots-tag")).toBe(noIndex);
    expect(reviewedRsc.status).toBe(200);
    expect(reviewedRsc.headers.get("x-robots-tag")).toBe(noIndex);
    expect(reviewedRsc.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(bareRsc.status).toBe(404);
    expect(bareRsc.headers.get("x-robots-tag")).toBe(noIndex);
    expect(bareRsc.headers.get("cache-control")).toBe("no-store, max-age=0");
    expect(directRsc.status).toBe(404);
    expect(directRsc.headers.get("x-robots-tag")).toBe(noIndex);
    expect(directRsc.headers.get("cache-control")).toBe("no-store, max-age=0");
  });

  it("indexes generic canonical HTML while RSC signals override spoofed Accept headers", async () => {
    harness.deploymentEnvironment = "production";

    const generic = await proxy(request("/en"));
    const spoofedRsc = await proxy(request("/en", { headers: { accept: "text/html", rsc: "1" } }));

    expect(generic.headers.get("x-robots-tag")).toBeNull();
    expect(spoofedRsc.status).toBe(404);
    expect(spoofedRsc.headers.get("x-robots-tag")).toBe(noIndex);
    expect(spoofedRsc.headers.get("cache-control")).toBe("no-store, max-age=0");
  });

  it("keeps numerology closed while its independent catalog activation is absent", async () => {
    harness.numerologyAvailability = "disabled";

    const page = await proxy(request("/en/readings/numerology"));
    const api = await proxy(request("/api/v1/numerology/calculate", { method: "POST" }));

    expect(page.status).toBe(404);
    expect(api.status).toBe(404);
    expect(page.headers.get("cache-control")).toContain("no-store");
    expect(api.headers.get("cache-control")).toContain("no-store");
  });

  it("allows only the independently enabled private tarot create, owner read, report, and interpretation APIs", async () => {
    harness.tarotReadingAvailability = "enabled";
    const readingId = "33333333-3333-4333-8333-333333333333";

    const create = await proxy(request("/api/v1/readings/tarot", { method: "POST" }));
    const read = await proxy(request(`/api/v1/readings/${readingId}`));
    const report = await proxy(request(`/api/v1/readings/${readingId}/report`, { method: "POST" }));
    const interpretationStart = await proxy(
      request(`/api/v1/readings/${readingId}/interpretation`, { method: "POST" }),
    );
    const interpretationPoll = await proxy(request(`/api/v1/readings/${readingId}/interpretation`));

    for (const response of [create, read, report, interpretationStart, interpretationPoll]) {
      expect(response.status).toBe(200);
      expect(response.headers.get("x-middleware-next")).toBe("1");
      expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
      expect(response.headers.get("x-robots-tag")).toBe(noIndex);
    }
  });

  it.each([
    ["GET", "/api/v1/readings/tarot"],
    ["OPTIONS", "/api/v1/readings/tarot"],
    ["POST", "/api/v1/readings/tarot/"],
    ["POST", "/api/v1/readings/tarot?question=private-canary"],
    ["POST", "/api/v1/readings/tarot.rsc"],
    ["GET", "/api/v1/readings/33333333-3333-4333-8333-333333333333?private=canary"],
    ["GET", "/api/v1/readings/not-a-reading"],
    ["HEAD", "/api/v1/readings/33333333-3333-4333-8333-333333333333"],
    ["OPTIONS", "/api/v1/readings/33333333-3333-4333-8333-333333333333"],
    ["POST", "/api/v1/readings/33333333-3333-4333-8333-333333333333"],
    ["GET", "/api/v1/readings/33333333-3333-4333-8333-333333333333/"],
    ["GET", "/api/v1/readings/33333333-3333-4333-8333-333333333333.rsc"],
    ["GET", "/api/v1/readings/33333333-3333-4333-8333-333333333333.segments/private"],
    ["GET", "/api/v1/readings/tarot/33333333-3333-4333-8333-333333333333"],
    ["GET", "/api/v1/readings/33333333-3333-4333-8333-333333333333/report"],
    ["HEAD", "/api/v1/readings/33333333-3333-4333-8333-333333333333/report"],
    ["OPTIONS", "/api/v1/readings/33333333-3333-4333-8333-333333333333/report"],
    ["PUT", "/api/v1/readings/33333333-3333-4333-8333-333333333333/report"],
    ["POST", "/api/v1/readings/33333333-3333-4333-8333-333333333333/report/"],
    ["POST", "/api/v1/readings/33333333-3333-4333-8333-333333333333/report?private=canary"],
    ["POST", "/api/v1/readings/33333333-3333-4333-8333-333333333333/report.rsc"],
    ["POST", "/api/v1/readings/not-a-reading/report"],
    ["HEAD", "/api/v1/readings/33333333-3333-4333-8333-333333333333/interpretation"],
    ["OPTIONS", "/api/v1/readings/33333333-3333-4333-8333-333333333333/interpretation"],
    ["PUT", "/api/v1/readings/33333333-3333-4333-8333-333333333333/interpretation"],
    ["POST", "/api/v1/readings/33333333-3333-4333-8333-333333333333/interpretation/"],
    ["GET", "/api/v1/readings/33333333-3333-4333-8333-333333333333/interpretation?private=canary"],
    ["POST", "/api/v1/readings/33333333-3333-4333-8333-333333333333/interpretation.rsc"],
    ["GET", "/api/v1/readings/not-a-reading/interpretation"],
  ])("rejects unreviewed tarot variant %s %s before lookup", async (method, pathname) => {
    harness.tarotReadingAvailability = "enabled";
    const response = await proxy(request(pathname, { method }));

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("x-robots-tag")).toBe(noIndex);
  });

  it.each([
    { accept: "text/x-component" },
    { "next-router-prefetch": "1" },
    { "next-router-segment-prefetch": "1" },
    { "next-router-state-tree": "private-canary" },
    { rsc: "1" },
  ])("rejects framework-shaped private reading requests before lookup: %#", async (headers) => {
    harness.tarotReadingAvailability = "enabled";
    const responses = await Promise.all([
      proxy(
        request("/api/v1/readings/33333333-3333-4333-8333-333333333333", {
          headers,
        }),
      ),
      proxy(
        request("/api/v1/readings/33333333-3333-4333-8333-333333333333/report", {
          headers,
          method: "POST",
        }),
      ),
      proxy(
        request("/api/v1/readings/33333333-3333-4333-8333-333333333333/interpretation", {
          headers,
        }),
      ),
      proxy(
        request("/api/v1/readings/33333333-3333-4333-8333-333333333333/interpretation", {
          headers,
          method: "POST",
        }),
      ),
    ]);

    for (const response of responses) {
      expect(response.status).toBe(404);
      expect(await response.text()).toBe("");
      expect(response.headers.get("cache-control")).toContain("no-store");
    }
  });

  it("keeps tarot APIs closed without a separately approved catalog activation", async () => {
    const create = await proxy(request("/api/v1/readings/tarot", { method: "POST" }));
    const read = await proxy(request("/api/v1/readings/33333333-3333-4333-8333-333333333333"));
    const report = await proxy(
      request("/api/v1/readings/33333333-3333-4333-8333-333333333333/report", {
        method: "POST",
      }),
    );
    const interpretationStart = await proxy(
      request("/api/v1/readings/33333333-3333-4333-8333-333333333333/interpretation", {
        method: "POST",
      }),
    );
    const interpretationPoll = await proxy(
      request("/api/v1/readings/33333333-3333-4333-8333-333333333333/interpretation"),
    );

    expect(create.status).toBe(404);
    expect(read.status).toBe(404);
    expect(report.status).toBe(404);
    expect(interpretationStart.status).toBe(404);
    expect(interpretationPoll.status).toBe(404);
  });

  it.each(["one-card", "three-card"] as const)(
    "allows the private %s page only with the same approved tarot activation",
    async (mode) => {
      harness.tarotReadingAvailability = "enabled";
      const pathname = `/en/tarot/${mode}`;

      const page = await proxy(request(pathname));
      const reviewedRsc = await proxy(
        request(`${pathname}?_rsc=abc_123`, { headers: { rsc: "1" } }),
      );

      for (const response of [page, reviewedRsc]) {
        expect(response.status).toBe(200);
        expect(response.headers.get("x-middleware-next")).toBe("1");
        expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
        expect(response.headers.get("x-robots-tag")).toBe(noIndex);
      }
    },
  );

  it.each([
    ["POST", "/en/tarot/one-card"],
    ["GET", "/en/tarot/one-card/"],
    ["GET", "/en/tarot/one-card?question=private-canary"],
    ["GET", "/en/tarot/one-card.rsc"],
    ["POST", "/en/tarot/three-card"],
    ["GET", "/en/tarot/three-card/"],
    ["GET", "/en/tarot/three-card?question=private-canary"],
    ["GET", "/en/tarot/three-card.rsc"],
  ])("rejects unreviewed tarot page variant %s %s before lookup", async (method, pathname) => {
    harness.tarotReadingAvailability = "enabled";
    const response = await proxy(request(pathname, { method }));

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("x-robots-tag")).toBe(noIndex);
  });

  it.each(["one-card", "three-card"] as const)(
    "keeps the %s page closed while approved tarot activation is absent",
    async (mode) => {
      const response = await proxy(request(`/en/tarot/${mode}`));

      expect(response.status).toBe(404);
      expect(response.headers.get("cache-control")).toContain("no-store");
    },
  );

  it("allows only the exact anonymous numerology page and calculation API", async () => {
    const page = await proxy(request("/en/readings/numerology"));
    const reviewedRsc = await proxy(
      request("/en/readings/numerology?_rsc=abc_123", { headers: { rsc: "1" } }),
    );
    const api = await proxy(request("/api/v1/numerology/calculate", { method: "POST" }));

    for (const response of [page, reviewedRsc, api]) {
      expect(response.status).toBe(200);
      expect(response.headers.get("x-middleware-next")).toBe("1");
      expect(response.headers.get("x-robots-tag")).toBe(noIndex);
      expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    }
  });

  it.each([
    ["GET", "/api/v1/numerology/calculate"],
    ["OPTIONS", "/api/v1/numerology/calculate"],
    ["POST", "/api/v1/numerology/calculate/"],
    ["POST", "/api/v1/numerology/calculate?birthDate=private-canary"],
    ["POST", "/api/v1/numerology/calculate.rsc"],
    ["POST", "/en/readings/numerology"],
    ["GET", "/en/readings/numerology/"],
    ["GET", "/en/readings/numerology?birthDate=private-canary"],
    ["GET", "/en/readings/numerology.rsc"],
  ])("rejects unreviewed numerology variant %s %s before lookup", async (method, pathname) => {
    const response = await proxy(request(pathname, { method }));

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("");
    expect(response.headers.get("x-robots-tag")).toBe(noIndex);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("allows only the independently enabled private intake page and API", async () => {
    harness.intakeAvailability = "enabled";

    const page = await proxy(request("/en/intake"));
    const reviewedRsc = await proxy(request("/en/intake?_rsc=abc_123", { headers: { rsc: "1" } }));
    const api = await proxy(request("/api/v1/intake/evaluate", { method: "POST" }));

    for (const response of [page, reviewedRsc, api]) {
      expect(response.status).toBe(200);
      expect(response.headers.get("x-middleware-next")).toBe("1");
      expect(response.headers.get("x-robots-tag")).toBe(noIndex);
      expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    }
  });

  it.each([
    ["GET", "/api/v1/intake/evaluate"],
    ["OPTIONS", "/api/v1/intake/evaluate"],
    ["POST", "/api/v1/intake/evaluate/"],
    ["POST", "/api/v1/intake/evaluate?question=private-canary"],
    ["POST", "/api/v1/intake/evaluate.rsc"],
    ["POST", "/en/intake"],
    ["GET", "/en/intake/"],
    ["GET", "/en/intake?question=private-canary"],
    ["GET", "/en/intake.rsc"],
  ])("rejects unreviewed intake variant %s %s before lookup", async (method, pathname) => {
    harness.intakeAvailability = "enabled";
    const response = await proxy(request(pathname, { method }));

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("");
    expect(response.headers.get("x-robots-tag")).toBe(noIndex);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("keeps intake closed while its independent activation is absent", async () => {
    const page = await proxy(request("/en/intake"));
    const api = await proxy(request("/api/v1/intake/evaluate", { method: "POST" }));

    expect(page.status).toBe(404);
    expect(api.status).toBe(404);
  });

  it.each([
    "/EN",
    "/fr",
    "/en-US",
    "/en/other",
    "/en/journal",
    "/en/checkout",
    "/en/reading/private-id",
    "/en/privacy/",
    "/en/Privacy",
    "/en/privacy/other",
    "/en/unknown",
    "/EN.rsc",
    "/EN.segments/_full.segment.rsc",
    "/en/privacy.segments",
    "//en",
    "/en%2fprivacy",
    "/en%5cprivacy",
    "/en;%2fprivacy",
    "/en/%2e%2e/privacy",
    "/robots.txt/",
    "/sitemap.xml/",
    "/sitemaps/en-private.xml",
    "/sitemaps/en-pages.xml/",
  ])("rejects unsupported or private paths before downstream handling: %s", async (pathname) => {
    const response = await proxy(request(pathname));

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("");
    expect(response.headers.get("x-robots-tag")).toBe(noIndex);
  });

  it.each([
    "/en?question=private-canary",
    "/en/privacy?birthTime=private-canary",
    "/en?_rsc=private-canary",
    "/robots.txt?preview=private-canary",
    "/sitemap.xml?preview=private-canary",
    "/sitemaps/en-pages.xml?preview=private-canary",
  ])("rejects query variants without evaluating or reflecting them: %s", async (pathname) => {
    const response = await proxy(request(pathname));

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("");
    expect(response.headers.get("location")).toBeNull();
    expect([...response.headers.values()].join(" ")).not.toContain("private-canary");
  });

  it("allows only one bounded internal RSC query and never marks it indexable", async () => {
    harness.deploymentEnvironment = "production";

    const reviewed = await proxy(request("/en?_rsc=abc_123", { headers: { rsc: "1" } }));
    const extra = await proxy(
      request("/en?_rsc=abc_123&question=private-canary", { headers: { rsc: "1" } }),
    );

    expect(reviewed.status).toBe(200);
    expect(reviewed.headers.get("x-robots-tag")).toBe(noIndex);
    expect(reviewed.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(extra.status).toBe(404);
    expect(extra.headers.get("location")).toBeNull();
  });

  it("rejects non-read public methods before downstream handling", async () => {
    const response = await proxy(request("/en", { method: "POST" }));

    expect(response.status).toBe(404);
    expect(response.headers.get("x-robots-tag")).toBe(noIndex);
  });

  it("allows only the exact enabled anonymous-session POST as a private API handoff", async () => {
    const response = await proxy(
      request("/api/v1/anonymous/session", {
        headers: { origin: "https://example.test" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(response.headers.get("x-robots-tag")).toBe(noIndex);
  });

  it.each([
    ["GET", "/api/v1/anonymous/session"],
    ["OPTIONS", "/api/v1/anonymous/session"],
    ["POST", "/api/v1/anonymous/session/"],
    ["POST", "/api/v1/anonymous/session?private=canary"],
    ["POST", "/api/v1/anonymous/session.rsc"],
  ])(
    "rejects unreviewed anonymous-session variant %s %s before lookup",
    async (method, pathname) => {
      const response = await proxy(request(pathname, { method }));

      expect(response.status).toBe(404);
      expect(await response.text()).toBe("");
      expect(response.headers.get("cache-control")).toContain("no-store");
      expect(response.headers.get("x-robots-tag")).toBe(noIndex);
    },
  );

  it("serves fail-closed non-production discovery without a database lookup", async () => {
    const robots = await proxy(request("/robots.txt"));
    const sitemap = await proxy(request("/sitemap.xml"));
    const sitemapShard = await proxy(request("/sitemaps/en-pages.xml"));

    expect(robots.status).toBe(200);
    expect(robots.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(robots.headers.get("x-robots-tag")).toBe(noIndex);
    expect(await robots.text()).toBe("User-agent: *\nDisallow: /\n");
    expect(sitemap.status).toBe(404);
    expect(sitemap.headers.get("content-type")).toBe("application/xml; charset=utf-8");
    expect(await sitemap.text()).toBe("");
    expect(sitemapShard.status).toBe(404);
    expect(await sitemapShard.text()).toBe("");
  });

  it("publishes production discovery from the reviewed finite inventory", async () => {
    harness.deploymentEnvironment = "production";

    const robots = await proxy(request("/robots.txt"));
    const sitemap = await proxy(request("/sitemap.xml"));
    const sitemapShard = await proxy(request("/sitemaps/en-pages.xml"));

    expect(robots.status).toBe(200);
    expect(await robots.text()).toContain("Allow: /en$");
    expect(await proxy(request("/robots.txt"))).toMatchObject({ status: 200 });
    expect(await sitemap.text()).toContain("<loc>https://example.test/sitemaps/en-pages.xml</loc>");
    expect(await sitemapShard.text()).toContain("<loc>https://example.test/en</loc>");
  });

  it("keeps HEAD discovery status and headers while suppressing bodies", async () => {
    const robots = await proxy(request("/robots.txt", { method: "HEAD" }));
    const sitemap = await proxy(request("/sitemap.xml", { method: "HEAD" }));
    const sitemapShard = await proxy(request("/sitemaps/en-pages.xml", { method: "HEAD" }));

    expect(robots.status).toBe(200);
    expect(await robots.text()).toBe("");
    expect(robots.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(sitemap.status).toBe(404);
    expect(await sitemap.text()).toBe("");
    expect(sitemapShard.status).toBe(404);
    expect(await sitemapShard.text()).toBe("");
  });

  it("treats a production canonical HTML HEAD request as the same indexable resource", async () => {
    harness.deploymentEnvironment = "production";

    const response = await proxy(
      request("/en/methodology", { headers: { accept: "text/html" }, method: "HEAD" }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("x-robots-tag")).toBeNull();
  });

  it.each(["/icon.svg", "/_next/static/app.js"])(
    "leaves reviewed infrastructure paths outside feature availability checks: %s",
    async (pathname) => {
      const response = await proxy(request(pathname));

      expect(response.status).toBe(200);
      expect(response.headers.get("x-middleware-next")).toBe("1");
      expect(response.headers.get("x-robots-tag")).toBe(noIndex);
    },
  );

  it("allows only the exact local development HMR endpoint and rejects it in production", async () => {
    const local = await proxy(request("/_next/webpack-hmr?id=reviewed"));
    harness.deploymentEnvironment = "production";
    const production = await proxy(request("/_next/webpack-hmr?id=reviewed"));

    expect(local.status).toBe(200);
    expect(local.headers.get("x-middleware-next")).toBe("1");
    expect(local.headers.get("x-robots-tag")).toBe(noIndex);
    expect(production.status).toBe(404);
    expect(production.headers.get("x-robots-tag")).toBe(noIndex);
  });
});
