import { describe, expect, it } from "vitest";

import { createObservability, type TelemetryRuntime } from "../packages/observability/src/index.js";
import { continueTrustedJob } from "../packages/observability/src/worker.js";

const runtime = (): TelemetryRuntime => {
  let seed = 1;
  return {
    monotonicTime: () => 1,
    randomBytes(length) {
      return Uint8Array.from({ length }, () => {
        seed = (seed % 254) + 1;
        return seed;
      });
    },
    wallTime: () => "2026-07-17T00:00:00.000Z",
  };
};

const silentWriter = () => ({ writeLine: () => undefined });

describe("synthetic Web to Worker trace propagation contract", () => {
  it("preserves correlation and trace IDs while rotating every span ID", () => {
    const web = createObservability({
      environment: "local",
      releaseVersion: "test",
      runtime: runtime(),
      service: "web",
      writer: silentWriter(),
    });
    const request = web.start({
      kind: "http",
      method: "POST",
      operation: "http.proxy_handoff",
    });
    const carrier = request.toJobCarrier();
    const worker = createObservability({
      environment: "local",
      releaseVersion: "test",
      runtime: runtime(),
      service: "worker",
      writer: silentWriter(),
    });
    const persistedCarrier = JSON.parse(JSON.stringify(carrier)) as unknown;
    const job = continueTrustedJob(worker, persistedCarrier, {
      attempt: 1,
      kind: "job",
      operation: "job.process",
      schemaVersion: 1,
    });
    const provider = job.child({
      dependency: "provider",
      kind: "dependency",
      operation: "dependency.request",
    });

    expect(job.context).toMatchObject({
      correlationId: request.context.correlationId,
      parentSpanId: request.context.spanId,
      traceId: request.context.traceId,
    });
    expect(job.context.spanId).not.toBe(request.context.spanId);
    expect(provider.context).toMatchObject({
      correlationId: request.context.correlationId,
      parentSpanId: job.context.spanId,
      traceId: request.context.traceId,
    });
    expect(provider.toTraceHeaders()).toEqual({
      traceparent: `00-${request.context.traceId}-${provider.context.spanId}-01`,
    });
    expect(provider.toTraceHeaders()).not.toHaveProperty("correlationId");
    expect(carrier).not.toHaveProperty("baggage");
  });

  it("ignores an inbound public request ID because roots are server generated", () => {
    const web = createObservability({
      environment: "local",
      releaseVersion: "test",
      runtime: runtime(),
      service: "web",
      writer: silentWriter(),
    });
    const publicRequestId = "req_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const request = web.start({
      clientRequestId: publicRequestId,
      kind: "http",
      method: "GET",
      operation: "http.proxy_handoff",
    } as never);

    expect(request.context.correlationId).not.toBe(publicRequestId);
  });
});
