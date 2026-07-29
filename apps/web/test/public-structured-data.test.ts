import { describe, expect, it } from "vitest";

import { assessRuntimePublicPageInventory } from "../app/_i18n/public-page-inventory";
import {
  createPublicStructuredData,
  publicStructuredDataType,
  serializePublicStructuredData,
} from "../app/_i18n/public-structured-data";

describe("public structured data", () => {
  it("authorizes one visible-content graph for every reviewed public route", () => {
    const inventory = assessRuntimePublicPageInventory(undefined, "2026-07-29");
    expect(inventory.findings).toEqual([]);
    expect(inventory.records).toHaveLength(45);

    for (const record of inventory.records) {
      const title = `Visible title for ${record.routeId}`;
      const description = `Visible explanatory content for ${record.routeId} remains bounded and source reviewed.`;
      const value = createPublicStructuredData({
        canonicalOrigin: "https://rituvia.example",
        description,
        locale: "en",
        routeId: record.routeId,
        title,
      });
      expect(value).not.toBeNull();
      const graph = value?.["@graph"] as readonly Record<string, unknown>[];
      expect(graph).toHaveLength(1);
      expect(graph[0]?.["@type"]).toBe(publicStructuredDataType(record.routeId, "en"));
      expect(graph[0]?.["url"]).toBe(`https://rituvia.example${record.pathname}`);
      expect(graph[0]?.["description"]).toBe(description);
      expect(graph[0]?.["inLanguage"]).toBe("en");
      expect(JSON.stringify(value)).not.toMatch(
        /"@type":"(?:BreadcrumbList|FAQPage|MedicalWebPage|Offer)"|"aggregateRating":|"review":/u,
      );
    }
  });

  it("fails closed for unreviewed origins or visible text", () => {
    const valid = {
      canonicalOrigin: "https://rituvia.example",
      description: "Visible reviewed description with enough detail for the public page.",
      locale: "en" as const,
      routeId: "methodology" as const,
      title: "How RITUVIA methodology works",
    };
    expect(createPublicStructuredData(valid)).not.toBeNull();
    expect(
      createPublicStructuredData({
        ...valid,
        canonicalOrigin: "https://rituvia.example/poisoned",
      }),
    ).toBeNull();
    expect(createPublicStructuredData({ ...valid, description: "too short" })).toBeNull();
    expect(createPublicStructuredData({ ...valid, title: " hidden title " })).toBeNull();
  });

  it("serializes script-closing and Unicode separator payloads without executable markup", () => {
    const value = createPublicStructuredData({
      canonicalOrigin: "https://rituvia.example",
      description:
        "Visible reviewed description that safely includes </script><script>alert(1)</script> and separators \u2028\u2029.",
      locale: "en",
      routeId: "safety",
      title: "Safety boundaries for symbolic reflection",
    });
    expect(value).not.toBeNull();
    const serialized = serializePublicStructuredData(value!);
    expect(serialized).not.toContain("<");
    expect(serialized).not.toContain(">");
    expect(serialized).not.toContain("&");
    expect(serialized).not.toContain("\u2028");
    expect(serialized).not.toContain("\u2029");
    expect(JSON.parse(serialized)).toEqual(value);
  });
});
