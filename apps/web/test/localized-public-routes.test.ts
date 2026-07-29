import { describe, expect, it } from "vitest";

import { createLocalizedPublicRouteRegistry } from "../app/_i18n/localized-public-routes";

const publication = Object.freeze({
  approvalReference: "D-999",
  contentVersion: "fixture.v1",
  reviewedDate: "2026-07-27",
  reviewerId: "fixture-reviewer",
  status: "approved" as const,
});

const definitions = Object.freeze([
  Object.freeze({
    contentType: "pages" as const,
    id: "methodology",
    localizations: Object.freeze({
      en: Object.freeze({
        lastModified: "2026-07-27",
        publication,
        segments: Object.freeze(["methodology"]),
      }),
      "es-419": Object.freeze({
        lastModified: "2026-07-27",
        publication,
        segments: Object.freeze(["metodologia"]),
      }),
    }),
  }),
  Object.freeze({
    contentType: "numerology" as const,
    id: "life-path",
    localizations: Object.freeze({
      en: Object.freeze({
        lastModified: "2026-07-27",
        publication,
        segments: Object.freeze(["numerology", "life-path-number"]),
      }),
      "es-419": Object.freeze({
        lastModified: "2026-07-27",
        publication,
        segments: Object.freeze(["numerologia", "numero-del-camino-de-vida"]),
      }),
    }),
  }),
]);

describe("localized public route registry", () => {
  it("binds stable IDs to reviewed locale-specific slugs and reciprocal alternates", () => {
    const registry = createLocalizedPublicRouteRegistry("en", definitions);

    expect(registry.locales).toEqual(["en", "es-419"]);
    expect(registry.route("methodology", "en")?.pathname).toBe("/en/methodology");
    expect(registry.route("methodology", "es-419")?.pathname).toBe("/es-419/metodologia");
    expect(registry.route("life-path", "es-419")?.pathname).toBe(
      "/es-419/numerologia/numero-del-camino-de-vida",
    );
    expect(
      Object.fromEntries(
        Object.entries(registry.alternates("life-path")).map(([locale, route]) => [
          locale,
          route.pathname,
        ]),
      ),
    ).toEqual({
      en: "/en/numerology/life-path-number",
      "es-419": "/es-419/numerologia/numero-del-camino-de-vida",
    });
  });

  it("resolves only explicit same-locale stale slug redirects", () => {
    const registry = createLocalizedPublicRouteRegistry("en", definitions, [
      {
        fromSegments: ["numerology", "life-path"],
        locale: "en",
        targetId: "life-path",
      },
      {
        fromSegments: ["numerologia", "camino-de-vida"],
        locale: "es-419",
        targetId: "life-path",
      },
    ]);

    expect(registry.redirectByPathname("/en/numerology/life-path")).toMatchObject({
      locale: "en",
      targetPathname: "/en/numerology/life-path-number",
    });
    expect(registry.redirectByPathname("/es-419/numerologia/camino-de-vida")).toMatchObject({
      locale: "es-419",
      targetPathname: "/es-419/numerologia/numero-del-camino-de-vida",
    });
    for (const pathname of [
      "/EN/numerology/life-path",
      "/en/numerology/life-path/",
      "/en/numerology/life-path?private=canary",
      "/es-419/numerology/life-path",
    ]) {
      expect(registry.redirectByPathname(pathname)).toBeNull();
    }
  });

  it("fails closed on missing default content, duplicate paths, and invalid approval evidence", () => {
    expect(() =>
      createLocalizedPublicRouteRegistry("en", [
        {
          contentType: "pages",
          id: "methodology",
          localizations: {
            "es-419": {
              lastModified: "2026-07-27",
              publication,
              segments: ["metodologia"],
            },
          },
        },
      ]),
    ).toThrow("default-locale");
    expect(() =>
      createLocalizedPublicRouteRegistry("en", [
        definitions[0]!,
        { ...definitions[0]!, id: "other" },
      ]),
    ).toThrow("duplicate route");
    expect(() =>
      createLocalizedPublicRouteRegistry("en", [
        {
          contentType: "pages",
          id: "methodology",
          localizations: {
            en: {
              lastModified: "2026-07-27",
              publication: { ...publication, approvalReference: "owner said yes" },
              segments: ["methodology"],
            },
          },
        },
      ]),
    ).toThrow("approval evidence");
  });
});
