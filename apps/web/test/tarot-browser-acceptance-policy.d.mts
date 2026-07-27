export type TarotBrowserAcceptanceReadingType = "one_card" | "three_card";

export type TarotBrowserAcceptanceJsonPrimitive = boolean | number | string | null;

export type TarotBrowserAcceptanceJsonValue =
  | TarotBrowserAcceptanceJsonPrimitive
  | readonly TarotBrowserAcceptanceJsonValue[]
  | Readonly<{ [key: string]: TarotBrowserAcceptanceJsonValue }>;

export type TarotBrowserAcceptanceReadingBody = Readonly<{
  locale: "en";
  readingType: TarotBrowserAcceptanceReadingType;
  schemaVersion: "tarot-reading-create.v1";
  themeCode: "open_reflection";
}>;

export type TarotBrowserAcceptanceReportBody = Readonly<{
  [key: string]: TarotBrowserAcceptanceJsonValue;
}>;

export type TarotBrowserAcceptanceLedger = Readonly<{
  readingBodies: readonly TarotBrowserAcceptanceReadingBody[];
  readingGets: number;
  readingOperationIds: readonly string[];
  readingStarts: number;
  reportBodies: readonly TarotBrowserAcceptanceReportBody[];
  reportOperationIds: readonly string[];
  reports: number;
  sessionBodies: readonly null[];
  sessionOperationIds: readonly string[];
  sessionStarts: number;
  unexpected: readonly string[];
}>;

export type TarotBrowserAcceptanceExpectation = Readonly<{
  readingGets: number;
  readingStarts: number;
  readingType: TarotBrowserAcceptanceReadingType;
  reportBody?: TarotBrowserAcceptanceReportBody;
  reports: number;
  sameReadingKey?: boolean;
  sameSessionKey?: boolean;
  sessionStarts: number;
}>;

export const tarotBrowserAcceptanceScenarioIds: readonly [
  "one-card-happy-report-resume",
  "three-card-happy-position-report",
  "one-card-offline-recovery",
  "three-card-service-retry",
  "one-card-limit-stop",
  "one-card-stale-resume",
];

export function auditTarotBrowserAcceptanceLedger(
  ledger: TarotBrowserAcceptanceLedger,
  expectation: TarotBrowserAcceptanceExpectation,
): readonly string[];
