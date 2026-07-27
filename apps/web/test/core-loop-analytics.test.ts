import { describe, expect, it, vi } from "vitest";

import { createBoundedInMemoryCoreLoopEventLedger, type CoreLoopEvent } from "@rituvia/analytics";

import {
  createCoreLoopAnalyticsPseudonymizer,
  createWebCoreLoopAnalytics,
  safeOffWebCoreLoopAnalytics,
} from "../server/core-loop-analytics";

const anonymousToken = "a".repeat(43);
const readingId = "11111111-1111-4111-8111-111111111111";
const intentionId = "22222222-2222-4222-8222-222222222222";
const subjectId = "33333333-3333-4333-8333-333333333333";
const sessionId = "44444444-4444-4444-8444-444444444444";
const eventInput = {
  anonymousSessionToken: anonymousToken,
  eventName: "intention_created" as const,
  locale: "en" as const,
  occurredAt: "2026-07-24T10:00:00.000Z",
  properties: { intentionCode: "calm_clarity" as const },
  reflectionRoot: { intentionId, kind: "intention" as const },
  semanticReference: intentionId,
  source: "server" as const,
};

describe("Web core-loop analytics boundary", () => {
  it("is hard safe-off without approved composition", async () => {
    await expect(safeOffWebCoreLoopAnalytics.capture(eventInput)).resolves.toBe(false);
  });

  it("requires exact current consent and emits only purpose-scoped pseudonyms", async () => {
    const ledger = createBoundedInMemoryCoreLoopEventLedger();
    const written: CoreLoopEvent[] = [];
    const analytics = createWebCoreLoopAnalytics({
      identity: {
        allowsConsent: vi.fn(async () => true),
        resolveSession: vi.fn(async () => ({
          expiresAt: "2026-08-24T10:00:00.000Z",
          sessionId,
          subjectId,
        })),
      },
      key: {
        environment: "test",
        key: new Uint8Array(32).fill(7),
        version: "test-key.v1",
      },
      resolveReadingId: vi.fn(async () => readingId),
      sink: {
        async write(event) {
          written.push(event);
          ledger.append(event, "2026-07-24T10:00:00.100Z");
        },
      },
    });

    await expect(analytics.capture(eventInput)).resolves.toBe(true);
    await expect(analytics.capture(eventInput)).resolves.toBe(true);
    expect(written).toHaveLength(2);
    expect(ledger.snapshot()).toHaveLength(1);
    const serialized = JSON.stringify(written[0]);
    expect(serialized).not.toContain(subjectId);
    expect(serialized).not.toContain(sessionId);
    expect(serialized).not.toContain(readingId);
    expect(serialized).not.toContain(intentionId);
    expect(serialized).not.toContain(anonymousToken);
  });

  it("fails closed for absent consent, invalid roots, and sink failure", async () => {
    const sink = vi.fn(async () => {
      throw new Error("PRIVATE-SINK-CANARY");
    });
    const create = (allowed: boolean, resolvedReadingId: string | null) =>
      createWebCoreLoopAnalytics({
        identity: {
          allowsConsent: vi.fn(async () => allowed),
          resolveSession: vi.fn(async () => ({
            expiresAt: "2026-08-24T10:00:00.000Z",
            sessionId,
            subjectId,
          })),
        },
        key: {
          environment: "test",
          key: new Uint8Array(32).fill(9),
          version: "test-key.v1",
        },
        resolveReadingId: vi.fn(async () => resolvedReadingId),
        sink: { write: sink },
      });

    await expect(create(false, readingId).capture(eventInput)).resolves.toBe(false);
    await expect(create(true, null).capture(eventInput)).resolves.toBe(false);
    await expect(create(true, readingId).capture(eventInput)).resolves.toBe(false);
  });

  it("isolates pseudonyms across purpose key versions and environments", () => {
    const first = createCoreLoopAnalyticsPseudonymizer({
      environment: "test",
      key: new Uint8Array(32).fill(1),
      version: "key.v1",
    });
    const rotated = createCoreLoopAnalyticsPseudonymizer({
      environment: "test",
      key: new Uint8Array(32).fill(1),
      version: "key.v2",
    });
    const production = createCoreLoopAnalyticsPseudonymizer({
      environment: "production",
      key: new Uint8Array(32).fill(1),
      version: "key.v1",
    });

    expect(first.derive("sub", "subject", subjectId)).not.toBe(
      rotated.derive("sub", "subject", subjectId),
    );
    expect(first.derive("sub", "subject", subjectId)).not.toBe(
      production.derive("sub", "subject", subjectId),
    );
  });
});
