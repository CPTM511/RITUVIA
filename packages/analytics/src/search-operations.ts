import { snapshotOwnEnumerableData } from "@rituvia/observability";

export const searchOperationsSnapshotSchemaVersion = "search-operations-snapshot.v1" as const;
export const searchOperationsReportSchemaVersion = "search-operations-report.v1" as const;
export const searchOperationsPolicyVersion = "seo-geo-operations.v1" as const;

export const searchOperationsStreams = Object.freeze([
  "crawl",
  "index",
  "query",
  "referral",
] as const);

export type SearchOperationsStream = (typeof searchOperationsStreams)[number];
export type SearchOperationsSourceKind =
  | "consented_referral_aggregate"
  | "local_http_crawl"
  | "manual_search_export"
  | "synthetic_fixture"
  | "unavailable";

export type SearchOperationsSource = Readonly<{
  approvalReference: string | null;
  kind: SearchOperationsSourceKind;
  observedThrough: string | null;
  stream: SearchOperationsStream;
}>;

export type SearchOperationsRouteObservation = Readonly<{
  crawl: Readonly<{
    attempted: boolean;
    statusCode: number | null;
    successful: boolean;
  }>;
  index: Readonly<{
    indexed: boolean;
  }>;
  pathname: string;
  query: Readonly<{
    clicks: number;
    impressions: number;
    positionWeightedSum: number;
  }>;
  referral: Readonly<{
    editorialReferralSessions: number;
    excludedSessions: number;
    generativeAiSessions: number;
    otherOrUnknownSessions: number;
    organicSearchSessions: number;
    usefulActionSessions: number;
  }>;
  routeId: string;
}>;

export type SearchOperationsSnapshot = Readonly<{
  capturedAt: string;
  routes: readonly SearchOperationsRouteObservation[];
  schemaVersion: typeof searchOperationsSnapshotSchemaVersion;
  sources: Readonly<Record<SearchOperationsStream, SearchOperationsSource>>;
  windowEnd: string;
  windowStart: string;
}>;

export type SearchOperationsRouteAuthority = Readonly<{
  contentFamily: string;
  locale: string;
  pathname: string;
  qualityStatus: "passed";
  reviewDueDate: string | null;
  reviewedDate: string;
  routeId: string;
  userIntent: string;
}>;

export type SearchOperationsEditorialAuthority = Readonly<{
  authorityId: string;
  kind: "record" | "source";
  reviewDueDate: string | null;
  reviewedDate: string;
  rightsExpiresDate: string | null;
}>;

export type SearchOperationsFreshness = "current" | "stale" | "unavailable";
export type SearchOperationsDecisionStatus = "blocked" | "ready";
export type SearchOperationsReviewStatus = "current" | "due_soon" | "overdue" | "unscheduled";

export type SearchOperationsMetric = Readonly<{
  definition: string;
  denominator: number | null;
  id:
    | "content_review_current_rate"
    | "crawl_coverage"
    | "editorial_record_review_current_rate"
    | "generative_referral_share"
    | "index_coverage"
    | "referral_useful_action_rate"
    | "search_average_position"
    | "search_ctr"
    | "source_review_current_rate";
  knownGaps: readonly string[];
  numerator: number | null;
  sourceStreams: readonly SearchOperationsStream[];
  unit: "count" | "position" | "ratio";
  value: number | null;
}>;

export type SearchOperationsRecommendation = Readonly<{
  action: string;
  evidence: string;
  kind:
    | "content_refresh_review"
    | "content_review_schedule"
    | "crawl_repair"
    | "index_investigation"
    | "referral_alignment_review"
    | "snippet_review";
  priority: "high" | "low" | "medium";
  requiresHumanReview: true;
  routeId: string;
}>;

export type SearchOperationsRouteSummary = Readonly<{
  averagePosition: number | null;
  clicks: number | null;
  crawlStatus: "failed" | "not_attempted" | "successful" | "unavailable";
  ctr: number | null;
  excludedSessions: number | null;
  generativeAiSessions: number | null;
  impressions: number | null;
  contentFamily: string;
  indexStatus: "indexed" | "not_indexed" | "unavailable";
  locale: string;
  otherOrUnknownSessions: number | null;
  pathname: string;
  referralSessions: number | null;
  reviewStatus: SearchOperationsReviewStatus;
  routeId: string;
  usefulActionSessions: number | null;
  userIntent: string;
}>;

export type SearchOperationsReport = Readonly<{
  caveats: readonly string[];
  contentFreshness: Readonly<{
    records: SearchOperationsReviewCounts;
    routes: SearchOperationsReviewCounts;
    sourceRights: Readonly<{
      currentDated: number;
      expired: number;
      expiringSoon: number;
      nonExpiring: number;
      total: number;
    }>;
    sources: SearchOperationsReviewCounts;
  }>;
  decisionStatus: SearchOperationsDecisionStatus;
  editorialDigest: string;
  generatedAt: string;
  inputDigest: string;
  inventoryDigest: string;
  metrics: readonly SearchOperationsMetric[];
  policyVersion: typeof searchOperationsPolicyVersion;
  recommendations: readonly SearchOperationsRecommendation[];
  referralAggregation: Readonly<{
    excludedSessions: number | null;
    includedSessions: number | null;
    otherOrUnknownSessions: number | null;
    usefulActionSessions: number | null;
  }>;
  routeSummaries: readonly SearchOperationsRouteSummary[];
  schemaVersion: typeof searchOperationsReportSchemaVersion;
  sources: readonly Readonly<{
    approvalReference: string | null;
    freshness: SearchOperationsFreshness;
    kind: SearchOperationsSourceKind;
    maximumAgeHours: number;
    observedThrough: string | null;
    stream: SearchOperationsStream;
  }>[];
  windowEnd: string;
  windowStart: string;
}>;

