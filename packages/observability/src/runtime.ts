import {
  createChildTraceContext,
  createRootTraceContext,
  continueTraceContext,
  formatTraceparent,
  toTraceCarrier,
} from "./context.js";
import type {
  ActiveOperation,
  DependencyOperationStart,
  JobOperationStart,
  Observability,
  ObservabilityConfiguration,
  OperationalEvent,
  OperationResult,
  OperationStart,
  TelemetryRuntime,
  TraceContext,
} from "./contracts.js";
import { createJsonLinesSink, type InternalJsonLineSink } from "./json-lines-sink.js";
import {
  sanitizeEnvironment,
  sanitizeOperationalEvent,
  sanitizeOperationResult,
  sanitizeOperationStart,
  sanitizeReleaseVersion,
  sanitizeService,
} from "./redaction.js";

const invalidInputEvent = "telemetry.input_rejected";
const startedEvent = "trace.span_started";
const endedEvent = "trace.span_ended";
const trustedJobContinuations = new WeakMap<
  Observability,
  (carrier: unknown, input: JobOperationStart) => ActiveOperation
>();

const defaultRuntime: TelemetryRuntime = Object.freeze({
  monotonicTime: () => globalThis.performance.now(),
  randomBytes(length: number) {
    return globalThis.crypto.getRandomValues(new Uint8Array(length));
  },
  wallTime: () => new Date().toISOString(),
});

const safeTimestamp = (runtime: TelemetryRuntime): string => {
  try {
    const value = runtime.wallTime();
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)
      ? value
      : "1970-01-01T00:00:00.000Z";
  } catch {
    return "1970-01-01T00:00:00.000Z";
  }
};

