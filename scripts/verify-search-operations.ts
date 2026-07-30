import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import {
  projectSearchOperationsReport,
  renderSearchOperationsMarkdown,
  searchOperationsSnapshotSchemaVersion,
  type SearchOperationsEditorialAuthority,
  type SearchOperationsRouteAuthority,
} from "../packages/analytics/src/index.js";

const inventoryBytes = await readFile("content/editorial/public-page-inventory.v1.json");
const editorialBytes = await readFile("content/editorial/manifest.v1.json");
const inventory = JSON.parse(inventoryBytes.toString("utf8")) as {
  records?: Array<{
    authority?: { reviewDueDate?: string | null; reviewedDate?: string };
    contentFamily?: string;
    locale?: string;
    pathname?: string;
    qualityStatus?: string;
    routeId?: string;
    userIntent?: string;
  }>;
  schemaVersion?: string;
};

assert.equal(inventory.schemaVersion, "rituvia-public-page-inventory.v1");
assert.equal(inventory.records?.length, 45);

const authorities = Object.freeze(
  (inventory.records ?? []).map((record): SearchOperationsRouteAuthority => {
    assert.equal(record.qualityStatus, "passed");
    assert.equal(typeof record.contentFamily, "string");
    assert.equal(typeof record.locale, "string");
    assert.equal(typeof record.routeId, "string");
    assert.equal(typeof record.pathname, "string");
    assert.equal(typeof record.userIntent, "string");
    assert.equal(typeof record.authority?.reviewedDate, "string");
    assert.ok(
      record.authority?.reviewDueDate === null ||
        typeof record.authority?.reviewDueDate === "string",
    );
    return Object.freeze({
      contentFamily: record.contentFamily ?? "",
      locale: record.locale ?? "",
      pathname: record.pathname ?? "",
      qualityStatus: "passed",
      reviewDueDate: record.authority?.reviewDueDate ?? null,
      reviewedDate: record.authority?.reviewedDate ?? "",
      routeId: record.routeId ?? "",
      userIntent: record.userIntent ?? "",
    });
  }),
);

const editorialManifest = JSON.parse(editorialBytes.toString("utf8")) as {
  records?: Array<{
    recordId?: string;
    review?: { reviewDueDate?: string | null; reviewedDate?: string };
  }>;
  sources?: Array<{
    reviewDueDate?: string | null;
    reviewedDate?: string;
    rights?: { expiresDate?: string | null };
    sourceId?: string;
  }>;
};
assert.equal(editorialManifest.records?.length, 5);
assert.equal(editorialManifest.sources?.length, 10);
const editorialAuthorities = Object.freeze([
  ...(editorialManifest.records ?? []).map((record): SearchOperationsEditorialAuthority =>
    Object.freeze({
      authorityId: record.recordId ?? "",
      kind: "record",
      reviewDueDate: record.review?.reviewDueDate ?? null,
      reviewedDate: record.review?.reviewedDate ?? "",
      rightsExpiresDate: null,
    }),
  ),
  ...(editorialManifest.sources ?? []).map((source): SearchOperationsEditorialAuthority =>
    Object.freeze({
      authorityId: source.sourceId ?? "",
      kind: "source",
      reviewDueDate: source.reviewDueDate ?? null,
      reviewedDate: source.reviewedDate ?? "",
      rightsExpiresDate: source.rights?.expiresDate ?? null,
    }),
  ),
]);

const placeholderRoute = (authority: SearchOperationsRouteAuthority) => ({
  crawl: { attempted: false, statusCode: null, successful: false },
  index: { indexed: false },
  pathname: authority.pathname,
  query: { clicks: 0, impressions: 0, positionWeightedSum: 0 },
  referral: {
    editorialReferralSessions: 0,
    excludedSessions: 0,
    generativeAiSessions: 0,
    otherOrUnknownSessions: 0,
    organicSearchSessions: 0,
    usefulActionSessions: 0,
  },
  routeId: authority.routeId,
});

const source = (kind: "synthetic_fixture" | "unavailable") => ({
  approvalReference: null,
  kind,
  observedThrough: kind === "unavailable" ? null : "2026-07-29T10:00:00.000Z",
});

const approvedSource = (
  kind: "consented_referral_aggregate" | "local_http_crawl" | "manual_search_export",
) => ({
  approvalReference: kind === "local_http_crawl" ? "D-084" : "D-087",
  kind,
  observedThrough: "2026-07-29T10:00:00.000Z",
});

const digest = (value: Uint8Array | string): string =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const contextFor = (snapshot: unknown) =>
  Object.freeze({
    asOf: "2026-07-29T12:00:00.000Z",
    editorialDigest: digest(editorialBytes),
    inputDigest: digest(JSON.stringify(snapshot)),
    inventoryDigest: digest(inventoryBytes),
  });

