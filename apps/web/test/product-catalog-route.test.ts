import { beforeEach, describe, expect, it, vi } from "vitest";

import { rituviaCatalog20260723Local } from "@rituvia/payments";

const harness = vi.hoisted(() => ({
  readActive: vi.fn(),
}));

vi.mock("../server/product-catalog", () => ({
  loadWebProductCatalogApplicationService: () => ({
    readActive: harness.readActive,
  }),
}));

import { GET } from "../app/api/v1/catalog/route";

describe("product catalog HTTP contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    harness.readActive.mockResolvedValue(rituviaCatalog20260723Local);
  });

  it("returns the exact versioned catalog and public hardening headers", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("public, max-age=0, must-revalidate");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    await expect(response.json()).resolves.toEqual(rituviaCatalog20260723Local);
  });

  it("fails closed without leaking storage or approval details", async () => {
    harness.readActive.mockRejectedValue(new Error("private database detail"));

    const response = await GET();

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      code: "CATALOG_UNAVAILABLE",
      schemaVersion: "catalog-error.v1",
    });
  });
});
