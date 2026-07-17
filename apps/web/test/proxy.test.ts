import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  deploymentEnvironment: "local" as "local" | "preview" | "production" | "staging",
  end: vi.fn(),
  loadPublicShellState: vi.fn(),
}));

vi.mock("../server/public-shell-state", () => ({
  loadPublicShellState: harness.loadPublicShellState,
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
    harness.loadPublicShellState.mockResolvedValue("enabled");
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
    expect(response.headers.get("content-security-policy")).toContain("style-src-attr 'none'");
    expect(response.headers.get("permissions-policy")).toContain("payment=()");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-robots-tag")).toBe(noIndex);
    expect(harness.loadPublicShellState).toHaveBeenCalledOnce();
    expect(harness.end).toHaveBeenCalledWith({ outcome: "success" });
  });

  it("permits indexing only for production canonical HTML, never framework representations", async () => {
    harness.deploymentEnvironment = "production";

    const canonical = await proxy(request("/en/privacy", { headers: { accept: "text/html" } }));
    const reviewedRsc = await proxy(
      request("/en/privacy", {
        headers: { accept: "text/x-component", "next-router-prefetch": "1", rsc: "1" },
      }),
    );
    const bareRsc = await proxy(request("/en/privacy", { headers: { rsc: "1" } }));
    const directRsc = await proxy(request("/en/privacy.rsc"));

    expect(canonical.status).toBe(200);
    expect(canonical.headers.get("x-robots-tag")).toBeNull();
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

  it.each(["disabled", "unavailable"] as const)(
    "returns an empty noindex 404 when the shell is %s",
    async (state) => {
      harness.loadPublicShellState.mockResolvedValue(state);

      const response = await proxy(request("/en"));

      expect(response.status).toBe(404);
      expect(await response.text()).toBe("");
      expect(response.headers.get("x-robots-tag")).toBe(noIndex);
      expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
      expect(response.headers.get("content-security-policy")).toContain("default-src 'self'");
      expect(response.headers.get("x-request-id")).toBe("req_11111111111111111111111111111111");
      expect(harness.end).toHaveBeenCalledWith(
        state === "unavailable"
          ? {
              category: "dependency",
              errorCode: "dependency_error",
              outcome: "failure",
              retryable: true,
            }
          : { outcome: "success", statusCode: 404 },
      );
    },
  );

  it.each([
    "/",
    "/index.rsc",
    "/index.segments/_full.segment.rsc",
    "/en",
    "/en.rsc",
    "/en.segments/_full.segment.rsc",
    "/en/methodology",
    "/en/methodology.rsc",
    "/en/methodology.segments/_full.segment.rsc",
    "/en/safety",
    "/en/safety.rsc",
    "/en/safety.segments/_full.segment.rsc",
    "/en/privacy",
    "/en/privacy.rsc",
    "/en/privacy.segments/_full.segment.rsc",
  ])("applies the same safe-off gate to shell representation %s", async (pathname) => {
    harness.loadPublicShellState.mockResolvedValue("disabled");

    const response = await proxy(request(pathname));

    expect(response.status).toBe(404);
    expect(response.headers.get("x-robots-tag")).toBe(noIndex);
    if (pathname.endsWith(".rsc") && !pathname.includes(".segments/")) {
      expect(harness.loadPublicShellState).not.toHaveBeenCalled();
    } else {
      expect(harness.loadPublicShellState).toHaveBeenCalledOnce();
    }
  });

  it.each([
    "/EN",
    "/fr",
    "/en-US",
    "/en/other",
    "/en/account",
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
  ])("rejects unsupported or private paths before the feature lookup: %s", async (pathname) => {
    const response = await proxy(request(pathname));

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("");
    expect(response.headers.get("x-robots-tag")).toBe(noIndex);
    expect(harness.loadPublicShellState).not.toHaveBeenCalled();
  });

  it.each([
    "/en?question=private-canary",
    "/en/privacy?birthTime=private-canary",
    "/en?_rsc=private-canary",
    "/robots.txt?preview=private-canary",
    "/sitemap.xml?preview=private-canary",
  ])("rejects query variants without evaluating or reflecting them: %s", async (pathname) => {
    const response = await proxy(request(pathname));

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("");
    expect(response.headers.get("location")).toBeNull();
    expect([...response.headers.values()].join(" ")).not.toContain("private-canary");
    expect(harness.loadPublicShellState).not.toHaveBeenCalled();
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
    expect(harness.loadPublicShellState).toHaveBeenCalledOnce();
  });

  it("rejects non-read methods before the feature lookup", async () => {
    const response = await proxy(request("/en", { method: "POST" }));

    expect(response.status).toBe(404);
    expect(response.headers.get("x-robots-tag")).toBe(noIndex);
    expect(harness.loadPublicShellState).not.toHaveBeenCalled();
  });

  it("serves fail-closed non-production discovery without a database lookup", async () => {
    const robots = await proxy(request("/robots.txt"));
    const sitemap = await proxy(request("/sitemap.xml"));

    expect(robots.status).toBe(200);
    expect(robots.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(robots.headers.get("x-robots-tag")).toBe(noIndex);
    expect(await robots.text()).toBe("User-agent: *\nDisallow: /\n");
    expect(sitemap.status).toBe(404);
    expect(sitemap.headers.get("content-type")).toBe("application/xml; charset=utf-8");
    expect(await sitemap.text()).toBe("");
    expect(harness.loadPublicShellState).not.toHaveBeenCalled();
  });

  it("publishes production discovery only while the shell is enabled", async () => {
    harness.deploymentEnvironment = "production";

    const robots = await proxy(request("/robots.txt"));
    const sitemap = await proxy(request("/sitemap.xml"));

    expect(robots.status).toBe(200);
    expect(await robots.text()).toContain("Allow: /en$");
    expect(await proxy(request("/robots.txt"))).toMatchObject({ status: 200 });
    expect(await sitemap.text()).toContain("<loc>https://example.test/en</loc>");
    expect(harness.loadPublicShellState).toHaveBeenCalledTimes(3);

    harness.loadPublicShellState.mockResolvedValue("disabled");
    const stoppedRobots = await proxy(request("/robots.txt"));
    const stoppedSitemap = await proxy(request("/sitemap.xml"));
    expect(await stoppedRobots.text()).toBe("User-agent: *\nDisallow: /\n");
    expect(stoppedSitemap.status).toBe(404);
  });

  it("keeps HEAD discovery status and headers while suppressing bodies", async () => {
    const robots = await proxy(request("/robots.txt", { method: "HEAD" }));
    const sitemap = await proxy(request("/sitemap.xml", { method: "HEAD" }));

    expect(robots.status).toBe(200);
    expect(await robots.text()).toBe("");
    expect(robots.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(sitemap.status).toBe(404);
    expect(await sitemap.text()).toBe("");
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
    "leaves reviewed infrastructure paths outside the activation query: %s",
    async (pathname) => {
      const response = await proxy(request(pathname));

      expect(response.status).toBe(200);
      expect(response.headers.get("x-middleware-next")).toBe("1");
      expect(response.headers.get("x-robots-tag")).toBe(noIndex);
      expect(harness.loadPublicShellState).not.toHaveBeenCalled();
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
