export const configurationIssueCodes = [
  "invalid",
  "missing",
  "unexpected-public-variable",
] as const;

export type ConfigurationIssueCode = (typeof configurationIssueCodes)[number];

export type ConfigurationIssue = Readonly<{
  code: ConfigurationIssueCode;
  key: string;
}>;

export type ConfigurationScope = "brand" | "build" | "client" | "server";

export class ConfigurationError extends Error {
  readonly code = "CONFIG_VALIDATION_FAILED";
  readonly issues: readonly ConfigurationIssue[];
  readonly scope: ConfigurationScope;

  constructor(scope: ConfigurationScope, issues: readonly ConfigurationIssue[]) {
    const normalizedIssues = [...issues]
      .map((issue) => Object.freeze({ ...issue }))
      .sort((left, right) =>
        `${left.key}:${left.code}`.localeCompare(`${right.key}:${right.code}`),
      );

    super(
      `Invalid ${scope} configuration: ${normalizedIssues
        .map(({ code, key }) => `${key}:${code}`)
        .join(", ")}`,
    );

    this.name = "ConfigurationError";
    this.scope = scope;
    this.issues = Object.freeze(normalizedIssues);
  }
}
