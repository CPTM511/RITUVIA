export type AccessibilityArtifactDescriptor = Readonly<{
  contentType: string;
  relativePath: string;
  type: "document" | "icon" | "static";
}>;

export type AxeAuditResult = Readonly<{
  incomplete: readonly Readonly<{
    id: string;
    impact: string | null;
    nodes: readonly Readonly<{ target: readonly string[] }>[];
  }>[];
  violations: readonly Readonly<{ id: string; impact: string | null }>[];
}>;

export type AccessibilityFinding = Readonly<{
  id: string;
  impact: string | null;
  state: "incomplete" | "violation";
}>;

export const accessibilityAxeTags: readonly string[];
export const accessibilitySmokeRoutes: readonly string[];

export function resolveAccessibilityArtifactRequest(
  rawUrl: string,
): AccessibilityArtifactDescriptor | null;

export function pseudoLocalizeText(value: string, direction?: "ltr" | "rtl"): string;

export function auditAxeResult(
  result: AxeAuditResult,
  reviewedIncompleteTargets?: readonly (readonly string[])[],
): readonly AccessibilityFinding[];

export function countReviewedAxeIncompleteNodes(
  result: AxeAuditResult,
  reviewedIncompleteTargets?: readonly (readonly string[])[],
): number;
