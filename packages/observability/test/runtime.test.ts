import { describe, expect, it } from "vitest";

import { createObservability } from "../src/index.js";
import { createJsonLinesSink } from "../src/json-lines-sink.js";
import { continueTrustedJob } from "../src/worker.js";
import { createDeterministicRuntime } from "./helpers.js";

const createHarness = () => {
  const lines: string[] = [];
  const observability = createObservability({
    environment: "local",
    releaseVersion: "2026.7.17+test",
    runtime: createDeterministicRuntime(),
    service: "web",
    writer: { writeLine: (line) => lines.push(line) },
  });
  return { lines, observability };
};

describe("structured observability runtime", () => {
  it("emits bounded one-line records with fixed service and trace metadata", () => {
    const { lines, observability } = createHarness();
    const operation = observability.start({
      kind: "http",
      method: "POST",
      operation: "http.proxy_handoff",
    });
    operation.event({ name: "service.ready" });
    operation.end({ outcome: "success", statusCode: 201 });

    expect(lines).toHaveLength(3);
    expect(lines.every((line) => !line.includes("\n") && line.length < 16_384)).toBe(true);
    const records = lines.map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(records[0]).toMatchObject({
      environment: "local",
      event: "trace.span_started",
      kind: "http",
      level: "info",
      method: "POST",
      operation: "http.proxy_handoff",
      releaseVersion: "2026.7.17+test",
      schemaVersion: 1,
      service: "web",
      timestamp: "2026-07-17T00:00:00.000Z",
    });
    expect(records[2]).toMatchObject({
      durationMs: 5,
      event: "trace.span_ended",
      level: "info",
      outcome: "success",
      statusCode: 201,
    });
  });

  it("drops unknown private fields from events, results, and final JSON", () => {
    const canary = "journal-prayer-birth-location-canary";
    const { lines, observability } = createHarness();
    const operation = observability.start({
      authorization: canary,
      body: { question: canary },
      kind: "http",
      method: "GET",
      operation: "http.proxy_handoff",
      prompt: canary,
      url: `https://example.invalid/?secret=${canary}`,
    } as never);
    operation.end({
      category: "internal",
      errorCode: "internal_error",
      message: canary,
      outcome: "failure",
      retryable: false,
      stack: canary,
    } as never);

    expect(lines.join("\n")).not.toContain(canary);
    expect(lines.at(-1)).toContain('"errorCode":"internal_error"');
  });

  it("ends each span only once and clamps a backwards clock", () => {
    const lines: string[] = [];
    let time = 10;
    const observability = createObservability({
      environment: "local",
      releaseVersion: "test",
      runtime: {
        ...createDeterministicRuntime(),
        monotonicTime: () => (time -= 1),
      },
      service: "worker",
      writer: { writeLine: (line) => lines.push(line) },
    });
    const operation = observability.start({ kind: "service", operation: "service.lifecycle" });

    operation.end({ outcome: "success" });
    operation.end({ outcome: "timeout" });

    expect(lines).toHaveLength(2);
    expect(lines.at(-1)).toContain('"durationMs":0');
    expect(lines.join("\n")).not.toContain("timeout");
  });

  it("contains writer and flush failures without changing application flow", async () => {
    const observability = createObservability({
      environment: "local",
      releaseVersion: "test",
      runtime: createDeterministicRuntime(),
      service: "worker",
      writer: {
        flush: () => Promise.reject(new Error("sink-secret")),
        writeLine: () => {
          throw new Error("sink-secret");
        },
      },
    });

    expect(() =>
      observability.start({ kind: "service", operation: "service.lifecycle" }),
    ).not.toThrow();
    await expect(observability.flush()).resolves.toBeUndefined();
  });

  it("falls back to a fresh trace for an invalid carrier without logging its value", () => {
    const canary = "forged-carrier-private-canary";
    const { lines, observability } = createHarness();
    const operation = continueTrustedJob(
      observability,
      { correlationId: canary, schemaVersion: 1, traceparent: canary },
      { attempt: 1, kind: "job", operation: "job.process", schemaVersion: 1 },
    );

    expect(operation.context.correlationId).toMatch(/^req_[0-9a-f]{32}$/u);
    expect(lines.join("\n")).toContain("trace.carrier_rejected");
    expect(lines.join("\n")).not.toContain(canary);
  });

  it("sanitizes every fixed metadata field at runtime", () => {
    const canary = "metadata-private-canary";
    const lines: string[] = [];
    const observability = createObservability({
      environment: canary,
      releaseVersion: `api_key_${canary}`,
      runtime: createDeterministicRuntime(),
      service: canary,
      writer: { writeLine: (line: string) => lines.push(line) },
    } as never);

    observability.start({ kind: "service", operation: "service.lifecycle" });

    expect(lines.join("\n")).not.toContain(canary);
    expect(JSON.parse(lines[0] ?? "null")).toMatchObject({
      environment: "unknown",
      releaseVersion: "[REDACTED]",
      service: "unknown",
    });
  });

  it("keeps the internal writer boundary control-safe and byte-bounded", () => {
    const lines: string[] = [];
    const sink = createJsonLinesSink({
      maxLineBytes: 1_024,
      writeLine: (line) => lines.push(line),
    });

    expect(sink.write('{"event":"safe"}')).toBe(true);
    expect(sink.write('{"event":"line\u2028separator"}')).toBe(false);
    expect(sink.write(`{"event":"${"😀".repeat(300)}"}`)).toBe(false);
    expect(lines).toEqual(['{"event":"safe"}']);
  });
});
