import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import type {
  CommercialPaymentEventPersistence,
  CommercialReconciliationCandidate,
  CommercialReconciliationPersistence,
} from "@rituvia/db";

import { runOneCommercialPaymentReconciliation } from "../src/payment-reconciliation.js";
import type { CommercialPaymentProviderReader } from "../src/stripe-reconciliation.js";

const candidate: CommercialReconciliationCandidate = Object.freeze({
  amountMinor: 599,
  creditGrantAmount: 6,
  creditGrantCount: 1,
  creditsExpected: 6,
  currencyCode: "USD",
  fulfillmentAppliedPaymentStateVersion: 1,
  fulfillmentStatus: "active",
  orderId: "12345678-1234-4123-8123-123456789abc",
  orderPublicId: "22345678-1234-4123-8123-123456789abc",
  orderStatus: "paid",
  paymentAttemptId: "32345678-1234-4123-8123-123456789abc",
  paymentStateVersion: 1,
  providerCheckoutId: "cs_test_123",
  providerPaymentIntentId: "pi_123",
});

const reader = (
  snapshot: Awaited<ReturnType<CommercialPaymentProviderReader["readCheckout"]>>,
): CommercialPaymentProviderReader => ({
  attestAccount: vi.fn(),
  readCheckout: vi.fn().mockResolvedValue(snapshot),
});

const store = (
  overrides: Partial<CommercialReconciliationPersistence> = {},
): CommercialReconciliationPersistence => ({
  listCandidates: vi.fn().mockResolvedValue({
    candidates: [candidate],
    truncated: false,
  }),
  recordRun: vi.fn().mockResolvedValue({
    cases: 0,
    disposition: "recorded",
    runId: "42345678-1234-4123-8123-123456789abc",
  }),
  ...overrides,
});

const matchingProvider = Object.freeze({
  amountMinor: 599,
  availability: "available" as const,
  currencyCode: "USD",
  orderId: candidate.orderPublicId,
  paymentState: "paid" as const,
  providerCheckoutId: candidate.providerCheckoutId,
  providerPaymentIntentId: candidate.providerPaymentIntentId,
  settlementState: "available" as const,
});

const paymentEvents = (): Pick<CommercialPaymentEventPersistence, "processStripeSandboxEvent"> => ({
  processStripeSandboxEvent: vi.fn().mockResolvedValue({
    disposition: "applied",
    kind: "processed",
    orderStatus: "paid",
    outboxCreated: true,
    paymentAttemptState: "succeeded",
  }),
});

describe("commercial payment reconciliation worker", () => {
  it("records a clean bounded daily run", async () => {
    const persistence = store();
    await expect(
      runOneCommercialPaymentReconciliation({
        clock: () => "2026-07-30T12:34:56.000Z",
        paymentEvents: paymentEvents(),
        providerAccountFingerprint: "acct_test",
        reader: reader(matchingProvider),
        store: persistence,
      }),
    ).resolves.toBe("clean");
    expect(persistence.recordRun).toHaveBeenCalledWith(
      expect.objectContaining({
        candidates: 1,
        cases: [],
        slotStartedAt: "2026-07-30T00:00:00.000Z",
      }),
    );
  });

  it("records provider API failure as a redacted auditable case", async () => {
    const events = paymentEvents();
    const persistence = store({
      recordRun: vi.fn().mockImplementation(async (input) => ({
        cases: input.cases.length,
        disposition: "recorded",
        runId: "42345678-1234-4123-8123-123456789abc",
      })),
    });
    await expect(
      runOneCommercialPaymentReconciliation({
        clock: () => "2026-07-30T12:34:56.000Z",
        paymentEvents: events,
        providerAccountFingerprint: "acct_test",
        reader: reader({ availability: "unavailable" }),
        store: persistence,
      }),
    ).resolves.toBe("cases_found");
    const recorded = vi.mocked(persistence.recordRun).mock.calls[0]?.[0];
    expect(recorded?.cases).toEqual([
      expect.objectContaining({
        caseType: "provider_api_unavailable",
        evidenceDigest: new Uint8Array(
          createHash("sha256")
            .update(
              JSON.stringify({
                caseType: "provider_api_unavailable",
                internal: candidate,
                provider: { availability: "unavailable" },
                schemaVersion: "commercial-reconciliation-evidence.v1",
              }),
            )
            .digest(),
        ),
      }),
    ]);
    expect(events.processStripeSandboxEvent).not.toHaveBeenCalled();
  });

  it("records the missed-webhook case before exact provider-authoritative repair", async () => {
    const events = paymentEvents();
    const persistence = store({
      listCandidates: vi.fn().mockResolvedValue({
        candidates: [
          {
            ...candidate,
            creditGrantAmount: 0,
            creditGrantCount: 0,
            fulfillmentAppliedPaymentStateVersion: null,
            fulfillmentStatus: null,
            orderStatus: "pending",
            paymentStateVersion: 0,
          },
        ],
        truncated: false,
      }),
      recordRun: vi.fn().mockResolvedValue({
        cases: 1,
        disposition: "recorded",
        runId: "42345678-1234-4123-8123-123456789abc",
      }),
    });
    await expect(
      runOneCommercialPaymentReconciliation({
        clock: () => "2026-07-30T12:34:56.000Z",
        paymentEvents: events,
        providerAccountFingerprint: "acct_test",
        reader: reader(matchingProvider),
        store: persistence,
      }),
    ).resolves.toBe("cases_found");
    expect(persistence.recordRun).toHaveBeenCalledWith(
      expect.objectContaining({
        cases: [expect.objectContaining({ caseType: "internal_payment_pending" })],
      }),
    );
    expect(events.processStripeSandboxEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        evidenceSource: "reconciliation_api",
        signatureTimestampSeconds: 1_785_414_896,
      }),
      expect.any(Function),
    );
    expect(vi.mocked(persistence.recordRun).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(events.processStripeSandboxEvent).mock.invocationCallOrder[0] ?? 0,
    );
  });

  it("alerts when the bounded scan is truncated", async () => {
    const persistence = store({
      listCandidates: vi.fn().mockResolvedValue({
        candidates: [candidate],
        truncated: true,
      }),
    });
    await expect(
      runOneCommercialPaymentReconciliation({
        clock: () => "2026-07-30T12:34:56.000Z",
        paymentEvents: paymentEvents(),
        providerAccountFingerprint: "acct_test",
        reader: reader(matchingProvider),
        store: persistence,
      }),
    ).resolves.toBe("truncated");
  });

  it("does not alert twice for the same daily slot", async () => {
    await expect(
      runOneCommercialPaymentReconciliation({
        clock: () => "2026-07-30T12:34:56.000Z",
        paymentEvents: paymentEvents(),
        providerAccountFingerprint: "acct_test",
        reader: reader(matchingProvider),
        store: store({
          recordRun: vi.fn().mockResolvedValue({
            cases: 2,
            disposition: "duplicate",
            runId: "42345678-1234-4123-8123-123456789abc",
          }),
        }),
      }),
    ).resolves.toBe("duplicate");
  });
});
