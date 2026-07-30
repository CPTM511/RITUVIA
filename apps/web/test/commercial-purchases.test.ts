import { describe, expect, it, vi } from "vitest";

import { WebCommerceError } from "../server/commerce";
import { createCommercialPurchaseApplicationService } from "../server/commercial-purchases";

const restoration = Object.freeze({
  credits: Object.freeze({
    promotional: 1,
    purchased: 6,
    purchasedHeld: 0,
    reserved: 0,
    subscription: 2,
    total: 9,
    version: 3,
  }),
  entitlements: Object.freeze([]),
});

describe("commercial purchase restoration service", () => {
  it("restores only the authenticated account projection", async () => {
    const restorePurchases = vi.fn().mockResolvedValue(restoration);
    const service = createCommercialPurchaseApplicationService({
      accounts: {
        resolveSession: vi.fn().mockResolvedValue({
          userId: "12345678-1234-4123-8123-123456789abc",
        }),
      },
      persistence: { restorePurchases },
    });
    await expect(service.restore("a".repeat(43))).resolves.toEqual(restoration);
    expect(restorePurchases).toHaveBeenCalledWith("12345678-1234-4123-8123-123456789abc");
  });

  it("does not reveal whether a missing token maps to another account", async () => {
    const service = createCommercialPurchaseApplicationService({
      accounts: { resolveSession: vi.fn().mockResolvedValue(null) },
      persistence: { restorePurchases: vi.fn() },
    });
    await expect(service.restore("a".repeat(43))).rejects.toMatchObject({
      code: "session_required",
    });
    await expect(service.restore(undefined)).rejects.toBeInstanceOf(WebCommerceError);
  });

  it("maps database details to a bounded unavailable error", async () => {
    const service = createCommercialPurchaseApplicationService({
      accounts: {
        resolveSession: vi.fn().mockResolvedValue({
          userId: "12345678-1234-4123-8123-123456789abc",
        }),
      },
      persistence: {
        restorePurchases: vi.fn().mockRejectedValue(new Error("private database details")),
      },
    });
    await expect(service.restore("a".repeat(43))).rejects.toMatchObject({
      code: "unavailable",
    });
  });
});
