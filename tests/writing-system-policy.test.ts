import { describe, expect, it } from "vitest";

import {
  auditWritingSystemPolicy,
  type WritingSystemPolicyFile,
} from "../scripts/writing-system-policy.js";

const contracts = (): WritingSystemPolicyFile[] => [
  {
    path: "packages/ui/src/styles.css",
    source: `
      :root {
        --font-ui-ja: "Hiragino Sans", "Yu Gothic UI", "Yu Gothic", Meiryo, sans-serif;
        --font-ui-ko: "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif;
        --font-ui-zh-hans: "PingFang SC", sans-serif;
        --font-ui-zh-hant: "PingFang TC", sans-serif;
        --font-ui-devanagari: "Noto Sans Devanagari", sans-serif;
      }
      :lang(ja) { line-break: strict; word-break: normal; }
      :lang(hi) { font-variant-ligatures: common-ligatures contextual; word-break: normal; }
    `,
  },
  {
    path: "packages/ui/src/primitives.tsx",
    source: "onValueChange?.(event.currentTarget.value);",
  },
  {
    path: "packages/ui/examples/preview.tsx",
    source: `
      id={createUiControlId("preview-japanese-name")}
      id={createUiControlId("preview-hindi-name")}
      id={createUiControlId("preview-hindi-date")}
    `,
  },
  {
    path: "packages/ui/test/controlled-preview.tsx",
    source: "onValueChange={setValue}",
  },
  {
    path: "packages/ui/test/serve-preview.ts",
    source: "../../../apps/web/app/styles.css",
  },
];

const rules = (files: readonly WritingSystemPolicyFile[]): readonly string[] =>
  auditWritingSystemPolicy(files).map(({ rule }) => rule);

describe("writing-system repository policy", () => {
  it("accepts locale-specific stacks, safe wrapping, shaping, and exact input fixtures", () => {
    expect(auditWritingSystemPolicy(contracts())).toEqual([]);
  });

  it("rejects break-all in production styles", () => {
    expect(
      rules([
        ...contracts(),
        {
          path: "apps/web/app/styles.css",
          source: ".unsafe { word-break: break-all; }",
        },
      ]),
    ).toContain("unsafe-grapheme-line-breaking");
  });

  it("fails closed when writing-system contracts disappear", () => {
    const withoutInputContract = contracts().map((file) =>
      file.path === "packages/ui/src/primitives.tsx" ? { ...file, source: "" } : file,
    );
    expect(rules(withoutInputContract)).toContain("input-preserves-unicode");
    expect(
      rules(contracts().filter(({ path }) => path !== "packages/ui/examples/preview.tsx")),
    ).toEqual(
      expect.arrayContaining([
        "devanagari-input-fixture",
        "japanese-input-fixture",
        "locale-date-fixture",
      ]),
    );
  });
});
