const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

const countFields = Object.freeze(["readingGets", "readingStarts", "reports", "sessionStarts"]);

const expectedReadingBodyKeys = Object.freeze([
  "locale",
  "readingType",
  "schemaVersion",
  "themeCode",
]);

export const tarotBrowserAcceptanceScenarioIds = Object.freeze([
  "one-card-happy-report-resume",
  "three-card-happy-position-report",
  "one-card-offline-recovery",
  "three-card-service-retry",
  "one-card-limit-stop",
  "one-card-stale-resume",
]);

const compareStrings = (left, right) => (left < right ? -1 : left > right ? 1 : 0);

const freezeFindings = (findings) => Object.freeze(findings.sort(compareStrings));

const isPlainObject = (value) =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  Object.getPrototypeOf(value) === Object.prototype;

const ownDataEntries = (value) => {
  if (!isPlainObject(value)) return null;
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key !== "string")) return null;
  const entries = [];
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !descriptor.enumerable || !Object.hasOwn(descriptor, "value")) {
      return null;
    }
    entries.push([key, descriptor.value]);
  }
  return entries.sort(([left], [right]) => compareStrings(left, right));
};

const isStrictJsonValue = (value, ancestors = new Set()) => {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return true;
  }
  if (typeof value !== "object" || value === null || ancestors.has(value)) return false;

  const nextAncestors = new Set(ancestors);
  nextAncestors.add(value);
  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype) return false;
    return value.every((entry) => isStrictJsonValue(entry, nextAncestors));
  }

  const entries = ownDataEntries(value);
  return (
    entries !== null &&
    entries.every(([, entryValue]) => isStrictJsonValue(entryValue, nextAncestors))
  );
};

const exactJsonEquals = (left, right) => {
  if (!isStrictJsonValue(left) || !isStrictJsonValue(right)) return false;
  if (left === null || right === null || typeof left !== "object" || typeof right !== "object") {
    return Object.is(left, right);
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((entry, index) => exactJsonEquals(entry, right[index]))
    );
  }

  const leftEntries = ownDataEntries(left);
  const rightEntries = ownDataEntries(right);
  return (
    leftEntries !== null &&
    rightEntries !== null &&
    leftEntries.length === rightEntries.length &&
    leftEntries.every(
      ([key, value], index) =>
        rightEntries[index]?.[0] === key && exactJsonEquals(value, rightEntries[index]?.[1]),
    )
  );
};

const isExpectedReadingType = (value) => value === "one_card" || value === "three_card";

const isExpectedReadingBody = (value, readingType) => {
  const entries = ownDataEntries(value);
  if (
    entries === null ||
    entries.length !== expectedReadingBodyKeys.length ||
    entries.some(([key], index) => key !== expectedReadingBodyKeys[index])
  ) {
    return false;
  }
  return (
    value.locale === "en" &&
    value.readingType === readingType &&
    value.schemaVersion === "tarot-reading-create.v1" &&
    value.themeCode === "open_reflection"
  );
};

const isNonNegativeInteger = (value) => Number.isInteger(value) && value >= 0;

const auditCount = (findings, ledger, expectation, field) => {
  const expected = expectation[field];
  const actual = ledger[field];
  if (!isNonNegativeInteger(expected)) {
    findings.push(`expectation.${field}:invalid`);
    return;
  }
  if (!isNonNegativeInteger(actual)) {
    findings.push(`ledger.${field}:invalid`);
    return;
  }
  if (actual !== expected) {
    findings.push(`ledger.${field}:expected-${expected}:received-${actual}`);
  }
};

const auditArray = (findings, ledger, field, expectedLength) => {
  const value = ledger[field];
  if (!Array.isArray(value)) {
    findings.push(`ledger.${field}:invalid`);
    return null;
  }
  if (isNonNegativeInteger(expectedLength) && value.length !== expectedLength) {
    findings.push(`ledger.${field}:expected-${expectedLength}:received-${value.length}`);
  }
  return value;
};

const auditOperationIds = (findings, operationIds, field) => {
  if (operationIds === null) return;
  operationIds.forEach((operationId, index) => {
    if (typeof operationId !== "string" || !uuidV4Pattern.test(operationId)) {
      findings.push(`ledger.${field}[${index}]:invalid-uuid-v4`);
    }
  });
};

