import { createHash } from "node:crypto";

export type RecordPolicyFinding = Readonly<{ location: string; rule: string }>;

export type BacklogTask = Readonly<{
  dependencies: readonly string[];
  status: string;
}>;

export type TaskResultContext = Readonly<{
  backlog: Readonly<Record<string, BacklogTask>>;
  repositoryPaths: ReadonlySet<string>;
}>;

const idPatterns = Object.freeze({
  decision: /^records\/decisions\/(D-[0-9]{3})\.md$/,
  experiment: /^records\/experiments\/(EXP-[0-9]{3})\.md$/,
  incident: /^records\/incidents\/(INC-[0-9]{3})\.md$/,
  task: /^records\/tasks\/(RIT-[0-9]{3})\.md$/,
});
const recordPattern =
  /^records\/(?:decisions\/D|experiments\/EXP|incidents\/INC|tasks\/RIT)-[0-9]{3}\.md$/;
const controlOrBidi = /[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u;
const recordControlOrBidi = /[\u0000-\u0008\u000b-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u;
const remoteOrEmbeddedContent = /!\[|<(?:!|\?|\/?[A-Za-z])/u;
const plainPathPart = /^[A-Za-z0-9._-]+$/u;
const nextDynamicPathPart = /^\[[A-Za-z0-9_-]+\]$/u;
const nextRouteGroupPathPart = /^\([A-Za-z0-9_-]+\)$/u;
const grandfatheredDone = new Set([
  "RIT-000",
  "RIT-001",
  "RIT-002",
  "RIT-003",
  "RIT-005",
  "RIT-006",
  "RIT-007",
]);
const taskResultFields = Object.freeze([
  "schema_version",
  "run_id",
  "as_of",
  "repository_revision",
  "branch",
  "task_id",
  "status",
  "summary",
  "observed_evidence",
  "changes",
  "verification",
  "assumptions",
  "blockers",
  "risks",
  "owner_actions",
  "record_refs",
  "rollback_notes",
  "next_recommended_task",
]);

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const add = (findings: RecordPolicyFinding[], location: string, rule: string): void => {
  findings.push(Object.freeze({ location, rule }));
};

export const isSafeRepositoryPath = (value: unknown): value is string => {
  if (typeof value !== "string" || value.length < 1 || value.length > 240 || value.startsWith("/"))
    return false;
  if (
    value.includes("\\") ||
    controlOrBidi.test(value) ||
    /^[A-Za-z][A-Za-z0-9+.-]*:/u.test(value)
  ) {
    return false;
  }
  const parts = value.split("/");
  return parts.every(
    (part) =>
      part !== "." &&
      part !== ".." &&
      (plainPathPart.test(part) ||
        nextDynamicPathPart.test(part) ||
        nextRouteGroupPathPart.test(part)),
  );
};

export const parseBacklog = (source: string): Readonly<Record<string, BacklogTask>> => {
  const tasks: Record<string, BacklogTask> = {};
  for (const line of source.split("\n")) {
    const columns = line.split("|").map((column) => column.trim());
    const taskId = columns[1];
    if (typeof taskId !== "string" || !/^(?:RIT|OWN)-[0-9]{3}$/.test(taskId)) continue;
    const status = columns[4];
    const dependencyText = columns[6];
    if (typeof status !== "string" || typeof dependencyText !== "string") continue;
    const dependencies = ["None", "—", "-"].includes(dependencyText)
      ? []
      : dependencyText
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);
    tasks[taskId] = Object.freeze({ dependencies: Object.freeze(dependencies), status });
  }
  return Object.freeze(tasks);
};

const requiredSections: Readonly<Record<keyof typeof idPatterns, readonly string[]>> =
  Object.freeze({
    decision: Object.freeze([
      "Context",
      "Decision",
      "Alternatives considered",
      "Consequences",
      "Validation",
      "Rollout and rollback",
      "Sources and approvals",
    ]),
    experiment: Object.freeze([
      "Decision and hypothesis",
      "Variants and assignment",
      "Metrics",
      "Ethics and privacy",
      "Implementation and QA",
      "Results",
      "Decision",
    ]),
    incident: Object.freeze([
      "User/business impact",
      "Detection",
      "Evidence locations",
      "Timeline",
      "Root cause and contributing factors",
      "Response and recovery",
      "Privacy/security/legal assessment",
      "Corrective actions",
      "Lessons and control updates",
    ]),
    task: Object.freeze([
      "Outcome",
      "Scope",
      "Acceptance criteria",
      "Verification evidence",
      "Risks and rollback",
    ]),
  });

const recordId = (
  recordPath: string,
): Readonly<{ id: string; kind: keyof typeof idPatterns }> | undefined => {
  for (const [kind, pattern] of Object.entries(idPatterns) as [keyof typeof idPatterns, RegExp][]) {
    const match = pattern.exec(recordPath);
    if (match?.[1] !== undefined) return { id: match[1], kind };
  }
  return undefined;
};

const markdownSectionBody = (source: string, section: string): string => {
  const escaped = section.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return (
    new RegExp(`^## ${escaped}\\n+([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, "mu")
      .exec(source)?.[1]
      ?.trim() ?? ""
  );
};

const metadataValues = (source: string, label: string): readonly string[] => {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return Array.from(source.matchAll(new RegExp(`^- ${escaped}: (.*)$`, "gmu")), (match) =>
    (match[1] ?? "").trim(),
  );
};

const auditTextBounds = (
  value: unknown,
  location: string,
  findings: RecordPolicyFinding[],
  depth = 0,
): void => {
  if (depth > 8) {
    add(findings, location, "value-depth");
    return;
  }
  if (typeof value === "string") {
    if (value.length === 0 || value.length > 4000 || controlOrBidi.test(value)) {
      add(findings, location, "unsafe-text");
    }
    return;
  }
  if (Array.isArray(value)) {
    if (value.length > 200) add(findings, location, "array-bound");
    value.forEach((item, index) =>
      auditTextBounds(item, `${location}[${index}]`, findings, depth + 1),
    );
    return;
  }
  if (isObject(value)) {
    if (Object.keys(value).length > 30) add(findings, location, "object-bound");
    for (const [key, item] of Object.entries(value)) {
      auditTextBounds(item, `${location}.${key}`, findings, depth + 1);
    }
  }
};

const stringArray = (value: unknown): readonly string[] | undefined =>
  Array.isArray(value) && value.every((item) => typeof item === "string") ? value : undefined;

const exactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean =>
  Object.keys(value).sort().join("|") === [...keys].sort().join("|");

const validDateTime = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length <= 40 &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
  !Number.isNaN(Date.parse(value));

export const auditTaskResult = (
  value: unknown,
  context: TaskResultContext,
): readonly RecordPolicyFinding[] => {
  const findings: RecordPolicyFinding[] = [];
  const location = "task-result";
  if (!isObject(value)) return [{ location, rule: "root-shape" }];
  auditTextBounds(value, location, findings);

  if (Object.keys(value).sort().join("|") !== [...taskResultFields].sort().join("|")) {
    add(findings, location, "root-fields");
  }
  if (value.schema_version !== 1) add(findings, `${location}.schema_version`, "schema-version");
  if (
    typeof value.run_id !== "string" ||
    !/^run-[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(value.run_id)
  ) {
    add(findings, `${location}.run_id`, "trace-id");
  }
  if (typeof value.as_of !== "string" || value.as_of.length > 40 || !validDateTime(value.as_of)) {
    add(findings, `${location}.as_of`, "trace-time");
  }
  if (
    typeof value.repository_revision !== "string" ||
    !/^(?:[0-9a-f]{40}|WORKTREE)$/.test(value.repository_revision)
  ) {
    add(findings, `${location}.repository_revision`, "trace-revision");
  }
  if (
    value.branch !== null &&
    (typeof value.branch !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9._/-]{0,159}$/.test(value.branch) ||
      !isSafeRepositoryPath(value.branch))
  ) {
    add(findings, `${location}.branch`, "trace-branch");
  }
  const taskId = value.task_id;
  if (taskId !== null && (typeof taskId !== "string" || !/^RIT-[0-9]{3}$/.test(taskId))) {
    add(findings, `${location}.task_id`, "task-id");
  }
  const status = value.status;
  if (
    !new Set(["completed", "partial", "blocked", "review_only", "no_change"]).has(status as string)
  ) {
    add(findings, `${location}.status`, "status");
  }
  if (typeof value.summary !== "string" || typeof value.rollback_notes !== "string") {
    add(findings, location, "required-text");
  }

  const changes = Array.isArray(value.changes) ? value.changes : undefined;
  if (changes === undefined || changes.length > 200)
    add(findings, `${location}.changes`, "array-shape");
  for (const [index, change] of (changes ?? []).entries()) {
    if (
      !isObject(change) ||
      !exactKeys(change, ["path", "description"]) ||
      !isSafeRepositoryPath(change.path) ||
      typeof change.description !== "string" ||
      change.description.length > 1000
    ) {
      add(findings, `${location}.changes[${index}]`, "change-shape-or-path");
    }
  }
  const observed = Array.isArray(value.observed_evidence) ? value.observed_evidence : undefined;
  if (observed === undefined || observed.length > 100)
    add(findings, `${location}.observed_evidence`, "array-shape");
  for (const [index, item] of (observed ?? []).entries()) {
    if (!isObject(item)) {
      add(findings, `${location}.observed_evidence[${index}]`, "evidence-shape");
      continue;
    }
    const source = item.source;
    const safeOpaque =
      typeof source === "string" && /^evidence:[A-Za-z0-9._:-]{1,120}$/.test(source);
    const safeTracked = isSafeRepositoryPath(source) && context.repositoryPaths.has(source);
    if (
      !exactKeys(item, ["claim", "source", "as_of", "confidence"]) ||
      typeof item.claim !== "string" ||
      item.claim.length > 1000 ||
      !["high", "medium", "low"].includes(String(item.confidence)) ||
      !(safeOpaque || safeTracked) ||
      !(item.as_of === null || validDateTime(item.as_of))
    ) {
      add(findings, `${location}.observed_evidence[${index}]`, "evidence-shape-or-source");
    }
  }
  const verification = Array.isArray(value.verification) ? value.verification : undefined;
  if (verification === undefined || verification.length > 100)
    add(findings, `${location}.verification`, "array-shape");
  for (const [index, item] of (verification ?? []).entries()) {
    if (
      !isObject(item) ||
      !exactKeys(item, ["check", "result", "details"]) ||
      typeof item.check !== "string" ||
      item.check.length > 240 ||
      typeof item.details !== "string" ||
      item.details.length > 2000 ||
      !["passed", "failed", "not_run", "not_applicable"].includes(String(item.result))
    ) {
      add(findings, `${location}.verification[${index}]`, "verification-shape");
    } else if (item.result === "not_applicable" && item.details.trim().length < 8) {
      add(findings, `${location}.verification[${index}]`, "not-applicable-reason");
    }
  }
  for (const field of ["assumptions", "blockers", "risks", "owner_actions"] as const) {
    if (!Array.isArray(value[field])) add(findings, `${location}.${field}`, "array-shape");
  }
  if (
    Array.isArray(value.assumptions) &&
    (value.assumptions.length > 100 ||
      value.assumptions.some((item) => typeof item !== "string" || item.length > 1000))
  ) {
    add(findings, `${location}.assumptions`, "assumption-shape");
  }
  if (
    Array.isArray(value.blockers) &&
    (value.blockers.length > 50 ||
      value.blockers.some(
        (item) =>
          !isObject(item) ||
          !exactKeys(item, ["description", "evidence_needed"]) ||
          typeof item.description !== "string" ||
          item.description.length > 1000 ||
          typeof item.evidence_needed !== "string" ||
          item.evidence_needed.length > 1000,
      ))
  ) {
    add(findings, `${location}.blockers`, "blocker-shape");
  }
  if (
    Array.isArray(value.risks) &&
    (value.risks.length > 100 ||
      value.risks.some(
        (item) =>
          !isObject(item) ||
          !exactKeys(item, ["severity", "status", "description", "mitigation"]) ||
          !["critical", "high", "medium", "low"].includes(String(item.severity)) ||
          !["open", "mitigated"].includes(String(item.status)) ||
          typeof item.description !== "string" ||
          item.description.length > 1000 ||
          typeof item.mitigation !== "string" ||
          item.mitigation.length > 1000,
      ))
  ) {
    add(findings, `${location}.risks`, "risk-shape");
  }
  if (
    Array.isArray(value.owner_actions) &&
    (value.owner_actions.length > 50 ||
      value.owner_actions.some(
        (item) =>
          !isObject(item) ||
          !exactKeys(item, ["action", "blocking", "evidence_needed"]) ||
          typeof item.action !== "string" ||
          item.action.length > 1000 ||
          typeof item.blocking !== "boolean" ||
          typeof item.evidence_needed !== "string" ||
          item.evidence_needed.length > 1000,
      ))
  ) {
    add(findings, `${location}.owner_actions`, "owner-action-shape");
  }

  const refs = value.record_refs;
  if (!isObject(refs)) {
    add(findings, `${location}.record_refs`, "record-refs-shape");
  } else {
    if (!exactKeys(refs, ["task", "decisions", "incidents", "experiments"])) {
      add(findings, `${location}.record_refs`, "record-refs-fields");
    }
    const expectedTask = typeof taskId === "string" ? `records/tasks/${taskId}.md` : null;
    if (
      refs.task !== expectedTask ||
      (typeof refs.task === "string" && !context.repositoryPaths.has(refs.task))
    ) {
      add(findings, `${location}.record_refs.task`, "task-record-match");
    }
    for (const [field, pattern] of [
      ["decisions", idPatterns.decision],
      ["incidents", idPatterns.incident],
      ["experiments", idPatterns.experiment],
    ] as const) {
      const items = stringArray(refs[field]);
      if (
        items === undefined ||
        items.length > 50 ||
        new Set(items).size !== items.length ||
        items.some((item) => !pattern.test(item) || !context.repositoryPaths.has(item))
      ) {
        add(findings, `${location}.record_refs.${field}`, "typed-record-refs");
      }
    }
  }

  const task = typeof taskId === "string" ? context.backlog[taskId] : undefined;
  if (typeof taskId === "string" && task === undefined)
    add(findings, `${location}.task_id`, "unknown-task");
  if (status === "completed") {
    if (task === undefined || task.status !== "Done")
      add(findings, `${location}.status`, "completed-canonical-state");
    if (
      !(verification ?? []).some((item) => isObject(item) && item.result === "passed") ||
      (verification ?? []).some(
        (item) => isObject(item) && ["failed", "not_run"].includes(String(item.result)),
      )
    ) {
      add(findings, `${location}.verification`, "completed-verification");
    }
    if (Array.isArray(value.blockers) && value.blockers.length > 0)
      add(findings, `${location}.blockers`, "completed-blockers");
    if (
      Array.isArray(value.owner_actions) &&
      value.owner_actions.some((item) => isObject(item) && item.blocking === true)
    ) {
      add(findings, `${location}.owner_actions`, "completed-owner-action");
    }
    if (
      Array.isArray(value.risks) &&
      value.risks.some(
        (item) =>
          isObject(item) &&
          ["critical", "high"].includes(String(item.severity)) &&
          item.status !== "mitigated",
      )
    ) {
      add(findings, `${location}.risks`, "completed-unmitigated-risk");
    }
    if (
      task !== undefined &&
      task.dependencies.some((dependency) => context.backlog[dependency]?.status !== "Done")
    ) {
      add(findings, `${location}.task_id`, "completed-dependency");
    }
  }
  if (status === "blocked" && (!Array.isArray(value.blockers) || value.blockers.length === 0)) {
    add(findings, `${location}.blockers`, "blocked-without-blocker");
  }
  if (["review_only", "no_change"].includes(String(status)) && (changes ?? []).length > 0) {
    add(findings, `${location}.changes`, "non-mutating-status-change");
  }
  const next = value.next_recommended_task;
  if (
    next !== null &&
    (typeof next !== "string" ||
      !/^(?:RIT|OWN)-[0-9]{3}$/.test(next) ||
      context.backlog[next] === undefined)
  ) {
    add(findings, `${location}.next_recommended_task`, "unknown-next-task");
  } else if (
    typeof next === "string" &&
    next.startsWith("RIT-") &&
    context.backlog[next]?.status !== "Ready"
  ) {
    add(findings, `${location}.next_recommended_task`, "next-task-not-ready");
  }
  return Object.freeze(findings);
};

export const auditTaskResultSchema = (value: unknown): readonly RecordPolicyFinding[] => {
  const findings: RecordPolicyFinding[] = [];
  const location = "automation/schemas/task-result.schema.json";
  if (!isObject(value)) return [{ location, rule: "schema-root" }];
  if (
    createHash("sha256").update(JSON.stringify(value)).digest("hex") !==
    "ca63c014541ab74aef99f4cec7b8379214fd2dc2a605f3cbc13498610e2eac07"
  ) {
    add(findings, location, "schema-fingerprint");
  }
  const properties = value.properties;
  const required = stringArray(value.required);
  if (
    value.$schema !== "https://json-schema.org/draft/2020-12/schema" ||
    value.type !== "object" ||
    value.additionalProperties !== false ||
    !isObject(properties) ||
    required === undefined ||
    [...required].sort().join("|") !== [...taskResultFields].sort().join("|") ||
    Object.keys(properties).sort().join("|") !== [...taskResultFields].sort().join("|")
  ) {
    add(findings, location, "schema-root-contract");
    if (!isObject(properties)) return Object.freeze(findings);
  }
  if (!isObject(properties)) return Object.freeze(findings);
  if (!isObject(properties.schema_version) || properties.schema_version.const !== 1) {
    add(findings, location, "schema-version-contract");
  }
  if (!isObject(properties.task_id) || properties.task_id.pattern !== "^RIT-[0-9]{3}$") {
    add(findings, location, "schema-task-pattern");
  }
  if (
    !isObject(properties.next_recommended_task) ||
    properties.next_recommended_task.pattern !== "^(?:RIT|OWN)-[0-9]{3}$"
  ) {
    add(findings, location, "schema-next-pattern");
  }
  const refs = properties.record_refs;
  const refProperties = isObject(refs) ? refs.properties : undefined;
  const expectedRefFields = ["task", "decisions", "incidents", "experiments"];
  if (
    !isObject(refs) ||
    refs.type !== "object" ||
    refs.additionalProperties !== false ||
    [...(stringArray(refs.required) ?? [])].sort().join("|") !==
      expectedRefFields.sort().join("|") ||
    !isObject(refProperties) ||
    Object.keys(refProperties).sort().join("|") !== expectedRefFields.sort().join("|")
  ) {
    add(findings, location, "schema-record-refs-contract");
  } else {
    const patterns = {
      task: "^records/tasks/RIT-[0-9]{3}\\.md$",
      decisions: "^records/decisions/D-[0-9]{3}\\.md$",
      incidents: "^records/incidents/INC-[0-9]{3}\\.md$",
      experiments: "^records/experiments/EXP-[0-9]{3}\\.md$",
    } as const;
    if (!isObject(refProperties.task) || refProperties.task.pattern !== patterns.task) {
      add(findings, location, "schema-task-ref-pattern");
    }
    for (const field of ["decisions", "incidents", "experiments"] as const) {
      const definition = refProperties[field];
      if (
        !isObject(definition) ||
        definition.type !== "array" ||
        definition.maxItems !== 50 ||
        definition.uniqueItems !== true ||
        !isObject(definition.items) ||
        definition.items.pattern !== patterns[field]
      ) {
        add(findings, location, `schema-${field}-refs`);
      }
    }
  }
  const risks = properties.risks;
  const riskStatus =
    isObject(risks) && isObject(risks.items) && isObject(risks.items.properties)
      ? risks.items.properties.status
      : undefined;
  if (
    !isObject(riskStatus) ||
    [...(stringArray(riskStatus.enum) ?? [])].sort().join("|") !== "mitigated|open"
  ) {
    add(findings, location, "schema-risk-status");
  }
  const allOf = Array.isArray(value.allOf) ? value.allOf : [];
  const completed = allOf.find((item) => {
    if (!isObject(item) || !isObject(item.if) || !isObject(item.if.properties)) return false;
    const status = item.if.properties.status;
    return isObject(status) && status.const === "completed";
  });
  const completedThen =
    isObject(completed) && isObject(completed.then) && isObject(completed.then.properties)
      ? completed.then.properties
      : undefined;
  const completedVerification = isObject(completedThen) ? completedThen.verification : undefined;
  const completedBlockers = isObject(completedThen) ? completedThen.blockers : undefined;
  const completedOwnerActions = isObject(completedThen) ? completedThen.owner_actions : undefined;
  const completedRisks = isObject(completedThen) ? completedThen.risks : undefined;
  if (
    !isObject(completedThen) ||
    !isObject(completedThen.task_id) ||
    completedThen.task_id.type !== "string" ||
    !isObject(completedVerification) ||
    completedVerification.minItems !== 1 ||
    completedVerification.minContains !== 1 ||
    !isObject(completedVerification.contains) ||
    !isObject(completedVerification.contains.properties) ||
    !isObject(completedVerification.contains.properties.result) ||
    completedVerification.contains.properties.result.const !== "passed" ||
    !isObject(completedBlockers) ||
    completedBlockers.maxItems !== 0 ||
    !isObject(completedOwnerActions) ||
    !isObject(completedRisks)
  ) {
    add(findings, location, "schema-completed-contract");
  }
  const taskRefConditional = allOf.find((item) => {
    if (!isObject(item) || !isObject(item.if) || !isObject(item.if.properties)) return false;
    const taskId = item.if.properties.task_id;
    return isObject(taskId) && taskId.type === "string";
  });
  const conditionalText = JSON.stringify(taskRefConditional ?? null);
  if (
    !conditionalText.includes('"record_refs":{"properties":{"task":{"type":"string"}}}') ||
    !conditionalText.includes(
      '"else":{"properties":{"record_refs":{"properties":{"task":{"type":"null"}}}}}',
    )
  ) {
    add(findings, location, "schema-task-ref-conditional");
  }
  for (const [field, maximum] of [
    ["observed_evidence", 100],
    ["changes", 200],
    ["verification", 100],
    ["assumptions", 100],
    ["blockers", 50],
    ["risks", 100],
    ["owner_actions", 50],
  ] as const) {
    const definition = properties[field];
    if (!isObject(definition) || definition.type !== "array" || definition.maxItems !== maximum) {
      add(findings, location, `schema-bound:${field}`);
    }
  }
  return Object.freeze(findings);
};

export const auditAutomationPromptContracts = (
  prompts: Readonly<Record<string, string>>,
): readonly RecordPolicyFinding[] => {
  const findings: RecordPolicyFinding[] = [];
  const expected = [
    "continue-next-task.md",
    "daily-maintenance.md",
    "monthly-risk-audit.md",
    "release-readiness.md",
    "weekly-product-review.md",
  ];
  if (Object.keys(prompts).sort().join("|") !== expected.sort().join("|")) {
    add(findings, "automation/prompts", "prompt-set");
  }
  for (const name of expected) {
    const source = prompts[name] ?? "";
    for (const token of [
      "automation/schemas/task-result.schema.json",
      "record_refs.task",
      "BACKLOG.md",
      "owner gate",
    ]) {
      if (!source.includes(token))
        add(findings, `automation/prompts/${name}`, `prompt-contract:${token}`);
    }
    const specializedTokens =
      name === "continue-next-task.md"
        ? ["records/tasks/RIT-NNN.md", "selected RIT ID"]
        : ["task_id: null", "record_refs.task: null", "status: review_only"];
    for (const token of specializedTokens) {
      if (!source.includes(token))
        add(findings, `automation/prompts/${name}`, `prompt-contract:${token}`);
    }
  }
  return Object.freeze(findings);
};

export const auditAutomationScheduleContract = (
  value: unknown,
  repositoryPaths: ReadonlySet<string>,
  runnerSource: string,
): readonly RecordPolicyFinding[] => {
  const findings: RecordPolicyFinding[] = [];
  const location = "automation/rituvia-recurring-reviews.json";
  const expected = [
    [
      "rituvia-daily-maintenance",
      "RITUVIA daily maintenance",
      "daily",
      null,
      "08:30",
      "daily-maintenance.md",
    ],
    [
      "rituvia-weekly-product-review",
      "RITUVIA weekly product review",
      "weekly",
      "monday",
      "09:30",
      "weekly-product-review.md",
    ],
    [
      "rituvia-monthly-risk-audit",
      "RITUVIA monthly risk audit",
      "monthly",
      "1",
      "10:30",
      "monthly-risk-audit.md",
    ],
  ] as const;
  const topKeys = ["automations", "project_path", "schema_version", "time_zone"];
  if (
    !isObject(value) ||
    JSON.stringify(Object.keys(value).sort()) !== JSON.stringify(topKeys) ||
    value.schema_version !== 1 ||
    value.time_zone !== "Asia/Shanghai" ||
    value.project_path !== "." ||
    !Array.isArray(value.automations) ||
    value.automations.length !== expected.length
  ) {
    add(findings, location, "schedule-contract");
    return Object.freeze(findings);
  }

  const entryKeys = [
    "access",
    "cadence",
    "day",
    "destination",
    "execution_environment",
    "id",
    "kind",
    "local_time",
    "model",
    "name",
    "notification_policy",
    "prompt_path",
    "reasoning_effort",
    "result_schema",
    "runner_path",
    "status",
  ];
  for (const [index, entry] of value.automations.entries()) {
    const [id, name, cadence, day, localTime, promptName] = expected[index]!;
    const promptPath = `automation/prompts/${promptName}`;
    if (
      !isObject(entry) ||
      JSON.stringify(Object.keys(entry).sort()) !== JSON.stringify(entryKeys) ||
      entry.id !== id ||
      entry.name !== name ||
      entry.status !== "PAUSED" ||
      entry.kind !== "cron" ||
      entry.model !== "gpt-5.6-terra" ||
      entry.reasoning_effort !== "high" ||
      entry.cadence !== cadence ||
      entry.day !== day ||
      entry.local_time !== localTime ||
      entry.runner_path !== "automation/scheduled-read-only-runner.md" ||
      entry.prompt_path !== promptPath ||
      entry.result_schema !== "automation/schemas/task-result.schema.json" ||
      entry.execution_environment !== "local" ||
      entry.destination !== "local" ||
      entry.notification_policy !== "failed_runs_only" ||
      entry.access !== "prompt_enforced_read_only"
    ) {
      add(findings, `${location}.automations[${index}]`, "schedule-contract");
      continue;
    }
    for (const referencedPath of [entry.runner_path, promptPath, entry.result_schema]) {
      if (!repositoryPaths.has(referencedPath)) {
        add(findings, `${location}.automations[${index}]`, "schedule-reference");
      }
    }
  }
  for (const token of [
    "git status --porcelain",
    "Do not modify",
    "BACKLOG.md",
    "DECISIONS.md",
    "owner gate",
    "production",
    "private product content",
    "paid APIs",
    "network",
    "automation/schemas/task-result.schema.json",
  ]) {
    if (!runnerSource.includes(token)) add(findings, location, `runner-contract:${token}`);
  }
  return Object.freeze(findings);
};

export const auditRecordSet = (
  files: Readonly<Record<string, string>>,
  backlogSource: string,
  decisionsSource: string,
  contributingSource: string,
): readonly RecordPolicyFinding[] => {
  const findings: RecordPolicyFinding[] = [];
  const backlog = parseBacklog(backlogSource);
  const ids = new Map<string, string>();
  const decisionIds = new Set<string>();
  const decisionLinks = new Map<string, string | undefined>();
  const supersedes = new Map<string, string>();
  const paths = Object.keys(files)
    .filter((entry) => recordPattern.test(entry))
    .sort();

  const registerHeadings = Array.from(
    decisionsSource.matchAll(/^### (?:\[(D-[0-9]{3})[^\]]*\]\(([^)]+)\)|(D-[0-9]{3})\b.*)$/gmu),
  );
  for (const [index, match] of registerHeadings.entries()) {
    const id = match[1] ?? match[3];
    if (id === undefined) continue;
    if (decisionIds.has(id)) add(findings, "DECISIONS.md", "duplicate-decision-id");
    decisionIds.add(id);
    decisionLinks.set(id, match[2]);
    const start = (match.index ?? 0) + match[0].length;
    const end = registerHeadings[index + 1]?.index ?? decisionsSource.length;
    const segment = decisionsSource.slice(start, end);
    const target = /^- \*\*Supersedes:\*\* (D-[0-9]{3})\b/mu.exec(segment)?.[1];
    if (target !== undefined) supersedes.set(id, target);
  }

  for (const recordPath of Object.keys(files).filter((entry) => !recordPattern.test(entry))) {
    add(findings, recordPath, "unexpected-record-path");
  }

  for (const recordPath of paths) {
    const descriptor = recordId(recordPath);
    if (descriptor === undefined) {
      add(findings, recordPath, "record-path");
      continue;
    }
    const previous = ids.get(descriptor.id);
    if (previous !== undefined) add(findings, recordPath, "duplicate-record-id");
    ids.set(descriptor.id, recordPath);
    const source = files[recordPath] ?? "";
    if (source.length === 0 || source.length > 65_536) add(findings, recordPath, "record-size");
    if (!source.startsWith(`# ${descriptor.id}: `) || /<[^>]+>/.test(source)) {
      add(findings, recordPath, "record-heading-or-placeholder");
    }
    if (recordControlOrBidi.test(source) || remoteOrEmbeddedContent.test(source)) {
      add(findings, recordPath, "unsafe-record-content");
    }
    for (const section of requiredSections[descriptor.kind]) {
      const escaped = section.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
      if (!new RegExp(`^## ${escaped}$`, "mu").test(source))
        add(findings, recordPath, `missing-section:${section}`);
    }
    if (descriptor.kind === "task") {
      if (backlog[descriptor.id] === undefined) add(findings, recordPath, "orphan-task-record");
      if (!source.includes(`- Backlog item: ${descriptor.id}`))
        add(findings, recordPath, "task-backlog-link");
      if (
        /^- (?:Priority|Status|Milestone|Dependencies|Owner gates|Primary role):/imu.test(source)
      ) {
        add(findings, recordPath, "duplicated-backlog-field");
      }
      if (backlog[descriptor.id]?.status === "Done") {
        const acceptance = markdownSectionBody(source, "Acceptance criteria");
        const verification = markdownSectionBody(source, "Verification evidence");
        const rollback = markdownSectionBody(source, "Risks and rollback");
        if (
          !/^\s*[-*+] \[[xX]\] /mu.test(acceptance) ||
          /^\s*[-*+] \[(?: |~)\] /mu.test(acceptance)
        ) {
          add(findings, recordPath, "done-task-acceptance");
        }
        if (verification.length === 0) add(findings, recordPath, "done-task-verification");
        if (rollback.length === 0) add(findings, recordPath, "done-task-rollback");
      }
    }
    if (descriptor.kind === "decision") {
      if (/^- (?:Status|Supersedes):/mu.test(source))
        add(findings, recordPath, "duplicated-decision-field");
      if (!source.includes("- Evidence references:"))
        add(findings, recordPath, "decision-evidence-reference");
      if (decisionLinks.get(descriptor.id) !== `records/decisions/${descriptor.id}.md`)
        add(findings, recordPath, "decision-register-link");
    }
  }

  for (const recordPath of paths) {
    const descriptor = recordId(recordPath);
    if (descriptor === undefined) continue;
    const source = files[recordPath] ?? "";
    if (descriptor.kind === "task") {
      const related = /^- Related records: (.+)$/mu.exec(source)?.[1];
      if (related === undefined) {
        add(findings, recordPath, "related-records-metadata");
      } else if (related !== "None") {
        for (const linkedId of related.split(",").map((item) => item.trim())) {
          if (!/^(?:D|INC|EXP)-[0-9]{3}$/.test(linkedId) || !ids.has(linkedId))
            add(findings, recordPath, "dangling-related-record");
          const linkedPath = ids.get(linkedId);
          if (
            linkedId.startsWith("D-") &&
            linkedPath !== undefined &&
            !(files[linkedPath] ?? "").match(
              new RegExp(`^- Related tasks: [^\\n]*\\b${descriptor.id}\\b`, "mu"),
            )
          ) {
            add(findings, recordPath, "nonreciprocal-decision-link");
          }
        }
      }
    }
    if (descriptor.kind === "decision") {
      const related = /^- Related tasks: (.+)$/mu.exec(source)?.[1];
      if (
        related === undefined ||
        related
          .split(",")
          .map((item) => item.trim())
          .some((item) => backlog[item] === undefined)
      ) {
        add(findings, recordPath, "dangling-related-task");
      } else {
        for (const taskId of related.split(",").map((item) => item.trim())) {
          const taskPath = ids.get(taskId);
          if (
            taskPath !== undefined &&
            !(files[taskPath] ?? "").match(
              new RegExp(`^- Related records: [^\\n]*\\b${descriptor.id}\\b`, "mu"),
            )
          ) {
            add(findings, recordPath, "nonreciprocal-task-link");
          }
        }
      }
    }
    if (descriptor.kind === "incident" || descriptor.kind === "experiment") {
      const related = /^- Related tasks\/decisions: (.+)$/mu.exec(source)?.[1];
      const refs =
        related
          ?.split(",")
          .map((item) => item.trim())
          .filter(Boolean) ?? [];
      if (
        refs.length === 0 ||
        refs.some(
          (item) =>
            !/^(?:RIT|OWN|D)-[0-9]{3}$/.test(item) ||
            (item.startsWith("D-") ? !decisionIds.has(item) : backlog[item] === undefined),
        )
      ) {
        add(findings, recordPath, "dangling-event-reference");
      }
    }
    if (descriptor.kind === "incident") {
      for (const label of [
        "Severity",
        "Status",
        "Related tasks/decisions",
        "Start / detected / mitigated / resolved times",
        "Incident commander",
        "Affected environments/countries/features",
        "Closure review evidence",
        "Owner/counsel/notification decision evidence",
      ]) {
        if (metadataValues(source, label).length !== 1) {
          add(findings, recordPath, "duplicate-event-metadata");
        }
      }
      const severity = /^- Severity: (SEV-[0-3])$/mu.exec(source)?.[1];
      if (severity === undefined) add(findings, recordPath, "incident-severity");
      const status = /^- Status: (Investigating|Mitigated|Resolved|Closed)$/mu.exec(source)?.[1];
      if (status === undefined) add(findings, recordPath, "incident-status");
      for (const metadata of [
        "Start / detected / mitigated / resolved times",
        "Incident commander",
        "Affected environments/countries/features",
      ]) {
        const escaped = metadata.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
        const metadataValue = new RegExp(`^- ${escaped}: (.+)$`, "mu").exec(source)?.[1]?.trim();
        if (metadataValue === undefined || /^(?:None|TBD|N\/A|-)$/iu.test(metadataValue)) {
          add(findings, recordPath, "incident-required-metadata");
        }
      }
      for (const section of requiredSections.incident) {
        const body = markdownSectionBody(source, section);
        if (body.length === 0 || /^(?:None|TBD|N\/A|-)$/iu.test(body)) {
          add(findings, recordPath, "incident-empty-section");
        }
      }
      const correctiveRows = Array.from(
        source.matchAll(/^\| ((?:RIT|OWN)-[0-9]{3}) \| ([^|]*\S[^|]*) \|$/gmu),
      );
      if (["Resolved", "Closed"].includes(status ?? "") && correctiveRows.length === 0) {
        add(findings, recordPath, "resolved-incident-corrective-task");
      }
      for (const match of correctiveRows) {
        const taskId = match[1];
        if (taskId === undefined || backlog[taskId] === undefined)
          add(findings, recordPath, "dangling-corrective-task");
        if (status === "Closed" && taskId !== undefined && backlog[taskId]?.status !== "Done") {
          add(findings, recordPath, "closed-incident-open-action");
        }
      }
      if (["Resolved", "Closed"].includes(status ?? "")) {
        if (!/^- Closure review evidence: evidence:[A-Za-z0-9._:-]{1,120}$/mu.test(source)) {
          add(findings, recordPath, "incident-closure-evidence");
        }
        if (
          ["SEV-0", "SEV-1"].includes(severity ?? "") &&
          !/^- Owner\/counsel\/notification decision evidence: evidence:[A-Za-z0-9._:-]{1,120}$/mu.test(
            source,
          )
        ) {
          add(findings, recordPath, "severe-incident-decision-evidence");
        }
      }
    }
    if (descriptor.kind === "experiment") {
      for (const label of [
        "Status",
        "Owner",
        "Related tasks/decisions",
        "Required owner/qualified-reviewer gates",
        "Gate evidence references",
        "Qualified review task",
        "Qualified review evidence",
        "Population/countries/locales",
        "Start/end",
      ]) {
        if (metadataValues(source, label).length !== 1) {
          add(findings, recordPath, "duplicate-event-metadata");
        }
      }
      const status = /^- Status: (Draft|Approved|Running|Stopped|Concluded)$/mu.exec(source)?.[1];
      const requiredGates = /^- Required owner\/qualified-reviewer gates: (.+)$/mu.exec(
        source,
      )?.[1];
      const gateEvidence = /^- Gate evidence references: (.+)$/mu.exec(source)?.[1];
      const reviewTask = /^- Qualified review task: (RIT-[0-9]{3}|None)$/mu.exec(source)?.[1];
      const reviewEvidence =
        /^- Qualified review evidence: (evidence:[A-Za-z0-9._:-]{1,120}|None)$/mu.exec(source)?.[1];
      if (status === undefined) add(findings, recordPath, "experiment-status");
      const gateIds =
        requiredGates === undefined || requiredGates === "None"
          ? []
          : requiredGates.split(",").map((item) => item.trim());
      if (
        requiredGates === undefined ||
        gateIds.some((item) => !/^OWN-[0-9]{3}$/.test(item) || backlog[item] === undefined)
      ) {
        add(findings, recordPath, "experiment-required-gates");
      }
      const active = ["Approved", "Running", "Stopped", "Concluded"].includes(status ?? "");
      if (
        active &&
        ["Owner", "Population/countries/locales", "Start/end"].some((label) => {
          const value = metadataValues(source, label)[0];
          return value === undefined || value.length === 0 || /^(?:None|TBD|N\/A|-)$/iu.test(value);
        })
      ) {
        add(findings, recordPath, "experiment-required-metadata");
      }
      if (active) {
        for (const section of requiredSections.experiment) {
          const body = markdownSectionBody(source, section);
          if (body.length === 0 || /^(?:None|TBD|N\/A|-)$/iu.test(body)) {
            add(findings, recordPath, "experiment-empty-section");
          }
        }
        if (
          !/^- Primary metric: \S.+$/mu.test(source) ||
          !/^- Guardrails: \S.+$/mu.test(source) ||
          !/^- Stopping rule: \S.+$/mu.test(source) ||
          !/^- Rollback: \S.+$/mu.test(source) ||
          !/^- Cleanup date: \d{4}-\d{2}-\d{2}$/mu.test(source)
        ) {
          add(findings, recordPath, "experiment-design-contract");
        }
      }
      const related = /^- Related tasks\/decisions: (.+)$/mu.exec(source)?.[1] ?? "";
      const relatedRitIds = related
        .split(",")
        .map((item) => item.trim())
        .filter((item) => /^RIT-[0-9]{3}$/.test(item));
      const expectedGateIds =
        reviewTask === undefined || reviewTask === "None"
          ? []
          : (backlog[reviewTask]?.dependencies ?? []).filter((item) => item.startsWith("OWN-"));
      if (
        active &&
        (gateIds.length !== new Set(gateIds).size ||
          [...gateIds].sort().join("|") !== [...expectedGateIds].sort().join("|") ||
          gateIds.some((gateId) => backlog[gateId]?.status !== "Done"))
      ) {
        add(findings, recordPath, "experiment-gate-not-canonical");
      }
      if (
        active &&
        (gateEvidence === undefined || !/^evidence:[A-Za-z0-9._:-]{1,120}$/.test(gateEvidence))
      ) {
        add(findings, recordPath, "experiment-gate-evidence");
      }
      if (active) {
        const reviewPath =
          reviewTask === undefined || reviewTask === "None" ? undefined : ids.get(reviewTask);
        const reviewSource = reviewPath === undefined ? "" : (files[reviewPath] ?? "");
        if (
          reviewTask === undefined ||
          reviewTask === "None" ||
          reviewEvidence === undefined ||
          reviewEvidence === "None" ||
          !relatedRitIds.includes(reviewTask) ||
          backlog[reviewTask]?.status !== "Done" ||
          reviewPath === undefined ||
          !new RegExp(`^- Related records: [^\\n]*\\b${descriptor.id}\\b`, "mu").test(
            reviewSource,
          ) ||
          !reviewSource.includes(`- [x] Safety/privacy/cultural review complete: ${reviewEvidence}`)
        ) {
          add(findings, recordPath, "experiment-qualified-review");
        }
      }
    }
  }

  for (const origin of supersedes.keys()) {
    const target = supersedes.get(origin);
    if (target === undefined || !decisionIds.has(target) || target === origin) {
      add(findings, "DECISIONS.md", "invalid-supersedes");
    }
    const seen = new Set<string>();
    let current: string | undefined = origin;
    while (current !== undefined) {
      if (seen.has(current)) {
        add(findings, `records/decisions/${origin}.md`, "supersession-cycle");
        break;
      }
      seen.add(current);
      current = supersedes.get(current);
    }
  }

  for (const [taskId, task] of Object.entries(backlog)) {
    if (
      task.status === "Done" &&
      task.dependencies.some((dependency) => backlog[dependency]?.status !== "Done")
    ) {
      add(findings, `BACKLOG.md#${taskId}`, "done-task-incomplete-dependency");
    }
    if (
      taskId.startsWith("RIT-") &&
      ["In Progress", "In Review", "Changes Requested", "Done"].includes(task.status) &&
      !(task.status === "Done" && grandfatheredDone.has(taskId)) &&
      !paths.includes(`records/tasks/${taskId}.md`)
    ) {
      add(findings, `BACKLOG.md#${taskId}`, "missing-task-record");
    }
  }
  for (const token of [
    "BACKLOG.md",
    "DECISIONS.md",
    "records/INDEX.md",
    "task-result.schema.json",
    "sync_generated_evidence.py",
    "owner gate",
    "Git-indexed",
  ]) {
    if (!contributingSource.includes(token))
      add(findings, "CONTRIBUTING.md", `missing-contract:${token}`);
  }
  return Object.freeze(findings);
};
