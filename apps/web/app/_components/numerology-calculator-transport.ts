import {
  parseNumerologyCalculationFacts,
  type NumerologyCalculationFacts,
  type NumerologyCalculationRequest,
} from "../_contracts/numerology-calculation-response";

export const numerologyCalculationEndpoint = "/api/v1/numerology/calculate";
export const numerologyCalculationMaximumResponseBytes = 16_384;

export type NumerologyTransportResult =
  | Readonly<{ kind: "aborted" }>
  | Readonly<{ kind: "error" }>
  | Readonly<{ kind: "invalid" }>
  | Readonly<{ kind: "offline" }>
  | Readonly<{ kind: "success"; facts: NumerologyCalculationFacts }>
  | Readonly<{ kind: "unavailable" }>;

type RequestNumerologyInput = Readonly<{
  fetcher?: typeof fetch;
  isOnline: () => boolean;
  request: NumerologyCalculationRequest;
  signal: AbortSignal;
}>;

const parseBoundedResponse = async (response: Response): Promise<unknown> => {
  const contentType = response.headers.get("content-type")?.split(";", 1)[0];
  const contentLength = response.headers.get("content-length");
  if (
    contentType !== "application/json" ||
    (contentLength !== null &&
      (!/^(?:0|[1-9][0-9]{0,4})$/u.test(contentLength) ||
        Number(contentLength) > numerologyCalculationMaximumResponseBytes))
  ) {
    throw new TypeError("The numerology response metadata is invalid.");
  }
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > numerologyCalculationMaximumResponseBytes) {
    throw new TypeError("The numerology response is too large.");
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new TypeError("The numerology response is not valid JSON.");
  }
};

export const requestNumerologyCalculation = async ({
  fetcher = fetch,
  isOnline,
  request,
  signal,
}: RequestNumerologyInput): Promise<NumerologyTransportResult> => {
  if (!isOnline()) return { kind: "offline" };
  try {
    const response = await fetcher(numerologyCalculationEndpoint, {
      body: JSON.stringify(request),
      cache: "no-store",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      method: "POST",
      signal,
    });
    if (response.status === 400 || response.status === 413 || response.status === 422) {
      return { kind: "invalid" };
    }
    if (response.status === 503) return { kind: "unavailable" };
    if (!response.ok) return { kind: "error" };
    return {
      facts: parseNumerologyCalculationFacts(await parseBoundedResponse(response)),
      kind: "success",
    };
  } catch {
    if (signal.aborted) return { kind: "aborted" };
    return { kind: isOnline() ? "error" : "offline" };
  }
};
