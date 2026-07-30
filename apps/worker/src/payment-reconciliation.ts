import { createHash } from "node:crypto";

import type {
  CommercialPaymentEventPersistence,
  CommercialReconciliationCase,
  CommercialReconciliationPersistence,
} from "@rituvia/db";
import {
  compareCommercialPayment,
  reduceCommercialPaymentTimeline,
  type CommercialReconciliationProviderSnapshot,
} from "@rituvia/payments";

import type { CommercialPaymentProviderReader } from "./stripe-reconciliation.js";

export type CommercialPaymentReconciliationWorkerEvent = Readonly<{
  candidates: number;
  cases: number;
  disposition: "cases_found" | "clean" | "duplicate" | "truncated";
}>;

const digest = (value: string): Uint8Array<ArrayBuffer> =>
  new Uint8Array(createHash("sha256").update(value).digest());

const repairEventId = (value: string): string =>
  `reconciliation_${createHash("sha256").update(value).digest("hex")}`;

const dailySlot = (instant: string): string => {
  const parsed = new Date(instant);
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(instant) ||
    !Number.isFinite(parsed.getTime())
  ) {
    throw new TypeError("Commercial reconciliation clock is invalid.");
  }
  return `${instant.slice(0, 10)}T00:00:00.000Z`;
};

export const runOneCommercialPaymentReconciliation = async (input: {
  clock?: () => string;
  observe?: (event: CommercialPaymentReconciliationWorkerEvent) => void;
  paymentEvents: Pick<CommercialPaymentEventPersistence, "processStripeSandboxEvent">;
  providerAccountFingerprint: string;
  reader: CommercialPaymentProviderReader;
  store: CommercialReconciliationPersistence;
}): Promise<CommercialPaymentReconciliationWorkerEvent["disposition"]> => {
  const now = input.clock?.() ?? new Date().toISOString();
  const slotStartedAt = dailySlot(now);
  const batch = await input.store.listCandidates({
    providerAccountFingerprint: input.providerAccountFingerprint,
    slotStartedAt,
  });
  const cases: CommercialReconciliationCase[] = [];
  const repairs: Readonly<{
    candidate: (typeof batch.candidates)[number];
    provider: Extract<CommercialReconciliationProviderSnapshot, { availability: "available" }> &
      Readonly<{ providerPaymentIntentId: string }>;
  }>[] = [];

  for (const candidate of batch.candidates) {
    const provider = await input.reader.readCheckout(candidate.providerCheckoutId);
    const findings = compareCommercialPayment({
      internal: candidate,
      orderId: candidate.orderPublicId,
      provider,
    });
    for (const finding of findings) {
      cases.push(
        Object.freeze({
          ...finding,
          evidenceDigest: digest(
            JSON.stringify({
              caseType: finding.caseType,
              internal: candidate,
              provider: provider as CommercialReconciliationProviderSnapshot,
              schemaVersion: "commercial-reconciliation-evidence.v1",
            }),
          ),
          orderId: candidate.orderId,
          paymentAttemptId: candidate.paymentAttemptId,
        }),
      );
    }
    if (
      provider.availability === "available" &&
      provider.paymentState === "paid" &&
      (candidate.orderStatus === "checkout_created" || candidate.orderStatus === "pending") &&
      provider.orderId === candidate.orderPublicId &&
      provider.providerCheckoutId === candidate.providerCheckoutId &&
      provider.providerPaymentIntentId !== null &&
      (candidate.providerPaymentIntentId === null ||
        candidate.providerPaymentIntentId === provider.providerPaymentIntentId) &&
      provider.amountMinor === candidate.amountMinor &&
      provider.currencyCode === candidate.currencyCode
    ) {
      repairs.push(
        Object.freeze({
          candidate,
          provider: Object.freeze({
            ...provider,
            providerPaymentIntentId: provider.providerPaymentIntentId,
          }),
        }),
      );
    }
  }

  const recorded = await input.store.recordRun({
    candidates: batch.candidates.length,
    cases,
    completedAt: now,
    providerAccountFingerprint: input.providerAccountFingerprint,
    slotStartedAt,
    truncated: batch.truncated,
  });
  for (const repair of repairs) {
    const evidence = JSON.stringify({
      amountMinor: repair.provider.amountMinor,
      currencyCode: repair.provider.currencyCode,
      orderId: repair.provider.orderId,
      paymentState: repair.provider.paymentState,
      providerCheckoutId: repair.provider.providerCheckoutId,
      providerPaymentIntentId: repair.provider.providerPaymentIntentId,
      schemaVersion: "stripe-reconciliation-event.v1",
    });
    await input.paymentEvents.processStripeSandboxEvent(
      {
        amountMinor: repair.provider.amountMinor,
        currencyCode: repair.provider.currencyCode,
        evidenceSource: "reconciliation_api",
        eventType: "payment_succeeded",
        normalizationVersion: "stripe-reconciliation-event.v1",
        occurredAt: now,
        orderId: repair.candidate.orderPublicId,
        payloadDigest: digest(evidence),
        providerAccountFingerprint: input.providerAccountFingerprint,
        providerCheckoutId: repair.provider.providerCheckoutId,
        providerEventId: repairEventId(evidence),
        providerObjectId: repair.provider.providerPaymentIntentId,
        providerPaymentIntentId: repair.provider.providerPaymentIntentId,
        receivedAt: now,
        signatureTimestampSeconds: Math.floor(Date.parse(now) / 1_000),
        verifierVersion: "stripe-reconciliation-api.v1",
      },
      reduceCommercialPaymentTimeline,
    );
  }
  const disposition =
    recorded.disposition === "duplicate"
      ? "duplicate"
      : batch.truncated
        ? "truncated"
        : recorded.cases > 0
          ? "cases_found"
          : "clean";
  input.observe?.({
    candidates: batch.candidates.length,
    cases: recorded.cases,
    disposition,
  });
  return disposition;
};

const delayUntilNextSlot = (signal: AbortSignal, now: number): Promise<void> =>
  new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const next = new Date(now);
    next.setUTCDate(next.getUTCDate() + 1);
    next.setUTCHours(0, 0, 0, 0);
    const finish = (): void => {
      clearTimeout(timeout);
      signal.removeEventListener("abort", finish);
      resolve();
    };
    const timeout = setTimeout(finish, Math.max(60_000, next.getTime() - now));
    signal.addEventListener("abort", finish, { once: true });
  });

export const runCommercialPaymentReconciliationLoop = async (input: {
  observe?: (event: CommercialPaymentReconciliationWorkerEvent) => void;
  paymentEvents: Pick<CommercialPaymentEventPersistence, "processStripeSandboxEvent">;
  providerAccountFingerprint: string;
  reader: CommercialPaymentProviderReader;
  signal: AbortSignal;
  store: CommercialReconciliationPersistence;
}): Promise<void> => {
  while (!input.signal.aborted) {
    await runOneCommercialPaymentReconciliation(input);
    await delayUntilNextSlot(input.signal, Date.now());
  }
};
