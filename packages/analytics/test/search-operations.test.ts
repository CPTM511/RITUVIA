import { describe, expect, it } from "vitest";

import {
  parseSearchOperationsSnapshot,
  projectSearchOperationsReport,
  renderSearchOperationsMarkdown,
  SearchOperationsContractError,
  searchOperationsSnapshotSchemaVersion,
  type SearchOperationsRouteAuthority,
} from "../src/index.js";

const authorities = Object.freeze([
  Object.freeze({
    contentFamily: "pages",
    locale: "en",
    pathname: "/en",
    qualityStatus: "passed",
    reviewDueDate: null,
    reviewedDate: "2026-07-17",
    routeId: "home",
    userIntent: "understand-rituvia-symbolic-reflection",
  }),
  Object.freeze({
    contentFamily: "pages",
    locale: "en",
    pathname: "/en/methodology",
    qualityStatus: "passed",
    reviewDueDate: "2027-07-17",
    reviewedDate: "2026-07-17",
    routeId: "methodology",
    userIntent: "understand-rituvia-methodology",
  }),
  Object.freeze({
    contentFamily: "tarot",
    locale: "en",
    pathname: "/en/tarot",
    qualityStatus: "passed",
    reviewDueDate: "2026-07-20",
    reviewedDate: "2026-07-01",
    routeId: "tarot",
    userIntent: "learn-major-arcana-reflection",
  }),
] satisfies readonly SearchOperationsRouteAuthority[]);

const editorialAuthorities = Object.freeze([
  Object.freeze({
    authorityId: "record.one",
    kind: "record",
    reviewDueDate: "2027-07-29",
    reviewedDate: "2026-07-29",
    rightsExpiresDate: null,
  }),
  Object.freeze({
    authorityId: "source.one",
    kind: "source",
    reviewDueDate: "2027-07-29",
    reviewedDate: "2026-07-29",
    rightsExpiresDate: null,
  }),
] as const);

const source = (
  kind:
    | "consented_referral_aggregate"
    | "local_http_crawl"
    | "manual_search_export"
    | "synthetic_fixture"
    | "unavailable",
  observedThrough: string | null = "2026-07-29T10:00:00.000Z",
) => ({
  approvalReference:
    kind === "synthetic_fixture" || kind === "unavailable"
      ? null
      : kind === "local_http_crawl"
        ? "D-084"
        : "D-087",
  kind,
  observedThrough: kind === "unavailable" ? null : observedThrough,
});

const route = (
  routeId: string,
  pathname: string,
  overrides: Readonly<Record<string, unknown>> = {},
) => ({
  crawl: { attempted: true, statusCode: 200, successful: true },
  index: { indexed: true },
  pathname,
  query: { clicks: 20, impressions: 400, positionWeightedSum: 2_000 },
  referral: {
    editorialReferralSessions: 40,
    excludedSessions: 0,
    generativeAiSessions: 20,
    otherOrUnknownSessions: 0,
    organicSearchSessions: 140,
    usefulActionSessions: 20,
  },
  routeId,
  ...overrides,
});

const snapshot = (
  overrides: Readonly<Record<string, unknown>> = {},
): Readonly<Record<string, unknown>> => ({
  capturedAt: "2026-07-29T11:00:00.000Z",
  routes: [
    route("home", "/en", {
      query: { clicks: 3, impressions: 300, positionWeightedSum: 1_500 },
      referral: {
        editorialReferralSessions: 40,
        excludedSessions: 0,
        generativeAiSessions: 20,
        otherOrUnknownSessions: 0,
        organicSearchSessions: 140,
        usefulActionSessions: 1,
      },
    }),
    route("methodology", "/en/methodology", {
      index: { indexed: false },
    }),
    route("tarot", "/en/tarot", {
      crawl: { attempted: true, statusCode: 500, successful: false },
      index: { indexed: false },
    }),
  ],
  schemaVersion: searchOperationsSnapshotSchemaVersion,
  sources: {
    crawl: source("local_http_crawl"),
    index: source("manual_search_export"),
    query: source("manual_search_export"),
    referral: source("consented_referral_aggregate"),
  },
  windowEnd: "2026-07-29T00:00:00.000Z",
  windowStart: "2026-07-22T00:00:00.000Z",
  ...overrides,
});

const contextFor = (_value: unknown, asOf = "2026-07-29T12:00:00.000Z") =>
  Object.freeze({
    asOf,
    editorialDigest: `sha256:${"c".repeat(64)}`,
    inputDigest: `sha256:${"b".repeat(64)}`,
    inventoryDigest: `sha256:${"a".repeat(64)}`,
  });

