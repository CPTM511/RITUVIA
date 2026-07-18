import { readFile } from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";

export const webShellBuildBudgets = Object.freeze({
  cssGzipBytes: 9 * 1024,
  htmlGzipBytes: 8 * 1024,
  iconBytes: 2 * 1024,
  javascriptGzipBytes: 232 * 1024,
});

const parseAttributeEntries = (tag) =>
  [
    ...tag.matchAll(
      /\s([A-Za-z_:][A-Za-z0-9_.:-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/gu,
    ),
  ].map(([, name, doubleQuoted, singleQuoted, unquoted]) => [
    name.toLowerCase(),
    doubleQuoted ?? singleQuoted ?? unquoted ?? "",
  ]);

const parseAttributes = (tag) => new Map(parseAttributeEntries(tag));

const attribute = (tag, name) => parseAttributes(tag).get(name) ?? null;

const unique = (values) => [...new Set(values)];
const cssResourceSyntax = /(?:@font-face|@import|(?:-webkit-)?image-set\s*\(|url\s*\()/iu;
const htmlWhitespace = /[\t\n\f\r ]/u;
const htmlNameStart = /[A-Za-z_:]/u;
const htmlNameContinuation = /[A-Za-z0-9_.:-]/u;
const structuredDataAttributes = new Set([
  "about",
  "datatype",
  "inlist",
  "itemid",
  "itemprop",
  "itemref",
  "itemscope",
  "itemtype",
  "prefix",
  "resource",
  "rev",
  "typeof",
  "vocab",
]);
const reviewedOpenGraphProperties = new Set([
  "og:description",
  "og:site_name",
  "og:title",
  "og:type",
  "og:url",
]);
const reviewedDocumentRelations = new Set([
  "alternate",
  "canonical",
  "icon",
  "preload",
  "stylesheet",
]);
const sanctuaryImageWidths = Object.freeze([256, 384, 640, 750, 828, 1080, 1200, 1920, 2048, 3840]);
const sanctuaryImagePath = "/images/rituvia-sanctuary-orb.png";
const sanctuaryImageSizes = Object.freeze({
  "hero-orb-image": "(max-width: 640px) 88vw, (max-width: 928px) 60vw, 38vw",
  "sanctuary-preview-image": "(max-width: 640px) 94vw, 48vw",
  "sanctuary-scene-image": "(max-width: 640px) 100vw, (max-width: 928px) 90vw, 58vw",
});

const optimizedSanctuaryImageUrl = (width) =>
  `/_next/image?url=${encodeURIComponent(sanctuaryImagePath)}&amp;w=${width}&amp;q=75`;

const optimizedSanctuaryImageSrcSet = (widths) =>
  widths.map((width) => `${optimizedSanctuaryImageUrl(width)} ${width}w`).join(", ");

const isReviewedSanctuaryImage = (attributes) => {
  const className = attributes.get("class") ?? "";
  const sizes = sanctuaryImageSizes[className];
  if (sizes === undefined) return false;
  const widths =
    className === "hero-orb-image" ? sanctuaryImageWidths : sanctuaryImageWidths.slice(1);
  const expectedKeys = new Set([
    "alt",
    "class",
    "data-nimg",
    "decoding",
    "height",
    "loading",
    "sizes",
    "src",
    "srcset",
    "style",
    "width",
    ...(className === "sanctuary-preview-image" ? ["aria-hidden"] : []),
  ]);
  return (
    attributes.size === expectedKeys.size &&
    [...attributes.keys()].every((key) => expectedKeys.has(key)) &&
    attributes.get("data-nimg") === "1" &&
    attributes.get("decoding") === "async" &&
    attributes.get("height") === "1402" &&
    attributes.get("loading") === (className === "sanctuary-preview-image" ? "lazy" : "eager") &&
    attributes.get("sizes") === sizes &&
    attributes.get("src") === optimizedSanctuaryImageUrl(3840) &&
    attributes.get("srcset") === optimizedSanctuaryImageSrcSet(widths) &&
    attributes.get("style") === "color:transparent" &&
    attributes.get("width") === "1122" &&
    (className !== "sanctuary-preview-image" ||
      (attributes.get("alt") === "" && attributes.get("aria-hidden") === "true")) &&
    (className === "sanctuary-preview-image" || (attributes.get("alt") ?? "").trim() !== "")
  );
};

const isReviewedSanctuaryImagePreload = (attributes) =>
  attributes.size === 4 &&
  attributes.get("rel") === "preload" &&
  attributes.get("as") === "image" &&
  attributes.get("imagesizes") === sanctuaryImageSizes["hero-orb-image"] &&
  attributes.get("imagesrcset") === optimizedSanctuaryImageSrcSet(sanctuaryImageWidths);

const canonicalStartTagSyntax = (tag) => {
  let position = 1;
  if (!/[A-Za-z]/u.test(tag[position] ?? "")) return false;
  while (/[A-Za-z0-9:-]/u.test(tag[position] ?? "")) position += 1;

  while (position < tag.length) {
    if (tag[position] === ">") return position === tag.length - 1;
    if (tag[position] === "/" && tag[position + 1] === ">") {
      return position === tag.length - 2;
    }
    if (!htmlWhitespace.test(tag[position] ?? "")) return false;
    while (htmlWhitespace.test(tag[position] ?? "")) position += 1;
    if (tag[position] === ">") return position === tag.length - 1;
    if (tag[position] === "/" && tag[position + 1] === ">") {
      return position === tag.length - 2;
    }
    if (!htmlNameStart.test(tag[position] ?? "")) return false;
    position += 1;
    while (htmlNameContinuation.test(tag[position] ?? "")) position += 1;
    while (htmlWhitespace.test(tag[position] ?? "")) position += 1;
    if (tag[position] !== "=") return false;
    position += 1;
    while (htmlWhitespace.test(tag[position] ?? "")) position += 1;
    const quote = tag[position];
    if (quote !== '"' && quote !== "'") return false;
    position += 1;
    while (position < tag.length && tag[position] !== quote) {
      if (tag[position] === "<" || tag[position] === ">") return false;
      position += 1;
    }
    if (tag[position] !== quote) return false;
    position += 1;
  }
  return false;
};

const scanDocumentStartTags = (html) => {
  const sources = [];
  const lowerHtml = html.toLowerCase();
  let malformed = false;
  for (let position = 0; position < html.length; position += 1) {
    if (html[position] !== "<" || !/[A-Za-z]/u.test(html[position + 1] ?? "")) continue;
    let end = position + 1;
    let quote = null;
    for (; end < html.length; end += 1) {
      const character = html[end];
      if (quote !== null) {
        if (character === quote) quote = null;
        else if (character === "<" || character === ">") malformed = true;
      } else if (character === '"' || character === "'") {
        quote = character;
      } else if (character === ">") {
        break;
      } else if (character === "<") {
        malformed = true;
      }
    }
    if (end >= html.length || quote !== null) {
      malformed = true;
      break;
    }
    const tag = html.slice(position, end + 1);
    const name = /^<([A-Za-z][A-Za-z0-9:-]*)/u.exec(tag)?.[1];
    if (name === undefined) {
      malformed = true;
      continue;
    }
    sources.push({ name, tag });
    position = end;
    if (["script", "style", "textarea", "title"].includes(name.toLowerCase())) {
      const closeStart = lowerHtml.indexOf(`</${name.toLowerCase()}`, position + 1);
      const closeEnd = closeStart < 0 ? -1 : html.indexOf(">", closeStart + name.length + 2);
      if (closeStart < 0 || closeEnd < 0) {
        malformed = true;
        break;
      }
      position = closeEnd;
    }
  }
  return { malformed, sources };
};

const documentTags = (html) => {
  const scanned = scanDocumentStartTags(html);
  return {
    malformed: scanned.malformed,
    tags: scanned.sources.map(({ name, tag }) => {
      const entries = parseAttributeEntries(tag);
      return {
        attributes: new Map(entries),
        canonicalSyntax: canonicalStartTagSyntax(tag),
        duplicateAttributes:
          new Set(entries.map(([attributeName]) => attributeName)).size !== entries.length,
        name: name.toLowerCase(),
        tag,
      };
    }),
  };
};

const isLocalDocumentUrl = (value, allowFragment) => {
  if (
    value === "" ||
    value.includes("\\") ||
    value.includes("&") ||
    /[\u0000-\u0020\u007f]/u.test(value)
  ) {
    return false;
  }
  if (allowFragment && value.startsWith("#")) return value.length > 1;
  return value.startsWith("/") && !value.startsWith("//");
};

const isCanonicalNextStaticUrl = (value) => {
  if (
    !value.startsWith("/_next/static/") ||
    value.includes("\\") ||
    value.includes("%") ||
    value.includes("?") ||
    value.includes("#") ||
    /[\u0000-\u0020\u007f]/u.test(value)
  ) {
    return false;
  }
  const segments = value.slice("/_next/static/".length).split("/");
  return (
    segments.length > 0 &&
    segments.every((segment) => segment !== "" && segment !== "." && segment !== "..")
  );
};

const canonicalDocumentUrl = (value) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed : null;
  } catch {
    return null;
  }
};

const metadataValues = (tags, attributeName, attributeValue) =>
  tags
    .filter(
      ({ attributes, name }) => name === "meta" && attributes.get(attributeName) === attributeValue,
    )
    .map(({ attributes }) => attributes.get("content") ?? "");

const documentTitle = (html) => {
  const matches = [...html.matchAll(/<title>([^<]*)<\/title>/gu)];
  return matches.length === 1 ? matches[0][1] : null;
};

export const auditPublicSeoDocument = (
  html,
  expectedPathname = "/en",
  expectedCanonicalOrigin = "http://localhost:3000",
  expectedRobots = "noindex, nofollow",
) => {
  const findings = [];
  const tags = documentTags(html).tags;
  const title = documentTitle(html);
  const descriptions = metadataValues(tags, "name", "description");
  const robots = metadataValues(tags, "name", "robots");
  const canonicalTags = tags.filter(
    ({ attributes, name }) => name === "link" && attributes.get("rel") === "canonical",
  );
  const canonical =
    canonicalTags.length === 1
      ? canonicalDocumentUrl(canonicalTags[0].attributes.get("href") ?? "")
      : null;
  const expectedOrigin = canonicalDocumentUrl(expectedCanonicalOrigin)?.origin ?? null;
  const alternates = tags
    .filter(({ attributes, name }) => name === "link" && attributes.get("rel") === "alternate")
    .map(({ attributes }) => ({
      href: attributes.get("href") ?? "",
      language: attributes.get("hreflang") ?? "",
    }));
  const openGraphTitle = metadataValues(tags, "property", "og:title");
  const openGraphDescription = metadataValues(tags, "property", "og:description");
  const openGraphUrl = metadataValues(tags, "property", "og:url");
  const openGraphSiteName = metadataValues(tags, "property", "og:site_name");
  const openGraphType = metadataValues(tags, "property", "og:type");

  if (
    title === null ||
    title.trim() === "" ||
    descriptions.length !== 1 ||
    descriptions[0].trim() === "" ||
    robots.length !== 1 ||
    !["index, follow", "noindex, nofollow"].includes(expectedRobots) ||
    robots[0] !== expectedRobots ||
    canonical === null ||
    expectedOrigin === null ||
    canonical.origin !== expectedOrigin ||
    canonical.username !== "" ||
    canonical.password !== "" ||
    canonical.pathname !== expectedPathname ||
    canonical.search !== "" ||
    canonical.hash !== "" ||
    alternates.length !== 2 ||
    !["en", "x-default"].every(
      (language) =>
        alternates.filter(
          (alternate) =>
            alternate.language === language && alternate.href === canonical?.toString(),
        ).length === 1,
    ) ||
    openGraphTitle.length !== 1 ||
    openGraphTitle[0] !== title ||
    openGraphDescription.length !== 1 ||
    openGraphDescription[0] !== descriptions[0] ||
    openGraphUrl.length !== 1 ||
    openGraphUrl[0] !== canonical.toString() ||
    openGraphSiteName.length !== 1 ||
    openGraphSiteName[0].trim() === "" ||
    openGraphType.length !== 1 ||
    openGraphType[0] !== "website"
  ) {
    findings.push("public-seo-metadata");
  }

  if (
    tags.some(({ attributes, name }) => {
      if (name !== "script") return false;
      const rawType = attributes.get("type") ?? "";
      if (rawType.includes("&")) return true;
      const type = rawType.trim().toLowerCase();
      return type === "application/ld+json" || type.startsWith("application/ld+json;");
    }) ||
    tags.some(({ attributes, name }) => {
      const property = attributes.get("property");
      const relation = attributes.get("rel");
      return (
        [...attributes.keys()].some(
          (attributeName) =>
            structuredDataAttributes.has(attributeName) ||
            attributeName === "xmlns" ||
            attributeName.startsWith("xmlns:"),
        ) ||
        (property !== undefined &&
          !(name === "meta" && reviewedOpenGraphProperties.has(property))) ||
        (relation !== undefined &&
          (relation.includes("&") ||
            relation
              .trim()
              .toLowerCase()
              .split(/\s+/u)
              .some((token) => !reviewedDocumentRelations.has(token))))
      );
    })
  ) {
    findings.push("structured-data-before-rit-114");
  }

  return Object.freeze(findings);
};

const auditDocumentResources = (html, expectedPathname = "/en") => {
  const findings = [];
  const documentWithoutReviewedDeclarations = html
    .replace(/^<!DOCTYPE html>/iu, "")
    .replaceAll("<!--$-->", "")
    .replaceAll("<!--/$-->", "");
  if (/<!--|-->|<!|<\?/u.test(documentWithoutReviewedDeclarations)) {
    findings.push("noncanonical-html-comment-or-declaration");
  }
  const document = documentTags(html);
  const tags = document.tags;
  if (document.malformed || tags.some(({ canonicalSyntax }) => !canonicalSyntax)) {
    findings.push("noncanonical-html-start-tag");
  }
  const canonicalTags = tags.filter(
    ({ attributes, name }) => name === "link" && attributes.get("rel") === "canonical",
  );
  const canonical =
    canonicalTags.length === 1
      ? canonicalDocumentUrl(canonicalTags[0].attributes.get("href") ?? "")
      : null;
  if (
    canonicalTags.length > 0 &&
    (canonicalTags.length !== 1 ||
      canonical === null ||
      canonical.pathname !== expectedPathname ||
      canonical.search !== "" ||
      canonical.hash !== "")
  ) {
    findings.push("invalid-canonical-alternate");
  }
  for (const { attributes, name } of tags) {
    if (name !== "link" || attributes.get("rel") !== "alternate") continue;
    const alternate = canonicalDocumentUrl(attributes.get("href") ?? "");
    if (
      canonical === null ||
      alternate === null ||
      alternate.origin !== canonical.origin ||
      alternate.pathname !== expectedPathname ||
      !["en", "x-default"].includes(attributes.get("hreflang") ?? "")
    ) {
      findings.push("invalid-canonical-alternate");
    }
  }

  const scriptSources = new Set(
    tags
      .filter(({ name }) => name === "script")
      .map(({ attributes }) => attributes.get("src"))
      .filter((value) => value !== undefined),
  );
  const stylesheetSources = new Set(
    tags
      .filter(({ attributes, name }) => name === "link" && attributes.get("rel") === "stylesheet")
      .map(({ attributes }) => attributes.get("href"))
      .filter((value) => value !== undefined),
  );

  const unexpectedResourceElements = new Set([
    "audio",
    "embed",
    "feimage",
    "iframe",
    "image",
    "img",
    "object",
    "source",
    "svg",
    "track",
    "use",
    "video",
  ]);
  const permittedLinkRelations = new Set([
    "alternate",
    "canonical",
    "icon",
    "modulepreload",
    "preload",
    "stylesheet",
  ]);

  for (const { attributes, duplicateAttributes, name } of tags) {
    const reviewedSanctuaryImage = name === "img" && isReviewedSanctuaryImage(attributes);
    const reviewedSanctuaryImagePreload =
      name === "link" && isReviewedSanctuaryImagePreload(attributes);
    if (name === "base") findings.push("document-base-url");
    if (duplicateAttributes) findings.push("duplicate-html-attribute");
    if ([...attributes.keys()].some((attributeName) => attributeName.startsWith("on"))) {
      findings.push("unreviewed-executable-html-attribute");
    }
    if (attributes.has("srcdoc")) findings.push("unreviewed-executable-html-attribute");
    if (unexpectedResourceElements.has(name) && !reviewedSanctuaryImage) {
      findings.push("unexpected-media-element");
    }
    if (
      ["attributionsrc", "background", "imagesrcset", "manifest", "ping"].some(
        (attributeName) =>
          attributes.has(attributeName) &&
          !(attributeName === "imagesrcset" && reviewedSanctuaryImagePreload),
      )
    ) {
      findings.push("unreviewed-fetch-attribute");
    }
    if (name === "input" && attributes.get("type")?.toLowerCase() === "image") {
      findings.push("unexpected-media-element");
    }
    if (name === "meta" && attributes.get("http-equiv")?.toLowerCase() === "refresh") {
      findings.push("meta-refresh-url");
    }
    const inlineStyle = attributes.get("style") ?? "";
    if (attributes.has("style") && !reviewedSanctuaryImage) {
      findings.push("inline-style-attribute");
    }
    if (cssResourceSyntax.test(inlineStyle)) {
      findings.push("inline-style-resource");
    }
    if (inlineStyle.includes("&")) findings.push("ambiguous-inline-style-entity");
    if (inlineStyle.includes("\\")) findings.push("unreviewed-css-escape");

    if (name === "link") {
      const relation = attributes.get("rel") ?? "";
      if (!permittedLinkRelations.has(relation)) {
        findings.push("unreviewed-link-relation");
      }
      const href = attributes.get("href") ?? "";
      if (relation === "modulepreload" && !scriptSources.has(href)) {
        findings.push("unreviewed-resource-preload");
      }
      if (relation === "preload") {
        const destination = attributes.get("as");
        const reviewed =
          (destination === "script" && scriptSources.has(href)) ||
          (destination === "style" && stylesheetSources.has(href)) ||
          reviewedSanctuaryImagePreload;
        if (!reviewed) findings.push("unreviewed-resource-preload");
      }
      if (
        relation === "icon" &&
        (!/^\/icon\.svg\?icon\.[A-Za-z0-9_-]+\.svg$/u.test(href) ||
          attributes.get("sizes") !== "any" ||
          attributes.get("type") !== "image/svg+xml")
      ) {
        findings.push("unreviewed-icon-resource");
      }
    }

    const urlAttributes = ["action", "formaction", "href", "poster", "src", "srcset", "xlink:href"];
    for (const urlAttribute of urlAttributes) {
      const value = attributes.get(urlAttribute);
      if (value === undefined) continue;
      const attributeApplies =
        urlAttribute !== "href" || name === "a" || name === "link" || name === "area";
      const metadataLink =
        name === "link" &&
        urlAttribute === "href" &&
        ["alternate", "canonical"].includes(attributes.get("rel") ?? "");
      if (
        attributeApplies &&
        !metadataLink &&
        !(reviewedSanctuaryImage && ["src", "srcset"].includes(urlAttribute)) &&
        !isLocalDocumentUrl(value, name === "a" && urlAttribute === "href")
      ) {
        findings.push("nonlocal-or-ambiguous-resource-url");
      }
      if (value.startsWith("/_next/static/") && !isCanonicalNextStaticUrl(value)) {
        findings.push("noncanonical-next-static-url");
      }
    }
    if (name === "object" && attributes.has("data")) {
      findings.push("nonlocal-or-ambiguous-resource-url");
    }
  }

  for (const [, stylesheet = ""] of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/giu)) {
    if (cssResourceSyntax.test(stylesheet)) findings.push("inline-style-resource");
    if (stylesheet.includes("\\")) findings.push("unreviewed-css-escape");
  }
  return findings;
};

export const auditWebShellBuildArtifacts = ({
  assets,
  budgets = webShellBuildBudgets,
  expectedPathname = "/en",
  html,
  icon,
}) => {
  const findings = [...auditDocumentResources(html, expectedPathname)];
  const scriptSources = unique(
    [...html.matchAll(/<script\b[^>]*>/gu)]
      .map(([tag]) => attribute(tag, "src"))
      .filter((value) => value !== null),
  );
  const stylesheetSources = unique(
    [...html.matchAll(/<link\b[^>]*>/gu)]
      .filter(([tag]) => attribute(tag, "rel") === "stylesheet")
      .map(([tag]) => attribute(tag, "href"))
      .filter((value) => value !== null),
  );

  if (scriptSources.length === 0) findings.push("missing-javascript-assets");
  if (stylesheetSources.length === 0) findings.push("missing-stylesheet-assets");
  if (gzipSync(Buffer.from(html)).byteLength > budgets.htmlGzipBytes) findings.push("html-budget");
  if (icon.byteLength > budgets.iconBytes) findings.push("icon-budget");
  let javascriptGzipBytes = 0;
  for (const source of scriptSources) {
    if (!isCanonicalNextStaticUrl(source)) {
      findings.push("nonlocal-javascript");
      continue;
    }
    const asset = assets.get(source);
    if (asset === undefined) {
      findings.push("missing-javascript-asset");
      continue;
    }
    javascriptGzipBytes += gzipSync(asset).byteLength;
  }
  if (javascriptGzipBytes > budgets.javascriptGzipBytes) findings.push("javascript-budget");

  let cssGzipBytes = 0;
  for (const source of stylesheetSources) {
    if (!isCanonicalNextStaticUrl(source)) {
      findings.push("nonlocal-stylesheet");
      continue;
    }
    const asset = assets.get(source);
    if (asset === undefined) {
      findings.push("missing-stylesheet-asset");
      continue;
    }
    cssGzipBytes += gzipSync(asset).byteLength;
    if (cssResourceSyntax.test(asset.toString("utf8"))) findings.push("unreviewed-css-resource");
    if (asset.includes("\\")) findings.push("unreviewed-css-escape");
  }
  if (cssGzipBytes > budgets.cssGzipBytes) findings.push("css-budget");

  return Object.freeze({
    cssGzipBytes,
    findings: Object.freeze([...new Set(findings)].sort()),
    htmlGzipBytes: gzipSync(Buffer.from(html)).byteLength,
    iconBytes: icon.byteLength,
    javascriptGzipBytes,
  });
};

export const auditWebShellRouteArtifacts = ({
  dynamicRoute = "/[locale]",
  expectedCanonicalOrigin = "http://localhost:3000",
  expectedPathname = "/en",
  expectedRobots = "noindex, nofollow",
  html,
  prerenderManifest,
  routeMetadata,
  routesManifest,
}) => {
  const findings = [
    ...auditPublicSeoDocument(html, expectedPathname, expectedCanonicalOrigin, expectedRobots),
  ];
  if (routesManifest?.caseSensitive !== true) findings.push("case-insensitive-routes");
  if (prerenderManifest?.dynamicRoutes?.[dynamicRoute]?.fallback !== false) {
    findings.push("dynamic-locale-fallback");
  }
  const cacheTags = routeMetadata?.headers?.["x-next-cache-tags"];
  if (
    (routeMetadata?.status !== undefined && routeMetadata.status !== 200) ||
    typeof cacheTags !== "string" ||
    !cacheTags.split(",").includes(`_N_T_${expectedPathname}`)
  ) {
    findings.push("canonical-route-metadata");
  }
  const canonicalTag = documentTags(html).tags.find(
    ({ attributes, name }) => name === "link" && attributes.get("rel") === "canonical",
  );
  const canonical = canonicalDocumentUrl(canonicalTag?.attributes.get("href") ?? "");
  if (
    !/<html\b[^>]*\bdir="ltr"[^>]*\blang="en"|<html\b[^>]*\blang="en"[^>]*\bdir="ltr"/u.test(
      html,
    ) ||
    !/<main\b[^>]*\bid="main-content"/u.test(html) ||
    canonical?.pathname !== expectedPathname ||
    !/<meta\b[^>]*\bname="robots"[^>]*\bcontent="(?:index, follow|noindex, nofollow)"/u.test(
      html,
    ) ||
    html.includes("__next_error__")
  ) {
    findings.push("canonical-shell-html");
  }
  return Object.freeze([...new Set(findings)].sort());
};

export const verifyWebShellBuild = async (
  repositoryRoot,
  expectedCanonicalOrigin = process.env.BRAND_CANONICAL_ORIGIN ?? "http://localhost:3000",
  expectedRobots = process.env.APP_ENV === "production" ? "index, follow" : "noindex, nofollow",
) => {
  const nextRoot = path.join(repositoryRoot, "apps/web/.next");
  const icon = await readFile(path.join(nextRoot, "server/app/icon.svg.body"));
  const [prerenderManifest, routesManifest] = await Promise.all(
    ["prerender-manifest.json", "routes-manifest.json"].map(async (file) =>
      JSON.parse(await readFile(path.join(nextRoot, file), "utf8")),
    ),
  );
  const routes = [
    { artifact: "en", dynamicRoute: "/[locale]", pathname: "/en" },
    {
      artifact: "en/methodology",
      dynamicRoute: "/[locale]/[page]",
      pathname: "/en/methodology",
    },
    { artifact: "en/safety", dynamicRoute: "/[locale]/[page]", pathname: "/en/safety" },
    { artifact: "en/privacy", dynamicRoute: "/[locale]/[page]", pathname: "/en/privacy" },
  ];
  const routeInputs = await Promise.all(
    routes.map(async (route) => ({
      ...route,
      html: await readFile(path.join(nextRoot, `server/app/${route.artifact}.html`), "utf8"),
      routeMetadata: JSON.parse(
        await readFile(path.join(nextRoot, `server/app/${route.artifact}.meta`), "utf8"),
      ),
    })),
  );
  const references = unique([
    ...routeInputs.flatMap(({ html }) => [
      ...[...html.matchAll(/<script\b[^>]*>/gu)]
        .map(([tag]) => attribute(tag, "src"))
        .filter((value) => value !== null),
      ...[...html.matchAll(/<link\b[^>]*>/gu)]
        .filter(([tag]) => attribute(tag, "rel") === "stylesheet")
        .map(([tag]) => attribute(tag, "href"))
        .filter((value) => value !== null),
    ]),
  ]);
  if (references.some((reference) => !isCanonicalNextStaticUrl(reference))) {
    throw new Error("Web shell build policy failed: noncanonical-next-static-url");
  }
  const assets = new Map(
    await Promise.all(
      references.map(async (reference) => [
        reference,
        await readFile(path.join(nextRoot, reference.replace(/^\/_next\//u, ""))),
      ]),
    ),
  );
  const results = routeInputs.map(({ dynamicRoute, html, pathname, routeMetadata }) => {
    const result = auditWebShellBuildArtifacts({
      assets,
      expectedPathname: pathname,
      html,
      icon,
    });
    const routeFindings = auditWebShellRouteArtifacts({
      dynamicRoute,
      expectedCanonicalOrigin,
      expectedPathname: pathname,
      expectedRobots,
      html,
      prerenderManifest,
      routeMetadata,
      routesManifest,
    });
    return { pathname, result, routeFindings };
  });
  const findings = [
    ...new Set(
      results.flatMap(({ result, routeFindings }) => [...result.findings, ...routeFindings]),
    ),
  ].sort();
  const titles = routeInputs.map(({ html }) => documentTitle(html));
  const descriptions = routeInputs.map(({ html }) => {
    const values = metadataValues(documentTags(html).tags, "name", "description");
    return values.length === 1 ? values[0] : null;
  });
  if (
    new Set(titles).size !== routeInputs.length ||
    new Set(descriptions).size !== routeInputs.length
  ) {
    findings.push("duplicate-public-seo-metadata");
    findings.sort();
  }
  if (findings.length > 0) {
    throw new Error(`Web shell build policy failed: ${findings.join(", ")}`);
  }
  return Object.freeze({
    cssGzipBytes: Math.max(...results.map(({ result }) => result.cssGzipBytes)),
    findings: Object.freeze([]),
    htmlGzipBytes: Math.max(...results.map(({ result }) => result.htmlGzipBytes)),
    iconBytes: icon.byteLength,
    javascriptGzipBytes: Math.max(...results.map(({ result }) => result.javascriptGzipBytes)),
    routes: Object.freeze(results.map(({ pathname }) => pathname)),
  });
};