const auditOperationKeyContinuity = (findings, operationIds, field, sameKey) => {
  if (sameKey === undefined || operationIds === null || operationIds.length < 2) return;
  const allSame = operationIds.every((operationId) => operationId === operationIds[0]);
  if (sameKey && !allSame) {
    findings.push(`ledger.${field}:retry-key-changed`);
  }
  if (!sameKey && allSame) {
    findings.push(`ledger.${field}:new-operation-key-reused`);
  }
};

const auditIndependentOperationIds = (
  findings,
  sessionOperationIds,
  readingOperationIds,
  reportOperationIds,
) => {
  const categories = [sessionOperationIds, readingOperationIds, reportOperationIds].map(
    (operationIds) =>
      new Set(
        operationIds?.filter(
          (operationId) => typeof operationId === "string" && uuidV4Pattern.test(operationId),
        ) ?? [],
      ),
  );
  for (let leftIndex = 0; leftIndex < categories.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < categories.length; rightIndex += 1) {
      if (
        [...categories[leftIndex]].some((operationId) => categories[rightIndex].has(operationId))
      ) {
        findings.push("ledger.operationIds:not-independent");
        return;
      }
    }
  }
};

export const auditTarotBrowserAcceptanceLedger = (ledger, expectation) => {
  const findings = [];
  try {
    if (!isPlainObject(expectation)) {
      return freezeFindings(["expectation:malformed"]);
    }

    const readingType = expectation.readingType;
    if (!isExpectedReadingType(readingType)) {
      findings.push("expectation.readingType:invalid");
    }
    for (const field of ["sameReadingKey", "sameSessionKey"]) {
      if (Object.hasOwn(expectation, field) && typeof expectation[field] !== "boolean") {
        findings.push(`expectation.${field}:invalid`);
      }
    }

    const hasReportBody = Object.hasOwn(expectation, "reportBody");
    const validReportBody =
      hasReportBody &&
      isPlainObject(expectation.reportBody) &&
      isStrictJsonValue(expectation.reportBody);
    if (hasReportBody && !validReportBody) {
      findings.push("expectation.reportBody:invalid");
    }
    if (isNonNegativeInteger(expectation.reports) && expectation.reports > 0 && !hasReportBody) {
      findings.push("expectation.reportBody:required");
    }

    if (!isPlainObject(ledger)) {
      findings.push("ledger:malformed");
      return freezeFindings(findings);
    }

    for (const field of countFields) {
      auditCount(findings, ledger, expectation, field);
    }

    const sessionBodies = auditArray(findings, ledger, "sessionBodies", expectation.sessionStarts);
    const sessionOperationIds = auditArray(
      findings,
      ledger,
      "sessionOperationIds",
      expectation.sessionStarts,
    );
    const readingBodies = auditArray(findings, ledger, "readingBodies", expectation.readingStarts);
    const readingOperationIds = auditArray(
      findings,
      ledger,
      "readingOperationIds",
      expectation.readingStarts,
    );
    const reportBodies = auditArray(findings, ledger, "reportBodies", expectation.reports);
    const reportOperationIds = auditArray(
      findings,
      ledger,
      "reportOperationIds",
      expectation.reports,
    );
    auditArray(findings, ledger, "unexpected", 0);

    sessionBodies?.forEach((body, index) => {
      if (body !== null) findings.push(`ledger.sessionBodies[${index}]:expected-null`);
    });
    readingBodies?.forEach((body, index) => {
      if (!isExpectedReadingType(readingType) || !isExpectedReadingBody(body, readingType)) {
        findings.push(`ledger.readingBodies[${index}]:invalid`);
      }
    });
    if (validReportBody) {
      reportBodies?.forEach((body, index) => {
        if (!exactJsonEquals(body, expectation.reportBody)) {
          findings.push(`ledger.reportBodies[${index}]:invalid`);
        }
      });
    }
    auditOperationIds(findings, sessionOperationIds, "sessionOperationIds");
    auditOperationIds(findings, readingOperationIds, "readingOperationIds");
    auditOperationIds(findings, reportOperationIds, "reportOperationIds");
    auditOperationKeyContinuity(
      findings,
      sessionOperationIds,
      "sessionOperationIds",
      expectation.sameSessionKey,
    );
    auditOperationKeyContinuity(
      findings,
      readingOperationIds,
      "readingOperationIds",
      expectation.sameReadingKey,
    );
    auditIndependentOperationIds(
      findings,
      sessionOperationIds,
      readingOperationIds,
      reportOperationIds,
    );

    return freezeFindings(findings);
  } catch {
    return freezeFindings(["audit:malformed-input"]);
  }
};
