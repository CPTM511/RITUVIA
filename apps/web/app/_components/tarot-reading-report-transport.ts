import { tarotReadingReportSchemaVersion, type TarotReadingReportCategory } from "@rituvia/domain";

export type TarotReadingReportFailure =
  "conflict" | "error" | "not_found" | "offline" | "unavailable";

export type TarotReadingReportOperation = Readonly<{
  category: TarotReadingReportCategory;
  idempotencyKey: string;
  target: Readonly<{ kind: "reading" }> | Readonly<{ kind: "position"; positionId: string }>;
}>;

export class TarotReadingReportTransportError extends Error {
  public readonly failure: TarotReadingReportFailure;

  public constructor(failure: TarotReadingReportFailure) {
    super("The tarot reading report did not complete.");
    this.name = "TarotReadingReportTransportError";
    this.failure = failure;
  }
}

const fail = (failure: TarotReadingReportFailure): never => {
  throw new TarotReadingReportTransportError(failure);
};

const failureForStatus = (status: number): TarotReadingReportFailure => {
  switch (status) {
    case 404:
      return "not_found";
    case 409:
      return "conflict";
    case 503:
      return "unavailable";
    default:
      return "error";
  }
};

export const executeTarotReadingReport = async (
  input: Readonly<{
    fetcher: typeof fetch;
    operation: TarotReadingReportOperation;
    readingId: string;
    signal: AbortSignal;
  }>,
): Promise<void> => {
  const response = await input.fetcher(`/api/v1/readings/${input.readingId}/report`, {
    body: JSON.stringify({
      category: input.operation.category,
      schemaVersion: tarotReadingReportSchemaVersion,
      target: input.operation.target,
    }),
    cache: "no-store",
    credentials: "same-origin",
    headers: {
      "content-type": "application/json",
      "idempotency-key": input.operation.idempotencyKey,
    },
    method: "POST",
    signal: input.signal,
  });
  if (response.status !== 204) return fail(failureForStatus(response.status));
  if (response.headers.get("content-type") !== null) return fail("error");
  const body = await response.text();
  if (body !== "") return fail("error");
};
