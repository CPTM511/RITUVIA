import { describe, expect, it } from "vitest";

import {
  auditPublicSeoDocument,
  auditWebShellBuildArtifacts,
  auditWebShellRouteArtifacts,
} from "../scripts/web-shell-build-policy.mjs";

const seoHead = (pathname = "/en", label = "Home") =>
  `<title>RITUVIA — ${label}</title><meta name="description" content="${label} description"><meta name="robots" content="noindex, nofollow"><link rel="canonical" href="http://localhost:3000${pathname}"><link rel="alternate" hreflang="en" href="http://localhost:3000${pathname}"><link rel="alternate" hreflang="x-default" href="http://localhost:3000${pathname}"><meta property="og:title" content="RITUVIA — ${label}"><meta property="og:description" content="${label} description"><meta property="og:url" content="http://localhost:3000${pathname}"><meta property="og:site_name" content="RITUVIA"><meta property="og:type" content="website">`;

const structuredDocument = (
  page: Record<string, unknown> = {
    "@id": "http://localhost:3000/en#website",
    "@type": "WebSite",
    description: "A visible structured description for the reviewed home page.",
    inLanguage: "en",
    name: "Home",
    url: "http://localhost:3000/en",
  },
) =>
  `<html><head>${seoHead()}<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [page],
  })}</script></head><body><main id="main-content"><h1>Home</h1><p>A visible structured description for the reviewed home page.</p></main></body></html>`;

const html = (script = "/_next/static/app.js", stylesheet = "/_next/static/app.css") =>
  `<html><head><link rel="stylesheet" href="${stylesheet}"></head><body><script src="${script}"></script></body></html>`;

const geoAuthority =
  '<section aria-labelledby="geo-home" class="shell geo-answer-context" data-geo-answer-context="" data-geo-entity-id="rituvia-public-guidance-v1"><h2 id="geo-home">How this answer is framed</h2><div data-geo-classification="product_guidance"><dt>Product policy</dt><dd>Reviewed product policy.</dd></div><div data-geo-classification="interpretation"><dt>Interpretation</dt><dd>Reviewed interpretation boundary.</dd></div><h3>Source basis</h3><ul><li>Reviewed source</li></ul><dl><dt>Review authority</dt><dd>Owner-approved product decision</dd></dl></section>';

const sanctuaryImageWidths = [256, 384, 640, 750, 828, 1080, 1200, 1920, 2048, 3840];
const sanctuaryImageUrl = (width: number) =>
  "/_next/image?url=%2Fimages%2Frituvia-sanctuary-orb.png&amp;w=" + width + "&amp;q=75";
const reviewedSanctuaryImage =
  '<img alt="A luminous sanctuary orb" class="hero-orb-image" data-nimg="1" decoding="async" height="1402" loading="eager" sizes="(max-width: 640px) 88vw, (max-width: 928px) 60vw, 38vw" src="' +
  sanctuaryImageUrl(3840) +
  '" srcSet="' +
  sanctuaryImageWidths.map((width) => sanctuaryImageUrl(width) + " " + width + "w").join(", ") +
  '" style="color:transparent" width="1122">';
const reviewedSanctuaryImagePreload =
  '<link rel="preload" as="image" imagesrcset="' +
  sanctuaryImageWidths.map((width) => sanctuaryImageUrl(width) + " " + width + "w").join(", ") +
  '" imagesizes="(max-width: 640px) 88vw, (max-width: 928px) 60vw, 38vw">';

const audit = (
  document = html(),
  assets = new Map([
    ["/_next/static/app.js", Buffer.from("export{}")],
    ["/_next/static/app.css", Buffer.from("body{color:#111}")],
  ]),
) =>
  auditWebShellBuildArtifacts({
    assets,
    budgets: {
      cssGzipBytes: 128,
      htmlGzipBytes: 256,
      iconBytes: 128,
      javascriptGzipBytes: 128,
    },
    html: document,
    icon: Buffer.from("<svg/>"),
  });

