import { readFile } from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";

export const webShellBuildBudgets = Object.freeze({
  cssGzipBytes: 4 * 1024,
  htmlGzipBytes: 8 * 1024,
  iconBytes: 2 * 1024,
  javascriptGzipBytes: 220 * 1024,
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

const canonicalDocumentUrl = (value) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed : null;
  } catch {
    return null;
  }
};

const auditDocumentResources = (html) => {
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
      canonical.pathname !== "/en" ||
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
      alternate.pathname !== "/en" ||
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
    if (name === "base") findings.push("document-base-url");
    if (duplicateAttributes) findings.push("duplicate-html-attribute");
    if ([...attributes.keys()].some((attributeName) => attributeName.startsWith("on"))) {
      findings.push("unreviewed-executable-html-attribute");
    }
    if (attributes.has("srcdoc")) findings.push("unreviewed-executable-html-attribute");
    if (unexpectedResourceElements.has(name)) findings.push("unexpected-media-element");
    if (
      ["attributionsrc", "background", "imagesrcset", "manifest", "ping"].some((attributeName) =>
        attributes.has(attributeName),
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
          (destination === "style" && stylesheetSources.has(href));
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
        !isLocalDocumentUrl(value, name === "a" && urlAttribute === "href")
      ) {
        findings.push("nonlocal-or-ambiguous-resource-url");
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
  html,
  icon,
}) => {
  const findings = [...auditDocumentResources(html)];
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
    if (!source.startsWith("/_next/static/") || source.includes("\\")) {
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
    if (!source.startsWith("/_next/static/") || source.includes("\\")) {
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
  html,
  prerenderManifest,
  routeMetadata,
  routesManifest,
}) => {
  const findings = [];
  if (routesManifest?.caseSensitive !== true) findings.push("case-insensitive-routes");
  if (prerenderManifest?.dynamicRoutes?.["/[locale]"]?.fallback !== false) {
    findings.push("dynamic-locale-fallback");
  }
  const cacheTags = routeMetadata?.headers?.["x-next-cache-tags"];
  if (
    (routeMetadata?.status !== undefined && routeMetadata.status !== 200) ||
    typeof cacheTags !== "string" ||
    !cacheTags.split(",").includes("_N_T_/en")
  ) {
    findings.push("canonical-route-metadata");
  }
  if (
    !/<html\b[^>]*\bdir="ltr"[^>]*\blang="en"|<html\b[^>]*\blang="en"[^>]*\bdir="ltr"/u.test(
      html,
    ) ||
    !/<main\b[^>]*\bid="main-content"/u.test(html) ||
    !/<link\b[^>]*\brel="canonical"[^>]*\bhref="[^"]+\/en"/u.test(html) ||
    !/<meta\b[^>]*\bname="robots"[^>]*\bcontent="(?:index, follow|noindex, nofollow)"/u.test(
      html,
    ) ||
    html.includes("__next_error__")
  ) {
    findings.push("canonical-shell-html");
  }
  return Object.freeze([...new Set(findings)].sort());
};

export const verifyWebShellBuild = async (repositoryRoot) => {
  const nextRoot = path.join(repositoryRoot, "apps/web/.next");
  const html = await readFile(path.join(nextRoot, "server/app/en.html"), "utf8");
  const icon = await readFile(path.join(nextRoot, "server/app/icon.svg.body"));
  const [prerenderManifest, routeMetadata, routesManifest] = await Promise.all(
    ["prerender-manifest.json", "server/app/en.meta", "routes-manifest.json"].map(async (file) =>
      JSON.parse(await readFile(path.join(nextRoot, file), "utf8")),
    ),
  );
  const references = unique([
    ...[...html.matchAll(/<script\b[^>]*>/gu)]
      .map(([tag]) => attribute(tag, "src"))
      .filter((value) => value !== null),
    ...[...html.matchAll(/<link\b[^>]*>/gu)]
      .filter(([tag]) => attribute(tag, "rel") === "stylesheet")
      .map(([tag]) => attribute(tag, "href"))
      .filter((value) => value !== null),
  ]);
  const assets = new Map(
    await Promise.all(
      references.map(async (reference) => [
        reference,
        await readFile(path.join(nextRoot, reference.replace(/^\/_next\//u, ""))),
      ]),
    ),
  );
  const result = auditWebShellBuildArtifacts({ assets, html, icon });
  const routeFindings = auditWebShellRouteArtifacts({
    html,
    prerenderManifest,
    routeMetadata,
    routesManifest,
  });
  const findings = [...new Set([...result.findings, ...routeFindings])].sort();
  if (findings.length > 0) {
    throw new Error(`Web shell build policy failed: ${findings.join(", ")}`);
  }
  return result;
};