export type SearchOperationsReviewCounts = Readonly<{
  current: number;
  dueSoon: number;
  overdue: number;
  total: number;
  unscheduled: number;
}>;

export class SearchOperationsContractError extends Error {
  constructor() {
    super("The search operations input is invalid.");
    this.name = "SearchOperationsContractError";
  }
}

const invalid = (): never => {
  throw new SearchOperationsContractError();
};

const projectedReports = new WeakSet<object>();

const routeIdPattern = /^[a-z][a-z0-9]*(?:[._:-][a-z0-9]+)*$/u;
const pathnamePattern = /^\/[A-Za-z0-9._~%-]+(?:\/[A-Za-z0-9._~%-]+)*$/u;
const utcInstantPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const datePattern = /^\d{4}-\d{2}-\d{2}$/u;
const approvalReferencePattern = /^(?:D|OWN)-\d{3}$/u;
const digestPattern = /^sha256:[0-9a-f]{64}$/u;
const localePattern = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/u;
const authorityIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:@-]{0,199}$/u;

const ownDataRecord = (value: unknown): Readonly<Record<string, unknown>> => {
  const snapshot = snapshotOwnEnumerableData(value);
  if (snapshot === null) return invalid();
  return Object.freeze(Object.fromEntries(snapshot));
};

const exact = (value: unknown, keys: readonly string[]): Readonly<Record<string, unknown>> => {
  const record = ownDataRecord(value);
  const actual = Object.keys(record);
  if (actual.length !== keys.length || keys.some((key) => !Object.hasOwn(record, key))) {
    return invalid();
  }
  return record;
};

const parseInstant = (value: unknown): string => {
  if (typeof value !== "string" || !utcInstantPattern.test(value)) return invalid();
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== value) {
    return invalid();
  }
  return value;
};

const parseDate = (value: unknown): string => {
  if (typeof value !== "string" || !datePattern.test(value)) return invalid();
  const milliseconds = Date.parse(`${value}T00:00:00.000Z`);
  if (
    !Number.isFinite(milliseconds) ||
    new Date(milliseconds).toISOString().slice(0, 10) !== value
  ) {
    return invalid();
  }
  return value;
};

const parseCount = (value: unknown): number => {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value > 1_000_000_000
  ) {
    return invalid();
  }
  return value;
};

const parseNonNegativeNumber = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return invalid();
  return value;
};

const parseRouteId = (value: unknown): string => {
  if (typeof value !== "string" || value.length > 120 || !routeIdPattern.test(value)) {
    return invalid();
  }
  return value;
};

const parsePathname = (value: unknown): string => {
  if (typeof value !== "string" || value.length > 240 || !pathnamePattern.test(value)) {
    return invalid();
  }
  return value;
};

const parseSource = (value: unknown, stream: SearchOperationsStream): SearchOperationsSource => {
  const source = exact(value, ["approvalReference", "kind", "observedThrough"]);
  const kinds: readonly string[] =
    stream === "crawl"
      ? ["local_http_crawl", "synthetic_fixture", "unavailable"]
      : stream === "referral"
        ? ["consented_referral_aggregate", "synthetic_fixture", "unavailable"]
        : ["manual_search_export", "synthetic_fixture", "unavailable"];
  if (typeof source.kind !== "string" || !kinds.includes(source.kind)) return invalid();
  const approvalReference =
    source.approvalReference === null
      ? null
      : typeof source.approvalReference === "string" &&
          approvalReferencePattern.test(source.approvalReference)
        ? source.approvalReference
        : invalid();
  if (
    (source.kind === "synthetic_fixture" || source.kind === "unavailable") !==
    (approvalReference === null)
  ) {
    return invalid();
  }
  const observedThrough =
    source.kind === "unavailable"
      ? source.observedThrough === null
        ? null
        : invalid()
      : parseInstant(source.observedThrough);
  return Object.freeze({
    approvalReference,
    kind: source.kind as SearchOperationsSourceKind,
    observedThrough,
    stream,
  });
};

