export type RtlPolicyFile = Readonly<{
  path: string;
  source: string;
}>;

export type RtlPolicyFinding = Readonly<{
  location: string;
  rule: string;
}>;

const bidiControlPattern = /[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/u;
const physicalDirectionalCssPattern =
  /(?:^|[;{\n]\s*)(?:(?:margin|padding|border(?:-(?:color|style|width))?)-(?:left|right)|left|right)\s*:/mu;
const productionSourcePattern = /^(?:apps\/web\/app|content|packages\/(?:i18n|ui)\/src)\//u;

const requiredContracts = Object.freeze([
  Object.freeze({
    path: "packages/ui/src/styles.css",
    rule: "directional-icon-mirroring",
    source: ":where(.rvt-icon--back, .rvt-icon--forward):dir(rtl)",
  }),
  Object.freeze({
    path: "packages/ui/src/primitives.tsx",
    rule: "user-input-auto-direction",
    source: 'dir = "auto"',
  }),
  Object.freeze({
    path: "apps/web/app/styles.css",
    rule: "chart-fixed-direction",
    source: ".astrology-wheel",
  }),
  Object.freeze({
    path: "apps/web/app/styles.css",
    rule: "chart-fixed-direction",
    source: "direction: ltr",
  }),
  Object.freeze({
    path: "apps/web/app/_components/numerology-calculator.tsx",
    rule: "technical-value-isolation",
    source: '<code dir="ltr">',
  }),
  Object.freeze({
    path: "apps/web/app/_components/sanctuary-flow.tsx",
    rule: "technical-value-isolation",
    source: '<bdi dir="auto">',
  }),
  Object.freeze({
    path: "apps/web/app/_components/revisit-experience.tsx",
    rule: "technical-value-isolation",
    source: 'dir="ltr"',
  }),
] as const);

const lineForIndex = (source: string, index: number): number =>
  source.slice(0, index).split("\n").length;

export const auditRtlPolicy = (files: readonly RtlPolicyFile[]): readonly RtlPolicyFinding[] => {
  const findings: RtlPolicyFinding[] = [];
  const byPath = new Map(files.map((file) => [file.path, file]));

  for (const file of files) {
    if (!productionSourcePattern.test(file.path)) continue;
    const bidiMatch = bidiControlPattern.exec(file.source);
    if (bidiMatch !== null) {
      findings.push({
        location: `${file.path}:${lineForIndex(file.source, bidiMatch.index)}`,
        rule: "bidi-control-character",
      });
    }
    if (file.path.endsWith(".css")) {
      const physicalMatch = physicalDirectionalCssPattern.exec(file.source);
      if (physicalMatch !== null) {
        findings.push({
          location: `${file.path}:${lineForIndex(file.source, physicalMatch.index)}`,
          rule: "physical-directional-css",
        });
      }
    }
    if (
      file.path !== "packages/i18n/src/pseudolocale.ts" &&
      (file.source.includes("@rituvia/i18n/testing") ||
        file.source.includes("pseudoLocalizeIcuMessage") ||
        file.source.includes("pseudoLocalizeText"))
    ) {
      findings.push({ location: file.path, rule: "test-pseudolocale-production-import" });
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