describe("search operations snapshot", () => {
  it("accepts exact aggregate source and route data", () => {
    const parsed = parseSearchOperationsSnapshot(snapshot());
    expect(parsed.routes).toHaveLength(3);
    expect(parsed.sources.query.approvalReference).toBe("D-087");
  });

  it("rejects raw query, referrer, identifier, and private fields", () => {
    for (const field of [
      "rawQuery",
      "referrerUrl",
      "analyticsSubjectKey",
      "privateQuestion",
      "birthDate",
    ]) {
      expect(() =>
        parseSearchOperationsSnapshot({
          ...snapshot(),
          routes: [
            {
              ...route("home", "/en"),
              [field]: "PRIVATE-SEARCH-CANARY",
            },
            route("methodology", "/en/methodology"),
            route("tarot", "/en/tarot"),
          ],
        }),
      ).toThrow(SearchOperationsContractError);
    }
  });

  it("rejects accessors without reading their private value", () => {
    let getterCalls = 0;
    const unsafe = { ...snapshot() };
    Object.defineProperty(unsafe, "rawQuery", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return "PRIVATE-ACCESSOR-CANARY";
      },
    });
    expect(() => parseSearchOperationsSnapshot(unsafe)).toThrow(SearchOperationsContractError);
    expect(getterCalls).toBe(0);
  });

  it("rejects invalid counts, status invariants, and duplicate routes", () => {
    expect(() =>
      parseSearchOperationsSnapshot({
        ...snapshot(),
        routes: [
          route("home", "/en", {
            query: { clicks: 2, impressions: 1, positionWeightedSum: 1 },
          }),
          route("methodology", "/en/methodology"),
          route("tarot", "/en/tarot"),
        ],
      }),
    ).toThrow(SearchOperationsContractError);
    expect(() =>
      parseSearchOperationsSnapshot({
        ...snapshot(),
        routes: [
          route("home", "/en", {
            crawl: { attempted: true, statusCode: 500, successful: true },
          }),
          route("methodology", "/en/methodology"),
          route("tarot", "/en/tarot"),
        ],
      }),
    ).toThrow(SearchOperationsContractError);
    expect(() =>
      parseSearchOperationsSnapshot({
        ...snapshot(),
        routes: [
          route("home", "/en"),
          route("home", "/en/methodology"),
          route("tarot", "/en/tarot"),
        ],
      }),
    ).toThrow(SearchOperationsContractError);
  });

  it("requires unavailable streams to contain only explicit zero placeholders", () => {
    expect(() =>
      parseSearchOperationsSnapshot({
        ...snapshot(),
        sources: {
          crawl: source("local_http_crawl"),
          index: source("manual_search_export"),
          query: source("unavailable"),
          referral: source("consented_referral_aggregate"),
        },
      }),
    ).toThrow(SearchOperationsContractError);
  });

  it("rejects historical windows relabelled with a current capture time", () => {
    expect(() =>
      parseSearchOperationsSnapshot({
        ...snapshot(),
        windowEnd: "2020-07-29T00:00:00.000Z",
        windowStart: "2020-07-22T00:00:00.000Z",
      }),
    ).toThrow(SearchOperationsContractError);
  });
});