const parseRoute = (value: unknown): SearchOperationsRouteObservation => {
  const route = exact(value, ["crawl", "index", "pathname", "query", "referral", "routeId"]);
  const crawl = exact(route.crawl, ["attempted", "statusCode", "successful"]);
  if (typeof crawl.attempted !== "boolean" || typeof crawl.successful !== "boolean") {
    return invalid();
  }
  const statusCode =
    crawl.statusCode === null
      ? null
      : typeof crawl.statusCode === "number" &&
          Number.isSafeInteger(crawl.statusCode) &&
          crawl.statusCode >= 100 &&
          crawl.statusCode <= 599
        ? crawl.statusCode
        : invalid();
  const successful =
    crawl.attempted && statusCode !== null && statusCode >= 200 && statusCode < 400;
  if (
    crawl.successful !== successful ||
    (!crawl.attempted && statusCode !== null) ||
    (crawl.attempted && statusCode === null)
  ) {
    return invalid();
  }

  const index = exact(route.index, ["indexed"]);
  if (typeof index.indexed !== "boolean") return invalid();

  const query = exact(route.query, ["clicks", "impressions", "positionWeightedSum"]);
  const clicks = parseCount(query.clicks);
  const impressions = parseCount(query.impressions);
  const positionWeightedSum = parseNonNegativeNumber(query.positionWeightedSum);
  if (
    clicks > impressions ||
    (impressions === 0 && positionWeightedSum !== 0) ||
    (impressions > 0 &&
      (positionWeightedSum < impressions || positionWeightedSum > impressions * 1_000))
  ) {
    return invalid();
  }

  const referral = exact(route.referral, [
    "editorialReferralSessions",
    "excludedSessions",
    "generativeAiSessions",
    "otherOrUnknownSessions",
    "organicSearchSessions",
    "usefulActionSessions",
  ]);
  const editorialReferralSessions = parseCount(referral.editorialReferralSessions);
  const excludedSessions = parseCount(referral.excludedSessions);
  const generativeAiSessions = parseCount(referral.generativeAiSessions);
  const otherOrUnknownSessions = parseCount(referral.otherOrUnknownSessions);
  const organicSearchSessions = parseCount(referral.organicSearchSessions);
  const usefulActionSessions = parseCount(referral.usefulActionSessions);
  const referralSessions =
    editorialReferralSessions +
    generativeAiSessions +
    organicSearchSessions +
    otherOrUnknownSessions;
  if (!Number.isSafeInteger(referralSessions) || usefulActionSessions > referralSessions) {
    return invalid();
  }

  return Object.freeze({
    crawl: Object.freeze({
      attempted: crawl.attempted,
      statusCode,
      successful: crawl.successful,
    }),
    index: Object.freeze({ indexed: index.indexed }),
    pathname: parsePathname(route.pathname),
    query: Object.freeze({ clicks, impressions, positionWeightedSum }),
    referral: Object.freeze({
      editorialReferralSessions,
      excludedSessions,
      generativeAiSessions,
      otherOrUnknownSessions,
      organicSearchSessions,
      usefulActionSessions,
    }),
    routeId: parseRouteId(route.routeId),
  });
};

export const parseSearchOperationsSnapshot = (value: unknown): SearchOperationsSnapshot => {
  const snapshot = exact(value, [
    "capturedAt",
    "routes",
    "schemaVersion",
    "sources",
    "windowEnd",
    "windowStart",
  ]);
  if (
    snapshot.schemaVersion !== searchOperationsSnapshotSchemaVersion ||
    !Array.isArray(snapshot.routes) ||
    snapshot.routes.length === 0 ||
    snapshot.routes.length > 500
  ) {
    return invalid();
  }
  const sources = exact(snapshot.sources, searchOperationsStreams);
  const capturedAt = parseInstant(snapshot.capturedAt);
  const windowStart = parseInstant(snapshot.windowStart);
  const windowEnd = parseInstant(snapshot.windowEnd);
  if (
    Date.parse(windowStart) >= Date.parse(windowEnd) ||
    Date.parse(windowEnd) > Date.parse(capturedAt) ||
    Date.parse(windowEnd) - Date.parse(windowStart) !== 7 * 86_400_000 ||
    Date.parse(capturedAt) - Date.parse(windowEnd) > 96 * 3_600_000
  ) {
    return invalid();
  }
  const parsedSources = Object.freeze({
    crawl: parseSource(sources.crawl, "crawl"),
    index: parseSource(sources.index, "index"),
    query: parseSource(sources.query, "query"),
    referral: parseSource(sources.referral, "referral"),
  });
  if (
    Object.values(parsedSources).some(
      (source) =>
        (source.observedThrough !== null &&
          Date.parse(source.observedThrough) > Date.parse(capturedAt)) ||
        (source.observedThrough !== null &&
          Date.parse(source.observedThrough) < Date.parse(windowEnd)),
    )
  ) {
    return invalid();
  }
  const routes = snapshot.routes.map(parseRoute);
  if (
    new Set(routes.map(({ routeId }) => routeId)).size !== routes.length ||
    new Set(routes.map(({ pathname }) => pathname)).size !== routes.length
  ) {
    return invalid();
  }
  const unavailableDefaults = (
    stream: SearchOperationsStream,
    route: SearchOperationsRouteObservation,
  ): boolean =>
    stream === "crawl"
      ? !route.crawl.attempted && route.crawl.statusCode === null && !route.crawl.successful
      : stream === "index"
        ? !route.index.indexed
        : stream === "query"
          ? route.query.clicks === 0 &&
            route.query.impressions === 0 &&
            route.query.positionWeightedSum === 0
          : route.referral.editorialReferralSessions === 0 &&
            route.referral.excludedSessions === 0 &&
            route.referral.generativeAiSessions === 0 &&
            route.referral.otherOrUnknownSessions === 0 &&
            route.referral.organicSearchSessions === 0 &&
            route.referral.usefulActionSessions === 0;
  if (
    (parsedSources.crawl.kind === "unavailable" &&
      routes.some((route) => !unavailableDefaults("crawl", route))) ||
    (parsedSources.index.kind === "unavailable" &&
      routes.some((route) => !unavailableDefaults("index", route))) ||
    (parsedSources.query.kind === "unavailable" &&
      routes.some((route) => !unavailableDefaults("query", route))) ||
    (parsedSources.referral.kind === "unavailable" &&
      routes.some((route) => !unavailableDefaults("referral", route)))
  ) {
    return invalid();
  }
  return Object.freeze({
    capturedAt,
    routes: Object.freeze(routes),
    schemaVersion: searchOperationsSnapshotSchemaVersion,
    sources: Object.freeze(parsedSources),
    windowEnd,
    windowStart,
  });
};

