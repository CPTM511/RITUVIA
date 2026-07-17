import { describe, expect, it } from "vitest";

import {
  auditWebShellBuildArtifacts,
  auditWebShellRouteArtifacts,
} from "../scripts/web-shell-build-policy.mjs";

const html = (script = "/_next/static/app.js", stylesheet = "/_next/static/app.css") =>
  `<html><head><link rel="stylesheet" href="${stylesheet}"></head><body><script src="${script}"></script></body></html>`;

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

  it("accepts the exact framework boundary comments emitted by the reviewed build", () => {
    expect(audit(`<!DOCTYPE html>${html()}<!--$--><main></main><!--/$-->`).findings).toEqual([]);
  });

  it("rejects remote or missing scripts and stylesheets", () => {
    expect(audit(html("https://cdn.invalid/app.js", "/_next/static/missing.css")).findings).toEqual(
      expect.arrayContaining(["missing-stylesheet-asset", "nonlocal-javascript"]),
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

  it("rejects every inline style attribute so CSP can disable style attributes", () => {
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
    const canonicalHtml =
      '<html dir="ltr" lang="en"><head><meta name="robots" content="noindex, nofollow"><link rel="canonical" href="http://localhost:3000/en"></head><body><main id="main-content"></main></body></html>';
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
    const nestedHtml =
      '<html dir="ltr" lang="en"><head><meta name="robots" content="noindex, nofollow"><link rel="canonical" href="http://localhost:3000/en/privacy"></head><body><main id="main-content"></main></body></html>';
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
});