describe("search operations report", () => {
  it("projects source-labelled metrics and bounded human-review recommendations", () => {
    const input = snapshot();
    const report = projectSearchOperationsReport(
      input,
      authorities,
      editorialAuthorities,
      contextFor(input),
    );
    expect(report.decisionStatus).toBe("ready");
    expect(report.metrics.map(({ id }) => id)).toEqual([
      "crawl_coverage",
      "index_coverage",
      "search_ctr",
      "search_average_position",
      "referral_useful_action_rate",
      "generative_referral_share",
      "content_review_current_rate",
      "editorial_record_review_current_rate",
      "source_review_current_rate",
    ]);
    expect(new Set(report.recommendations.map(({ kind }) => kind))).toEqual(
      new Set([
        "content_refresh_review",
        "content_review_schedule",
        "crawl_repair",
        "index_investigation",
        "referral_alignment_review",
        "snippet_review",
      ]),
    );
    expect(report.recommendations.every(({ requiresHumanReview }) => requiresHumanReview)).toBe(
      true,
    );
    expect(report.contentFreshness.records).toMatchObject({ current: 1, total: 1 });
    expect(report.contentFreshness.sources).toMatchObject({ current: 1, total: 1 });
  });

  it("blocks decision use when a source is stale or synthetic", () => {
    const staleInput = {
      ...snapshot(),
      sources: {
        crawl: source("local_http_crawl"),
        index: source("manual_search_export"),
        query: source("manual_search_export"),
        referral: source("consented_referral_aggregate"),
      },
    };
    const stale = projectSearchOperationsReport(
      staleInput,
      authorities,
      editorialAuthorities,
      contextFor(staleInput, "2026-08-02T12:00:00.000Z"),
    );
    expect(stale.decisionStatus).toBe("blocked");
    expect(stale.sources.find(({ stream }) => stream === "crawl")?.freshness).toBe("stale");
    expect(stale.metrics.slice(0, 6).every(({ value }) => value === null)).toBe(true);

    const syntheticInput = {
      ...snapshot(),
      sources: {
        crawl: source("synthetic_fixture"),
        index: source("synthetic_fixture"),
        query: source("synthetic_fixture"),
        referral: source("synthetic_fixture"),
      },
    };
    const synthetic = projectSearchOperationsReport(
      syntheticInput,
      authorities,
      editorialAuthorities,
      contextFor(syntheticInput),
    );
    expect(synthetic.decisionStatus).toBe("blocked");
    expect(synthetic.metrics.slice(0, 6).every(({ value }) => value === null)).toBe(true);
    expect(
      synthetic.recommendations.every(
        ({ kind }) => kind === "content_refresh_review" || kind === "content_review_schedule",
      ),
    ).toBe(true);
  });

  it("reports missing streams as unavailable instead of fabricated zero performance", () => {
    const unavailableRoutes = authorities.map(({ pathname, routeId }) =>
      route(routeId, pathname, {
        crawl: { attempted: false, statusCode: null, successful: false },
        index: { indexed: false },
        query: { clicks: 0, impressions: 0, positionWeightedSum: 0 },
        referral: {
          editorialReferralSessions: 0,
          excludedSessions: 0,
          generativeAiSessions: 0,
          otherOrUnknownSessions: 0,
          organicSearchSessions: 0,
          usefulActionSessions: 0,
        },
      }),
    );
    const unavailableInput = {
      ...snapshot(),
      routes: unavailableRoutes,
      sources: {
        crawl: source("unavailable"),
        index: source("unavailable"),
        query: source("unavailable"),
        referral: source("unavailable"),
      },
    };
    const report = projectSearchOperationsReport(
      unavailableInput,
      authorities,
      editorialAuthorities,
      contextFor(unavailableInput),
    );
    expect(report.decisionStatus).toBe("blocked");
    expect(report.metrics.slice(0, 6).every(({ value }) => value === null)).toBe(true);
    expect(report.routeSummaries.every(({ impressions }) => impressions === null)).toBe(true);
    expect(new Set(report.recommendations.map(({ kind }) => kind))).toEqual(
      new Set(["content_review_schedule", "content_refresh_review"]),
    );
  });

  it("suppresses performance recommendations below reviewed sample thresholds", () => {
    const lowSampleInput = {
      ...snapshot(),
      routes: authorities.map(({ pathname, routeId }) =>
        route(routeId, pathname, {
          query: { clicks: 0, impressions: 19, positionWeightedSum: 95 },
          referral: {
            editorialReferralSessions: 5,
            excludedSessions: 0,
            generativeAiSessions: 5,
            otherOrUnknownSessions: 0,
            organicSearchSessions: 9,
            usefulActionSessions: 0,
          },
        }),
      ),
    };
    const lowSample = projectSearchOperationsReport(
      lowSampleInput,
      authorities,
      editorialAuthorities,
      contextFor(lowSampleInput),
    );
    expect(
      lowSample.recommendations.some(
        ({ kind }) => kind === "snippet_review" || kind === "referral_alignment_review",
      ),
    ).toBe(false);
    expect(
      lowSample.routeSummaries.every(
        ({ clicks, impressions, referralSessions }) =>
          clicks === null && impressions === null && referralSessions === null,
      ),
    ).toBe(true);
  });

  it("fails closed on missing, unknown, or pathname-drifted inventory authority", () => {
    const input = snapshot();
    expect(() =>
      projectSearchOperationsReport(
        input,
        authorities.slice(0, 2),
        editorialAuthorities,
        contextFor(input),
      ),
    ).toThrow(SearchOperationsContractError);
    expect(() =>
      projectSearchOperationsReport(
        input,
        authorities.map((authority) =>
          authority.routeId === "home" ? { ...authority, pathname: "/en/privacy" } : authority,
        ),
        editorialAuthorities,
        contextFor(input),
      ),
    ).toThrow(SearchOperationsContractError);
  });

  it("rejects authority accessors without evaluating their private value", () => {
    let getterCalls = 0;
    const unsafeAuthority = { ...authorities[0] };
    Object.defineProperty(unsafeAuthority, "userIntent", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return "PRIVATE-AUTHORITY-CANARY";
      },
    });
    const input = snapshot();
    expect(() =>
      projectSearchOperationsReport(
        input,
        [
          unsafeAuthority,
          ...authorities.slice(1),
        ] as unknown as readonly SearchOperationsRouteAuthority[],
        editorialAuthorities,
        contextFor(input),
      ),
    ).toThrow(SearchOperationsContractError);
    expect(getterCalls).toBe(0);
  });

  it("renders a deterministic brief with definitions, denominators, sources, and caveats", () => {
    const input = snapshot();
    const report = projectSearchOperationsReport(
      input,
      authorities,
      editorialAuthorities,
      contextFor(input),
    );
    const markdown = renderSearchOperationsMarkdown(report);
    expect(markdown).toContain("# RITUVIA SEO/GEO Operations Brief");
    expect(markdown).toContain("D-087");
    expect(markdown).toContain("Denominator");
    expect(markdown).toContain("Raw query text is intentionally unavailable");
    expect(markdown).not.toContain("PRIVATE");
    expect(renderSearchOperationsMarkdown(report)).toBe(markdown);
    expect(() =>
      renderSearchOperationsMarkdown({
        ...report,
        caveats: ["<script>PRIVATE-RENDER-CANARY</script>"],
      }),
    ).toThrow(SearchOperationsContractError);
  });
});
