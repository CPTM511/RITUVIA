import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  end: vi.fn(),
  evaluate: vi.fn(),
  loadWebFeatureFlagEvaluator: vi.fn(),
}));

vi.mock("../server/feature-flags", () => ({
  loadWebFeatureFlagEvaluator: harness.loadWebFeatureFlagEvaluator,
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

const request = (pathname: string) => new NextRequest(`http://localhost${pathname}`);

describe("public shell request gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    harness.loadWebFeatureFlagEvaluator.mockResolvedValue({ evaluate: harness.evaluate });
  });

  it("allows the canonical shell only after an explicit enabled evaluation", async () => {
    harness.evaluate.mockReturnValue({ enabled: true, reason: "enabled", version: 1 });

    const response = await proxy(request("/en"));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("x-request-id")).toBe("req_11111111111111111111111111111111");
    expect(response.headers.get("content-security-policy")).toContain("connect-src 'self'");
    expect(response.headers.get("content-security-policy")).toContain("font-src 'none'");
    expect(response.headers.get("content-security-policy")).toContain("object-src 'none'");
    expect(response.headers.get("permissions-policy")).toContain("payment=()");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(harness.evaluate).toHaveBeenCalledWith("experience.public_shell", { locale: "en" });
    expect(harness.end).toHaveBeenCalledWith({ outcome: "success" });
  });

  it.each([
    ["default safe-off", "default-off", null],
    ["configured emergency off", "configured-off", 2],
  ])("returns an indistinguishable 404 for %s", async (_label, reason, version) => {
    harness.evaluate.mockReturnValue({ enabled: false, reason, version });

    const response = await proxy(request("/en"));

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("");
    expect(response.headers.get("content-security-policy")).toContain("default-src 'self'");
    expect(response.headers.get("x-request-id")).toBe("req_11111111111111111111111111111111");
    expect(harness.end).toHaveBeenCalledWith({ outcome: "success", statusCode: 404 });
  });

  it("fails closed when database loading or privilege attestation fails", async () => {
    harness.loadWebFeatureFlagEvaluator.mockRejectedValue(new Error("unavailable"));

    const response = await proxy(request("/"));

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("");
    expect(harness.evaluate).not.toHaveBeenCalled();
    expect(harness.end).toHaveBeenCalledWith({
      category: "dependency",
      errorCode: "dependency_error",
      outcome: "failure",
      retryable: true,
    });
  });

  it.each([
    "/",
    "/index.rsc",
    "/index.segments/_full.segment.rsc",
    "/en",
    "/en.rsc",
    "/en.segments/_full.segment.rsc",
  ])("applies the same safe-off gate to the shell representation %s", async (pathname) => {
    harness.evaluate.mockReturnValue({ enabled: false, reason: "default-off", version: null });

    await expect(proxy(request(pathname))).resolves.toMatchObject({ status: 404 });
    expect(harness.loadWebFeatureFlagEvaluator).toHaveBeenCalledOnce();
  });

  it.each(["/EN", "/fr", "/en-US", "/en/other", "/EN.rsc", "/EN.segments/_full.segment.rsc"])(
    "rejects unsupported public paths before the filesystem router: %s",
    async (pathname) => {
      const response = await proxy(request(pathname));

      expect(response.status).toBe(404);
      expect(await response.text()).toBe("");
      expect(harness.loadWebFeatureFlagEvaluator).not.toHaveBeenCalled();
    },
  );

  it.each(["/icon.svg", "/_next/static/app.js"])(
    "leaves reviewed infrastructure paths outside the activation query: %s",
    async (pathname) => {
      const response = await proxy(request(pathname));

      expect(response.status).toBe(200);
      expect(response.headers.get("x-middleware-next")).toBe("1");
      expect(harness.loadWebFeatureFlagEvaluator).not.toHaveBeenCalled();
    },
  );
});
