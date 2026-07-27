const vulnerabilityIdPattern = /^[A-Z][A-Z0-9_.-]{1,127}$/u;
const commitPattern = /^[0-9a-f]{40}$/u;

const invalid = (message) => {
  throw new Error(message);
};

export const parseOsvCommitResponse = (value, expectedCommit) => {
  if (!commitPattern.test(expectedCommit)) {
    invalid("Native SCA commit is invalid.");
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    invalid("Native SCA response is invalid.");
  }
  const vulnerabilities = value.vulns;
  if (vulnerabilities === undefined) {
    return Object.freeze({
      commit: expectedCommit,
      vulnerabilityIds: Object.freeze([]),
    });
  }
  if (!Array.isArray(vulnerabilities) || vulnerabilities.length > 1_000) {
    invalid("Native SCA response is invalid.");
  }
  const ids = vulnerabilities.map((vulnerability) => {
    if (
      typeof vulnerability !== "object" ||
      vulnerability === null ||
      Array.isArray(vulnerability) ||
      !vulnerabilityIdPattern.test(vulnerability.id)
    ) {
      invalid("Native SCA vulnerability record is invalid.");
    }
    return vulnerability.id;
  });
  if (new Set(ids).size !== ids.length) {
    invalid("Native SCA response contains duplicate vulnerabilities.");
  }
  return Object.freeze({
    commit: expectedCommit,
    vulnerabilityIds: Object.freeze(ids.sort()),
  });
};
