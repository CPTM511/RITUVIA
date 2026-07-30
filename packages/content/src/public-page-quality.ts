export type PublicPageAuthorityEvidence = Readonly<{
  kind: "decision" | "editorial_record";
  reference: string;
  reviewDueDate: string | null;
  reviewedDate: string;
  sourcePaths: readonly string[];
  sourceSha256: string;
}>;

export type PublicPageQualityInput = Readonly<{
  authority: PublicPageAuthorityEvidence;
  canonicalPath: string;
  contentDigest: string;
  contentFamily: string;
  contentShape: string;
  description: string;
  headings: readonly string[];
  internalRouteIds: readonly string[];
  locale: string;
  pathname: string;
  personalized: boolean;
  private: boolean;
  publicationApproved: boolean;
  routeId: string;
  structuredParentRouteId: string | null;
  textBlocks: readonly string[];
  title: string;
  userIntent: string;
}>;

export type PublicPageQualityFinding = Readonly<{
  code:
    | "authority"
    | "canonical"
    | "content_duplicate"
    | "content_near_duplicate"
    | "content_thin"
    | "exposure"
    | "intent"
    | "internal_link"
    | "locale"
    | "path"
    | "review"
    | "source"
    | "structure"
    | "template_substitution";
  relatedRouteId: string | null;
  routeId: string;
}>;

export type PublicPageInventoryRecord = Readonly<{
  authority: PublicPageAuthorityEvidence;
  canonicalPath: string;
  contentDigest: string;
  contentFamily: string;
  contentShape: string;
  headingCount: number;
  internalRouteIds: readonly string[];
  locale: string;
  nearestRouteId: string | null;
  nearestSimilarityPermille: number;
  pathname: string;
  qualityStatus: "passed";
  routeId: string;
  structuredParentRouteId: string | null;
  substantiveBlockCount: number;
  uniqueWordCount: number;
  userIntent: string;
  wordCount: number;
}>;

export type PublicPageQualityAssessment = Readonly<{
  findings: readonly PublicPageQualityFinding[];
  records: readonly PublicPageInventoryRecord[];
}>;

