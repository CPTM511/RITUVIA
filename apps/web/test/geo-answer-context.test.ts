import { describe, expect, it } from "vitest";

import { publicRouteRegistry } from "../app/_i18n/public-routes";
import { getGeoAnswerContext } from "../server/geo-answer-context";

const sources = Object.freeze(["Reviewed source label, version 1.0.0"]);

describe("GEO answer context registry", () => {
  it("covers the exact approved 45-page registry with stable visible entities", () => {
    const contexts = publicRouteRegistry.records.map((route) =>
      getGeoAnswerContext({
        asOfDate: "2026-07-29",
        brandName: "Configured Brand",
        locale: route.locale,
        routeId: route.id,
        ...(route.contentType === "pages" ? {} : { sourceLabels: sources }),
      }),
    );

    expect(contexts).toHaveLength(45);
    expect(new Set(contexts.map(({ entity }) => entity.id))).toEqual(
      new Set([
        "rituvia-public-guidance-v1",
        "rituvia-numerology-v1",
        "rituvia-western-natal-astrology-v1",
        "rituvia-major-arcana-reflection-v1",
        "rituvia-original-secular-reflection-v1",
      ]),
    );
    expect(
      contexts.every(
        ({ authority, classifications, entity, sources: sourceLabels }) =>
          authority.reviewedDate <= "2026-07-29" &&
          classifications.length >= 1 &&
          entity.definition.length > 30 &&
          sourceLabels.length >= 1,
      ),
    ).toBe(true);
  });

  it("keeps fact, tradition, interpretation, and product policy distinct by family", () => {
    const classifications = new Map(
      publicRouteRegistry.records.map((route) => [
        route.id,
        getGeoAnswerContext({
          asOfDate: "2026-07-29",
          brandName: "Configured Brand",
          locale: route.locale,
          routeId: route.id,
          ...(route.contentType === "pages" ? {} : { sourceLabels: sources }),
        }).classifications.map(({ kind }) => kind),
      ]),
    );

    expect(classifications.get("numerology-hub")).toEqual(["fact", "interpretation"]);
    expect(classifications.get("astrology-hub")).toEqual(["fact", "tradition", "interpretation"]);
    expect(classifications.get("tarot-hub")).toEqual(["tradition", "interpretation"]);
    expect(classifications.get("ritual-reflection-hub")).toEqual([
      "product_guidance",
      "interpretation",
    ]);
    expect(classifications.get("privacy")).toEqual(["product_guidance"]);
  });

  it("rejects hidden markup, internal paths, duplicates, and incomplete sources", () => {
    const input = {
      asOfDate: "2026-07-29",
      brandName: "Configured Brand",
      locale: "en",
      routeId: "tarot-hub" as const,
    };

    expect(() => getGeoAnswerContext({ ...input, sourceLabels: [] })).toThrow(
      "source inventory is incomplete",
    );
    expect(() => getGeoAnswerContext({ ...input, sourceLabels: ["Source", "Source"] })).toThrow(
      "contains duplicates",
    );
    expect(() =>
      getGeoAnswerContext({ ...input, sourceLabels: ["content/private-source.json"] }),
    ).toThrow("not safe reviewed text");
    expect(() =>
      getGeoAnswerContext({ ...input, sourceLabels: ["Source<script>alert(1)</script>"] }),
    ).toThrow("not safe reviewed text");
  });

  it("fails closed when context governance or page authority is stale", () => {
    expect(() =>
      getGeoAnswerContext({
        asOfDate: "2027-07-30",
        brandName: "Configured Brand",
        locale: "en",
        routeId: "home",
      }),
    ).toThrow("does not have current publication evidence");
  });
});
