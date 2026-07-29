import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import type {
  PublicPageAuthorityEvidence,
  PublicPageQualityInput,
} from "../packages/content/src/index.js";
import { getMessages } from "../apps/web/app/_i18n/messages.js";
import { publicRouteRegistry, type PublicRouteId } from "../apps/web/app/_i18n/public-routes.js";

type UnknownRecord = Record<string, unknown>;

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const coreSourcePath = "apps/web/app/_i18n/messages.ts";
const numerologySourcePath = "content/traditions/numerology/rituvia-symbolic-reflection.en.v1.json";
const astrologySourcePath =
  "content/traditions/astrology/rituvia-western-natal-education.en.v1.json";
const tarotLibrarySourcePath = "content/traditions/tarot/rituvia-major-arcana-library.en.v1.json";
const tarotCatalogSourcePath = "content/traditions/tarot/rituvia-major-arcana.v1.json";
const ritualSourcePath = "content/traditions/ritual/rituvia-ritual-reflection-library.en.v1.json";
const geoSourcePath = "content/editorial/geo-answer-context.en.v1.json";

const object = (value: unknown, label: string): UnknownRecord => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`);
  }
  return value as UnknownRecord;
};

const objects = (value: unknown, label: string): readonly UnknownRecord[] => {
  if (!Array.isArray(value)) throw new TypeError(`${label} must be an array.`);
  return Object.freeze(value.map((item, index) => object(item, `${label}[${index}]`)));
};

const text = (value: unknown, label: string): string => {
  if (typeof value !== "string" || value.length < 1 || value.trim() !== value) {
    throw new TypeError(`${label} must be non-empty reviewed text.`);
  }
  return value;
};

const textField = (value: UnknownRecord, key: string, label: string): string =>
  text(value[key], `${label}.${key}`);

const textList = (value: unknown, label: string): readonly string[] => {
  if (!Array.isArray(value)) throw new TypeError(`${label} must be a text list.`);
  return Object.freeze(value.map((item, index) => text(item, `${label}[${index}]`)));
};

const nestedText = (value: unknown): readonly string[] => {
  if (typeof value === "string") return Object.freeze([value]);
  if (Array.isArray(value)) return Object.freeze(value.flatMap(nestedText));
  if (value !== null && typeof value === "object") {
    return Object.freeze(Object.values(value as UnknownRecord).flatMap(nestedText));
  }
  return Object.freeze([]);
};

const readJson = async (sourcePath: string): Promise<UnknownRecord> =>
  object(JSON.parse(await readFile(path.join(repositoryRoot, sourcePath), "utf8")), sourcePath);

const sha256 = (value: string | Uint8Array): string =>
  createHash("sha256").update(value).digest("hex");

const publicContentDigest = (
  title: string,
  description: string,
  headings: readonly string[],
  textBlocks: readonly string[],
): string =>
  sha256(
    [title, description, ...headings, ...textBlocks]
      .join(" ")
      .normalize("NFKC")
      .toLocaleLowerCase("en-US")
      .match(/[\p{L}\p{N}]+(?:'[\p{L}\p{N}]+)?/gu)
      ?.join(" ") ?? "",
  );

const sourceSetDigest = async (sourcePaths: readonly string[]): Promise<string> => {
  const entries = await Promise.all(
    sourcePaths.map(async (sourcePath) => {
      const bytes = await readFile(path.join(repositoryRoot, sourcePath));
      return `${sourcePath}\u0000${sha256(bytes)}`;
    }),
  );
  return sha256(entries.join("\u0000"));
};

const routeFor = (routeId: PublicRouteId) => {
  const route = publicRouteRegistry.route(routeId, "en");
  if (route === null) throw new TypeError(`Missing approved public route: ${routeId}`);
  return route;
};

const coreRouteIds = Object.freeze([
  "home",
  "methodology",
  "safety",
  "privacy",
] as const satisfies readonly PublicRouteId[]);

const withoutSelf = (
  routeId: PublicRouteId,
  routeIds: readonly PublicRouteId[],
): readonly PublicRouteId[] => Object.freeze(routeIds.filter((candidate) => candidate !== routeId));

const addCoreNavigation = (
  routeId: PublicRouteId,
  routeIds: readonly PublicRouteId[],
): readonly PublicRouteId[] =>
  Object.freeze([
    ...withoutSelf(routeId, coreRouteIds),
    ...routeIds.filter(
      (candidate) => candidate !== routeId && !coreRouteIds.includes(candidate as never),
    ),
  ]);

const structuredParentFor = (
  routeId: PublicRouteId,
  contentType: string,
  contentShape: string,
): PublicRouteId | null => {
  if (routeId === "home") return null;
  if (contentType === "pages" || contentShape === "educational-collection") return "home";
  switch (contentType) {
    case "astrology":
      return "astrology-hub";
    case "numerology":
      return "numerology-hub";
    case "rituals":
      return "ritual-reflection-hub";
    case "tarot":
      return "tarot-hub";
    default:
      throw new TypeError(`Unsupported structured-data content family: ${contentType}`);
  }
};

const editorialManifest = await readJson("content/editorial/manifest.v1.json");
const editorialRecords = objects(editorialManifest.records, "editorial records");
const geoSource = await readJson(geoSourcePath);
const geoContexts = object(geoSource.contexts, "GEO contexts");
const geoEntities = objects(geoSource.entities, "GEO entities");
const geoLabels = object(geoSource.labels, "GEO labels");

const editorialRecordFor = (pathname: string): UnknownRecord => {
  const matching = editorialRecords.filter((candidate) => {
    if (candidate.seo === null) return false;
    const seo = object(candidate.seo, "editorial record SEO");
    return textList(seo.canonicalPaths, "editorial canonical paths").includes(pathname);
  });
  if (matching.length !== 1) {
    throw new TypeError(`Expected one editorial authority for ${pathname}.`);
  }
  return matching[0]!;
};

const geoContextKey = (routeId: PublicRouteId, contentType: string): string => {
  if (
    routeId === "home" ||
    routeId === "methodology" ||
    routeId === "privacy" ||
    routeId === "safety"
  ) {
    return routeId;
  }
  if (["astrology", "numerology", "rituals", "tarot"].includes(contentType)) return contentType;
  throw new TypeError(`Unsupported GEO content family: ${contentType}`);
};

const geoContentFor = (
  routeId: PublicRouteId,
  contentType: string,
): Readonly<{ headings: readonly string[]; textBlocks: readonly string[] }> => {
  const context = object(geoContexts[geoContextKey(routeId, contentType)], "GEO context");
  const entityId = textField(context, "entityId", "GEO context");
  const entity = geoEntities.find((candidate) => candidate.entityId === entityId);
  if (entity === undefined) throw new TypeError(`Missing GEO entity: ${entityId}`);
  const classificationLabels = object(geoLabels.classification, "GEO classification labels");
  const classifications = objects(context.classifications, "GEO classifications");
  return Object.freeze({
    headings: Object.freeze([
      textField(geoLabels, "answerContextHeading", "GEO labels"),
      textField(geoLabels, "sourceBasis", "GEO labels"),
    ]),
    textBlocks: Object.freeze([
      textField(entity, "name", "GEO entity"),
      textField(entity, "definition", "GEO entity"),
      ...classifications.flatMap((classification) => {
        const kind = textField(classification, "kind", "GEO classification");
        return [
          text(classificationLabels[kind], `GEO classification labels.${kind}`),
          textField(classification, "statement", "GEO classification"),
        ];
      }),
      textField(geoLabels, "reviewAuthority", "GEO labels"),
      textField(geoLabels, "reviewed", "GEO labels"),
      textField(geoLabels, "reviewDue", "GEO labels"),
    ]),
  });
};

const authorityFor = async (
  routeId: PublicRouteId,
  sourcePaths: readonly string[],
): Promise<PublicPageAuthorityEvidence> => {
  const route = routeFor(routeId);
  if (route.contentType === "pages") {
    return Object.freeze({
      kind: "decision",
      reference: "D-025",
      reviewDueDate: null,
      reviewedDate: route.publication.reviewedDate,
      sourcePaths: Object.freeze([...sourcePaths]),
      sourceSha256: await sourceSetDigest(sourcePaths),
    });
  }
  const editorial = editorialRecordFor(route.pathname);
  const review = object(editorial.review, "editorial review");
  return Object.freeze({
    kind: "editorial_record",
    reference: textField(editorial, "recordId", "editorial record"),
    reviewDueDate: textField(review, "reviewDueDate", "editorial review"),
    reviewedDate: textField(review, "reviewedDate", "editorial review"),
    sourcePaths: Object.freeze([...sourcePaths]),
    sourceSha256: await sourceSetDigest(sourcePaths),
  });
};

const page = async ({
  contentShape,
  description,
  headings,
  internalRouteIds,
  routeId,
  sourcePaths,
  textBlocks,
  title,
  userIntent,
}: Readonly<{
  contentShape: string;
  description: string;
  headings: readonly string[];
  internalRouteIds: readonly PublicRouteId[];
  routeId: PublicRouteId;
  sourcePaths: readonly string[];
  textBlocks: readonly string[];
  title: string;
  userIntent: string;
}>): Promise<PublicPageQualityInput> => {
  const route = routeFor(routeId);
  const geo = geoContentFor(routeId, route.contentType);
  const completeSourcePaths = Object.freeze([...sourcePaths, geoSourcePath]);
  const completeHeadings = Object.freeze([...headings, ...geo.headings]);
  const completeTextBlocks = Object.freeze([...textBlocks, ...geo.textBlocks]);
  return Object.freeze({
    authority: await authorityFor(routeId, completeSourcePaths),
    canonicalPath: route.pathname,
    contentDigest: publicContentDigest(title, description, completeHeadings, completeTextBlocks),
    contentFamily: route.contentType,
    contentShape,
    description,
    headings: completeHeadings,
    internalRouteIds: Object.freeze([...internalRouteIds]),
    locale: route.locale,
    pathname: route.pathname,
    personalized: false,
    private: false,
    publicationApproved: route.publication.status === "approved",
    routeId,
    structuredParentRouteId: structuredParentFor(routeId, route.contentType, contentShape),
    textBlocks: completeTextBlocks,
    title,
    userIntent,
  });
};

export const collectPublicPageQualityInputs = async (): Promise<
  readonly PublicPageQualityInput[]
> => {
  const inputs = new Map<PublicRouteId, PublicPageQualityInput>();
  const add = async (input: Parameters<typeof page>[0]): Promise<void> => {
    if (inputs.has(input.routeId)) throw new TypeError(`Duplicate quality input: ${input.routeId}`);
    inputs.set(input.routeId, await page(input));
  };

  const messages = getMessages("en");
  await add({
    contentShape: "product-landing",
    description: messages.home.metadata.description,
    headings: Object.freeze([
      messages.home.hero.title,
      messages.home.oracle.title,
      messages.home.practice.title,
      messages.home.principles.title,
      messages.home.boundary.title,
    ]),
    internalRouteIds: withoutSelf("home", coreRouteIds),
    routeId: "home",
    sourcePaths: Object.freeze([coreSourcePath]),
    textBlocks: nestedText(messages.home),
    title: messages.home.metadata.title,
    userIntent: "understand-rituvia-symbolic-reflection",
  });
  for (const routeId of ["methodology", "safety", "privacy"] as const) {
    const content = messages.pages[routeId];
    await add({
      contentShape: "public-trust-article",
      description: content.metadata.description,
      headings: Object.freeze([
        content.title,
        ...content.sections.map(({ title }) => title),
        content.nextStep.title,
      ]),
      internalRouteIds: withoutSelf(routeId, coreRouteIds),
      routeId,
      sourcePaths: Object.freeze([coreSourcePath]),
      textBlocks: nestedText(content),
      title: content.metadata.title,
      userIntent: `understand-rituvia-${routeId}`,
    });
  }

  const numerology = await readJson(numerologySourcePath);
  const numerologyHub = object(numerology.hub, "numerology hub");
  const numerologyLabels = object(numerology.labels, "numerology labels");
  const numerologyGuides = objects(numerology.guides, "numerology guides");
  const numerologyRouteIds: readonly PublicRouteId[] = Object.freeze([
    "numerology-hub",
    ...numerologyGuides.map(
      (guide) =>
        `numerology-guide:${textField(guide, "slug", "numerology guide")}` as PublicRouteId,
    ),
  ]);
  await add({
    contentShape: "educational-collection",
    description: textField(numerologyHub, "description", "numerology hub"),
    headings: Object.freeze([
      textField(numerologyHub, "title", "numerology hub"),
      textField(numerologyLabels, "guideListTitle", "numerology labels"),
      ...numerologyGuides.map((guide) => textField(guide, "title", "numerology guide")),
    ]),
    internalRouteIds: addCoreNavigation("numerology-hub", numerologyRouteIds),
    routeId: "numerology-hub",
    sourcePaths: Object.freeze([numerologySourcePath]),
    textBlocks: Object.freeze([
      ...nestedText(numerologyHub),
      ...numerologyGuides.flatMap((guide) => [
        textField(guide, "title", "numerology guide"),
        textField(guide, "description", "numerology guide"),
        textField(guide, "answer", "numerology guide"),
      ]),
    ]),
    title: textField(numerologyHub, "title", "numerology hub"),
    userIntent: "learn-date-numerology-method",
  });
  for (const guide of numerologyGuides) {
    const slug = textField(guide, "slug", "numerology guide");
    const routeId = `numerology-guide:${slug}` as PublicRouteId;
    const example = object(guide.example, "numerology example");
    await add({
      contentShape: "calculation-guide",
      description: textField(guide, "description", "numerology guide"),
      headings: Object.freeze([
        textField(guide, "title", "numerology guide"),
        textField(numerologyLabels, "formulaTitle", "numerology labels"),
        textField(numerologyLabels, "exampleTitle", "numerology labels"),
        textField(numerologyLabels, "limitationsTitle", "numerology labels"),
        textField(numerologyLabels, "reflectionTitle", "numerology labels"),
        textField(numerologyLabels, "sourceTitle", "numerology labels"),
      ]),
      internalRouteIds: addCoreNavigation(routeId, numerologyRouteIds),
      routeId,
      sourcePaths: Object.freeze([numerologySourcePath]),
      textBlocks: Object.freeze([
        textField(guide, "answer", "numerology guide"),
        textField(guide, "formula", "numerology guide"),
        ...nestedText(example),
        ...textList(guide.limitations, "numerology limitations"),
        ...textList(guide.reflectionQuestions, "numerology reflection questions"),
        ...textList(guide.sourceRefs, "numerology source refs"),
        textField(numerologyHub, "sourceNote", "numerology hub"),
      ]),
      title: textField(guide, "title", "numerology guide"),
      userIntent: `calculate-and-reflect-${slug}`,
    });
  }

  const astrology = await readJson(astrologySourcePath);
  const astrologyHub = object(astrology.hub, "astrology hub");
  const astrologyLabels = object(astrology.labels, "astrology labels");
  const astrologyGuides = objects(astrology.guides, "astrology guides");
  const astrologyRouteIds: readonly PublicRouteId[] = Object.freeze([
    "astrology-hub",
    ...astrologyGuides.map(
      (guide) => `astrology-guide:${textField(guide, "slug", "astrology guide")}` as PublicRouteId,
    ),
  ]);
  await add({
    contentShape: "educational-collection",
    description: textField(astrologyHub, "description", "astrology hub"),
    headings: Object.freeze([
      textField(astrologyHub, "title", "astrology hub"),
      textField(astrologyLabels, "guideListTitle", "astrology labels"),
      ...astrologyGuides.map((guide) => textField(guide, "title", "astrology guide")),
    ]),
    internalRouteIds: addCoreNavigation("astrology-hub", astrologyRouteIds),
    routeId: "astrology-hub",
    sourcePaths: Object.freeze([astrologySourcePath]),
    textBlocks: Object.freeze([
      ...nestedText(astrologyHub),
      ...astrologyGuides.flatMap((guide) => [
        textField(guide, "title", "astrology guide"),
        textField(guide, "description", "astrology guide"),
        textField(guide, "answer", "astrology guide"),
      ]),
    ]),
    title: textField(astrologyHub, "title", "astrology hub"),
    userIntent: "learn-western-natal-method",
  });
  for (const guide of astrologyGuides) {
    const slug = textField(guide, "slug", "astrology guide");
    const routeId = `astrology-guide:${slug}` as PublicRouteId;
    const sections = objects(guide.sections, "astrology sections");
    const table = object(guide.table, "astrology table");
    await add({
      contentShape: "methodology-guide",
      description: textField(guide, "description", "astrology guide"),
      headings: Object.freeze([
        textField(guide, "title", "astrology guide"),
        ...sections.map((section) => textField(section, "heading", "astrology section")),
        textField(table, "caption", "astrology table"),
        textField(astrologyLabels, "limitationsTitle", "astrology labels"),
        textField(astrologyLabels, "sourceTitle", "astrology labels"),
      ]),
      internalRouteIds: addCoreNavigation(routeId, astrologyRouteIds),
      routeId,
      sourcePaths: Object.freeze([astrologySourcePath]),
      textBlocks: Object.freeze([
        textField(guide, "answer", "astrology guide"),
        ...sections.flatMap((section) => [
          ...textList(section.paragraphs, "astrology paragraphs"),
          ...textList(section.bullets, "astrology bullets"),
        ]),
        ...nestedText(table),
        ...textList(guide.limitations, "astrology limitations"),
        ...textList(guide.sourceRefs, "astrology source refs"),
        textField(astrologyHub, "sourceNote", "astrology hub"),
      ]),
      title: textField(guide, "title", "astrology guide"),
      userIntent: `understand-western-natal-${slug}`,
    });
  }

  const tarotLibrary = await readJson(tarotLibrarySourcePath);
  const tarotCatalog = await readJson(tarotCatalogSourcePath);
  const tarotHub = object(tarotLibrary.hub, "Tarot hub");
  const tarotLabels = object(tarotLibrary.labels, "Tarot labels");
  const cardRoutes = objects(tarotLibrary.cardRoutes, "Tarot card routes");
  const spreadRoutes = objects(tarotLibrary.spreadRoutes, "Tarot spread routes");
  const decks = objects(tarotCatalog.decks, "Tarot decks");
  const deckCards = objects(decks[0]?.cards, "Tarot deck cards");
  const cardContents = objects(tarotCatalog.cardContents, "Tarot card contents");
  const spreads = objects(tarotCatalog.spreads, "Tarot spreads");
  const tarotRouteIds: readonly PublicRouteId[] = Object.freeze([
    "tarot-hub",
    ...cardRoutes.map(
      (route) => `tarot-guide:${textField(route, "slug", "Tarot card route")}` as PublicRouteId,
    ),
    ...spreadRoutes.map(
      (route) => `tarot-guide:${textField(route, "slug", "Tarot spread route")}` as PublicRouteId,
    ),
  ]);
  const tarotSourcePaths = Object.freeze([tarotLibrarySourcePath, tarotCatalogSourcePath]);
  await add({
    contentShape: "educational-collection",
    description: textField(tarotHub, "description", "Tarot hub"),
    headings: Object.freeze([
      textField(tarotHub, "title", "Tarot hub"),
      textField(tarotLabels, "cardListTitle", "Tarot labels"),
      textField(tarotLabels, "spreadListTitle", "Tarot labels"),
    ]),
    internalRouteIds: addCoreNavigation("tarot-hub", tarotRouteIds),
    routeId: "tarot-hub",
    sourcePaths: tarotSourcePaths,
    textBlocks: Object.freeze([
      ...nestedText(tarotHub),
      ...cardRoutes.flatMap((route) => {
        const cardId = textField(route, "cardId", "Tarot card route");
        const card = deckCards.find((candidate) => candidate.cardId === cardId);
        const upright = cardContents.find(
          (candidate) => candidate.cardId === cardId && candidate.orientation === "upright",
        );
        if (card === undefined || upright === undefined) {
          throw new TypeError(`Missing Tarot hub card: ${cardId}`);
        }
        return [
          textField(card, "title", "Tarot card"),
          ...textList(upright.coreThemes, "Tarot core themes"),
        ];
      }),
      ...spreadRoutes.flatMap((route) => [
        textField(route, "title", "Tarot spread route"),
        textField(route, "description", "Tarot spread route"),
      ]),
    ]),
    title: textField(tarotHub, "title", "Tarot hub"),
    userIntent: "learn-major-arcana-symbolic-reflection",
  });
  for (const [index, route] of cardRoutes.entries()) {
    const cardId = textField(route, "cardId", "Tarot card route");
    const slug = textField(route, "slug", "Tarot card route");
    const routeId = `tarot-guide:${slug}` as PublicRouteId;
    const card = deckCards.find((candidate) => candidate.cardId === cardId);
    const upright = cardContents.find(
      (candidate) => candidate.cardId === cardId && candidate.orientation === "upright",
    );
    const reversed = cardContents.find(
      (candidate) => candidate.cardId === cardId && candidate.orientation === "reversed",
    );
    const previous = cardRoutes.at(index === 0 ? cardRoutes.length - 1 : index - 1);
    const next = cardRoutes.at(index === cardRoutes.length - 1 ? 0 : index + 1);
    if (
      card === undefined ||
      upright === undefined ||
      reversed === undefined ||
      !previous ||
      !next
    ) {
      throw new TypeError(`Missing Tarot card quality source: ${cardId}`);
    }
    const title = `${textField(card, "title", "Tarot card")} Tarot meaning`;
    const description = `${textField(card, "title", "Tarot card")} upright and reversed meanings for symbolic reflection, with themes, questions, actions, and explicit limits.`;
    await add({
      contentShape: "tarot-card-guide",
      description,
      headings: Object.freeze([
        title,
        textField(tarotLabels, "uprightTitle", "Tarot labels"),
        textField(tarotLabels, "reversedTitle", "Tarot labels"),
        textField(tarotLabels, "sourceTitle", "Tarot labels"),
        textField(tarotLabels, "relatedTitle", "Tarot labels"),
      ]),
      internalRouteIds: addCoreNavigation(routeId, [
        "tarot-hub",
        `tarot-guide:${textField(previous, "slug", "Tarot card route")}` as PublicRouteId,
        `tarot-guide:${textField(next, "slug", "Tarot card route")}` as PublicRouteId,
        ...spreadRoutes.map(
          (spread) =>
            `tarot-guide:${textField(spread, "slug", "Tarot spread route")}` as PublicRouteId,
        ),
      ]),
      routeId,
      sourcePaths: tarotSourcePaths,
      textBlocks: Object.freeze([
        textField(tarotHub, "boundary", "Tarot hub"),
        ...[upright, reversed].flatMap((content) => [
          textList(content.coreThemes, "Tarot themes").join(" "),
          ...textList(content.constructivePossibilities, "Tarot possibilities"),
          ...textList(content.tensions, "Tarot tensions"),
          ...textList(content.reflectionQuestions, "Tarot questions"),
          ...textList(content.smallActions, "Tarot actions"),
          textField(content, "cannotDetermine", "Tarot content"),
        ]),
        textField(tarotHub, "sourceNote", "Tarot hub"),
      ]),
      title,
      userIntent: `understand-tarot-card-${slug}`,
    });
  }
  for (const route of spreadRoutes) {
    const spreadId = textField(route, "spreadId", "Tarot spread route");
    const slug = textField(route, "slug", "Tarot spread route");
    const routeId = `tarot-guide:${slug}` as PublicRouteId;
    const spread = spreads.find((candidate) => candidate.spreadId === spreadId);
    if (spread === undefined)
      throw new TypeError(`Missing Tarot spread quality source: ${spreadId}`);
    await add({
      contentShape: "tarot-spread-guide",
      description: textField(route, "description", "Tarot spread route"),
      headings: Object.freeze([
        textField(route, "title", "Tarot spread route"),
        textField(tarotLabels, "positionsTitle", "Tarot labels"),
        textField(tarotLabels, "stepsTitle", "Tarot labels"),
        textField(tarotLabels, "questionTitle", "Tarot labels"),
        textField(tarotLabels, "limitsTitle", "Tarot labels"),
        textField(tarotLabels, "sourceTitle", "Tarot labels"),
      ]),
      internalRouteIds: addCoreNavigation(routeId, [
        "tarot-hub",
        ...cardRoutes
          .slice(0, 4)
          .map(
            (cardRoute) =>
              `tarot-guide:${textField(cardRoute, "slug", "Tarot card route")}` as PublicRouteId,
          ),
        ...spreadRoutes
          .filter((candidate) => candidate !== route)
          .map(
            (candidate) =>
              `tarot-guide:${textField(candidate, "slug", "Tarot spread route")}` as PublicRouteId,
          ),
      ]),
      routeId,
      sourcePaths: tarotSourcePaths,
      textBlocks: Object.freeze([
        textField(route, "answer", "Tarot spread route"),
        textField(tarotHub, "boundary", "Tarot hub"),
        ...nestedText(spread.positions),
        ...textList(route.steps, "Tarot spread steps"),
        ...textList(route.reflectionQuestions, "Tarot spread questions"),
        ...textList(route.limitations, "Tarot spread limitations"),
        "rituvia.tarot.major-arcana-catalog@1.0.0",
        "rituvia.editorial.tarot-library@1.0.0",
        textField(tarotHub, "sourceNote", "Tarot hub"),
      ]),
      title: textField(route, "title", "Tarot spread route"),
      userIntent: `use-tarot-spread-${slug}`,
    });
  }

  const ritual = await readJson(ritualSourcePath);
  const ritualHub = object(ritual.hub, "ritual hub");
  const ritualLabels = object(ritual.labels, "ritual labels");
  const ritualGuides = objects(ritual.guideRoutes, "ritual guides");
  const ritualRouteIds: readonly PublicRouteId[] = Object.freeze([
    "ritual-reflection-hub",
    ...ritualGuides.map(
      (guide) =>
        `ritual-reflection-guide:${textField(guide, "slug", "ritual guide")}` as PublicRouteId,
    ),
  ]);
  await add({
    contentShape: "educational-collection",
    description: textField(ritualHub, "description", "ritual hub"),
    headings: Object.freeze([
      textField(ritualHub, "title", "ritual hub"),
      textField(ritualLabels, "guideListTitle", "ritual labels"),
      ...ritualGuides.map((guide) => textField(guide, "title", "ritual guide")),
    ]),
    internalRouteIds: addCoreNavigation("ritual-reflection-hub", ritualRouteIds),
    routeId: "ritual-reflection-hub",
    sourcePaths: Object.freeze([ritualSourcePath]),
    textBlocks: Object.freeze([
      ...nestedText(ritualHub),
      ...ritualGuides.flatMap((guide) => [
        textField(guide, "title", "ritual guide"),
        textField(guide, "description", "ritual guide"),
        textField(guide, "answer", "ritual guide"),
      ]),
    ]),
    title: textField(ritualHub, "title", "ritual hub"),
    userIntent: "learn-rituvia-digital-ritual-reflection",
  });
  for (const guide of ritualGuides) {
    const slug = textField(guide, "slug", "ritual guide");
    const routeId = `ritual-reflection-guide:${slug}` as PublicRouteId;
    await add({
      contentShape: "ritual-reflection-guide",
      description: textField(guide, "description", "ritual guide"),
      headings: Object.freeze([
        textField(guide, "title", "ritual guide"),
        textField(ritualLabels, "stepsTitle", "ritual labels"),
        textField(ritualLabels, "questionsTitle", "ritual labels"),
        textField(ritualLabels, "limitsTitle", "ritual labels"),
        textField(ritualLabels, "sourceTitle", "ritual labels"),
      ]),
      internalRouteIds: addCoreNavigation(routeId, ["ritual-reflection-hub"]),
      routeId,
      sourcePaths: Object.freeze([ritualSourcePath]),
      textBlocks: Object.freeze([
        textField(guide, "answer", "ritual guide"),
        textField(ritualHub, "boundary", "ritual hub"),
        ...textList(guide.steps, "ritual steps"),
        ...textList(guide.reflectionQuestions, "ritual reflection questions"),
        ...textList(guide.limitations, "ritual limitations"),
        ...textList(guide.sourceRefs, "ritual source refs"),
      ]),
      title: textField(guide, "title", "ritual guide"),
      userIntent: `practice-${slug}`,
    });
  }

  const ordered = publicRouteRegistry.records.map(({ id }) => inputs.get(id));
  if (ordered.some((input) => input === undefined) || ordered.length !== inputs.size) {
    throw new TypeError("The public-page quality source does not cover the exact route registry.");
  }
  return Object.freeze(ordered as readonly PublicPageQualityInput[]);
};