const datePattern = /^\d{4}-\d{2}-\d{2}$/u;
const digestPattern = /^[0-9a-f]{64}$/u;
const identifierPattern = /^[a-z0-9][a-z0-9._:-]{1,199}$/u;
const localePattern = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/u;
const pathnamePattern = /^\/[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/u;
const forbiddenPathPattern =
  /(?:[?#]|\.rsc(?:$|\/)|\.segments(?:$|\/)|\/(?:account|api|checkout|intake|journal|readings|revisit|sanctuary|sign-in)(?:\/|$))/u;
const tokenPattern = /[\p{L}\p{N}]+(?:'[\p{L}\p{N}]+)?/gu;
const stopWords = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "be",
  "by",
  "can",
  "for",
  "from",
  "how",
  "if",
  "in",
  "into",
  "is",
  "it",
  "its",
  "not",
  "of",
  "on",
  "one",
  "or",
  "that",
  "the",
  "this",
  "to",
  "what",
  "when",
  "with",
  "without",
  "you",
  "your",
]);

const date = (value: string): Date => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (
    !datePattern.test(value) ||
    Number.isNaN(parsed.valueOf()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    throw new TypeError("Public-page quality dates must be exact ISO calendar dates.");
  }
  return parsed;
};

const tokens = (value: string): readonly string[] =>
  Object.freeze(value.normalize("NFKC").toLocaleLowerCase("en-US").match(tokenPattern) ?? []);

const contentTokens = (input: PublicPageQualityInput): readonly string[] =>
  Object.freeze(
    tokens([input.title, input.description, ...input.headings, ...input.textBlocks].join(" ")),
  );

const shingles = (values: readonly string[], width: number): ReadonlySet<string> => {
  const meaningful = values.filter((value) => !stopWords.has(value));
  const result = new Set<string>();
  for (let index = 0; index + width - 1 < meaningful.length; index += 1) {
    result.add(meaningful.slice(index, index + width).join(" "));
  }
  return result;
};

const jaccard = (left: ReadonlySet<string>, right: ReadonlySet<string>): number => {
  let intersection = 0;
  for (const value of left) {
    if (right.has(value)) intersection += 1;
  }
  const union = left.size + right.size - intersection;
  return union === 0 ? 1 : intersection / union;
};

const containment = (left: ReadonlySet<string>, right: ReadonlySet<string>): number => {
  let intersection = 0;
  for (const value of left) {
    if (right.has(value)) intersection += 1;
  }
  const minimum = Math.min(left.size, right.size);
  return minimum === 0 ? 1 : intersection / minimum;
};

const shapeMinimums = new Map<string, Readonly<{ headings: number; substantiveBlocks: number }>>([
  ["calculation-guide", { headings: 6, substantiveBlocks: 8 }],
  ["educational-collection", { headings: 3, substantiveBlocks: 5 }],
  ["methodology-guide", { headings: 5, substantiveBlocks: 8 }],
  ["product-landing", { headings: 5, substantiveBlocks: 20 }],
  ["public-trust-article", { headings: 6, substantiveBlocks: 8 }],
  ["ritual-reflection-guide", { headings: 5, substantiveBlocks: 9 }],
  ["tarot-card-guide", { headings: 5, substantiveBlocks: 12 }],
  ["tarot-spread-guide", { headings: 6, substantiveBlocks: 10 }],
]);

const finding = (
  code: PublicPageQualityFinding["code"],
  routeId: string,
  relatedRouteId: string | null = null,
): PublicPageQualityFinding => Object.freeze({ code, relatedRouteId, routeId });

const compareFindings = (left: PublicPageQualityFinding, right: PublicPageQualityFinding): number =>
  left.routeId.localeCompare(right.routeId) ||
  left.code.localeCompare(right.code) ||
  (left.relatedRouteId ?? "").localeCompare(right.relatedRouteId ?? "");

export const assessPublicPageQuality = (
  inputs: readonly PublicPageQualityInput[],
  asOfDate: string,
): PublicPageQualityAssessment => {
  const asOf = date(asOfDate);
  if (inputs.length < 1 || inputs.length > 500) {
    throw new TypeError("The public-page quality inventory must be finite and non-empty.");
  }

  const findings: PublicPageQualityFinding[] = [];
  const routeIds = new Set(inputs.map(({ routeId }) => routeId));
  const observedRouteIds = new Set<string>();
  const observedPathnames = new Map<string, string>();
  const observedIntents = new Map<string, string>();
  const normalizedByRoute = new Map<string, string>();
  const tokensByRoute = new Map<string, readonly string[]>();
  const threeShinglesByRoute = new Map<string, ReadonlySet<string>>();
  const fiveShinglesByRoute = new Map<string, ReadonlySet<string>>();

  for (const input of inputs) {
    if (!identifierPattern.test(input.routeId) || observedRouteIds.has(input.routeId)) {
      findings.push(finding("path", input.routeId));
    }
    observedRouteIds.add(input.routeId);

    if (!localePattern.test(input.locale)) findings.push(finding("locale", input.routeId));
    if (
      !pathnamePattern.test(input.pathname) ||
      forbiddenPathPattern.test(input.pathname) ||
      !input.pathname.startsWith(`/${input.locale}`)
    ) {
      findings.push(finding("path", input.routeId));
    }
    const pathnameOwner = observedPathnames.get(input.pathname);
    if (pathnameOwner !== undefined) {
      findings.push(finding("canonical", input.routeId, pathnameOwner));
    } else {
      observedPathnames.set(input.pathname, input.routeId);
    }
    if (input.canonicalPath !== input.pathname) {
      findings.push(finding("canonical", input.routeId));
    }

    if (input.private || input.personalized || !input.publicationApproved) {
      findings.push(finding("exposure", input.routeId));
    }

    const intentKey = `${input.locale}\u0000${input.userIntent}`;
    if (!identifierPattern.test(input.userIntent)) {
      findings.push(finding("intent", input.routeId));
    }
    const intentOwner = observedIntents.get(intentKey);
    if (intentOwner !== undefined) {
      findings.push(finding("intent", input.routeId, intentOwner));
    } else {
      observedIntents.set(intentKey, input.routeId);
    }

    const { authority } = input;
    if (
      !["decision", "editorial_record"].includes(authority.kind) ||
      authority.reference.length < 3 ||
      authority.reference.length > 220
    ) {
      findings.push(finding("authority", input.routeId));
    }
    if (
      authority.sourcePaths.length < 1 ||
      authority.sourcePaths.length > 4 ||
      new Set(authority.sourcePaths).size !== authority.sourcePaths.length ||
      authority.sourcePaths.some(
        (sourcePath) =>
          !(
            sourcePath.startsWith(
              authority.kind === "editorial_record" ? "content/" : "apps/web/",
            ) ||
            (authority.kind === "decision" && sourcePath.startsWith("content/editorial/"))
          ),
      ) ||
      !digestPattern.test(authority.sourceSha256) ||
      !digestPattern.test(input.contentDigest)
    ) {
      findings.push(finding("source", input.routeId));
    }
    const reviewed = date(authority.reviewedDate);
    if (
      reviewed.valueOf() > asOf.valueOf() ||
      (authority.reviewDueDate !== null && date(authority.reviewDueDate).valueOf() < asOf.valueOf())
    ) {
      findings.push(finding("review", input.routeId));
    }

    const pageTokens = contentTokens(input);
    const normalized = pageTokens.join(" ");
    const uniqueWords = new Set(pageTokens.filter((value) => !stopWords.has(value)));
    const substantiveBlockCount = input.textBlocks.filter(
      (block) => tokens(block).length >= 8,
    ).length;
    const shapeMinimum = shapeMinimums.get(input.contentShape);
    if (
      pageTokens.length < 120 ||
      uniqueWords.size < 40 ||
      tokens(input.title).length < 3 ||
      tokens(input.description).length < 8 ||
      substantiveBlockCount < 3
    ) {
      findings.push(finding("content_thin", input.routeId));
    }
    if (
      input.headings.length < 1 ||
      input.contentFamily.length < 2 ||
      input.contentShape.length < 2 ||
      (shapeMinimum !== undefined &&
        (input.headings.length < shapeMinimum.headings ||
          substantiveBlockCount < shapeMinimum.substantiveBlocks))
    ) {
      findings.push(finding("structure", input.routeId));
    }
    if (
      input.internalRouteIds.length < 1 ||
      new Set(input.internalRouteIds).size !== input.internalRouteIds.length ||
      input.internalRouteIds.some((routeId) => routeId === input.routeId || !routeIds.has(routeId))
    ) {
      findings.push(finding("internal_link", input.routeId));
    }
    if (
      input.structuredParentRouteId !== null &&
      (input.structuredParentRouteId === input.routeId ||
        !routeIds.has(input.structuredParentRouteId) ||
        !input.internalRouteIds.includes(input.structuredParentRouteId))
    ) {
      findings.push(finding("structure", input.routeId));
    }

    normalizedByRoute.set(input.routeId, normalized);
    tokensByRoute.set(input.routeId, pageTokens);
    threeShinglesByRoute.set(input.routeId, shingles(pageTokens, 3));
    fiveShinglesByRoute.set(input.routeId, shingles(pageTokens, 5));
  }

  for (let leftIndex = 0; leftIndex < inputs.length; leftIndex += 1) {
    const left = inputs.at(leftIndex)!;
    for (let rightIndex = leftIndex + 1; rightIndex < inputs.length; rightIndex += 1) {
      const right = inputs.at(rightIndex)!;
      if (normalizedByRoute.get(left.routeId) === normalizedByRoute.get(right.routeId)) {
        findings.push(finding("content_duplicate", right.routeId, left.routeId));
        continue;
      }
      const similarity = jaccard(
        threeShinglesByRoute.get(left.routeId) ?? new Set(),
        threeShinglesByRoute.get(right.routeId) ?? new Set(),
      );
      const contained = containment(
        fiveShinglesByRoute.get(left.routeId) ?? new Set(),
        fiveShinglesByRoute.get(right.routeId) ?? new Set(),
      );
      if (similarity >= 0.82 || contained >= 0.9) {
        findings.push(finding("content_near_duplicate", right.routeId, left.routeId));
      } else if (
        left.contentShape === right.contentShape &&
        left.contentFamily === right.contentFamily &&
        (similarity >= 0.7 || contained >= 0.84)
      ) {
        findings.push(finding("template_substitution", right.routeId, left.routeId));
      }
    }
  }

  const sortedFindings = Object.freeze(findings.sort(compareFindings));
  if (sortedFindings.length > 0) {
    return Object.freeze({ findings: sortedFindings, records: Object.freeze([]) });
  }

  const records = inputs.map((input): PublicPageInventoryRecord => {
    const pageTokens = tokensByRoute.get(input.routeId) ?? [];
    const pageThreeShingles = threeShinglesByRoute.get(input.routeId) ?? new Set();
    const pageFiveShingles = fiveShinglesByRoute.get(input.routeId) ?? new Set();
    let nearestRouteId: string | null = null;
    let nearestSimilarity = 0;
    for (const candidate of inputs) {
      if (candidate.routeId === input.routeId) continue;
      const similarity = Math.max(
        jaccard(pageThreeShingles, threeShinglesByRoute.get(candidate.routeId) ?? new Set()),
        containment(pageFiveShingles, fiveShinglesByRoute.get(candidate.routeId) ?? new Set()),
      );
      if (
        similarity > nearestSimilarity ||
        (similarity === nearestSimilarity &&
          (nearestRouteId === null || candidate.routeId.localeCompare(nearestRouteId) < 0))
      ) {
        nearestRouteId = candidate.routeId;
        nearestSimilarity = similarity;
      }
    }
    return Object.freeze({
      authority: input.authority,
      canonicalPath: input.canonicalPath,
      contentDigest: input.contentDigest,
      contentFamily: input.contentFamily,
      contentShape: input.contentShape,
      headingCount: input.headings.length,
      internalRouteIds: Object.freeze([...input.internalRouteIds]),
      locale: input.locale,
      nearestRouteId,
      nearestSimilarityPermille: Math.round(nearestSimilarity * 1_000),
      pathname: input.pathname,
      qualityStatus: "passed",
      routeId: input.routeId,
      structuredParentRouteId: input.structuredParentRouteId,
      substantiveBlockCount: input.textBlocks.filter((block) => tokens(block).length >= 8).length,
      uniqueWordCount: new Set(pageTokens.filter((value) => !stopWords.has(value))).size,
      userIntent: input.userIntent,
      wordCount: pageTokens.length,
    });
  });

  return Object.freeze({
    findings: sortedFindings,
    records: Object.freeze(records),
  });
};

export const assertPublicPageQuality = (
  inputs: readonly PublicPageQualityInput[],
  asOfDate: string,
): readonly PublicPageInventoryRecord[] => {
  const assessment = assessPublicPageQuality(inputs, asOfDate);
  if (assessment.findings.length > 0) {
    throw new TypeError(
      `Public-page quality failed: ${assessment.findings
        .map(({ code, relatedRouteId, routeId }) =>
          [routeId, code, relatedRouteId].filter(Boolean).join(":"),
        )
        .join(", ")}`,
    );
  }
  return assessment.records;
};
