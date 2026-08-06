import {
  parseAstrologyNatalViewResponse,
  type AstrologyNatalViewItem,
} from "../_contracts/astrology-natal-response";
import type { RecoveryAstrologyRequest } from "../_contracts/recovery-astrology";

export const recoveryAstrologyEndpoint = "/api/recovery/item-8/astrology" as const;
export const anonymousSessionEndpoint = "/api/v1/anonymous/session" as const;
export const recoveryAstrologyMaximumResponseBytes = 512 * 1024;

export type RecoveryAstrologyTransportResult =
  | Readonly<{ kind: "aborted" }>
  | Readonly<{ kind: "ambiguous" }>
  | Readonly<{ kind: "error" }>
  | Readonly<{ kind: "invalid" }>
  | Readonly<{ kind: "nonexistent" }>
  | Readonly<{ kind: "offline" }>
  | Readonly<{ item: AstrologyNatalViewItem; kind: "success" }>
  | Readonly<{ kind: "unavailable" }>;

type RequestInput = Readonly<{
  fetcher?: typeof fetch;
  isOnline: () => boolean;
  request: RecoveryAstrologyRequest;
  signal: AbortSignal;
}>;

const parseBoundedJson = async (response: Response): Promise<unknown> => {
  if (response.headers.get("content-type")?.split(";", 1)[0]?.trim() !== "application/json") {
    throw new TypeError("The protected astrology response metadata is invalid.");
  }
  const declaredLength = response.headers.get("content-length");
  if (
    declaredLength !== null &&
    (!/^(?:0|[1-9][0-9]{0,6})$/u.test(declaredLength) ||
      Number(declaredLength) > recoveryAstrologyMaximumResponseBytes)
  ) {
    throw new TypeError("The protected astrology response is too large.");
  }
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > recoveryAstrologyMaximumResponseBytes) {
    throw new TypeError("The protected astrology response is too large.");
  }
  return JSON.parse(text) as unknown;
};

export const requestRecoveryAstrology = async ({
  fetcher = fetch,
  isOnline,
  request,
  signal,
}: RequestInput): Promise<RecoveryAstrologyTransportResult> => {
  if (!isOnline()) return Object.freeze({ kind: "offline" });
  try {
    const sessionResponse = await fetcher(anonymousSessionEndpoint, {
      cache: "no-store",
      credentials: "same-origin",
      headers: { "idempotency-key": crypto.randomUUID() },
      method: "POST",
      redirect: "error",
      signal,
    });
    const csrfToken = sessionResponse.headers.get("x-csrf-token");
    if (sessionResponse.status !== 204 || csrfToken === null) {
      return Object.freeze({ kind: "unavailable" });
    }
    const response = await fetcher(recoveryAstrologyEndpoint, {
      body: JSON.stringify(request),
      cache: "no-store",
      credentials: "same-origin",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "x-csrf-token": csrfToken,
      },
      method: "POST",
      redirect: "error",
      signal,
    });
    if (response.status === 400 || response.status === 413) {
      return Object.freeze({ kind: "invalid" });
    }
    if (response.status === 409) return Object.freeze({ kind: "ambiguous" });
    if (response.status === 422) return Object.freeze({ kind: "nonexistent" });
    if (response.status === 401 || response.status === 403 || response.status === 503) {
      return Object.freeze({ kind: "unavailable" });
    }
    if (response.status !== 200) return Object.freeze({ kind: "error" });
    const parsed = parseAstrologyNatalViewResponse(await parseBoundedJson(response));
    return parsed.item === null
      ? Object.freeze({ kind: "error" })
      : Object.freeze({ item: parsed.item, kind: "success" });
  } catch (error) {
    if (signal.aborted || (error instanceof DOMException && error.name === "AbortError")) {
      return Object.freeze({ kind: "aborted" });
    }
    return Object.freeze({ kind: isOnline() ? "error" : "offline" });
  }
};
