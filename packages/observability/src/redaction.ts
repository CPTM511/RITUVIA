import type {
  OperationalEvent,
  OperationResult,
  OperationStart,
  TraceCarrierV1,
} from "./contracts.js";

export const REDACTED = "[REDACTED]" as const;

type DataFields = ReadonlyMap<string, unknown>;

const readDataFields = (input: unknown, allowedKeys: ReadonlySet<string>): DataFields => {
  if ((typeof input !== "object" && typeof input !== "function") || input === null) {
    return new Map();
  }

  try {
    const fields = new Map<string, unknown>();
    for (const key of allowedKeys) {
      const descriptor = Object.getOwnPropertyDescriptor(input, key);
      if (descriptor?.enumerable && "value" in descriptor) {
        fields.set(key, descriptor.value);
      }
    }
    return fields;
  } catch {
    return new Map();
  }
};

const operationKeys = new Set([
  "attempt",
  "dependency",
  "kind",
  "method",
  "operation",
  "schemaVersion",
]);
const resultKeys = new Set(["category", "errorCode", "outcome", "retryable", "statusCode"]);
const eventKeys = new Set(["name", "signal"]);
const carrierKeys = new Set(["correlationId", "schemaVersion", "traceparent"]);

const isSafeInteger = (value: unknown, minimum: number, maximum: number): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= minimum && value <= maximum;

export const sanitizeOperationStart = (input: unknown): OperationStart | null => {
  const fields = readDataFields(input, operationKeys);
  const kind = fields.get("kind");
  const operation = fields.get("operation");

  if (kind === "service" && operation === "service.lifecycle") {
    return Object.freeze({ kind, operation });
  }
  const method = fields.get("method");
  if (
    kind === "http" &&
    operation === "http.proxy_handoff" &&
    (method === "DELETE" ||
      method === "GET" ||
      method === "HEAD" ||
      method === "OPTIONS" ||
      method === "OTHER" ||
      method === "PATCH" ||
      method === "POST" ||
      method === "PUT")
  ) {
    return Object.freeze({ kind, method, operation });
  }
  const attempt = fields.get("attempt");
  const schemaVersion = fields.get("schemaVersion");
  if (
    kind === "job" &&
    operation === "job.process" &&
    isSafeInteger(attempt, 1, 100) &&
    isSafeInteger(schemaVersion, 1, 1_000)
  ) {
    return Object.freeze({ attempt, kind, operation, schemaVersion });
  }
  const dependency = fields.get("dependency");
  if (
    kind === "dependency" &&
    operation === "dependency.request" &&
    (dependency === "ai" ||
      dependency === "database" ||
      dependency === "email" ||
      dependency === "payment" ||
      dependency === "provider")
  ) {
    return Object.freeze({ dependency, kind, operation });
  }
  return null;
};

export const sanitizeOperationResult = (input: unknown): OperationResult | null => {
  const fields = readDataFields(input, resultKeys);
  const outcome = fields.get("outcome");
  if (outcome === "cancelled" || outcome === "timeout") {
    return Object.freeze({ outcome });
  }
  if (outcome === "success") {
    const statusCode = fields.get("statusCode");
    return statusCode === undefined
      ? Object.freeze({ outcome })
      : isSafeInteger(statusCode, 100, 599)
        ? Object.freeze({ outcome, statusCode })
        : null;
  }
  const category = fields.get("category");
  const errorCode = fields.get("errorCode");
  const retryable = fields.get("retryable");
  if (
    outcome === "failure" &&
    (category === "configuration" ||
      category === "dependency" ||
      category === "internal" ||
      category === "validation") &&
    (errorCode === "configuration_error" ||
      errorCode === "dependency_error" ||
      errorCode === "internal_error" ||
      errorCode === "invalid_input") &&
    typeof retryable === "boolean"
  ) {
    return Object.freeze({ category, errorCode, outcome, retryable });
  }
  return null;
};

export const sanitizeOperationalEvent = (input: unknown): OperationalEvent | null => {
  const fields = readDataFields(input, eventKeys);
  const name = fields.get("name");
  if (name === "service.ready" || name === "trace.carrier_rejected") {
    return Object.freeze({ name });
  }
  const signal = fields.get("signal");
  if (name === "service.shutdown_requested" && (signal === "SIGINT" || signal === "SIGTERM")) {
    return Object.freeze({ name, signal });
  }
  return null;
};

export const readTraceCarrier = (input: unknown): TraceCarrierV1 | null => {
  const fields = readDataFields(input, carrierKeys);
  const correlationId = fields.get("correlationId");
  const traceparent = fields.get("traceparent");
  if (
    fields.get("schemaVersion") === 1 &&
    typeof correlationId === "string" &&
    typeof traceparent === "string"
  ) {
    return Object.freeze({ correlationId, schemaVersion: 1, traceparent });
  }
  return null;
};

export const sanitizeReleaseVersion = (input: unknown): string => {
  if (typeof input !== "string") return REDACTED;
  const normalized = input.normalize("NFKC");
  return /^(?:0|[1-9]\d{0,9})\.(?:0|[1-9]\d{0,9})\.(?:0|[1-9]\d{0,9})(?:-[0-9A-Za-z][0-9A-Za-z.-]{0,31})?(?:\+[0-9A-Za-z][0-9A-Za-z.-]{0,31})?$/u.test(
    normalized,
  )
    ? normalized
    : REDACTED;
};

export const sanitizeEnvironment = (input: unknown): string =>
  input === "local" || input === "preview" || input === "production" || input === "staging"
    ? input
    : "unknown";

export const sanitizeService = (input: unknown): string =>
  input === "web" || input === "worker" ? input : "unknown";
