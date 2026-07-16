import { describe, expect, it } from "vitest";

import {
  continueTraceContext,
  createRootTraceContext,
  formatTraceparent,
  isTraceCarrier,
  isTraceparent,
  parseTraceparent,
  toTraceCarrier,
  validateTraceContext,
} from "../src/context.js";
import { createDeterministicRuntime } from "./helpers.js";

describe("W3C trace context", () => {
  it("creates valid server-authoritative correlation and trace identifiers", () => {
    const context = createRootTraceContext(createDeterministicRuntime());

    expect(context.correlationId).toMatch(/^req_[0-9a-f]{32}$/u);
    expect(context.traceId).toMatch(/^[0-9a-f]{32}$/u);
    expect(context.spanId).toMatch(/^[0-9a-f]{16}$/u);
    expect(validateTraceContext(context)).toBe(true);
    expect(isTraceparent(formatTraceparent(context))).toBe(true);
  });

  it.each([
    "",
    "00-00000000000000000000000000000000-1111111111111111-01",
    "00-11111111111111111111111111111111-0000000000000000-01",
    "00-11111111111111111111111111111111-1111111111111111-ff",
    "01-11111111111111111111111111111111-1111111111111111-01",
    "00-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA-1111111111111111-01",
    "00-11111111111111111111111111111111-111111111111111-01",
  ])("rejects malformed or unsafe traceparent %j", (value) => {
    expect(parseTraceparent(value)).toBeNull();
    expect(isTraceparent(value)).toBe(false);
  });

  it("continues only a versioned, structurally valid job carrier", () => {
    const runtime = createDeterministicRuntime();
    const root = createRootTraceContext(runtime);
    const carrier = toTraceCarrier(root);
    const continued = continueTraceContext(runtime, carrier);

    expect(isTraceCarrier(carrier)).toBe(true);
    expect(continued).toMatchObject({
      correlationId: root.correlationId,
      parentSpanId: root.spanId,
      traceFlags: root.traceFlags,
      traceId: root.traceId,
    });
    expect(continued?.spanId).not.toBe(root.spanId);
    expect(isTraceCarrier({ ...carrier, schemaVersion: 2 })).toBe(false);
    expect(isTraceCarrier({ ...carrier, correlationId: "client-selected" })).toBe(false);
    expect(
      isTraceCarrier({
        ...carrier,
        correlationId: "req_00000000000000000000000000000000",
      }),
    ).toBe(false);
    expect(
      continueTraceContext(runtime, {
        ...carrier,
        correlationId: "req_00000000000000000000000000000000",
      }),
    ).toBeNull();
    expect(continueTraceContext(runtime, { ...carrier, baggage: "secret" })).not.toBeNull();
    expect(continueTraceContext(runtime, JSON.parse(JSON.stringify(carrier)))).not.toBeNull();
  });

  it("fails closed when the random source returns zeroes or a wrong length", () => {
    const base = createDeterministicRuntime();
    expect(() =>
      createRootTraceContext({ ...base, randomBytes: (length) => new Uint8Array(length) }),
    ).toThrow("all-zero identifier");
    expect(() => createRootTraceContext({ ...base, randomBytes: () => new Uint8Array(1) })).toThrow(
      "invalid byte sequence",
    );
  });

  it("validates every context field before formatting or propagation", () => {
    const context = createRootTraceContext(createDeterministicRuntime());
    expect(
      validateTraceContext({
        ...context,
        parentSpanId: "0000000000000000",
      }),
    ).toBe(false);
    expect(validateTraceContext({ ...context, traceFlags: "ff" } as never)).toBe(false);
    expect(
      validateTraceContext({
        ...context,
        correlationId: "req_00000000000000000000000000000000",
      }),
    ).toBe(false);
    expect(() => formatTraceparent({ ...context, traceFlags: "ff" } as never)).toThrow(
      "invalid trace context",
    );
  });
});
