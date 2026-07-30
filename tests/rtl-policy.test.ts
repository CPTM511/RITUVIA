import { describe, expect, it } from "vitest";

import { auditRtlPolicy, type RtlPolicyFile } from "../scripts/rtl-policy.js";

const contracts = (): RtlPolicyFile[] => [
  {
    path: "packages/ui/src/styles.css",
    source: ":where(.rvt-icon--back, .rvt-icon--forward):dir(rtl) { transform: scaleX(-1); }",
  },
  {
    path: "packages/ui/src/primitives.tsx",
    source: 'export const Field = ({ dir = "auto" }) => <input dir={dir} />;',
  },
  {
    path: "apps/web/app/styles.css",
    source: ".astrology-wheel { direction: ltr; margin-inline: auto; }",
  },
  {
    path: "apps/web/app/_components/numerology-calculator.tsx",
    source: '<code dir="ltr">{formula}</code>',
  },
  {
    path: "apps/web/app/_components/sanctuary-flow.tsx",
    source: '<bdi dir="auto">{price}</bdi>',
  },
  {
    path: "apps/web/app/_components/revisit-experience.tsx",
    source: '<time dir="ltr">{date}</time>',
  },
];

const rules = (files: readonly RtlPolicyFile[]): readonly string[] =>
  auditRtlPolicy(files).map(({ rule }) => rule);

describe("RTL repository policy", () => {
  it("accepts logical CSS, structural isolation, and test-only pseudolocale code", () => {
    expect(
      auditRtlPolicy([
        ...contracts(),
        {
          path: "packages/i18n/src/pseudolocale.ts",
          source: "export const pseudoLocalizeText = () => 'safe';",
        },
      ]),
    ).toEqual([]);
  });

  it("rejects physical directional CSS and invisible bidi controls", () => {
    expect(
      rules([
        ...contracts(),
        {
          path: "apps/web/app/unsafe.css",
          source: ".unsafe { margin-left: 1rem; right: 0; }",
        },
        {
          path: "content/unsafe.json",
          source: '{"message":"unsafe\u202evalue"}',
        },
      ]),
    ).toEqual(expect.arrayContaining(["bidi-control-character", "physical-directional-css"]));
  });

  it("rejects pseudolocalization from production modules", () => {
    expect(
      rules([
        ...contracts(),
        {
          path: "apps/web/app/page.tsx",
          source: 'import { pseudoLocalizeText } from "@rituvia/i18n/testing";',
        },
      ]),
    ).toContain("test-pseudolocale-production-import");
  });

  it("fails closed when a reviewed structural contract disappears", () => {
    expect(
      rules(contracts().filter(({ path }) => path !== "packages/ui/src/styles.css")),
    ).toContain("directional-icon-mirroring");
  });
});
