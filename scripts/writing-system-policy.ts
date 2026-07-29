export type WritingSystemPolicyFile = Readonly<{
  path: string;
  source: string;
}>;

export type WritingSystemPolicyFinding = Readonly<{
  location: string;
  rule: string;
}>;

const unsafeLineBreakingPattern = /\bword-break\s*:\s*break-all\b/iu;
const productionStylePattern = /^(?:apps\/web\/app|packages\/ui\/src)\/.*\.css$/u;

const requiredContracts = Object.freeze([
  Object.freeze({
    path: "packages/ui/src/styles.css",
    rule: "japanese-font-stack",
    source: '--font-ui-ja: "Hiragino Sans", "Yu Gothic UI", "Yu Gothic", Meiryo, sans-serif',
  }),
  Object.freeze({
    path: "packages/ui/src/styles.css",
    rule: "korean-font-stack",
    source: '--font-ui-ko: "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif',
  }),
  Object.freeze({
    path: "packages/ui/src/styles.css",
    rule: "simplified-chinese-font-stack",
    source: "--font-ui-zh-hans:",
  }),
  Object.freeze({
    path: "packages/ui/src/styles.css",
    rule: "traditional-chinese-font-stack",
    source: "--font-ui-zh-hant:",
  }),
  Object.freeze({
    path: "packages/ui/src/styles.css",
    rule: "devanagari-font-stack",
    source: "--font-ui-devanagari:",
  }),
  Object.freeze({
    path: "packages/ui/src/styles.css",
    rule: "cjk-strict-line-breaking",
    source: "line-break: strict",
  }),
  Object.freeze({
    path: "packages/ui/src/styles.css",
    rule: "devanagari-shaping",
    source: "font-variant-ligatures: common-ligatures contextual",
  }),
  Object.freeze({
    path: "packages/ui/src/primitives.tsx",
    rule: "input-preserves-unicode",
    source: "onValueChange?.(event.currentTarget.value);",
  }),
  Object.freeze({
    path: "packages/ui/examples/preview.tsx",
    rule: "japanese-input-fixture",
    source: 'id={createUiControlId("preview-japanese-name")}',
  }),
  Object.freeze({
    path: "packages/ui/examples/preview.tsx",
    rule: "devanagari-input-fixture",
    source: 'id={createUiControlId("preview-hindi-name")}',
  }),
  Object.freeze({
    path: "packages/ui/examples/preview.tsx",
    rule: "locale-date-fixture",
    source: 'id={createUiControlId("preview-hindi-date")}',
  }),
  Object.freeze({
    path: "packages/ui/test/controlled-preview.tsx",
    rule: "controlled-composition-fixture",
    source: "onValueChange={setValue}",
  }),
  Object.freeze({
    path: "packages/ui/test/serve-preview.ts",
    rule: "production-web-style-fixture",
    source: "../../../apps/web/app/styles.css",
  }),
] as const);

const lineForIndex = (source: string, index: number): number =>
  source.slice(0, index).split("\n").length;

export const auditWritingSystemPolicy = (
  files: readonly WritingSystemPolicyFile[],
): readonly WritingSystemPolicyFinding[] => {
  const findings: WritingSystemPolicyFinding[] = [];
  const byPath = new Map(files.map((file) => [file.path, file]));

  for (const file of files) {
    if (!productionStylePattern.test(file.path)) continue;
    const unsafeLineBreak = unsafeLineBreakingPattern.exec(file.source);
    if (unsafeLineBreak !== null) {
      findings.push({
        location: `${file.path}:${lineForIndex(file.source, unsafeLineBreak.index)}`,
        rule: "unsafe-grapheme-line-breaking",
      });
    }
  }

  for (const contract of requiredContracts) {
    const file = byPath.get(contract.path);
    if (file === undefined || !file.source.includes(contract.source)) {
      findings.push({ location: contract.path, rule: contract.rule });
    }
  }

  return findings.sort((left, right) =>
    `${left.location}:${left.rule}`.localeCompare(`${right.location}:${right.rule}`),
  );
};
