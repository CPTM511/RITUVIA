import { publicPageInventoryRecord } from "./public-page-inventory";
import type { PublicRouteId } from "./public-routes";

export type PublicStructuredDataType = "Article" | "CollectionPage" | "WebPage" | "WebSite";

export type PublicStructuredDataInput = Readonly<{
  canonicalOrigin: string;
  description: string;
  locale: "en";
  routeId: PublicRouteId;
  title: string;
}>;

type JsonLdValue = Readonly<Record<string, unknown>>;

const controlledTextPattern = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u;

const reviewedType = (contentShape: string): PublicStructuredDataType | null => {
  switch (contentShape) {
    case "product-landing":
      return "WebSite";
    case "public-trust-article":
      return "WebPage";
    case "educational-collection":
      return "CollectionPage";
    case "calculation-guide":
    case "methodology-guide":
    case "ritual-reflection-guide":
    case "tarot-card-guide":
    case "tarot-spread-guide":
      return "Article";
    default:
      return null;
  }
};

const reviewedText = (value: string, minimum: number, maximum: number): boolean =>
  value === value.trim() &&
  value.length >= minimum &&
  value.length <= maximum &&
  !controlledTextPattern.test(value);

const canonicalOrigin = (value: string): URL | null => {
  try {
    const parsed = new URL(value);
    return (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      parsed.username === "" &&
      parsed.password === "" &&
      parsed.pathname === "/" &&
      parsed.search === "" &&
      parsed.hash === ""
      ? parsed
      : null;
  } catch {
    return null;
  }
};

const entityId = (url: string, type: PublicStructuredDataType): string =>
  `${url}#${type === "WebSite" ? "website" : "webpage"}`;

export const createPublicStructuredData = (
  input: PublicStructuredDataInput,
): JsonLdValue | null => {
  const origin = canonicalOrigin(input.canonicalOrigin);
  const record = publicPageInventoryRecord(input.routeId, input.locale);
  const type = record === null ? null : reviewedType(record.contentShape);
  if (
    origin === null ||
    record === null ||
    type === null ||
    !reviewedText(input.title, 3, 220) ||
    !reviewedText(input.description, 20, 600)
  ) {
    return null;
  }

  const currentUrl = new URL(record.canonicalPath, origin).toString();
  let parentNode: Readonly<Record<string, unknown>> | null = null;
  if (record.structuredParentRouteId !== null) {
    const parentRecord = publicPageInventoryRecord(record.structuredParentRouteId, input.locale);
    const parentType = parentRecord === null ? null : reviewedType(parentRecord.contentShape);
    if (
      parentRecord === null ||
      parentType === null ||
      !record.internalRouteIds.includes(record.structuredParentRouteId)
    ) {
      return null;
    }
    const parentUrl = new URL(parentRecord.canonicalPath, origin).toString();
    parentNode = Object.freeze({
      "@id": entityId(parentUrl, parentType),
      "@type": parentType,
      url: parentUrl,
    });
  }

  const pageNode = Object.freeze({
    "@id": entityId(currentUrl, type),
    "@type": type,
    description: input.description,
    inLanguage: input.locale,
    ...(parentNode === null ? {} : { isPartOf: parentNode }),
    ...(type === "Article" ? { headline: input.title } : { name: input.title }),
    url: currentUrl,
  });
  return Object.freeze({
    "@context": "https://schema.org",
    "@graph": Object.freeze([pageNode]),
  });
};

export const serializePublicStructuredData = (value: JsonLdValue): string =>
  JSON.stringify(value)
    .replaceAll("&", "\\u0026")
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");

export const publicStructuredDataType = (
  routeId: PublicRouteId,
  locale: "en",
): PublicStructuredDataType | null => {
  const record = publicPageInventoryRecord(routeId, locale);
  return record === null ? null : reviewedType(record.contentShape);
};