describe("Web shell build policy", () => {
  it("accepts bounded local framework assets", () => {
    expect(audit().findings).toEqual([]);
  });

  it("validates but does not charge nomodule compatibility code to the modern budget", () => {
    const legacy = Buffer.from(
      Array.from({ length: 1_024 }, (_, index) => String.fromCharCode(index % 256)).join(""),
      "latin1",
    );
    const document = html().replace(
      "</body>",
      '<script nomodule="" src="/_next/static/legacy.js"></script></body>',
    );
    const assets = new Map([
      ["/_next/static/app.js", Buffer.from("export{}")],
      ["/_next/static/legacy.js", legacy],
      ["/_next/static/app.css", Buffer.from("body{color:#111}")],
    ]);
    expect(audit(document, assets).findings).toEqual([]);
    assets.delete("/_next/static/legacy.js");
    expect(audit(document, assets).findings).toContain("missing-javascript-asset");
  });

  it("accepts the exact framework boundary comments emitted by the reviewed build", () => {
    expect(audit(`<!DOCTYPE html>${html()}<!--$--><main></main><!--/$-->`).findings).toEqual([]);
  });

  it("rejects remote or missing scripts and stylesheets", () => {
    expect(audit(html("https://cdn.invalid/app.js", "/_next/static/missing.css")).findings).toEqual(
      expect.arrayContaining(["missing-stylesheet-asset", "nonlocal-javascript"]),
    );
  });

  it.each([
    "/_next/static/../../escape.js",
    "/_next/static/%2e%2e/escape.js",
    "/_next/static//chunks/escape.js",
    "/_next/static/./escape.js",
    "/_next/static/chunks/escape.js?query=true",
    "/_next/static/chunks/escape.js#fragment",
    "/_next/static/chunks\\escape.js",
  ])("rejects a non-canonical Next static path before file access: %s", (source) => {
    const result = audit(
      html(source),
      new Map([
        [source, Buffer.from("export{}")],
        ["/_next/static/app.css", Buffer.from("body{color:#111}")],
      ]),
    );
    expect(result.findings).toEqual(
      expect.arrayContaining(["noncanonical-next-static-url", "nonlocal-javascript"]),
    );
  });

  it("rejects unreviewed CSS resources and media elements", () => {
    const assets = new Map([
      ["/_next/static/app.js", Buffer.from("export{}")],
      ["/_next/static/app.css", Buffer.from("@font-face{src:url(font.woff2)}")],
    ]);

    expect(audit(`${html()}<img src="/photo.png">`, assets).findings).toEqual(
      expect.arrayContaining(["unexpected-media-element", "unreviewed-css-resource"]),
    );
  });

  it("accepts only the exact optimized local sanctuary image contract", () => {
    expect(
      auditWebShellBuildArtifacts({
        assets: new Map([
          ["/_next/static/app.js", Buffer.from("export{}")],
          ["/_next/static/app.css", Buffer.from("body{color:#111}")],
        ]),
        budgets: {
          cssGzipBytes: 128,
          htmlGzipBytes: 4_096,
          iconBytes: 128,
          javascriptGzipBytes: 128,
        },
        html: html() + reviewedSanctuaryImagePreload + reviewedSanctuaryImage,
        icon: Buffer.from("<svg/>"),
      }).findings,
    ).toEqual([]);
  });

  it.each([
    reviewedSanctuaryImage.replace("hero-orb-image", "unreviewed-image"),
    reviewedSanctuaryImage.replace('width="1122"', 'width="1123"'),
    reviewedSanctuaryImage.replace("color:transparent", "background:url(/pixel)"),
    reviewedSanctuaryImage.replace(">", ' onerror="alert(1)">'),
  ])("rejects a mutated sanctuary image contract", (image) => {
    expect(audit(html() + image).findings).toContain("unexpected-media-element");
  });

  it("rejects CSS escapes that can normalize into hidden resource functions", () => {
    const escapedResource = "body{background:u\\72l(https://tracker.invalid/pixel)}";
    const assets = new Map([
      ["/_next/static/app.js", Buffer.from("export{}")],
      ["/_next/static/app.css", Buffer.from(escapedResource)],
    ]);

    expect(audit(html(), assets).findings).toContain("unreviewed-css-escape");
    expect(audit(`${html()}<p style="background:u\\72l(/pixel)">x</p>`).findings).toContain(
      "unreviewed-css-escape",
    );
    expect(audit(`${html()}<style>${escapedResource}</style>`).findings).toContain(
      "unreviewed-css-escape",
    );
  });

  it("rejects HTML entities and image-set sources that hide CSS fetches", () => {
    expect(
      audit(`${html()}<main style="background:u&#x72;l(https://tracker.invalid/pixel)"></main>`)
        .findings,
    ).toContain("ambiguous-inline-style-entity");

    const imageSet = 'body{background-image:image-set("https://tracker.invalid/pixel" 1x)}';
    const assets = new Map([
      ["/_next/static/app.js", Buffer.from("export{}")],
      ["/_next/static/app.css", Buffer.from(imageSet)],
    ]);
    expect(audit(html(), assets).findings).toContain("unreviewed-css-resource");
    expect(audit(`${html()}<style>${imageSet}</style>`).findings).toContain(
      "inline-style-resource",
    );
  });

  it("rejects unreviewed inline styles outside the single CSP-hashed image attribute", () => {
    expect(audit(`${html()}<main style="color:inherit"></main>`).findings).toContain(
      "inline-style-attribute",
    );
  });

  it.each([
    '<link rel="preconnect" href="https://tracker.invalid">',
    '<link rel="dns-prefetch" href="//tracker.invalid">',
    '<link rel="preload" as="font" href="https://tracker.invalid/font.woff2">',
    '<link rel="modulepreload" href="data:text/javascript,export{}">',
  ])("rejects automatic remote link fetches: %s", (remoteLink) => {
    expect(audit(`${html()}${remoteLink}`).findings).toEqual(
      expect.arrayContaining(["nonlocal-or-ambiguous-resource-url"]),
    );
  });

  it.each([
    ['<base href="https://tracker.invalid/">', "document-base-url"],
    ['<meta http-equiv="refresh" content="0;url=https://tracker.invalid">', "meta-refresh-url"],
    [
      '<form action="https://tracker.invalid/collect"></form>',
      "nonlocal-or-ambiguous-resource-url",
    ],
    ['<object data="/payload"></object>', "unexpected-media-element"],
    ['<p style="background:url(https://tracker.invalid/pixel)">x</p>', "inline-style-resource"],
  ])("rejects alternate HTML fetch surfaces: %s", (surface, finding) => {
    expect(audit(`${html()}${surface}`).findings).toContain(finding);
  });

  it.each([
    '<svg><image href="https://tracker.invalid/pixel"></image></svg>',
    '<svg><use href="https://tracker.invalid/icons.svg#mark"></use></svg>',
    '<svg><feImage href="/large.png"></feImage></svg>',
    '<input type="image" src="/large.png">',
  ])("rejects unbudgeted SVG and image-input fetch surfaces: %s", (surface) => {
    expect(audit(`${html()}${surface}`).findings).toContain("unexpected-media-element");
  });

  it.each([
    '<a href="/en" ping="https://tracker.invalid/p">Continue</a>',
    '<a href="/en" attributionsrc="https://tracker.invalid/a">Continue</a>',
    '<body background="/large.png"></body>',
    '<html manifest="/legacy.appcache"></html>',
    '<link rel="preload" as="image" href="/image.png" imagesrcset="/large.png 2x">',
  ])("rejects side-channel and unbudgeted fetch attributes: %s", (surface) => {
    expect(audit(`${html()}${surface}`).findings).toContain("unreviewed-fetch-attribute");
  });

  it("accepts same-origin canonicals and local navigation/resources", () => {
    const document = `${html()}<link rel="canonical" href="https://example.test/en"><link rel="alternate" hreflang="en" href="https://example.test/en"><link rel="alternate" hreflang="x-default" href="https://example.test/en"><a href="/en#practice">Practice</a><a href="#main">Skip</a>`;

    expect(audit(document).findings).toEqual([]);
  });

  it("does not let a canonical self-authorize remote resources", () => {
    const document = `${html()}<link rel="canonical" href="https://tracker.invalid/en"><link rel="preload" as="font" href="https://tracker.invalid/font.woff2"><link rel="modulepreload" href="https://tracker.invalid/app.js">`;

    expect(audit(document).findings).toEqual(
      expect.arrayContaining(["nonlocal-or-ambiguous-resource-url", "unreviewed-resource-preload"]),
    );
  });

  it("rejects duplicate attributes before browser and auditor parsing can disagree", () => {
    const document = `${html()}<script src="https://tracker.invalid/app.js" src="/_next/static/app.js"></script>`;

    expect(audit(document).findings).toContain("duplicate-html-attribute");
  });

  it.each([
    "<script/src=https://tracker.invalid/x.js></script>",
    '<script type="text/javascript"src="https://tracker.invalid/x.js"></script>',
    '<a href="/en"ping="https://tracker.invalid/p">go</a>',
  ])("rejects browser error-recovery attribute boundaries: %s", (malformedTag) => {
    expect(audit(`${html()}${malformedTag}`).findings).toContain("noncanonical-html-start-tag");
  });

  it.each([
    '<!--<style>--><img src="https://tracker.invalid/pixel"><!--</style>-->',
    '<!--<textarea>--><iframe src="https://tracker.invalid/frame"></iframe><!--</textarea>-->',
    '<!--<title>--><a href="/en" ping="https://tracker.invalid/p">go</a><!--</title>-->',
  ])("rejects raw-text scanner confusion hidden in comments: %s", (commentedSurface) => {
    expect(audit(`${html()}${commentedSurface}`).findings).toContain(
      "noncanonical-html-comment-or-declaration",
    );
  });

  it.each([
    "<body onload=\"fetch('/collect')\"></body>",
    "<iframe srcdoc=\"<script>location='/collect'</script>\"></iframe>",
  ])("rejects executable HTML attributes: %s", (executableAttribute) => {
    expect(audit(`${html()}${executableAttribute}`).findings).toContain(
      "unreviewed-executable-html-attribute",
    );
  });

  it("rejects local preloads that are not already counted script or stylesheet assets", () => {
    expect(
      audit(`${html()}<link rel="preload" as="script" href="/_next/static/huge.js">`).findings,
    ).toContain("unreviewed-resource-preload");
    expect(
      audit(`${html()}<link rel="modulepreload" href="/_next/static/huge.js">`).findings,
    ).toContain("unreviewed-resource-preload");
  });

  it.each([
    '<link rel="stylesheet preload" as="style" href="/_next/static/huge.css">',
    '<link rel="StyleSheet" href="/_next/static/huge.css">',
  ])("rejects non-canonical stylesheet relations: %s", (stylesheet) => {
    expect(audit(`${html()}${stylesheet}`).findings).toContain("unreviewed-link-relation");
  });

  it("permits only the generated, separately budgeted icon route", () => {
    expect(audit(`${html()}<link rel="icon" href="/_next/static/huge.bin">`).findings).toContain(
      "unreviewed-icon-resource",
    );
    expect(
      audit(
        `${html()}<link rel="icon" href="/icon.svg?icon.reviewed.svg" sizes="any" type="image/svg+xml">`,
      ).findings,
    ).toEqual([]);
  });

  it("fails each compressed asset budget closed", () => {
    expect(
      auditWebShellBuildArtifacts({
        assets: new Map([
          ["/_next/static/app.js", Buffer.from("javascript")],
          ["/_next/static/app.css", Buffer.from("css")],
        ]),
        budgets: {
          cssGzipBytes: 1,
          htmlGzipBytes: 1,
          iconBytes: 1,
          javascriptGzipBytes: 1,
        },
        html: html(),
        icon: Buffer.from("icon"),
      }).findings,
    ).toEqual(
      expect.arrayContaining(["css-budget", "html-budget", "icon-budget", "javascript-budget"]),
    );
  });

  it("locks case-sensitive finite locale routing and a healthy canonical artifact", () => {
    const canonicalHtml = `<html dir="ltr" lang="en"><head>${seoHead()}</head><body><main id="main-content">${geoAuthority}</main></body></html>`;
    const valid = {
      html: canonicalHtml,
      prerenderManifest: { dynamicRoutes: { "/[locale]": { fallback: false } } },
      routeMetadata: { headers: { "x-next-cache-tags": "_N_T_/layout,_N_T_/en" } },
      routesManifest: { caseSensitive: true },
    };

    expect(auditWebShellRouteArtifacts(valid)).toEqual([]);
    expect(
      auditWebShellRouteArtifacts({
        ...valid,
        html: canonicalHtml.replace(
          "<main",
          '<template data-dgst="NEXT_HTTP_ERROR_FALLBACK;404"></template><main',
        ),
        prerenderManifest: { dynamicRoutes: { "/[locale]": { fallback: null } } },
        routeMetadata: {
          headers: { "x-next-cache-tags": "_N_T_/layout,_N_T_/EN" },
          status: 404,
        },
        routesManifest: { caseSensitive: false },
      }),
    ).toEqual(
      expect.arrayContaining([
        "canonical-route-metadata",
        "case-insensitive-routes",
        "dynamic-locale-fallback",
      ]),
    );
  });

  it("audits the nested public-page route and canonical independently", () => {
    const nestedHtml = `<html dir="ltr" lang="en"><head>${seoHead("/en/privacy", "Privacy")}</head><body><main id="main-content">${geoAuthority}</main></body></html>`;
    const input = {
      dynamicRoute: "/[locale]/[page]",
      expectedPathname: "/en/privacy",
      html: nestedHtml,
      prerenderManifest: { dynamicRoutes: { "/[locale]/[page]": { fallback: false } } },
      routeMetadata: { headers: { "x-next-cache-tags": "_N_T_/layout,_N_T_/en/privacy" } },
      routesManifest: { caseSensitive: true },
    };

    expect(auditWebShellRouteArtifacts(input)).toEqual([]);
    expect(
      auditWebShellRouteArtifacts({
        ...input,
        expectedPathname: "/en/safety",
      }),
    ).toEqual(expect.arrayContaining(["canonical-route-metadata", "canonical-shell-html"]));
  });

  it("requires one visible allowlisted GEO answer authority without internal evidence", () => {
    const canonicalHtml = `<html dir="ltr" lang="en"><head>${seoHead()}</head><body><main id="main-content">${geoAuthority}</main></body></html>`;
    const input = {
      html: canonicalHtml,
      prerenderManifest: { dynamicRoutes: { "/[locale]": { fallback: false } } },
      routeMetadata: { headers: { "x-next-cache-tags": "_N_T_/layout,_N_T_/en" } },
      routesManifest: { caseSensitive: true },
    };

    expect(auditWebShellRouteArtifacts(input)).toEqual([]);
    for (const mutation of [
      canonicalHtml.replace(geoAuthority, ""),
      canonicalHtml.replace("<section", "<section hidden"),
      canonicalHtml.replace("Reviewed source", "content/editorial/private.json"),
      canonicalHtml.replace("Reviewed source", "product.codex"),
      canonicalHtml.replace(
        'data-geo-classification="interpretation"',
        'data-geo-classification="prediction"',
      ),
    ]) {
      expect(auditWebShellRouteArtifacts({ ...input, html: mutation })).toContain(
        "geo-answer-context",
      );
    }
  });

  it("requires exact visible SEO parity and admits only explicitly reviewed JSON-LD", () => {
    const valid = `<html><head>${seoHead()}</head><body></body></html>`;
    const reviewed = structuredDocument();

    expect(auditPublicSeoDocument(valid)).toEqual([]);
    expect(
      auditPublicSeoDocument(valid.replace('hreflang="x-default"', 'hreflang="fr"')),
    ).toContain("public-seo-metadata");
    expect(
      auditPublicSeoDocument(
        valid.replace(
          'property="og:url" content="http://localhost:3000/en"',
          'property="og:url" content="https://poison.invalid/en"',
        ),
      ),
    ).toContain("public-seo-metadata");
    expect(
      auditPublicSeoDocument(valid.replaceAll("http://localhost:3000", "https://poison.invalid")),
    ).toContain("public-seo-metadata");
    expect(
      auditPublicSeoDocument(valid, "/en", "http://localhost:3000", "index, follow"),
    ).toContain("public-seo-metadata");
    expect(
      auditPublicSeoDocument(
        valid.replace("</head>", '<script type="application/ld+json">{}</script></head>'),
      ),
    ).toContain("public-structured-data");
    expect(
      auditPublicSeoDocument(reviewed, "/en", "http://localhost:3000", "noindex, nofollow", {
        expectedStructuredDataType: "WebSite",
      }),
    ).not.toContain("public-structured-data");
    expect(
      auditPublicSeoDocument(valid, "/en", "http://localhost:3000", "noindex, nofollow", {
        expectedStructuredDataType: "WebSite",
      }),
    ).toContain("public-structured-data");
    const articleDescription = "A visible structured description for the reviewed guide page.";
    const article = `<html><head>${seoHead("/en/numerology/example", "Example").replace('content="website"', 'content="article"')}<script type="application/ld+json">${JSON.stringify(
      {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@id": "http://localhost:3000/en/numerology/example#webpage",
            "@type": "Article",
            description: articleDescription,
            headline: "Example",
            inLanguage: "en",
            isPartOf: {
              "@id": "http://localhost:3000/en/numerology#webpage",
              "@type": "CollectionPage",
              url: "http://localhost:3000/en/numerology",
            },
            url: "http://localhost:3000/en/numerology/example",
          },
        ],
      },
    )}</script></head><body><main id="main-content"><h1>Example</h1><p>${articleDescription}</p><a href="/en/numerology">Back to the library</a></main></body></html>`;
    expect(
      auditPublicSeoDocument(
        article,
        "/en/numerology/example",
        "http://localhost:3000",
        "noindex, nofollow",
        { expectedOpenGraphType: "article", expectedStructuredDataType: "Article" },
      ),
    ).not.toContain("public-structured-data");
    expect(
      auditPublicSeoDocument(
        article.replace('href="/en/numerology"', 'href="/en/safety"'),
        "/en/numerology/example",
        "http://localhost:3000",
        "noindex, nofollow",
        { expectedOpenGraphType: "article", expectedStructuredDataType: "Article" },
      ),
    ).toContain("public-structured-data");
    for (const mutation of [
      reviewed.replace('"@type":"WebSite"', '"@type":"FAQPage"'),
      reviewed.replace('"name":"Home"', '"name":"Hidden title"'),
      reviewed.replace(
        '"description":"A visible structured description for the reviewed home page."',
        '"description":"A hidden structured description that is not rendered in the page."',
      ),
      reviewed.replace('"url":"http://localhost:3000/en"', '"url":"https://poison.invalid/en"'),
      reviewed.replace(
        '"url":"http://localhost:3000/en"',
        '"unknown":"claim","url":"http://localhost:3000/en"',
      ),
    ]) {
      expect(
        auditPublicSeoDocument(mutation, "/en", "http://localhost:3000", "noindex, nofollow", {
          expectedStructuredDataType: "WebSite",
        }),
      ).toContain("public-structured-data");
    }
    for (const hiddenDescription of [
      "<template>A visible structured description for the reviewed home page.</template>",
      "<p hidden>A visible structured description for the reviewed home page.</p>",
      '<p aria-hidden="true">A visible structured description for the reviewed home page.</p>',
    ]) {
      const hiddenOnly = reviewed.replace(
        "<p>A visible structured description for the reviewed home page.</p>",
        `<p>Different visible page copy.</p>${hiddenDescription}`,
      );
      expect(
        auditPublicSeoDocument(hiddenOnly, "/en", "http://localhost:3000", "noindex, nofollow", {
          expectedStructuredDataType: "WebSite",
        }),
      ).toContain("public-structured-data");
    }
    expect(
      auditPublicSeoDocument(
        reviewed.replace("<h1>Home</h1>", "<h1>Different title</h1><h1 hidden>Home</h1>"),
        "/en",
        "http://localhost:3000",
        "noindex, nofollow",
        { expectedStructuredDataType: "WebSite" },
      ),
    ).toContain("public-structured-data");
    expect(
      auditPublicSeoDocument(
        article.replace(
          '<a href="/en/numerology">Back to the library</a>',
          '<a hidden href="/en/numerology">Back to the library</a>',
        ),
        "/en/numerology/example",
        "http://localhost:3000",
        "noindex, nofollow",
        { expectedOpenGraphType: "article", expectedStructuredDataType: "Article" },
      ),
    ).toContain("public-structured-data");
    expect(
      auditPublicSeoDocument(
        valid.replace(
          "</head>",
          '<script type=" application/ld+json; charset=utf-8 ">{}</script></head>',
        ),
      ),
    ).toContain("public-structured-data");
    for (const encodedType of [
      "application/ld&#43;json",
      "application/ld&#x2b;json",
      "application/ld&plus;json",
    ]) {
      expect(
        auditPublicSeoDocument(
          valid.replace("</head>", `<script type="${encodedType}">{}</script></head>`),
        ),
      ).toContain("public-structured-data");
    }
    for (const structuredMarkup of [
      '<div itemscope="" itemtype="https://schema.org/WebSite"></div>',
      '<span itemprop="name">RITUVIA</span>',
      '<div vocab="https://schema.org/" typeof="WebSite"></div>',
      '<span property="schema:name">RITUVIA</span>',
      '<div xmlns:schema="https://schema.org/" property="schema:name"></div>',
      '<meta property="og:ignore https://schema.org/name" content="RITUVIA">',
      '<meta property="og:title&#32;https://schema.org/name" content="RITUVIA">',
      '<a rel="https://schema.org/url" href="/en">RITUVIA</a>',
      '<a rel="schema:url" href="/en">RITUVIA</a>',
      '<a rel="schema&#58;url" href="/en">RITUVIA</a>',
    ]) {
      expect(
        auditPublicSeoDocument(valid.replace("</body>", `${structuredMarkup}</body>`)),
      ).toContain("public-structured-data");
    }
  });
});
