import { describe, expect, it } from "vitest";

import {
  accessibilityAxeTags,
  accessibilitySmokeRoutes,
  auditAxeResult,
  countReviewedAxeIncompleteNodes,
  pseudoLocalizeText,
  privateAccessibilitySmokeRoutes,
  publicAccessibilitySmokeRoutes,
  resolveAccessibilityArtifactRequest,
} from "./accessibility-policy.mjs";
import { getMessages } from "../app/_i18n/messages";
import { getQuestionIntakeMessages } from "../app/_i18n/question-intake-messages";
import { getStateMessages } from "../app/_i18n/state-messages";
import { getTarotOneCardMessages } from "../app/_i18n/tarot-one-card-messages";
import { getTarotThreeCardMessages } from "../app/_i18n/tarot-three-card-messages";

const collectStrings = (value: unknown): string[] => {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(collectStrings);
  if (typeof value === "object" && value !== null) {
    return Object.values(value).flatMap(collectStrings);
  }
  return [];
};

describe("Web accessibility smoke policy", () => {
  it("separates the exact public and private route inventories", () => {
    expect(publicAccessibilitySmokeRoutes).toEqual([
      "/en",
      "/en/methodology",
      "/en/safety",
      "/en/privacy",
      "/en/numerology",
      "/en/numerology/life-path-number",
      "/en/numerology/birthday-number",
      "/en/numerology/personal-year-number",
      "/en/numerology/master-numbers",
      "/en/astrology",
      "/en/astrology/natal-chart-calculation",
      "/en/astrology/birth-time-uncertainty",
      "/en/astrology/houses-and-major-aspects",
      "/en/astrology/sources-and-methodology",
    ]);
    expect(privateAccessibilitySmokeRoutes).toEqual([
      "/en/intake",
      "/en/tarot/one-card",
      "/en/tarot/three-card",
    ]);
    expect(accessibilitySmokeRoutes).toEqual([
      "/en",
      "/en/methodology",
      "/en/safety",
      "/en/privacy",
      "/en/numerology",
      "/en/numerology/life-path-number",
      "/en/numerology/birthday-number",
      "/en/numerology/personal-year-number",
      "/en/numerology/master-numbers",
      "/en/astrology",
      "/en/astrology/natal-chart-calculation",
      "/en/astrology/birth-time-uncertainty",
      "/en/astrology/houses-and-major-aspects",
      "/en/astrology/sources-and-methodology",
      "/en/intake",
      "/en/tarot/one-card",
      "/en/tarot/three-card",
    ]);
    expect(accessibilityAxeTags).toEqual([
      "wcag2a",
      "wcag2aa",
      "wcag21a",
      "wcag21aa",
      "wcag22aa",
      "best-practice",
    ]);
    expect(Object.isFrozen(accessibilitySmokeRoutes)).toBe(true);
    expect(Object.isFrozen(publicAccessibilitySmokeRoutes)).toBe(true);
    expect(Object.isFrozen(privateAccessibilitySmokeRoutes)).toBe(true);
    expect(Object.isFrozen(accessibilityAxeTags)).toBe(true);
  });

  it("maps only reviewed documents, the generated icon, and bounded static assets", () => {
    expect(resolveAccessibilityArtifactRequest("/en/privacy")).toEqual({
      contentType: "text/html; charset=utf-8",
      relativePath: "server/app/en/privacy.html",
      type: "document",
    });
    expect(resolveAccessibilityArtifactRequest("/en/numerology/master-numbers")).toEqual({
      contentType: "text/html; charset=utf-8",
      relativePath: "server/app/en/numerology/master-numbers.html",
      type: "document",
    });
    expect(resolveAccessibilityArtifactRequest("/en/intake")).toEqual({
      contentType: "text/html; charset=utf-8",
      relativePath: "server/app/en/intake.html",
      type: "document",
    });
    expect(resolveAccessibilityArtifactRequest("/en/tarot/one-card")).toEqual({
      contentType: "text/html; charset=utf-8",
      relativePath: "server/app/en/tarot/one-card.html",
      type: "document",
    });
    expect(resolveAccessibilityArtifactRequest("/en/tarot/three-card")).toEqual({
      contentType: "text/html; charset=utf-8",
      relativePath: "server/app/en/tarot/three-card.html",
      type: "document",
    });
    expect(resolveAccessibilityArtifactRequest("/icon.svg?icon.reviewed.svg")).toEqual({
      contentType: "image/svg+xml",
      relativePath: "server/app/icon.svg.body",
      type: "icon",
    });
    expect(resolveAccessibilityArtifactRequest("/_next/static/chunks/reviewed.js")).toEqual({
      contentType: "text/javascript; charset=utf-8",
      relativePath: "static/chunks/reviewed.js",
      type: "static",
    });
    expect(
      resolveAccessibilityArtifactRequest(
        "/_next/image?url=%2Fimages%2Frituvia-sanctuary-orb.png&w=384&q=75",
      ),
    ).toEqual({
      contentType: "image/png",
      relativePath: "images/rituvia-sanctuary-orb.png",
      type: "public-image",
    });
  });

  it.each([
    "/",
    "/ar-XB",
    "/en?preview=true",
    "/en-XA",
    "/account",
    "/_next/static/../server/secret.js",
    "/_next/static/%2e%2e/server/secret.js",
    "/_next/static/chunks\\secret.js",
    "/_next/static/chunks/secret.txt",
    "/_next/image?url=%2Fimages%2Frituvia-sanctuary-orb.png&w=1&q=75",
    "/_next/image?url=%2Fimages%2Fother.png&w=384&q=75",
    "/_next/image?url=%2Fimages%2Frituvia-sanctuary-orb.png&w=384&q=74",
    "/_next/image?url=%2Fimages%2Frituvia-sanctuary-orb.png&w=384&q=75&extra=true",
    "/_next/image?url=%2Fimages%2Frituvia-sanctuary-orb.png&w=384&w=640&q=75",
    "/icon.svg?unreviewed=true",
    "https://remote.invalid/en",
  ])("rejects an unreviewed artifact request: %s", (request) => {
    expect(resolveAccessibilityArtifactRequest(request)).toBeNull();
  });

  it("produces stable expanded LTR and Arabic-assisted RTL pseudolocales", () => {
    expect(pseudoLocalizeText(" Home ")).toBe(" ［Ĥöṁë ·］ ");
    expect(pseudoLocalizeText("Home", "ar-XB")).toBe("اختبار Ĥöṁë · موسّع");
    expect(pseudoLocalizeText("Welcome to {brand}")).toContain("{brand}");
    expect(pseudoLocalizeText(" 123 ")).toBe(" 123 ");
    expect(() => pseudoLocalizeText("Home", "sideways" as "en-XA")).toThrowError(
      "Pseudolocalization is restricted to en-XA and ar-XB test locales.",
    );
  });

  it("expands every transformable string by at least forty percent", () => {
    const messages = collectStrings([
      getMessages("en"),
      getQuestionIntakeMessages("en"),
      getStateMessages("en"),
      getTarotOneCardMessages("en"),
      getTarotThreeCardMessages("en"),
    ]);
    expect(messages.length).toBeGreaterThan(100);
    for (const source of messages) {
      const localized = pseudoLocalizeText(source);
      expect([...localized].length, source).toBeGreaterThanOrEqual(
        Math.ceil([...source].length * 1.4),
      );
      expect(localized.match(/\{[A-Za-z][A-Za-z0-9_]*\}/gu), source).toEqual(
        source.match(/\{[A-Za-z][A-Za-z0-9_]*\}/gu),
      );
    }
  });

  it("fails closed for violations and every unreviewed incomplete rule", () => {
    const result = {
      incomplete: [
        { id: "color-contrast", impact: "serious", nodes: [{ target: ["main"] }] },
        { id: "aria-valid-attr", impact: "critical", nodes: [{ target: ["body"] }] },
      ],
      violations: [{ id: "button-name", impact: "critical" }],
    };
    expect(auditAxeResult(result, [["main"]])).toEqual([
      { id: 'aria-valid-attr@["body"]', impact: "critical", state: "incomplete" },
      { id: "button-name", impact: "critical", state: "violation" },
    ]);
    expect(auditAxeResult(result)).toContainEqual({
      id: 'color-contrast@["main"]',
      impact: "serious",
      state: "incomplete",
    });
    expect(countReviewedAxeIncompleteNodes(result, [["main"]])).toBe(1);
    expect(countReviewedAxeIncompleteNodes(result, [["footer"]])).toBe(0);
    expect(auditAxeResult({ incomplete: [], violations: [] })).toEqual([]);
  });
});
