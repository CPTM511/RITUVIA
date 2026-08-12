import { describe, expect, it, vi } from "vitest";

import { createCommercialAccountApplicationService } from "../server/commercial-account";

const userId = "0f228746-1f1c-4df7-8330-167055ff15db";
const now = "2026-10-01T00:00:00.000Z";

const snapshot = Object.freeze({
  credits: Object.freeze({
    promotional: 0,
    purchased: 6,
    reserved: 0,
    subscription: 24,
    totalAvailable: 30,
  }),
  ledger: Object.freeze([]),
  orders: Object.freeze([]),
  reconciliation: Object.freeze({
    balanced: true,
    expectedPromotional: 0,
    expectedPurchased: 6,
    expectedSubscription: 24,
  }),
  subscriptions: Object.freeze([]),
});

const harness = () => {
  const reconcileAnnualCredits = vi.fn(async () => 2);
  const readSnapshot = vi.fn(async () => snapshot);
  const service = createCommercialAccountApplicationService({
    accounts: { resolveSession: async () => ({ userId }) },
    clock: () => now,
    persistence: {
      getOrder: vi.fn(async () => null),
      readSnapshot,
    },
    reconcileAnnualCredits,
  });
  return { readSnapshot, reconcileAnnualCredits, service };
};

describe("commercial account application service", () => {
  it("reconciles due annual Credits before returning the private snapshot", async () => {
    const test = harness();

    await expect(test.service.readSnapshot("session-token")).resolves.toBe(snapshot);
    expect(test.reconcileAnnualCredits).toHaveBeenCalledWith({ asOf: now, userId });
    expect(test.readSnapshot).toHaveBeenCalledWith(userId);
    expect(test.reconcileAnnualCredits.mock.invocationCallOrder[0]).toBeLessThan(
      test.readSnapshot.mock.invocationCallOrder[0]!,
    );
  });

  it("requires an authenticated account before reconciliation", async () => {
    const reconcileAnnualCredits = vi.fn(async () => 0);
    const service = createCommercialAccountApplicationService({
      accounts: { resolveSession: async () => null },
      clock: () => now,
      persistence: {
        getOrder: vi.fn(async () => null),
        readSnapshot: vi.fn(async () => snapshot),
      },
      reconcileAnnualCredits,
    });

    await expect(service.readSnapshot(undefined)).rejects.toMatchObject({
      code: "session_required",
    });
    expect(reconcileAnnualCredits).not.toHaveBeenCalled();
  });

  it("fails closed when annual reconciliation is unavailable", async () => {
    const test = harness();
    test.reconcileAnnualCredits.mockRejectedValueOnce(new TypeError("database unavailable"));

    await expect(test.service.readSnapshot("session-token")).rejects.toMatchObject({
      code: "unavailable",
    });
    expect(test.readSnapshot).not.toHaveBeenCalled();
  });
});
