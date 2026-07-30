import { afterEach, describe, expect, it, vi } from "vitest";

import inventorySource from "../../../content/editorial/public-page-inventory.v1.json";
import {
  assessRuntimePublicPageInventory,
  isPublicPageInventoryCurrent,
} from "../app/_i18n/public-page-inventory";
import { createLocalizedPublicAlternates } from "../app/_i18n/public-route-metadata";
import { publicRouteRegistry } from "../app/_i18n/public-routes";
import { createRobotsText, createSitemapXml } from "../app/_i18n/seo";

const production = {
  canonicalOrigin: "https://example.test",
  deploymentEnvironment: "production" as const,
  publicShellState: "enabled" as const,
};

const cloneInventory = (): Record<string, unknown> => structuredClone(inventorySource);

afterEach(() => {
  vi.useRealTimers();
});

describe("public-page inventory publication gate", () => {
  it("covers the exact approved 45-route inventory", () => {
    const assessment = assessRuntimePublicPageInventory(inventorySource, "2026-07-29");

    expect(assessment.findings).toEqual([]);
    expect(assessment.records).toHaveLength(45);
    expect(assessment.records.map(({ pathname }) => pathname)).toEqual(
      publicRouteRegistry.records.map(({ pathname }) => pathname),
    );
    expect(new Set(assessment.records.map(({ contentDigest }) => contentDigest))).toHaveLength(45);
    expect(new Set(assessment.records.map(({ userIntent }) => userIntent))).toHaveLength(45);
    expect(
      assessment.records.filter(({ structuredParentRouteId }) => structuredParentRouteId === null),
    ).toHaveLength(1);
  });

  it("rejects missing, duplicated, stale, private, and weak quality evidence", () => {
    const missing = cloneInventory();
    (missing.records as unknown[]).pop();
    expect(assessRuntimePublicPageInventory(missing, "2026-07-29").findings).toContain("coverage");

    const duplicated = cloneInventory();
    const duplicateRecords = duplicated.records as Record<string, unknown>[];
    duplicateRecords[1]!.userIntent = duplicateRecords[0]!.userIntent;
    expect(
      assessRuntimePublicPageInventory(duplicated, "2026-07-29").findings.some((value) =>
        value.startsWith("duplicate:"),
      ),
    ).toBe(true);

    const stale = cloneInventory();
    const staleRecord = (stale.records as Record<string, unknown>[])[4]!;
    (staleRecord.authority as Record<string, unknown>).reviewDueDate = "2026-07-28";
    expect(
      assessRuntimePublicPageInventory(stale, "2026-07-29").findings.some((value) =>
        value.startsWith("record:"),
      ),
    ).toBe(true);

    const privateRoute = cloneInventory();
    const privateRecord = (privateRoute.records as Record<string, unknown>[])[4]!;
    privateRecord.pathname = "/en/sanctuary";
    privateRecord.canonicalPath = "/en/sanctuary";
    expect(
      assessRuntimePublicPageInventory(privateRoute, "2026-07-29").findings.some((value) =>
        value.startsWith("record:"),
      ),
    ).toBe(true);

    const weakQuality = cloneInventory();
    (weakQuality.records as Record<string, unknown>[])[4]!.nearestSimilarityPermille = 900;
    expect(
      assessRuntimePublicPageInventory(weakQuality, "2026-07-29").findings.some((value) =>
        value.startsWith("record:"),
      ),
    ).toBe(true);

    const forgedHierarchy = cloneInventory();
    (forgedHierarchy.records as Record<string, unknown>[])[1]!.structuredParentRouteId = "privacy";
    expect(
      assessRuntimePublicPageInventory(forgedHierarchy, "2026-07-29").findings.some((value) =>
        value.startsWith("record:"),
      ),
    ).toBe(true);
  });

  it("fails canonical, robots, and sitemap publication closed when evidence expires", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2028-01-01T00:00:00.000Z"));

    expect(isPublicPageInventoryCurrent()).toBe(false);
    expect(createLocalizedPublicAlternates("https://example.test", "en", "home")).toBeNull();
    expect(createRobotsText(production)).toBe("User-agent: *\nDisallow: /\n");
    expect(createSitemapXml(production)).toBeNull();
  });
});
