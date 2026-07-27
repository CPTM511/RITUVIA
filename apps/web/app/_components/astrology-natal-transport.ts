import {
  parseAstrologyNatalViewResponse,
  type AstrologyNatalViewItem,
} from "../_contracts/astrology-natal-response";

export const astrologyNatalViewEndpoint = "/api/v1/readings/astrology/natal" as const;
export const astrologyNatalViewMaximumResponseBytes = 512 * 1024;

export type AstrologyNatalTransportResult =
  | Readonly<{ kind: "aborted" }>
  | Readonly<{ kind: "empty" }>
  | Readonly<{ kind: "error" }>
  | Readonly<{ kind: "offline" }>
  | Readonly<{ kind: "success"; item: AstrologyNatalViewItem }>
  | Readonly<{ kind: "unauthorized" }>
  | Readonly<{ kind: "unavailable" }>;

type RequestAstrologyNatalInput = Readonly<{
  fetcher?: typeof fetch;
  isOnline: () => boolean;
  signal: AbortSignal;
}>;

const parseBoundedResponse = async (response: Response): Promise<unknown> => {
  const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim();
  if (contentType !== "application/json") throw new TypeError();
  const declaredLength = response.headers.get("content-length");
  if (
    declaredLength !== null &&
    (!/^[0-9]+$/u.test(declaredLength) ||
      Number(declaredLength) > astrologyNatalViewMaximumResponseBytes)
  ) {
    throw new TypeError();
  }
  const body = await response.text();
  if (new TextEncoder().encode(body).byteLength > astrologyNatalViewMaximumResponseBytes) {
    throw new TypeError();
  }
  return JSON.parse(body) as unknown;
};

export const requestAstrologyNatalView = async ({
  fetcher = fetch,
  isOnline,
  signal,
}: RequestAstrologyNatalInput): Promise<AstrologyNatalTransportResult> => {
  if (!isOnline()) return Object.freeze({ kind: "offline" });
  try {
    const response = await fetcher(astrologyNatalViewEndpoint, {
      cache: "no-store",
      credentials: "same-origin",
      headers: { accept: "application/json" },
      method: "GET",
      redirect: "error",
      signal,
    });
    if (response.status === 401) return Object.freeze({ kind: "unauthorized" });
    if (response.status === 503) return Object.freeze({ kind: "unavailable" });
    if (response.status !== 200) return Object.freeze({ kind: "error" });
    const parsed = parseAstrologyNatalViewResponse(await parseBoundedResponse(response));
    return parsed.item === null
      ? Object.freeze({ kind: "empty" })
      : Object.freeze({ item: parsed.item, kind: "success" });
  } catch (error) {
    return error instanceof DOMException && error.name === "AbortError"
      ? Object.freeze({ kind: "aborted" })
      : Object.freeze({ kind: "error" });
  }
};