const safeMonotonicTime = (runtime: TelemetryRuntime): number => {
  try {
    const value = runtime.monotonicTime();
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
};

const operationFields = (operation: OperationStart): Readonly<Record<string, unknown>> => {
  switch (operation.kind) {
    case "dependency":
      return {
        dependency: operation.dependency,
        kind: operation.kind,
        operation: operation.operation,
      };
    case "http":
      return { kind: operation.kind, method: operation.method, operation: operation.operation };
    case "job":
      return {
        attempt: operation.attempt,
        kind: operation.kind,
        operation: operation.operation,
        schemaVersion: operation.schemaVersion,
      };
    case "service":
      return { kind: operation.kind, operation: operation.operation };
  }
};

const resultFields = (result: OperationResult): Readonly<Record<string, unknown>> => {
  switch (result.outcome) {
    case "cancelled":
    case "timeout":
      return { outcome: result.outcome };
    case "failure":
      return {
        category: result.category,
        errorCode: result.errorCode,
        outcome: result.outcome,
        retryable: result.retryable,
      };
    case "success":
      return result.statusCode === undefined
        ? { outcome: result.outcome }
        : { outcome: result.outcome, statusCode: result.statusCode };
  }
};

const eventFields = (event: OperationalEvent): Readonly<Record<string, unknown>> =>
  event.name === "service.shutdown_requested"
    ? { event: event.name, signal: event.signal }
    : { event: event.name };

const serialize = (record: Readonly<Record<string, unknown>>): string => {
  try {
    return JSON.stringify(record);
  } catch {
    return '{"schemaVersion":1,"event":"telemetry.serialization_failed"}';
  }
};

type RuntimeMetadata = Readonly<{
  environment: string;
  releaseVersion: string;
  service: string;
}>;

const emit = (
  sink: InternalJsonLineSink,
  runtime: TelemetryRuntime,
  metadata: RuntimeMetadata,
  context: TraceContext,
  level: "error" | "info" | "warn",
  fields: Readonly<Record<string, unknown>>,
): void => {
  const record = {
    schemaVersion: 1,
    timestamp: safeTimestamp(runtime),
    service: metadata.service,
    environment: metadata.environment,
    releaseVersion: metadata.releaseVersion,
    level,
    correlationId: context.correlationId,
    traceId: context.traceId,
    spanId: context.spanId,
    ...(context.parentSpanId === undefined ? {} : { parentSpanId: context.parentSpanId }),
    ...fields,
  };
  sink.write(serialize(record));
};

const createActiveOperation = (
  context: TraceContext,
  operation: OperationStart,
  sink: InternalJsonLineSink,
  runtime: TelemetryRuntime,
  metadata: RuntimeMetadata,
): ActiveOperation => {
  const startedAt = safeMonotonicTime(runtime);
  let ended = false;
  emit(sink, runtime, metadata, context, "info", {
    event: startedEvent,
    ...operationFields(operation),
  });

  return Object.freeze({
    child(input: DependencyOperationStart) {
      const sanitized = sanitizeOperationStart(input);
      if (sanitized?.kind !== "dependency") {
        emit(sink, runtime, metadata, context, "warn", { event: invalidInputEvent });
        return createActiveOperation(
          createChildTraceContext(runtime, context),
          { dependency: "provider", kind: "dependency", operation: "dependency.request" },
          sink,
          runtime,
          metadata,
        );
      }
      return createActiveOperation(
        createChildTraceContext(runtime, context),
        sanitized,
        sink,
        runtime,
        metadata,
      );
    },
    context,
    end(result: OperationResult) {
      if (ended) return;
      ended = true;
      const sanitized = sanitizeOperationResult(result);
      const durationMs = Math.max(0, safeMonotonicTime(runtime) - startedAt);
      if (sanitized === null) {
        emit(sink, runtime, metadata, context, "warn", { event: invalidInputEvent });
        emit(sink, runtime, metadata, context, "error", {
          category: "internal",
          durationMs,
          errorCode: "invalid_input",
          event: endedEvent,
          outcome: "failure",
          retryable: false,
        });
        return;
      }
      const level =
        sanitized.outcome === "failure"
          ? "error"
          : sanitized.outcome === "cancelled" || sanitized.outcome === "timeout"
            ? "warn"
            : "info";
      emit(sink, runtime, metadata, context, level, {
        durationMs,
        event: endedEvent,
        ...resultFields(sanitized),
      });
    },
    event(event: OperationalEvent) {
      const sanitized = sanitizeOperationalEvent(event);
      emit(
        sink,
        runtime,
        metadata,
        context,
        sanitized?.name === "trace.carrier_rejected" || sanitized === null ? "warn" : "info",
        sanitized === null ? { event: invalidInputEvent } : eventFields(sanitized),
      );
    },
    toJobCarrier: () => toTraceCarrier(context),
    toTraceHeaders: () => Object.freeze({ traceparent: formatTraceparent(context) }),
  });
};

export const createObservability = (configuration: ObservabilityConfiguration): Observability => {
  const runtime = configuration.runtime ?? defaultRuntime;
  const sink = createJsonLinesSink(configuration.writer);
  const metadata = Object.freeze({
    environment: sanitizeEnvironment(configuration.environment),
    releaseVersion: sanitizeReleaseVersion(configuration.releaseVersion),
    service: sanitizeService(configuration.service),
  });

  const continueTrustedJob = (carrier: unknown, input: JobOperationStart): ActiveOperation => {
    const sanitized = sanitizeOperationStart(input);
    const continued = continueTraceContext(runtime, carrier);
    const context = continued ?? createRootTraceContext(runtime);
    if (continued === null) {
      emit(sink, runtime, metadata, context, "warn", {
        event: "trace.carrier_rejected",
      });
    }
    if (sanitized?.kind !== "job") {
      emit(sink, runtime, metadata, context, "warn", {
        event: invalidInputEvent,
      });
    }
    return createActiveOperation(
      context,
      sanitized?.kind === "job"
        ? sanitized
        : { attempt: 1, kind: "job", operation: "job.process", schemaVersion: 1 },
      sink,
      runtime,
      metadata,
    );
  };
  const observability: Observability = Object.freeze({
    flush: () => sink.flush(),
    start(input: OperationStart) {
      const sanitized = sanitizeOperationStart(input);
      const context = createRootTraceContext(runtime);
      if (sanitized === null || (sanitized.kind !== "http" && sanitized.kind !== "service")) {
        emit(sink, runtime, metadata, context, "warn", {
          event: invalidInputEvent,
        });
        return createActiveOperation(
          context,
          { kind: "service", operation: "service.lifecycle" },
          sink,
          runtime,
          metadata,
        );
      }
      return createActiveOperation(context, sanitized, sink, runtime, metadata);
    },
  });
  trustedJobContinuations.set(observability, continueTrustedJob);
  return observability;
};

export const continueTrustedJob = (
  observability: Observability,
  carrier: unknown,
  input: JobOperationStart,
): ActiveOperation => {
  const continuation = trustedJobContinuations.get(observability);
  if (continuation === undefined) {
    throw new TypeError("Job continuation requires an observability instance from this runtime.");
  }
  return continuation(carrier, input);
};
