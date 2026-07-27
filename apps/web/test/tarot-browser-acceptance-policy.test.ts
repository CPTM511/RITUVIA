import { describe, expect, it } from "vitest";

import {
  auditTarotBrowserAcceptanceLedger,
  tarotBrowserAcceptanceScenarioIds,
  type TarotBrowserAcceptanceExpectation,
  type TarotBrowserAcceptanceLedger,
  type TarotBrowserAcceptanceReportBody,
} from "./tarot-browser-acceptance-policy.mjs";

const sessionOperationId = "11111111-1111-4111-8111-111111111111";
const secondSessionOperationId = "66666666-6666-4666-8666-666666666666";
const readingOperationId = "22222222-2222-4222-8222-222222222222";
const secondReadingOperationId = "77777777-7777-4777-8777-777777777777";
const reportOperationId = "55555555-5555-4555-8555-555555555555";

const oneCardReadingBody = Object.freeze({
  locale: "en",
  readingType: "one_card",
  schemaVersion: "tarot-reading-create.v1",
  themeCode: "open_reflection",
} as const);

const threeCardReadingBody = Object.freeze({
  locale: "en",
  readingType: "three_card",
  schemaVersion: "tarot-reading-create.v1",
  themeCode: "open_reflection",
} as const);

const wholeReadingReportBody = Object.freeze({
  category: "safety",
  schemaVersion: "tarot-reading-report.v1",
  target: Object.freeze({ kind: "reading" }),
}) satisfies TarotBrowserAcceptanceReportBody;

const positionReportBody = Object.freeze({
  category: "safety",
  schemaVersion: "tarot-reading-report.v1",
  target: Object.freeze({ kind: "position", positionId: "situation" }),
}) satisfies TarotBrowserAcceptanceReportBody;

const createOneCardLedger = (
  overrides: Partial<TarotBrowserAcceptanceLedger> = {},
): TarotBrowserAcceptanceLedger => ({
  readingBodies: [oneCardReadingBody],
  readingGets: 0,
  readingOperationIds: [readingOperationId],
  readingStarts: 1,
  reportBodies: [wholeReadingReportBody],
  reportOperationIds: [reportOperationId],
  reports: 1,
  sessionBodies: [null],
  sessionOperationIds: [sessionOperationId],
  sessionStarts: 1,
  unexpected: [],
  ...overrides,
});

const oneCardExpectation = Object.freeze({
  readingGets: 0,
  readingStarts: 1,
  readingType: "one_card",
  reportBody: wholeReadingReportBody,
  reports: 1,
  sessionStarts: 1,
} as const satisfies TarotBrowserAcceptanceExpectation);

