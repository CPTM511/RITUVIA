export const telemetryEnvironments = Object.freeze([
  "local",
  "preview",
  "staging",
  "production",
] as const);

export type TelemetryEnvironment = (typeof telemetryEnvironments)[number];
export type TelemetryService = "web" | "worker";
export type TraceFlags = "00" | "01";

export type TraceContext = Readonly<{
  correlationId: string;
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  traceFlags: TraceFlags;
}>;

export type TraceCarrierV1 = Readonly<{
  schemaVersion: 1;
  correlationId: string;
  traceparent: string;
}>;

export type ServiceOperationStart = Readonly<{
  kind: "service";
  operation: "service.lifecycle";
}>;

export type HttpOperationStart = Readonly<{
  kind: "http";
  method: "DELETE" | "GET" | "HEAD" | "OPTIONS" | "OTHER" | "PATCH" | "POST" | "PUT";
  operation: "http.proxy_handoff";
}>;

export type JobOperationStart = Readonly<{
  attempt: number;
  kind: "job";
  operation: "job.process";
  schemaVersion: number;
}>;

export type DependencyOperationStart = Readonly<{
  dependency: "ai" | "database" | "email" | "payment" | "provider";
  kind: "dependency";
  operation: "dependency.request";
}>;

export type OperationStart =
  DependencyOperationStart | HttpOperationStart | JobOperationStart | ServiceOperationStart;

export type FailureCategory = "configuration" | "dependency" | "internal" | "validation";
export type StableErrorCode =
  "configuration_error" | "dependency_error" | "internal_error" | "invalid_input";

export type OperationResult =
  | Readonly<{ outcome: "cancelled" | "timeout" }>
  | Readonly<{
      category: FailureCategory;
      errorCode: StableErrorCode;
      outcome: "failure";
      retryable: boolean;
    }>
  | Readonly<{ outcome: "success"; statusCode?: number }>;

export type OperationalEvent =
  | Readonly<{ name: "service.ready" }>
  | Readonly<{ name: "service.shutdown_requested"; signal: "SIGINT" | "SIGTERM" }>
  | Readonly<{ name: "trace.carrier_rejected" }>;

export interface TelemetryRuntime {
  monotonicTime(): number;
  randomBytes(length: number): Uint8Array;
  wallTime(): string;
}

export type ObservabilityConfiguration = Readonly<{
  environment: TelemetryEnvironment;
  releaseVersion: string;
  runtime?: TelemetryRuntime;
  service: TelemetryService;
  writer: Readonly<{
    flush?: () => Promise<void>;
    maxLineBytes?: number;
    writeLine: (line: string) => void;
  }>;
}>;

export interface ActiveOperation {
  readonly context: TraceContext;
  child(input: DependencyOperationStart): ActiveOperation;
  end(result: OperationResult): void;
  event(event: OperationalEvent): void;
  toJobCarrier(): TraceCarrierV1;
  toTraceHeaders(): Readonly<{ traceparent: string }>;
}

export interface Observability {
  flush(): Promise<void>;
  start(input: HttpOperationStart | ServiceOperationStart): ActiveOperation;
}
