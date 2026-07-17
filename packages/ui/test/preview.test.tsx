import { readFileSync } from "node:fs";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { UiPreview } from "../examples/preview.js";

const previewStyles = readFileSync("packages/ui/examples/preview.css", "utf8");

describe("synthetic UI verification preview", () => {
  it("renders long German, Arabic RTL, Japanese, and Devanagari fixtures without external content", () => {
    const html = renderToStaticMarkup(<UiPreview />);

    for (const fixture of [
      "Diese absichtlich sehr lange synthetische Beschriftung",
      'dir="rtl" lang="ar"',
      'data-direction-fixture="ltr" dir="ltr" lang="en"',
      "rvt-icon--forward",
      'id="preview-ltr-switch"',
      "هذا نص تجريبي",
      "日本語の表示確認",
      "देवनागरी प्रदर्शन जाँच",
    ]) {
      expect(html).toContain(fixture);
    }
    expect(html).not.toMatch(/https?:|<script| style=/iu);
  });

  it("collapses the verification grid at narrow effective widths and permits text reflow", () => {
    expect(previewStyles).toContain("@media (width <= 40rem)");
    expect(previewStyles).toContain("grid-template-columns: minmax(0, 1fr)");
    expect(previewStyles).toContain("overflow-wrap: anywhere");
    expect(previewStyles).not.toMatch(/min-width|white-space:\s*nowrap|overflow-x/iu);
  });
});