const parseRouteAuthority = (value: unknown): SearchOperationsRouteAuthority => {
  const authority = exact(value, [
    "contentFamily",
    "locale",
    "pathname",
    "qualityStatus",
    "reviewDueDate",
    "reviewedDate",
    "routeId",
    "userIntent",
  ]);
  if (
    authority.qualityStatus !== "passed" ||
    typeof authority.contentFamily !== "string" ||
    parseRouteId(authority.contentFamily) !== authority.contentFamily ||
    typeof authority.userIntent !== "string" ||
    parseRouteId(authority.userIntent) !== authority.userIntent ||
    typeof authority.locale !== "string" ||
    !localePattern.test(authority.locale)
  ) {
    return invalid();
  }
  const routeId = parseRouteId(authority.routeId);
  const pathname = parsePathname(authority.pathname);
  const reviewedDate = parseDate(authority.reviewedDate);
  const reviewDueDate =
    authority.reviewDueDate === null ? null : parseDate(authority.reviewDueDate);
  if (
    !(pathname === `/${authority.locale}` || pathname.startsWith(`/${authority.locale}/`)) ||
    (reviewDueDate !== null && reviewDueDate < reviewedDate)
  ) {
    return invalid();
  }
  return Object.freeze({
    contentFamily: authority.contentFamily,
    locale: authority.locale,
    pathname,
    qualityStatus: "passed",
    reviewDueDate,
    reviewedDate,
    routeId,
    userIntent: authority.userIntent,
  });
};

const parseEditorialAuthority = (value: unknown): SearchOperationsEditorialAuthority => {
  const authority = exact(value, [
    "authorityId",
    "kind",
    "reviewDueDate",
    "reviewedDate",
    "rightsExpiresDate",
  ]);
  if (
    typeof authority.authorityId !== "string" ||
    !authorityIdPattern.test(authority.authorityId) ||
    (authority.kind !== "record" && authority.kind !== "source")
  ) {
    return invalid();
  }
  const reviewedDate = parseDate(authority.reviewedDate);
  const reviewDueDate =
    authority.reviewDueDate === null ? null : parseDate(authority.reviewDueDate);
  const rightsExpiresDate =
    authority.rightsExpiresDate === null ? null : parseDate(authority.rightsExpiresDate);
  if (
    (reviewDueDate !== null && reviewDueDate < reviewedDate) ||
    (authority.kind === "record" && rightsExpiresDate !== null)
  ) {
    return invalid();
  }
  return Object.freeze({
    authorityId: authority.authorityId,
    kind: authority.kind,
    reviewDueDate,
    reviewedDate,
    rightsExpiresDate,
  });
};

const parseAsOf = (value: string): number => Date.parse(parseInstant(value));

const ratio = (numerator: number, denominator: number): number | null =>
  denominator === 0 ? null : numerator / denominator;

const reviewStatusFor = (
  authority: Readonly<{ reviewDueDate: string | null }>,
  asOfMilliseconds: number,
): SearchOperationsReviewStatus => {
  if (authority.reviewDueDate === null) return "unscheduled";
  const due = Date.parse(`${authority.reviewDueDate}T23:59:59.999Z`);
  if (due < asOfMilliseconds) return "overdue";
  return due - asOfMilliseconds <= 30 * 86_400_000 ? "due_soon" : "current";
};

const reviewCountsFor = (
  authorities: readonly Readonly<{ reviewDueDate: string | null }>[],
  asOfMilliseconds: number,
): SearchOperationsReviewCounts => {
  const counts = { current: 0, dueSoon: 0, overdue: 0, total: authorities.length, unscheduled: 0 };
  for (const authority of authorities) {
    const status = reviewStatusFor(authority, asOfMilliseconds);
    if (status === "current") counts.current += 1;
    else if (status === "due_soon") counts.dueSoon += 1;
    else if (status === "overdue") counts.overdue += 1;
    else counts.unscheduled += 1;
  }
  return Object.freeze(counts);
};

const maximumSourceAge = (stream: SearchOperationsStream): number =>
  stream === "crawl" ? 24 : stream === "referral" ? 72 : 96;

const recommendationPriority = (priority: SearchOperationsRecommendation["priority"]): number =>
  priority === "high" ? 0 : priority === "medium" ? 1 : 2;

const sourceFreshness = (
  source: SearchOperationsSource,
  asOfMilliseconds: number,
): SearchOperationsFreshness => {
  if (source.observedThrough === null) return "unavailable";
  return asOfMilliseconds - Date.parse(source.observedThrough) <=
    maximumSourceAge(source.stream) * 3_600_000
    ? "current"
    : "stale";
};

