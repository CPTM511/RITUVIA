import { describe, expect, it, vi } from "vitest";

import { rituviaCatalog20260723Local } from "@rituvia/payments";

import { createProductCatalogApplicationService } from "../server/product-catalog";

describe("Web product catalog service", () => {
  it("attests privileges and returns the exact current environment catalog", async () => {
    const assertPrivileges = vi.fn(async () => undefined);
    const read = vi.fn(async () => [rituviaCatalog20260723Local]);
    const service = createProductCatalogApplicationService({
      assertPrivileges,
      clock: () => "2026-07-25T00:00:00.000Z",
      environment: "local",
      read,
    });

    await expect(service.readActive()).resolves.toBe(rituviaCatalog20260723Local);
    expect(assertPrivileges).toHaveBeenCalledOnce();
    expect(read).toHaveBeenCalledWith("local");
  });

  it("fails closed when the requested deployment has no approved active catalog", async () => {
    const service = createProductCatalogApplicationService({
      assertPrivileges: async () => undefined,
      clock: () => "2026-07-25T00:00:00.000Z",
      environment: "production",
      read: async () => [],
    });

    await expect(service.readActive()).rejects.toMatchObject({
      code: "COMMERCE_STATE_CONFLICT",
    });
  });

  it("does not read catalog data if least-privilege attestation fails", async () => {
    const read = vi.fn(async () => [rituviaCatalog20260723Local]);
    const service = createProductCatalogApplicationService({
      assertPrivileges: async () => {
        throw new TypeError("unsafe database role");
      },
      clock: () => "2026-07-25T00:00:00.000Z",
      environment: "local",
      read,
    });

    await expect(service.readActive()).rejects.toThrow("unsafe database role");
    expect(read).not.toHaveBeenCalled();
  });
});
