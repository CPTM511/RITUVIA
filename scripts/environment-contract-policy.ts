export type EnvironmentContractFinding = Readonly<{
  location: string;
  rule: string;
}>;

export type EnvironmentContractReferences = Readonly<{
  architecture: string;
  compiledManualBuilder: string;
  configurationSource: string;
  docsIndex: string;
  envExample: string;
  launchRunbook: string;
  packageJson: string;
  readme: string;
  seoSource: string;
  workflow: string;
}>;

const sectionTitles = [
  "## 1. Authority and current state",
  "## 2. Environment matrix",
  "## 3. Isolation and data flow",
  "## 4. Secrets and privileged access",
  "## 5. Indexing and public exposure",
  "## 6. Schema change, backup, and recovery",
  "## 7. Build, promotion, and deployment gates",
  "## 8. Evidence and current implementation state",
  "## 9. Rollback and emergency actions",
  "## 10. Owner approvals",
] as const;

const sectionRequirements = {
  "## 1. Authority and current state": Object.freeze([
    "`implemented`",
    "`verified rehearsal`",
    "`standing protected`",
    "`required before use`",
    "one `standing protected` Vercel custom Staging environment",
    "RIT-016",
  ]),
  "## 2. Environment matrix": Object.freeze([
    "| Local       | `local`      | `implemented`",
    "| Preview     | `preview`    | `required before use`",
    "| Staging     | `staging`    | `standing protected`",
    "| Production  | `production` | `required before use`",
    "Preview cannot promote directly to production",
    "exact Git revision",
  ]),
  "## 3. Isolation and data flow": Object.freeze([
    "Production data MUST NOT",
    "Production secrets MUST NOT flow downward",
    "Cross-environment network access is denied by default",
    "| PostgreSQL              |",
    "| Redis/cache             |",
    "| Object storage          |",
    "| Encryption/signing keys |",
    "| Payment/crypto          |",
    "| AI                      |",
    "| Email/auth              |",
    "| Analytics/observability |",
  ]),
  "## 4. Secrets and privileged access": Object.freeze([
    "managed secret store",
    "`NEXT_PUBLIC_*` remains denied",
    "least privilege",
    "Rotation",
    "Break-glass",
    "revocation",
  ]),
  "## 5. Indexing and public exposure": Object.freeze([
    "Local, preview, and staging MUST emit `noindex, nofollow`",
    "disallow-all robots",
    "publish no sitemap",
    "`APP_ENV=production`",
    "approved HTTPS origin",
    "owner separately approves production deployment and indexing activation",
  ]),
  "## 6. Schema change, backup, and recovery": Object.freeze([
    "Preview may apply migrations only to disposable isolated databases",
    "Staging applies the exact candidate migration set",
    "Production migrations require",
    "Destructive migrations",
    "Backups are encrypted",
    "isolated target",
    "RIT-123",
  ]),
  "## 7. Build, promotion, and deployment gates": Object.freeze([
    "exact Git revision and clean source state",
    "`Quality`, `PostgreSQL integration`, and `Security scans`",
    "complete Corresponding Source",
    "environment-specific typed configuration validation",
    "open critical/high security findings: zero",
    "Production deployment and rollback that affect customers always require explicit owner approval",
  ]),
  "## 8. Evidence and current implementation state": Object.freeze([
    "`implemented` repository evidence",
    "`verified rehearsal` evidence",
    "`standing protected` evidence",
    "`required before use` and not currently claimed",
    "general per-PR Preview hosting and any Production hosting",
  ]),
  "## 9. Rollback and emergency actions": Object.freeze([
    "feature/provider/country kill switch",
    "read-only mode",
    "artifact rollback",
    "forward fix",
    "post-action review",
  ]),
  "## 10. Owner approvals": Object.freeze([
    "production hosting, deployment, rollback, DNS, domains, or indexing",
    "production secrets and provider credentials",
    "production migrations",
    "live payment, crypto, email, AI, analytics, country, locale, content, or age-policy activation",
    "must not execute these owner-gated production actions",
  ]),
} as const satisfies Readonly<Record<(typeof sectionTitles)[number], readonly string[]>>;

const add = (findings: EnvironmentContractFinding[], rule: string, location: string): void => {
  findings.push({ location, rule });
};

const count = (source: string, value: string): number => source.split(value).length - 1;

const sectionBody = (source: string, title: string): string | null => {
  const start = source.indexOf(title);
  if (start < 0) return null;
  const next = source.indexOf("\n## ", start + title.length);
  return source.slice(start, next < 0 ? source.length : next);
};

export const auditEnvironmentContractSource = (
  source: string,
): readonly EnvironmentContractFinding[] => {
  const findings: EnvironmentContractFinding[] = [];
  if (!source.startsWith("# Environment Isolation and Deployment Contract\n")) {
    add(findings, "title", "docs/21_ENVIRONMENT_CONTRACT.md");
  }
  for (const title of sectionTitles) {
    if (count(source, title) !== 1) {
      add(findings, "section", title);
      continue;
    }
    const body = sectionBody(source, title);
    for (const requirement of sectionRequirements[title]) {
      if (!body?.includes(requirement)) add(findings, "requirement", `${title}:${requirement}`);
    }
  }
  for (const forbidden of [
    "standing staging service exists",
    "production is deployed",
    "production indexing is active",
    "production secrets are configured",
  ]) {
    if (source.toLowerCase().includes(forbidden)) {
      add(findings, "unsupported-current-state", forbidden);
    }
  }
  return Object.freeze(findings);
};

const requiredReferenceTokens = Object.freeze({
  architecture: "[Environment contract](21_ENVIRONMENT_CONTRACT.md)",
  compiledManualBuilder: '"AI_GROWTH_ENGINE",\n        "ENVIRONMENT_CONTRACT",',
  configurationSource: '"local", "preview", "staging", "production"',
  docsIndex: "`21_ENVIRONMENT_CONTRACT.md`",
  envExample: "Allowed values: local, preview, staging, production.",
  launchRunbook: "[environment contract](21_ENVIRONMENT_CONTRACT.md)",
  packageJson:
    '"check:environment-contract": "node --import tsx scripts/verify-environment-contract.ts"',
  readme: "docs/21_ENVIRONMENT_CONTRACT.md",
  seoSource: 'deploymentEnvironment === "production"',
  workflow: "run: pnpm check:environment-contract",
});

export const auditEnvironmentContractReferences = (
  references: EnvironmentContractReferences,
): readonly EnvironmentContractFinding[] => {
  const findings: EnvironmentContractFinding[] = [];
  for (const [name, token] of Object.entries(requiredReferenceTokens)) {
    if (!references[name as keyof EnvironmentContractReferences].includes(token)) {
      add(findings, "reference", name);
    }
  }
  return Object.freeze(findings);
};
