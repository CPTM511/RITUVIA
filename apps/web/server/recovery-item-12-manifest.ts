import "server-only";

import { createHash } from "node:crypto";

export const recoveryItem12AcceptanceManifest = Object.freeze({
  baselineSha: "f79fee6713670fdc12b33dd3182569a942782636",
  beforeStateManifestSha256: "c9672676a2f1c2c54cc6cfa16f37bad43c3f3b8c715193e183b531123a3139c6",
  decisionReference: "D-098",
  excludedJourneys: Object.freeze(["FJ-15"]),
  license: "AGPL-3.0-only",
  mandatoryJourneys: Object.freeze(["FJ-00-FJ-14", "FJ-16-FJ-20"]),
  productionDecision: "NO-GO",
  recoveryItem: 12,
  rollbackSourceSha: "5ffe98ef735d4031933873d4e443c8b74a34c677",
  schemaVersion: "rituvia.recovery-item-12-acceptance.v1",
  stagingBoundary: "protected-authenticated-noindex-synthetic-test-only",
});

export const recoveryItem12AcceptanceManifestSha256 = createHash("sha256")
  .update(JSON.stringify(recoveryItem12AcceptanceManifest), "utf8")
  .digest("hex");