export const projectSearchOperationsReport = (
  snapshotInput: unknown,
  routeAuthorities: readonly SearchOperationsRouteAuthority[],
  editorialAuthorities: readonly SearchOperationsEditorialAuthority[],
  context: Readonly<{
    asOf: string;
    editorialDigest: string;
    inputDigest: string;
    inventoryDigest: string;
  }>,
): SearchOperationsReport => {
  const snapshot = parseSearchOperationsSnapshot(snapshotInput);
  const asOfMilliseconds = parseAsOf(context.asOf);
  if (
    Date.parse(snapshot.capturedAt) > asOfMilliseconds ||
    !digestPattern.test(context.editorialDigest) ||
    !digestPattern.test(context.inputDigest) ||
    !digestPattern.test(context.inventoryDigest) ||
    routeAuthorities.length === 0 ||
    routeAuthorities.length > 500
  ) {
    return invalid();
  }

  const editorial = editorialAuthorities.map(parseEditorialAuthority);
  if (
    editorial.length === 0 ||
    editorial.length > 500 ||
    new Set(editorial.map(({ authorityId }) => authorityId)).size !== editorial.length ||
    !editorial.some(({ kind }) => kind === "record") ||
    !editorial.some(({ kind }) => kind === "source")
  ) {
    return invalid();
  }

  const authorities = new Map<string, SearchOperationsRouteAuthority>();
  const authorityPaths = new Set<string>();
  for (const authorityInput of routeAuthorities) {
    const authority = parseRouteAuthority(authorityInput);
    if (authorities.has(authority.routeId) || authorityPaths.has(authority.pathname)) {
      return invalid();
    }
    authorities.set(authority.routeId, authority);
    authorityPaths.add(authority.pathname);
  }
  if (snapshot.routes.length !== authorities.size) return invalid();
  for (const route of snapshot.routes) {
    const authority = authorities.get(route.routeId);
    if (authority?.pathname !== route.pathname) return invalid();
  }

  const projectSource = (
    source: SearchOperationsSource,
    stream: SearchOperationsStream,
  ): SearchOperationsReport["sources"][number] => {
    return Object.freeze({
      approvalReference: source.approvalReference,
      freshness: sourceFreshness(source, asOfMilliseconds),
      kind: source.kind,
      maximumAgeHours: maximumSourceAge(stream),
      observedThrough: source.observedThrough,
      stream,
    });
  };
  const sources = [
    projectSource(snapshot.sources.crawl, "crawl"),
    projectSource(snapshot.sources.index, "index"),
    projectSource(snapshot.sources.query, "query"),
    projectSource(snapshot.sources.referral, "referral"),
  ];
  const editorialRecords = editorial.filter(({ kind }) => kind === "record");
  const editorialSources = editorial.filter(({ kind }) => kind === "source");
  const routeReviewCounts = reviewCountsFor([...authorities.values()], asOfMilliseconds);
  const recordReviewCounts = reviewCountsFor(editorialRecords, asOfMilliseconds);
  const sourceReviewCounts = reviewCountsFor(editorialSources, asOfMilliseconds);
  const sourceRights = {
    currentDated: 0,
    expired: 0,
    expiringSoon: 0,
    nonExpiring: 0,
    total: editorialSources.length,
  };
  for (const authority of editorialSources) {
    if (authority.rightsExpiresDate === null) {
      sourceRights.nonExpiring += 1;
      continue;
    }
    const expires = Date.parse(`${authority.rightsExpiresDate}T23:59:59.999Z`);
    if (expires < asOfMilliseconds) sourceRights.expired += 1;
    else if (expires - asOfMilliseconds <= 30 * 86_400_000) sourceRights.expiringSoon += 1;
    else sourceRights.currentDated += 1;
  }
  const blocked =
    sources.some(
      ({ freshness, kind }) => freshness !== "current" || kind === "synthetic_fixture",
    ) ||
    recordReviewCounts.overdue > 0 ||
    sourceReviewCounts.overdue > 0 ||
    sourceRights.expired > 0;
  const usable = Object.freeze(
    Object.fromEntries(
      sources.map(({ freshness, kind, stream }) => [
        stream,
        freshness === "current" && kind !== "synthetic_fixture" && kind !== "unavailable",
      ]),
    ) as Record<SearchOperationsStream, boolean>,
  );

  let successfulCrawls = 0;
  let eligibleRoutes = 0;
  let indexedRoutes = 0;
  let clicks = 0;
  let impressions = 0;
  let positionWeightedSum = 0;
  let referralSessions = 0;
  let excludedSessions = 0;
  let generativeAiSessions = 0;
  let otherOrUnknownSessions = 0;
  let usefulActionSessions = 0;
  let currentReviewRoutes = 0;
  const recommendations: SearchOperationsRecommendation[] = [];

  const routeSummaries = snapshot.routes
    .map((route): SearchOperationsRouteSummary => {
      const authority = authorities.get(route.routeId);
      if (authority === undefined) return invalid();
      const reviewStatus = reviewStatusFor(authority, asOfMilliseconds);
      const routeReferralSessions =
        route.referral.editorialReferralSessions +
        route.referral.generativeAiSessions +
        route.referral.organicSearchSessions +
        route.referral.otherOrUnknownSessions;
      successfulCrawls += Number(route.crawl.successful);
      eligibleRoutes += 1;
      indexedRoutes += Number(route.index.indexed);
      clicks += route.query.clicks;
      impressions += route.query.impressions;
      positionWeightedSum += route.query.positionWeightedSum;
      referralSessions += routeReferralSessions;
      excludedSessions += route.referral.excludedSessions;
      generativeAiSessions += route.referral.generativeAiSessions;
      otherOrUnknownSessions += route.referral.otherOrUnknownSessions;
      usefulActionSessions += route.referral.usefulActionSessions;
      currentReviewRoutes += Number(reviewStatus === "current");

      if (usable.crawl && !route.crawl.successful) {
        recommendations.push(
          Object.freeze({
            action:
              "Inspect the canonical route and local crawl evidence before changing content or crawl policy.",
            evidence: route.crawl.attempted
              ? `The latest aggregate crawl status was ${route.crawl.statusCode ?? "unavailable"}.`
              : "The route was absent from the latest aggregate crawl attempt.",
            kind: "crawl_repair",
            priority: "high",
            requiresHumanReview: true,
            routeId: route.routeId,
          }),
        );
      }
      if (usable.index && usable.crawl && route.crawl.successful && !route.index.indexed) {
        recommendations.push(
          Object.freeze({
            action:
              "Review search-system exclusion evidence, canonical parity, and crawl history; do not request indexing automatically.",
            evidence:
              "The approved route was crawled successfully but the aggregate export marked it unindexed.",
            kind: "index_investigation",
            priority: "high",
            requiresHumanReview: true,
            routeId: route.routeId,
          }),
        );
      }
      const routeCtr = ratio(route.query.clicks, route.query.impressions);
      const averagePosition = ratio(route.query.positionWeightedSum, route.query.impressions);
      if (
        usable.query &&
        route.query.impressions >= 200 &&
        routeCtr !== null &&
        averagePosition !== null &&
        averagePosition <= 10 &&
        routeCtr < 0.02
      ) {
        recommendations.push(
          Object.freeze({
            action:
              "Review visible title and description alignment with the approved route intent; preserve truthful copy and require editorial review.",
            evidence: `The route had ${route.query.impressions} impressions, average position ${averagePosition.toFixed(2)}, and CTR ${(routeCtr * 100).toFixed(2)}%.`,
            kind: "snippet_review",
            priority: "medium",
            requiresHumanReview: true,
            routeId: route.routeId,
          }),
        );
      }
      const usefulActionRate = ratio(route.referral.usefulActionSessions, routeReferralSessions);
      if (
        usable.referral &&
        routeReferralSessions >= 200 &&
        usefulActionRate !== null &&
        usefulActionRate < 0.01
      ) {
        recommendations.push(
          Object.freeze({
            action:
              "Review aggregate landing-page alignment and data quality; do not personalize from referral source or add bot-only copy.",
            evidence: `The route had ${routeReferralSessions} aggregate referral sessions and ${(usefulActionRate * 100).toFixed(2)}% useful-action rate.`,
            kind: "referral_alignment_review",
            priority: "low",
            requiresHumanReview: true,
            routeId: route.routeId,
          }),
        );
      }
      if (reviewStatus === "overdue" || reviewStatus === "due_soon") {
        recommendations.push(
          Object.freeze({
            action:
              "Schedule human source, rights, safety, and cultural review before substantive republication.",
            evidence:
              reviewStatus === "overdue"
                ? `The approved review deadline ${authority.reviewDueDate} has passed.`
                : `The approved review deadline ${authority.reviewDueDate} is within 30 days.`,
            kind: "content_refresh_review",
            priority: reviewStatus === "overdue" ? "high" : "medium",
            requiresHumanReview: true,
            routeId: route.routeId,
          }),
        );
      } else if (reviewStatus === "unscheduled") {
        recommendations.push(
          Object.freeze({
            action:
              "Confirm whether this decision-backed page needs a dated review cadence; do not invent a review deadline.",
            evidence: "The current authority record has no review-due date.",
            kind: "content_review_schedule",
            priority: "low",
            requiresHumanReview: true,
            routeId: route.routeId,
          }),
        );
      }

      const queryVisible = usable.query && route.query.impressions >= 20;
      const referralVisible = usable.referral && routeReferralSessions >= 20;
      return Object.freeze({
        averagePosition: queryVisible ? averagePosition : null,
        clicks: queryVisible ? route.query.clicks : null,
        contentFamily: authority.contentFamily,
        crawlStatus: usable.crawl
          ? route.crawl.successful
            ? "successful"
            : route.crawl.attempted
              ? "failed"
              : "not_attempted"
          : "unavailable",
        ctr: queryVisible ? routeCtr : null,
        excludedSessions: referralVisible ? route.referral.excludedSessions : null,
        generativeAiSessions: referralVisible ? route.referral.generativeAiSessions : null,
        impressions: queryVisible ? route.query.impressions : null,
        locale: authority.locale,
        indexStatus: usable.index
          ? route.index.indexed
            ? "indexed"
            : "not_indexed"
          : "unavailable",
        pathname: route.pathname,
        otherOrUnknownSessions: referralVisible ? route.referral.otherOrUnknownSessions : null,
        referralSessions: referralVisible ? routeReferralSessions : null,
        reviewStatus,
        routeId: route.routeId,
        usefulActionSessions: referralVisible ? route.referral.usefulActionSessions : null,
        userIntent: authority.userIntent,
      });
    })
    .sort((left, right) => left.routeId.localeCompare(right.routeId));

  const metricInputs = [
    {
      definition: "Successfully crawled approved routes divided by all approved routes.",
      denominator: usable.crawl ? snapshot.routes.length : null,
      id: "crawl_coverage",
      knownGaps: ["Local aggregate crawl evidence does not prove external search-system fetches."],
      numerator: usable.crawl ? successfulCrawls : null,
      sourceStreams: ["crawl"],
      unit: "ratio",
      value: usable.crawl ? ratio(successfulCrawls, snapshot.routes.length) : null,
    },
    {
      definition: "Indexed routes divided by routes marked eligible in the reviewed inventory.",
      denominator: usable.index ? eligibleRoutes : null,
      id: "index_coverage",
      knownGaps: [
        "Manual exports may lag search-system state and must not trigger automatic indexing.",
      ],
      numerator: usable.index ? indexedRoutes : null,
      sourceStreams: ["index"],
      unit: "ratio",
      value: usable.index ? ratio(indexedRoutes, eligibleRoutes) : null,
    },
    {
      definition: "Aggregate clicks divided by aggregate impressions across approved routes.",
      denominator: usable.query && impressions >= 20 ? impressions : null,
      id: "search_ctr",
      knownGaps: [
        "Raw query text is intentionally unavailable.",
        "Provider sampling, anonymization, and bot filtering are not independently verified.",
      ],
      numerator: usable.query && impressions >= 20 ? clicks : null,
      sourceStreams: ["query"],
      unit: "ratio",
      value: usable.query && impressions >= 20 ? ratio(clicks, impressions) : null,
    },
    {
      definition: "Impression-weighted aggregate search position across approved routes.",
      denominator: usable.query && impressions >= 20 ? impressions : null,
      id: "search_average_position",
      knownGaps: [
        "Position is an aggregate diagnostic and is not comparable across every query or device.",
      ],
      numerator: usable.query && impressions >= 20 ? positionWeightedSum : null,
      sourceStreams: ["query"],
      unit: "position",
      value: usable.query && impressions >= 20 ? ratio(positionWeightedSum, impressions) : null,
    },
    {
      definition: "Consented useful-action sessions divided by aggregate referral sessions.",
      denominator: usable.referral && referralSessions >= 20 ? referralSessions : null,
      id: "referral_useful_action_rate",
      knownGaps: [
        "Referrer URLs, user identifiers, private content, and unconsented sessions are excluded.",
      ],
      numerator: usable.referral && referralSessions >= 20 ? usefulActionSessions : null,
      sourceStreams: ["referral"],
      unit: "ratio",
      value:
        usable.referral && referralSessions >= 20
          ? ratio(usefulActionSessions, referralSessions)
          : null,
    },
    {
      definition:
        "Aggregate generative-AI referral sessions divided by all aggregate referral sessions.",
      denominator: usable.referral && referralSessions >= 20 ? referralSessions : null,
      id: "generative_referral_share",
      knownGaps: [
        "Channel classification is aggregate and does not establish citation quality or causality.",
      ],
      numerator: usable.referral && referralSessions >= 20 ? generativeAiSessions : null,
      sourceStreams: ["referral"],
      unit: "ratio",
      value:
        usable.referral && referralSessions >= 20
          ? ratio(generativeAiSessions, referralSessions)
          : null,
    },
    {
      definition:
        "Routes with a review date more than 30 days away divided by all approved routes.",
      denominator: snapshot.routes.length,
      id: "content_review_current_rate",
      knownGaps: [
        "Decision-backed records without a due date are reported as unscheduled, not silently current.",
      ],
      numerator: currentReviewRoutes,
      sourceStreams: [],
      unit: "ratio",
      value: ratio(currentReviewRoutes, snapshot.routes.length),
    },
    {
      definition: "Current editorial records divided by all registered editorial records.",
      denominator: recordReviewCounts.total,
      id: "editorial_record_review_current_rate",
      knownGaps: [
        "Review freshness does not replace source, rights, cultural, or legal reassessment.",
      ],
      numerator: recordReviewCounts.current,
      sourceStreams: [],
      unit: "ratio",
      value: ratio(recordReviewCounts.current, recordReviewCounts.total),
    },
    {
      definition: "Current source records divided by all registered source records.",
      denominator: sourceReviewCounts.total,
      id: "source_review_current_rate",
      knownGaps: [
        "Non-expiring rights remain subject to allowed-use and evidence-reference validation.",
      ],
      numerator: sourceReviewCounts.current,
      sourceStreams: [],
      unit: "ratio",
      value: ratio(sourceReviewCounts.current, sourceReviewCounts.total),
    },
  ] satisfies SearchOperationsMetric[];
  const metrics: SearchOperationsMetric[] = metricInputs.map((metric) =>
    Object.freeze({
      ...metric,
      knownGaps: Object.freeze(metric.knownGaps),
      sourceStreams: Object.freeze(metric.sourceStreams),
    }),
  );

  const caveats = [
    "The report consumes aggregate offline exports and performs no provider or network request.",
    "No raw query, referrer URL, user identifier, private content, or cross-site tracking data is accepted.",
    "Recommendations are bounded investigation prompts and never publish, index, rewrite, or expand content automatically.",
    ...(recordReviewCounts.dueSoon +
      recordReviewCounts.overdue +
      sourceReviewCounts.dueSoon +
      sourceReviewCounts.overdue +
      sourceRights.expiringSoon +
      sourceRights.expired >
    0
      ? [
          "Editorial review or rights evidence requires human attention before substantive republication.",
        ]
      : []),
    ...(blocked
      ? [
          "Decision use is blocked because at least one source is unavailable, stale, or synthetic; refresh approved aggregate evidence first.",
        ]
      : []),
  ];

  const report: SearchOperationsReport = Object.freeze({
    caveats: Object.freeze(caveats),
    contentFreshness: Object.freeze({
      records: recordReviewCounts,
      routes: routeReviewCounts,
      sourceRights: Object.freeze(sourceRights),
      sources: sourceReviewCounts,
    }),
    decisionStatus: blocked ? "blocked" : "ready",
    editorialDigest: context.editorialDigest,
    generatedAt: context.asOf,
    inputDigest: context.inputDigest,
    inventoryDigest: context.inventoryDigest,
    metrics: Object.freeze(metrics),
    policyVersion: searchOperationsPolicyVersion,
    recommendations: Object.freeze(
      recommendations.sort(
        (left, right) =>
          recommendationPriority(left.priority) - recommendationPriority(right.priority) ||
          left.routeId.localeCompare(right.routeId) ||
          left.kind.localeCompare(right.kind),
      ),
    ),
    referralAggregation: Object.freeze({
      excludedSessions: usable.referral && referralSessions >= 20 ? excludedSessions : null,
      includedSessions: usable.referral && referralSessions >= 20 ? referralSessions : null,
      otherOrUnknownSessions:
        usable.referral && referralSessions >= 20 ? otherOrUnknownSessions : null,
      usefulActionSessions: usable.referral && referralSessions >= 20 ? usefulActionSessions : null,
    }),
    routeSummaries: Object.freeze(routeSummaries),
    schemaVersion: searchOperationsReportSchemaVersion,
    sources: Object.freeze(sources),
    windowEnd: snapshot.windowEnd,
    windowStart: snapshot.windowStart,
  });
  projectedReports.add(report);
  return report;
};

