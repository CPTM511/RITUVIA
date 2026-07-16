import type { TelemetryRuntime, TraceCarrierV1, TraceContext, TraceFlags } from "./contracts.js";
import { readTraceCarrier } from "./redaction.js";

const traceIdPattern = /^[0-9a-f]{32}$/u;
const spanIdPattern = /^[0-9a-f]{16}$/u;
const correlationIdPattern = /^req_[0-9a-f]{32}$/u;
const zeroTraceId = "00000000000000000000000000000000";
const zeroSpanId = "0000000000000000";
const zeroCorrelationId = `req_${zeroTraceId}`;

type ParsedTraceparent = Readonly<{
  spanId: string;
  traceFlags: TraceFlags;
  traceId: string;
}>;

const bytesToHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

const generateHex = (runtime: TelemetryRuntime, byteLength: number): string => {
  const bytes = runtime.randomBytes(byteLength);
  if (!(bytes instanceof Uint8Array) || bytes.byteLength !== byteLength) {
    throw new TypeError("Telemetry random source returned an invalid byte sequence.");
  }
  const value = bytesToHex(bytes);
  if (/^0+$/u.test(value)) {
    throw new TypeError("Telemetry random source returned an all-zero identifier.");
  }
  return value;
};

export const parseTraceparent = (input: unknown): ParsedTraceparent | null => {
  if (typeof input !== "string") return null;
  const match = /^00-([0-9a-f]{32})-([0-9a-f]{16})-(00|01)$/u.exec(input);
  if (!match) return null;
  const traceId = match.at(1);
  const spanId = match.at(2);
  const traceFlags = match.at(3);
  if (
    !traceId ||
    !spanId ||
    (traceFlags !== "00" && traceFlags !== "01") ||
    traceId === zeroTraceId ||
    spanId === zeroSpanId
  ) {
    return null;
  }
  return Object.freeze({ spanId, traceFlags, traceId });
};

export const isTraceparent = (input: unknown): input is string => parseTraceparent(input) !== null;

export const isTraceCarrier = (input: unknown): input is TraceCarrierV1 => {
  const carrier = readTraceCarrier(input);
  return (
    carrier !== null &&
    correlationIdPattern.test(carrier.correlationId) &&
    carrier.correlationId !== zeroCorrelationId &&
    parseTraceparent(carrier.traceparent) !== null
  );
};

export const validateTraceContext = (context: TraceContext): boolean =>
  correlationIdPattern.test(context.correlationId) &&
  context.correlationId !== zeroCorrelationId &&
  traceIdPattern.test(context.traceId) &&
  context.traceId !== zeroTraceId &&
  spanIdPattern.test(context.spanId) &&
  context.spanId !== zeroSpanId &&
  (context.traceFlags === "00" || context.traceFlags === "01") &&
  (context.parentSpanId === undefined ||
    (spanIdPattern.test(context.parentSpanId) && context.parentSpanId !== zeroSpanId));

export const createRootTraceContext = (runtime: TelemetryRuntime): TraceContext =>
  Object.freeze({
    correlationId: `req_${generateHex(runtime, 16)}`,
    spanId: generateHex(runtime, 8),
    traceFlags: "01",
    traceId: generateHex(runtime, 16),
  });

export const continueTraceContext = (
  runtime: TelemetryRuntime,
  carrierInput: unknown,
): TraceContext | null => {
  const carrier = readTraceCarrier(carrierInput);
  if (
    carrier === null ||
    !correlationIdPattern.test(carrier.correlationId) ||
    carrier.correlationId === zeroCorrelationId
  ) {
    return null;
  }
  const parent = parseTraceparent(carrier.traceparent);
  if (parent === null) return null;
  const context = Object.freeze({
    correlationId: carrier.correlationId,
    parentSpanId: parent.spanId,
    spanId: generateHex(runtime, 8),
    traceFlags: parent.traceFlags,
    traceId: parent.traceId,
  });
  return validateTraceContext(context) ? context : null;
};

export const createChildTraceContext = (
  runtime: TelemetryRuntime,
  parent: TraceContext,
): TraceContext => {
  if (!validateTraceContext(parent)) {
    throw new TypeError("Cannot create a child from an invalid trace context.");
  }
  return Object.freeze({
    correlationId: parent.correlationId,
    parentSpanId: parent.spanId,
    spanId: generateHex(runtime, 8),
    traceFlags: parent.traceFlags,
    traceId: parent.traceId,
  });
};

export const formatTraceparent = (context: TraceContext): string => {
  if (!validateTraceContext(context)) {
    throw new TypeError("Cannot format an invalid trace context.");
  }
  return `00-${context.traceId}-${context.spanId}-${context.traceFlags}`;
};

export const toTraceCarrier = (context: TraceContext): TraceCarrierV1 => {
  return Object.freeze({
    correlationId: context.correlationId,
    schemaVersion: 1,
    traceparent: formatTraceparent(context),
  });
};
