const publicRouteArtifacts = Object.freeze([
  Object.freeze({ artifact: "en", pathname: "/en" }),
  Object.freeze({ artifact: "en/methodology", pathname: "/en/methodology" }),
  Object.freeze({ artifact: "en/safety", pathname: "/en/safety" }),
  Object.freeze({ artifact: "en/privacy", pathname: "/en/privacy" }),
]);

const privateRouteArtifacts = Object.freeze([
  Object.freeze({ artifact: "en/intake", pathname: "/en/intake" }),
]);

const routeArtifacts = Object.freeze([...publicRouteArtifacts, ...privateRouteArtifacts]);

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

const accentCharacters = Object.freeze({
  A: "Å",
  B: "Ɓ",
  C: "Ç",
  D: "Ð",
  E: "Ë",
  F: "Ƒ",
  G: "Ĝ",
  H: "Ĥ",
  I: "Ï",
  J: "Ĵ",
  K: "Ķ",
  L: "Ŀ",
  M: "Ṁ",
  N: "Ñ",
  O: "Ö",
  P: "Þ",
  Q: "Ǫ",
  R: "Ŕ",
  S: "Š",
  T: "Ŧ",
  U: "Ü",
  V: "Ṽ",
  W: "Ŵ",
  X: "Ẍ",
  Y: "Ÿ",
  Z: "Ž",
  a: "å",
  b: "ƀ",
  c: "ç",
  d: "ð",
  e: "ë",
  f: "ƒ",
  g: "ĝ",
  h: "ĥ",
  i: "ï",
  j: "ĵ",
  k: "ķ",
  l: "ŀ",
  m: "ṁ",
  n: "ñ",
  o: "ö",
  p: "þ",
  q: "ǫ",
  r: "ŕ",
  s: "š",
  t: "ŧ",
  u: "ü",
  v: "ṽ",
  w: "ŵ",
  x: "ẍ",
  y: "ÿ",
  z: "ž",
});

export const pseudoLocalizeText = (value, direction = "ltr") => {
  if (direction !== "ltr" && direction !== "rtl") {
    throw new TypeError("Pseudolocale direction must be ltr or rtl.");
  }
  const match = /^(\s*)([\s\S]*?)(\s*)$/u.exec(value);
  if (match === null) return value;
  const [, leading, core, trailing] = match;
  const letters = [...core].filter((character) => /[A-Za-z]/u.test(character)).length;
  if (letters === 0) return value;
  const accented = core
    .split(/(\{[A-Za-z][A-Za-z0-9_]*\})/gu)
    .map((part) =>
      /^\{[A-Za-z][A-Za-z0-9_]*\}$/u.test(part)
        ? part
        : [...part].map((character) => accentCharacters[character] ?? character).join(""),
    )
    .join("");
  const targetLength = Math.ceil([...core].length * 1.4);
  const wrap = (padding) =>
    direction === "rtl" ? `اختبار ${accented} ${padding} موسّع` : `［${accented} ${padding}］`;
  let expansion = "·";
  while ([...wrap(expansion)].length < targetLength) expansion += " ·";
  const localized = wrap(expansion);
  return `${leading}${localized}${trailing}`;
};

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