const formatMetricValue = (metric: SearchOperationsMetric): string => {
  if (metric.value === null) return "Unavailable";
  if (metric.unit === "ratio") return `${(metric.value * 100).toFixed(2)}%`;
  if (metric.unit === "position") return metric.value.toFixed(2);
  return String(metric.value);
};

export const renderSearchOperationsMarkdown = (report: SearchOperationsReport): string => {
  if (!projectedReports.has(report)) return invalid();
  const lines = [
    "# RITUVIA SEO/GEO Operations Brief",
    "",
    `- Decision status: ${report.decisionStatus}`,
    `- Policy version: ${report.policyVersion}`,
    `- Generated at: ${report.generatedAt}`,
    `- Window: ${report.windowStart} to ${report.windowEnd}`,
    `- Input digest: ${report.inputDigest}`,
    `- Inventory digest: ${report.inventoryDigest}`,
    `- Editorial digest: ${report.editorialDigest}`,
    "",
    "## Sources and Freshness",
    "",
    "| Stream | Source | Approval | Observed through | Maximum age | Freshness |",
    "| --- | --- | --- | --- | ---: | --- |",
    ...report.sources.map(
      (source) =>
        `| ${source.stream} | ${source.kind} | ${source.approvalReference ?? "not approved"} | ${source.observedThrough ?? "unavailable"} | ${source.maximumAgeHours}h | ${source.freshness} |`,
    ),
    "",
    "## Content Freshness",
    "",
    "| Authority | Current | Due soon | Overdue | Unscheduled | Total |",
    "| --- | ---: | ---: | ---: | ---: | ---: |",
    `| routes | ${report.contentFreshness.routes.current} | ${report.contentFreshness.routes.dueSoon} | ${report.contentFreshness.routes.overdue} | ${report.contentFreshness.routes.unscheduled} | ${report.contentFreshness.routes.total} |`,
    `| records | ${report.contentFreshness.records.current} | ${report.contentFreshness.records.dueSoon} | ${report.contentFreshness.records.overdue} | ${report.contentFreshness.records.unscheduled} | ${report.contentFreshness.records.total} |`,
    `| sources | ${report.contentFreshness.sources.current} | ${report.contentFreshness.sources.dueSoon} | ${report.contentFreshness.sources.overdue} | ${report.contentFreshness.sources.unscheduled} | ${report.contentFreshness.sources.total} |`,
    "",
    `- Source rights: ${report.contentFreshness.sourceRights.currentDated} current dated, ${report.contentFreshness.sourceRights.expiringSoon} expiring soon, ${report.contentFreshness.sourceRights.expired} expired, ${report.contentFreshness.sourceRights.nonExpiring} non-expiring.`,
    "",
    "## Metrics",
    "",
    "| Metric | Value | Numerator | Denominator | Sources |",
    "| --- | ---: | ---: | ---: | --- |",
    ...report.metrics.map(
      (metric) =>
        `| ${metric.id} | ${formatMetricValue(metric)} | ${metric.numerator ?? "n/a"} | ${metric.denominator ?? "n/a"} | ${metric.sourceStreams.join(", ") || "public inventory"} |`,
    ),
    "",
    "## Referral Denominator",
    "",
    `- Included sessions: ${report.referralAggregation.includedSessions ?? "suppressed or unavailable"}; other/unknown sessions: ${report.referralAggregation.otherOrUnknownSessions ?? "suppressed or unavailable"}; excluded sessions: ${report.referralAggregation.excludedSessions ?? "suppressed or unavailable"}; useful-action sessions: ${report.referralAggregation.usefulActionSessions ?? "suppressed or unavailable"}.`,
    "",
    "## Gap Brief",
    "",
    ...(report.recommendations.length === 0
      ? ["No bounded investigation recommendation met its reviewed threshold."]
      : report.recommendations.map(
          (recommendation) =>
            `- **${recommendation.priority} / ${recommendation.routeId} / ${recommendation.kind}:** ${recommendation.evidence} ${recommendation.action}`,
        )),
    "",
    "## Data Quality Caveats",
    "",
    ...report.caveats.map((caveat) => `- ${caveat}`),
    ...report.metrics.flatMap((metric) => metric.knownGaps.map((gap) => `- ${metric.id}: ${gap}`)),
    "",
  ];
  return lines.join("\n");
};
