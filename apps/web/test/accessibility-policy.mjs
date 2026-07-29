import { pseudoLocalizeText } from "@rituvia/i18n/testing";

const publicRouteArtifacts = Object.freeze([
  Object.freeze({ artifact: "en", pathname: "/en" }),
  Object.freeze({ artifact: "en/methodology", pathname: "/en/methodology" }),
  Object.freeze({ artifact: "en/safety", pathname: "/en/safety" }),
  Object.freeze({ artifact: "en/privacy", pathname: "/en/privacy" }),
  Object.freeze({ artifact: "en/numerology", pathname: "/en/numerology" }),
  Object.freeze({
    artifact: "en/numerology/life-path-number",
    pathname: "/en/numerology/life-path-number",
  }),
  Object.freeze({
    artifact: "en/numerology/birthday-number",
    pathname: "/en/numerology/birthday-number",
  }),
  Object.freeze({
    artifact: "en/numerology/personal-year-number",
    pathname: "/en/numerology/personal-year-number",
  }),
  Object.freeze({
    artifact: "en/numerology/master-numbers",
    pathname: "/en/numerology/master-numbers",
  }),
  Object.freeze({ artifact: "en/astrology", pathname: "/en/astrology" }),
  Object.freeze({
    artifact: "en/astrology/natal-chart-calculation",
    pathname: "/en/astrology/natal-chart-calculation",
  }),
  Object.freeze({
    artifact: "en/astrology/birth-time-uncertainty",
    pathname: "/en/astrology/birth-time-uncertainty",
  }),
  Object.freeze({
    artifact: "en/astrology/houses-and-major-aspects",
    pathname: "/en/astrology/houses-and-major-aspects",
  }),
  Object.freeze({
    artifact: "en/astrology/sources-and-methodology",
    pathname: "/en/astrology/sources-and-methodology",
  }),
]);

const privateRouteArtifacts = Object.freeze([
  Object.freeze({ artifact: "en/intake", pathname: "/en/intake" }),
  Object.freeze({ artifact: "en/tarot/one-card", pathname: "/en/tarot/one-card" }),
  Object.freeze({ artifact: "en/tarot/three-card", pathname: "/en/tarot/three-card" }),
]);

const routeArtifacts = Object.freeze([...publicRouteArtifacts, ...privateRouteArtifacts]);
const sanctuaryImagePath = "/images/rituvia-sanctuary-orb.png";
const sanctuaryImageWidths = new Set([256, 384, 640, 750, 828, 1080, 1200, 1920, 2048, 3840]);

export const publicAccessibilitySmokeRoutes = Object.freeze(
  publicRouteArtifacts.map(({ pathname }) => pathname),
);

export const privateAccessibilitySmokeRoutes = Object.freeze(
  privateRouteArtifacts.map(({ pathname }) => pathname),
);

export const accessibilitySmokeRoutes = Object.freeze(
  routeArtifacts.map(({ pathname }) => pathname),
);

export const accessibilityAxeTags = Object.freeze([
  "wcag2a",
  "wcag2aa",
  "wcag21a",
  "wcag21aa",
  "wcag22aa",
  "best-practice",
]);

const contentTypeByExtension = Object.freeze({
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
});

const extension = (pathname) => {
  const index = pathname.lastIndexOf(".");
  return index < 0 ? "" : pathname.slice(index).toLowerCase();
};

const safeStaticRelativePath = (pathname) => {
  if (!pathname.startsWith("/_next/static/") || pathname.includes("%")) return null;
  const relativePath = pathname.slice("/_next/static/".length);
  const segments = relativePath.split("/");
  if (
    relativePath === "" ||
    relativePath.includes("\\") ||
    relativePath.includes("\0") ||
    segments.some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    return null;
  }
  return relativePath;
};

export const resolveAccessibilityArtifactRequest = (rawUrl) => {
  if (
    typeof rawUrl !== "string" ||
    rawUrl.includes("\\") ||
    /[\u0000-\u001f\u007f]/u.test(rawUrl)
  ) {
    return null;
  }
  let url;
  try {
    url = new URL(rawUrl, "http://127.0.0.1");
  } catch {
    return null;
  }
  if (
    url.origin !== "http://127.0.0.1" ||
    url.username !== "" ||
    url.password !== "" ||
    url.hash !== ""
  ) {
    return null;
  }

  const route = routeArtifacts.find(({ pathname }) => pathname === url.pathname);
  if (route !== undefined && url.search === "") {
    return Object.freeze({
      contentType: "text/html; charset=utf-8",
      relativePath: `server/app/${route.artifact}.html`,
      type: "document",
    });
  }

  if (
    url.pathname === "/icon.svg" &&
    (url.search === "" || /^\?icon\.[A-Za-z0-9_-]+\.svg$/u.test(url.search))
  ) {
    return Object.freeze({
      contentType: "image/svg+xml",
      relativePath: "server/app/icon.svg.body",
      type: "icon",
    });
  }

  if (url.pathname === "/_next/image") {
    const keys = [...url.searchParams.keys()];
    const width = Number(url.searchParams.get("w"));
    if (
      keys.length !== 3 ||
      !["q", "url", "w"].every(
        (key) => url.searchParams.getAll(key).length === 1 && keys.includes(key),
      ) ||
      url.searchParams.get("url") !== sanctuaryImagePath ||
      url.searchParams.get("q") !== "75" ||
      !sanctuaryImageWidths.has(width)
    ) {
      return null;
    }
    return Object.freeze({
      contentType: "image/png",
      relativePath: sanctuaryImagePath.slice(1),
      type: "public-image",
    });
  }

  if (url.search !== "") return null;
  const staticRelativePath = safeStaticRelativePath(url.pathname);
  if (staticRelativePath === null) return null;
  const contentType = contentTypeByExtension[extension(staticRelativePath)];
  if (contentType === undefined) return null;
  return Object.freeze({
    contentType,
    relativePath: `static/${staticRelativePath}`,
    type: "static",
  });
};

export { pseudoLocalizeText };

const axeTargetKey = (target) => JSON.stringify(target);

export const auditAxeResult = (result, reviewedIncompleteTargets = []) => {
  const reviewedTargets = new Set(reviewedIncompleteTargets.map(axeTargetKey));
  return Object.freeze(
    [
      ...result.violations.map(({ id, impact }) => ({ id, impact, state: "violation" })),
      ...result.incomplete.flatMap(({ id, impact, nodes }) =>
        nodes.flatMap(({ target }) =>
          id === "color-contrast" && reviewedTargets.has(axeTargetKey(target))
            ? []
            : [{ id: `${id}@${axeTargetKey(target)}`, impact, state: "incomplete" }],
        ),
      ),
    ]
      .map((finding) => Object.freeze(finding))
      .sort((left, right) =>
        `${left.state}:${left.id}`.localeCompare(`${right.state}:${right.id}`),
      ),
  );
};

export const countReviewedAxeIncompleteNodes = (result, reviewedIncompleteTargets = []) => {
  const reviewedTargets = new Set(reviewedIncompleteTargets.map(axeTargetKey));
  return result.incomplete
    .filter(({ id }) => id === "color-contrast")
    .flatMap(({ nodes }) => nodes)
    .filter(({ target }) => reviewedTargets.has(axeTargetKey(target))).length;
};
