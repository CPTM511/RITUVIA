import inventorySource from "../../../../content/editorial/public-page-inventory.v1.json";

import { publicRouteRegistry, type PublicRouteId } from "./public-routes";

type UnknownRecord = Record<string, unknown>;

export type RuntimePublicPageInventoryRecord = Readonly<{
  authority: Readonly<{
    kind: "decision" | "editorial_record";
    reviewDueDate: string | null;
    reviewedDate: string;
  }>;
  canonicalPath: string;
  contentDigest: string;
  contentFamily: string;
  contentShape: string;
  internalRouteIds: readonly string[];
  locale: string;
  pathname: string;
  qualityStatus: "passed";
  routeId: PublicRouteId;
  structuredParentRouteId: PublicRouteId | null;
  userIntent: string;
}>;

export type PublicPageInventoryAssessment = Readonly<{
  findings: readonly string[];
  records: readonly RuntimePublicPageInventoryRecord[];
}>;

const datePattern = /^\d{4}-\d{2}-\d{2}$/u;
const digestPattern = /^[0-9a-f]{64}$/u;
const privatePathPattern =
  /(?:[?#]|\.rsc(?:$|\/)|\.segments(?:$|\/)|\/(?:account|api|checkout|intake|journal|readings|revisit|sanctuary|sign-in)(?:\/|$))/u;

const object = (value: unknown): UnknownRecord | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;

const exactKeys = (value: UnknownRecord, expected: readonly string[]): boolean => {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return actual.join("\u0000") === sortedExpected.join("\u0000");
};

const validDate = (value: unknown): value is string => {
  if (typeof value !== "string" || !datePattern.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
};

const currentDate = (): string => new Date().toISOString().slice(0, 10);

const expectedStructuredParentRouteId = (
  routeId: PublicRouteId,
  contentFamily: string,
  contentShape: string,
): PublicRouteId | null => {
  if (routeId === "home") return null;
  if (contentFamily === "pages" || contentShape === "educational-collection") return "home";
  switch (contentFamily) {
    case "numerology":
      return "numerology-hub";
    case "astrology":
      return "astrology-hub";
    case "tarot":
      return "tarot-hub";
    case "rituals":
      return "ritual-reflection-hub";
    default:
      return null;
  }
};

export const assessRuntimePublicPageInventory = (
  source: unknown = inventorySource,
  asOfDate = currentDate(),
): PublicPageInventoryAssessment => {
  if (!validDate(asOfDate)) {
    throw new TypeError("The public-page inventory date must be an exact ISO calendar date.");
  }
  const findings: string[] = [];
  const manifest = object(source);
  if (
    manifest === null ||
    !exactKeys(manifest, ["generatedDate", "policyVersion", "records", "schemaVersion"]) ||
    manifest.schemaVersion !== "rituvia-public-page-inventory.v1" ||
    manifest.policyVersion !== "rituvia-public-page-quality.v1" ||
    !validDate(manifest.generatedDate) ||
    manifest.generatedDate > asOfDate ||
    !Array.isArray(manifest.records)
  ) {
    return Object.freeze({
      findings: Object.freeze(["manifest"]),
      records: Object.freeze([]),
    });
  }

  const expectedRoutes = new Map(
    publicRouteRegistry.records.map((route) => [`${route.id}\u0000${route.locale}`, route]),
  );
  const observedRoutes = new Set<string>();
  const observedPaths = new Set<string>();
  const observedIntents = new Set<string>();
  const observedDigests = new Set<string>();
  const records: RuntimePublicPageInventoryRecord[] = [];

  for (const value of manifest.records) {
    const record = object(value);
    if (
      record === null ||
      !exactKeys(record, [
        "authority",
        "canonicalPath",
        "contentDigest",
        "contentFamily",
        "contentShape",
        "headingCount",
        "internalRouteIds",
        "locale",
        "nearestRouteId",
        "nearestSimilarityPermille",
        "pathname",
        "qualityStatus",
        "routeId",
        "structuredParentRouteId",
        "substantiveBlockCount",
        "uniqueWordCount",
        "userIntent",
        "wordCount",
      ])
    ) {
      findings.push("record-shape");
      continue;
    }
    const authority = object(record.authority);
    const routeKey = `${String(record.routeId)}\u0000${String(record.locale)}`;
    const route = expectedRoutes.get(routeKey);
    const internalRouteIds = Array.isArray(record.internalRouteIds)
      ? record.internalRouteIds.filter((item): item is string => typeof item === "string")
      : [];
    const sourcePaths =
      authority !== null && Array.isArray(authority.sourcePaths)
        ? authority.sourcePaths.filter((item): item is string => typeof item === "string")
        : [];
    const reviewDueDate = authority?.reviewDueDate;
    const authorityValid =
      authority !== null &&
      exactKeys(authority, [
        "kind",
        "reference",
        "reviewDueDate",
        "reviewedDate",
        "sourcePaths",
        "sourceSha256",
      ]) &&
      (authority.kind === "decision" || authority.kind === "editorial_record") &&
      typeof authority.reference === "string" &&
      authority.reference.length >= 3 &&
      validDate(authority.reviewedDate) &&
      authority.reviewedDate <= asOfDate &&
      (reviewDueDate === null || (validDate(reviewDueDate) && reviewDueDate >= asOfDate)) &&
      sourcePaths.length >= 1 &&
      sourcePaths.length <= 4 &&
      new Set(sourcePaths).size === sourcePaths.length &&
      digestPattern.test(String(authority.sourceSha256));
    const metricsValid =
      typeof record.headingCount === "number" &&
      record.headingCount >= 1 &&
      typeof record.substantiveBlockCount === "number" &&
      record.substantiveBlockCount >= 3 &&
      typeof record.uniqueWordCount === "number" &&
      record.uniqueWordCount >= 40 &&
      typeof record.wordCount === "number" &&
      record.wordCount >= 120 &&
      typeof record.nearestSimilarityPermille === "number" &&
      record.nearestSimilarityPermille >= 0 &&
      record.nearestSimilarityPermille < 840;
    const routeValid =
      route !== undefined &&
      route.pathname === record.pathname &&
      route.pathname === record.canonicalPath &&
      route.contentType === record.contentFamily &&
      route.publication.status === "approved" &&
      route.publication.reviewedDate === authority?.reviewedDate &&
      !privatePathPattern.test(route.pathname);
    const evidenceValid =
      record.qualityStatus === "passed" &&
      typeof record.contentShape === "string" &&
      record.contentShape.length >= 2 &&
      typeof record.userIntent === "string" &&
      record.userIntent.length >= 2 &&
      digestPattern.test(String(record.contentDigest)) &&
      Array.isArray(record.internalRouteIds) &&
      internalRouteIds.length >= 1 &&
      internalRouteIds.length === record.internalRouteIds.length &&
      new Set(internalRouteIds).size === internalRouteIds.length &&
      internalRouteIds.every(
        (routeId) =>
          routeId !== record.routeId &&
          publicRouteRegistry.route(routeId as PublicRouteId, String(record.locale)) !== null,
      ) &&
      record.structuredParentRouteId ===
        expectedStructuredParentRouteId(
          route?.id ?? (String(record.routeId) as PublicRouteId),
          String(record.contentFamily),
          String(record.contentShape),
        ) &&
      (record.structuredParentRouteId === null ||
        internalRouteIds.includes(String(record.structuredParentRouteId)));
    if (!authorityValid || !metricsValid || !routeValid || !evidenceValid) {
      findings.push(`record:${String(record.routeId)}`);
      continue;
    }
    if (
      observedRoutes.has(routeKey) ||
      observedPaths.has(route.pathname) ||
      observedIntents.has(`${route.locale}\u0000${String(record.userIntent)}`) ||
      observedDigests.has(String(record.contentDigest))
    ) {
      findings.push(`duplicate:${String(record.routeId)}`);
      continue;
    }
    observedRoutes.add(routeKey);
    observedPaths.add(route.pathname);
    observedIntents.add(`${route.locale}\u0000${String(record.userIntent)}`);
    observedDigests.add(String(record.contentDigest));
    records.push(
      Object.freeze({
        authority: Object.freeze({
          kind: authority.kind as "decision" | "editorial_record",
          reviewDueDate: reviewDueDate as string | null,
          reviewedDate: authority.reviewedDate as string,
        }),
        canonicalPath: route.pathname,
        contentDigest: String(record.contentDigest),
        contentFamily: route.contentType,
        contentShape: String(record.contentShape),
        internalRouteIds: Object.freeze(internalRouteIds),
        locale: route.locale,
        pathname: route.pathname,
        qualityStatus: "passed",
        routeId: route.id,
        structuredParentRouteId: record.structuredParentRouteId as PublicRouteId | null,
        userIntent: String(record.userIntent),
      }),
    );
  }

  if (
    records.length !== expectedRoutes.size ||
    observedRoutes.size !== expectedRoutes.size ||
    expectedRoutes.size !== manifest.records.length
  ) {
    findings.push("coverage");
  }

  return Object.freeze({
    findings: Object.freeze([...new Set(findings)].sort()),
    records: findings.length === 0 ? Object.freeze(records) : Object.freeze([]),
  });
};

export const publicPageInventoryRecord = (
  routeId: PublicRouteId,
  locale: string,
  asOfDate = currentDate(),
): RuntimePublicPageInventoryRecord | null => {
  const assessment = assessRuntimePublicPageInventory(inventorySource, asOfDate);
  if (assessment.findings.length > 0) return null;
  return (
    assessment.records.find((record) => record.routeId === routeId && record.locale === locale) ??
    null
  );
};

export const isPublicPageInventoryCurrent = (asOfDate = currentDate()): boolean =>
  assessRuntimePublicPageInventory(inventorySource, asOfDate).findings.length === 0;
