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
    ]);
    expect(privateAccessibilitySmokeRoutes).toEqual(["/en/intake"]);
    expect(accessibilitySmokeRoutes).toEqual([
      "/en",
      "/en/methodology",
      "/en/safety",
      "/en/privacy",
      "/en/intake",
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
    expect(resolveAccessibilityArtifactRequest("/en/intake")).toEqual({
      contentType: "text/html; charset=utf-8",
      relativePath: "server/app/en/intake.html",
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
    "/icon.svg?unreviewed=true",
    "https://remote.invalid/en",
  ])("rejects an unreviewed artifact request: %s", (request) => {
    expect(resolveAccessibilityArtifactRequest(request)).toBeNull();
  });

  it("produces stable expanded LTR and Arabic-assisted RTL pseudolocales", () => {
    expect(pseudoLocalizeText(" Home ")).toBe(" ［Ĥöṁë ·］ ");
    expect(pseudoLocalizeText("Home", "rtl")).toBe("اختبار Ĥöṁë · موسّع");
    expect(pseudoLocalizeText("Welcome to {brand}")).toContain("{brand}");
    expect(pseudoLocalizeText(" 123 ")).toBe(" 123 ");
    expect(() => pseudoLocalizeText("Home", "sideways" as "ltr")).toThrowError(
      "Pseudolocale direction must be ltr or rtl.",
    );
  });

  it("expands every transformable string by at least forty percent", () => {
    const messages = collectStrings([
      getMessages("en"),
      getQuestionIntakeMessages("en"),
      getStateMessages("en"),
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