describe("tarot browser acceptance ledger policy", () => {
  it("accepts exact one-card and three-card report ledgers", () => {
    expect(auditTarotBrowserAcceptanceLedger(createOneCardLedger(), oneCardExpectation)).toEqual(
      [],
    );

    const threeCardLedger: TarotBrowserAcceptanceLedger = {
      readingBodies: [threeCardReadingBody],
      readingGets: 1,
      readingOperationIds: [readingOperationId],
      readingStarts: 1,
      reportBodies: [positionReportBody],
      reportOperationIds: [reportOperationId],
      reports: 1,
      sessionBodies: [null],
      sessionOperationIds: [sessionOperationId],
      sessionStarts: 1,
      unexpected: [],
    };
    expect(
      auditTarotBrowserAcceptanceLedger(threeCardLedger, {
        readingGets: 1,
        readingStarts: 1,
        readingType: "three_card",
        reportBody: positionReportBody,
        reports: 1,
        sessionStarts: 1,
      }),
    ).toEqual([]);
  });

  it("accepts an offline zero-request ledger", () => {
    const offlineLedger: TarotBrowserAcceptanceLedger = {
      readingBodies: [],
      readingGets: 0,
      readingOperationIds: [],
      readingStarts: 0,
      reportBodies: [],
      reportOperationIds: [],
      reports: 0,
      sessionBodies: [],
      sessionOperationIds: [],
      sessionStarts: 0,
      unexpected: [],
    };
    expect(
      auditTarotBrowserAcceptanceLedger(offlineLedger, {
        readingGets: 0,
        readingStarts: 0,
        readingType: "one_card",
        reports: 0,
        sessionStarts: 0,
      }),
    ).toEqual([]);
  });

  it("accepts explicit session and reading retries only with the same keys", () => {
    const retryLedger: TarotBrowserAcceptanceLedger = {
      readingBodies: [threeCardReadingBody, threeCardReadingBody],
      readingGets: 0,
      readingOperationIds: [readingOperationId, readingOperationId],
      readingStarts: 2,
      reportBodies: [],
      reportOperationIds: [],
      reports: 0,
      sessionBodies: [null, null],
      sessionOperationIds: [sessionOperationId, sessionOperationId],
      sessionStarts: 2,
      unexpected: [],
    };
    expect(
      auditTarotBrowserAcceptanceLedger(retryLedger, {
        readingGets: 0,
        readingStarts: 2,
        readingType: "three_card",
        reports: 0,
        sameReadingKey: true,
        sameSessionKey: true,
        sessionStarts: 2,
      }),
    ).toEqual([]);
  });

  it("accepts a separate reflection only with fresh operation keys", () => {
    const ledger: TarotBrowserAcceptanceLedger = {
      readingBodies: [oneCardReadingBody, oneCardReadingBody],
      readingGets: 0,
      readingOperationIds: [readingOperationId, secondReadingOperationId],
      readingStarts: 2,
      reportBodies: [],
      reportOperationIds: [],
      reports: 0,
      sessionBodies: [null, null],
      sessionOperationIds: [sessionOperationId, secondSessionOperationId],
      sessionStarts: 2,
      unexpected: [],
    };
    const expectation = {
      readingGets: 0,
      readingStarts: 2,
      readingType: "one_card",
      reports: 0,
      sameReadingKey: false,
      sameSessionKey: false,
      sessionStarts: 2,
    } as const satisfies TarotBrowserAcceptanceExpectation;

    expect(auditTarotBrowserAcceptanceLedger(ledger, expectation)).toEqual([]);
    expect(
      auditTarotBrowserAcceptanceLedger(
        {
          ...ledger,
          readingOperationIds: [readingOperationId, readingOperationId],
          sessionOperationIds: [sessionOperationId, sessionOperationId],
        },
        expectation,
      ),
    ).toEqual([
      "ledger.readingOperationIds:new-operation-key-reused",
      "ledger.sessionOperationIds:new-operation-key-reused",
    ]);
  });

  it("rejects malformed operation UUIDs", () => {
    expect(
      auditTarotBrowserAcceptanceLedger(
        createOneCardLedger({ sessionOperationIds: ["11111111-1111-4111-7111-111111111111"] }),
        oneCardExpectation,
      ),
    ).toEqual(["ledger.sessionOperationIds[0]:invalid-uuid-v4"]);
  });

  it("rejects changed same-operation retry keys", () => {
    const findings = auditTarotBrowserAcceptanceLedger(
      {
        readingBodies: [threeCardReadingBody, threeCardReadingBody],
        readingGets: 0,
        readingOperationIds: [readingOperationId, secondReadingOperationId],
        readingStarts: 2,
        reportBodies: [],
        reportOperationIds: [],
        reports: 0,
        sessionBodies: [null, null],
        sessionOperationIds: [sessionOperationId, secondSessionOperationId],
        sessionStarts: 2,
        unexpected: [],
      },
      {
        readingGets: 0,
        readingStarts: 2,
        readingType: "three_card",
        reports: 0,
        sameReadingKey: true,
        sameSessionKey: true,
        sessionStarts: 2,
      },
    );
    expect(findings).toEqual([
      "ledger.readingOperationIds:retry-key-changed",
      "ledger.sessionOperationIds:retry-key-changed",
    ]);
  });

  it("rejects non-independent session, reading, and report keys", () => {
    expect(
      auditTarotBrowserAcceptanceLedger(
        createOneCardLedger({ reportOperationIds: [readingOperationId] }),
        oneCardExpectation,
      ),
    ).toEqual(["ledger.operationIds:not-independent"]);
  });

  it("rejects wrong, extra, malformed, and free-text bodies", () => {
    const wrongReadingBody = {
      ...oneCardReadingBody,
      question: "private free text",
      themeCode: "work",
    };
    expect(
      auditTarotBrowserAcceptanceLedger(
        createOneCardLedger({
          readingBodies: [wrongReadingBody as never],
          sessionBodies: ["" as never],
        }),
        oneCardExpectation,
      ),
    ).toEqual(["ledger.readingBodies[0]:invalid", "ledger.sessionBodies[0]:expected-null"]);

    const reportWithFreeText = {
      ...wholeReadingReportBody,
      details: "private free text",
    };
    expect(
      auditTarotBrowserAcceptanceLedger(
        createOneCardLedger({ reportBodies: [reportWithFreeText] }),
        oneCardExpectation,
      ),
    ).toEqual(["ledger.reportBodies[0]:invalid"]);
    expect(
      auditTarotBrowserAcceptanceLedger(
        createOneCardLedger({ reportBodies: [new Date() as never] }),
        oneCardExpectation,
      ),
    ).toEqual(["ledger.reportBodies[0]:invalid"]);
  });

  it("rejects count, array-length, and unexpected-request mutations", () => {
    expect(
      auditTarotBrowserAcceptanceLedger(
        createOneCardLedger({
          readingGets: 1,
          readingOperationIds: [],
          unexpected: ["DELETE:/api/v1/readings/private"],
        }),
        oneCardExpectation,
      ),
    ).toEqual([
      "ledger.readingGets:expected-0:received-1",
      "ledger.readingOperationIds:expected-1:received-0",
      "ledger.unexpected:expected-0:received-1",
    ]);
  });

  it("requires an exact report expectation whenever reports are expected", () => {
    expect(
      auditTarotBrowserAcceptanceLedger(createOneCardLedger(), {
        readingGets: 0,
        readingStarts: 1,
        readingType: "one_card",
        reports: 1,
        sessionStarts: 1,
      }),
    ).toEqual(["expectation.reportBody:required"]);
  });

  it("never throws for malformed ledgers, expectations, getters, or cyclic bodies", () => {
    const throwingLedger = Object.defineProperty({}, "readingGets", {
      enumerable: true,
      get: () => {
        throw new Error("private canary");
      },
    });
    const cyclicReportBody: Record<string, unknown> = {};
    cyclicReportBody.self = cyclicReportBody;

    for (const [ledger, expectation] of [
      [null, null],
      [[], oneCardExpectation],
      [{}, oneCardExpectation],
      [throwingLedger, oneCardExpectation],
      [createOneCardLedger(), { ...oneCardExpectation, readingStarts: Number.NaN }],
      [createOneCardLedger(), { ...oneCardExpectation, reportBody: cyclicReportBody }],
    ]) {
      let findings: readonly string[] = [];
      expect(() => {
        findings = auditTarotBrowserAcceptanceLedger(
          ledger as TarotBrowserAcceptanceLedger,
          expectation as TarotBrowserAcceptanceExpectation,
        );
      }).not.toThrow();
      expect(findings.length).toBeGreaterThan(0);
      expect(findings).toEqual([...findings].sort());
      expect(Object.isFrozen(findings)).toBe(true);
      expect(findings.join(" ")).not.toContain("private canary");
    }
  });

  it("deeply freezes the exact ordered scenario inventory and every result", () => {
    expect(tarotBrowserAcceptanceScenarioIds).toEqual([
      "one-card-happy-report-resume",
      "three-card-happy-position-report",
      "one-card-offline-recovery",
      "three-card-service-retry",
      "one-card-limit-stop",
      "one-card-stale-resume",
    ]);
    expect(Object.isFrozen(tarotBrowserAcceptanceScenarioIds)).toBe(true);

    const accepted = auditTarotBrowserAcceptanceLedger(createOneCardLedger(), oneCardExpectation);
    const rejected = auditTarotBrowserAcceptanceLedger(
      createOneCardLedger({ readingGets: 2 }),
      oneCardExpectation,
    );
    expect(Object.isFrozen(accepted)).toBe(true);
    expect(Object.isFrozen(rejected)).toBe(true);
    expect(() => {
      (rejected as string[]).push("mutation");
    }).toThrow();
  });
});
