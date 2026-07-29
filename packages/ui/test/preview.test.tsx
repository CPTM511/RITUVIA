import { readFileSync } from "node:fs";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { UiPreview } from "../examples/preview.js";

const previewStyles = readFileSync("packages/ui/examples/preview.css", "utf8");

describe("synthetic UI verification preview", () => {
  it("renders long German, Arabic RTL, CJK, and Devanagari fixtures without external content", () => {
    const html = renderToStaticMarkup(<UiPreview />);

    for (const fixture of [
      "Diese absichtlich sehr lange synthetische Beschriftung",
      'dir="rtl" lang="ar"',
      'data-direction-fixture="ltr" dir="ltr" lang="en"',
      "rvt-icon--forward",
      'id="preview-ltr-switch"',
      "هذا نص تجريبي",
      'data-writing-system="ja" lang="ja"',
      "日本語の表示確認",
      'id="preview-japanese-name"',
      'data-line-break-probe="ja"',
      'data-writing-system="ko" lang="ko"',
      "한국어 표시 확인",
      'data-line-break-probe="ko"',
      'data-writing-system="zh-Hans" lang="zh-Hans"',
      "简体中文显示检查",
      'data-line-break-probe="zh-Hans"',
      'data-writing-system="zh-Hant" lang="zh-Hant"',
      "繁體中文顯示檢查",
      'data-line-break-probe="zh-Hant"',
      'data-writing-system="hi" lang="hi"',
      "देवनागरी प्रदर्शन जाँच",
      'data-shaping-probe="hi"',
      'id="preview-hindi-name"',
      'id="preview-hindi-date"',
      'data-kind="empty"',
      'data-kind="error"',
      'data-kind="offline"',
      'data-kind="provider-unavailable"',
      "synthetic verification states",
    ]) {
      expect(html).toContain(fixture);
    }
    expect(html).not.toMatch(/https?:|<script| style=/iu);
  });

  it("collapses the verification grid at narrow effective widths and permits text reflow", () => {
    expect(previewStyles).toContain("@media (width <= 40rem)");
    expect(previewStyles).toContain("grid-template-columns: minmax(0, 1fr)");
    expect(previewStyles).toContain("overflow-wrap: anywhere");
    expect(previewStyles).toContain(".preview-state-grid");
    expect(previewStyles).not.toMatch(/min-width|white-space:\s*nowrap|overflow-x/iu);
  });
});
