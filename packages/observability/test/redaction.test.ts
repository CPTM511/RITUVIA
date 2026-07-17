import { describe, expect, it } from "vitest";

import {
  readTraceCarrier,
  REDACTED,
  sanitizeOperationalEvent,
  sanitizeOperationResult,
  sanitizeOperationStart,
  sanitizeReleaseVersion,
} from "../src/redaction.js";
import { snapshotOwnEnumerableData } from "../src/index.js";

const canary = "private-canary-8675309";

describe("telemetry redaction boundary", () => {
  it("creates a bounded exact own-enumerable-data snapshot without invoking code", () => {
    const input = Object.create(null) as Record<string, unknown>;
    input.safe = "value";
    input.count = 2;
    const snapshot = snapshotOwnEnumerableData(input);

    expect(Object.fromEntries(snapshot ?? [])).toEqual({ count: 2, safe: "value" });
    expect(Object.isFrozen(snapshot)).toBe(true);

    let getterCalls = 0;
    const accessor = {
      get safe() {
        getterCalls += 1;
        return canary;
      },
    };
    expect(snapshotOwnEnumerableData(accessor)).toBeNull();
    expect(getterCalls).toBe(0);

    const hidden = { safe: "value" };
    Object.defineProperty(hidden, "secret", { enumerable: false, value: canary });
    expect(snapshotOwnEnumerableData(hidden)).toBeNull();
    expect(snapshotOwnEnumerableData({ safe: "value", [Symbol(canary)]: canary })).toBeNull();
  });

  it("copies only fixed scalar data fields and drops every unknown sensitive field", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    const input = {
      attempt: 2,
      authorization: canary,
      body: { journal: canary },
      error: new Error(canary),
      kind: "job",
      operation: "job.process",
      payload: cyclic,
      prompt: canary,
      schemaVersion: 1,
      stack: canary,
      toJSON: () => ({ leaked: canary }),
    };

    const sanitized = sanitizeOperationStart(input);

    expect(sanitized).toEqual({
      attempt: 2,
      kind: "job",
      operation: "job.process",
      schemaVersion: 1,
    });
    expect(JSON.stringify(sanitized)).not.toContain(canary);
  });

  it("never invokes accessors or toJSON while reading operational input", () => {
    let getterCalls = 0;
    let jsonCalls = 0;
    let coercionCalls = 0;
    const event = {
      get name() {
        getterCalls += 1;
        return "service.ready";
      },
      toJSON() {
        jsonCalls += 1;
        return { name: canary };
      },
    };

    expect(sanitizeOperationalEvent(event)).toBeNull();
    expect(
      sanitizeOperationStart({
        kind: "http",
        method: {
          toString() {
            coercionCalls += 1;
            return "GET";
          },
        },
        operation: "http.proxy_handoff",
      }),
    ).toBeNull();
    expect(getterCalls).toBe(0);
    expect(jsonCalls).toBe(0);
    expect(coercionCalls).toBe(0);
  });

  it("handles revoked proxies, symbols, BigInt, functions, and accessors without throwing", () => {
    const target = { name: "service.ready" };
    const { proxy, revoke } = Proxy.revocable(target, {});
    revoke();

    expect(() => sanitizeOperationalEvent(proxy)).not.toThrow();
    expect(sanitizeOperationalEvent(proxy)).toBeNull();
    expect(sanitizeOperationStart(Symbol(canary))).toBeNull();
    expect(sanitizeOperationStart(BigInt(42))).toBeNull();
    expect(sanitizeOperationStart(() => canary)).toBeNull();
  });

  it("reads only the fixed allowlist and never enumerates attacker-controlled width", () => {
    let descriptorCalls = 0;
    let enumerationCalls = 0;
    const event = new Proxy(
      { name: "service.ready" },
      {
        getOwnPropertyDescriptor(target, key) {
          descriptorCalls += 1;
          return Object.getOwnPropertyDescriptor(target, key);
        },
        ownKeys() {
          enumerationCalls += 1;
          throw new Error(canary);
        },
      },
    );

    expect(sanitizeOperationalEvent(event)).toEqual({ name: "service.ready" });
    expect(descriptorCalls).toBe(2);
    expect(enumerationCalls).toBe(0);
  });

  it("accepts only fixed safe error taxonomies and never Error text", () => {
    const result = sanitizeOperationResult({
      category: "internal",
      cause: new Error(canary),
      errorCode: "internal_error",
      message: canary,
      outcome: "failure",
      retryable: false,
      stack: canary,
    });

    expect(result).toEqual({
      category: "internal",
      errorCode: "internal_error",
      outcome: "failure",
      retryable: false,
    });
    expect(JSON.stringify(result)).not.toContain(canary);
    expect(
      sanitizeOperationResult({
        category: "internal",
        errorCode: canary,
        outcome: "failure",
        retryable: false,
      }),
    ).toBeNull();
  });

  it("rejects carrier accessors and redacts unsafe release metadata", () => {
    const carrier = {
      correlationId: "req_11111111111111111111111111111111",
      get traceparent() {
        throw new Error(canary);
      },
      schemaVersion: 1,
    };

    expect(readTraceCarrier(carrier)).toBeNull();
    expect(sanitizeReleaseVersion("release\nforged")).toBe(REDACTED);
    expect(sanitizeReleaseVersion("2026.7.17+sha.abc123")).toBe("2026.7.17+sha.abc123");
    expect(sanitizeReleaseVersion("api_key_private-canary")).toBe(REDACTED);
  });
});