const unavailableSnapshot = {
  capturedAt: "2026-07-29T11:00:00.000Z",
  routes: authorities.map(placeholderRoute),
  schemaVersion: searchOperationsSnapshotSchemaVersion,
  sources: {
    crawl: source("unavailable"),
    index: source("unavailable"),
    query: source("unavailable"),
    referral: source("unavailable"),
  },
  windowEnd: "2026-07-29T00:00:00.000Z",
  windowStart: "2026-07-22T00:00:00.000Z",
};

const unavailableReport = projectSearchOperationsReport(
  unavailableSnapshot,
  authorities,
  editorialAuthorities,
  contextFor(unavailableSnapshot),
);
assert.equal(unavailableReport.decisionStatus, "blocked");
assert.equal(unavailableReport.routeSummaries.length, 45);
assert.ok(unavailableReport.metrics.slice(0, 6).every(({ value }) => value === null));
assert.ok(unavailableReport.sources.every(({ freshness }) => freshness === "unavailable"));

const syntheticRoutes = authorities.map((authority, index) => ({
  crawl:
    index === 2
      ? { attempted: true, statusCode: 500, successful: false }
      : { attempted: true, statusCode: 200, successful: true },
  index: { indexed: index !== 1 && index !== 2 },
  pathname: authority.pathname,
  query:
    index === 0
      ? { clicks: 3, impressions: 300, positionWeightedSum: 1_500 }
      : { clicks: 20, impressions: 400, positionWeightedSum: 2_000 },
  referral:
    index === 0
      ? {
          editorialReferralSessions: 40,
          excludedSessions: 0,
          generativeAiSessions: 20,
          otherOrUnknownSessions: 0,
          organicSearchSessions: 140,
          usefulActionSessions: 1,
        }
      : {
          editorialReferralSessions: 40,
          excludedSessions: 0,
          generativeAiSessions: 20,
          otherOrUnknownSessions: 0,
          organicSearchSessions: 140,
          usefulActionSessions: 20,
        },
  routeId: authority.routeId,
}));

const syntheticSnapshot = {
  ...unavailableSnapshot,
  routes: syntheticRoutes,
  sources: {
    crawl: source("synthetic_fixture"),
    index: source("synthetic_fixture"),
    query: source("synthetic_fixture"),
    referral: source("synthetic_fixture"),
  },
};

const syntheticReport = projectSearchOperationsReport(
  syntheticSnapshot,
  authorities,
  editorialAuthorities,
  contextFor(syntheticSnapshot),
);
assert.equal(syntheticReport.decisionStatus, "blocked");
assert.ok(
  syntheticReport.recommendations.every(
    ({ kind }) => kind === "content_refresh_review" || kind === "content_review_schedule",
  ),
);

const approvedSnapshot = {
  ...syntheticSnapshot,
  sources: {
    crawl: approvedSource("local_http_crawl"),
    index: approvedSource("manual_search_export"),
    query: approvedSource("manual_search_export"),
    referral: approvedSource("consented_referral_aggregate"),
  },
};
const approvedReport = projectSearchOperationsReport(
  approvedSnapshot,
  authorities,
  editorialAuthorities,
  contextFor(approvedSnapshot),
);
assert.equal(approvedReport.decisionStatus, "ready");
assert.ok(approvedReport.recommendations.some(({ kind }) => kind === "crawl_repair"));
assert.ok(approvedReport.recommendations.some(({ kind }) => kind === "index_investigation"));
assert.ok(approvedReport.recommendations.some(({ kind }) => kind === "snippet_review"));
assert.ok(approvedReport.recommendations.some(({ kind }) => kind === "referral_alignment_review"));
assert.ok(approvedReport.recommendations.every(({ requiresHumanReview }) => requiresHumanReview));

assert.throws(() =>
  projectSearchOperationsReport(
    {
      ...syntheticSnapshot,
      routes: [
        { ...syntheticRoutes[0], rawQuery: "PRIVATE-SEARCH-CANARY" },
        ...syntheticRoutes.slice(1),
      ],
    },
    authorities,
    editorialAuthorities,
    contextFor(syntheticSnapshot),
  ),
);

const markdown = renderSearchOperationsMarkdown(approvedReport);
assert.match(markdown, /Sources and Freshness/u);
assert.match(markdown, /Denominator/u);
assert.match(markdown, /Decision status: ready/u);
assert.doesNotMatch(markdown, /PRIVATE|sourcePaths|sourceSha256|referrerUrl|rawQuery/u);

process.stdout.write(
  "Verified exact 45-route offline SEO/GEO metrics, unavailable/stale blocking, safe gap briefs, and private-field rejection.\n",
);
