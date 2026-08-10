import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  recoveryItem12AcceptanceManifest,
  recoveryItem12AcceptanceManifestSha256,
} from "../server/recovery-item-12-manifest";

describe("Recovery Item 12 acceptance manifest", () => {
  it("binds the final gate to the approved scope and checksum", () => {
    expect(recoveryItem12AcceptanceManifest).toEqual({
      baselineSha: "f79fee6713670fdc12b33dd3182569a942782636",
      beforeStateManifestSha256: "c9672676a2f1c2c54cc6cfa16f37bad43c3f3b8c715193e183b531123a3139c6",
      decisionReference: "D-098",
      excludedJourneys: ["FJ-15"],
      license: "AGPL-3.0-only",
      mandatoryJourneys: ["FJ-00-FJ-14", "FJ-16-FJ-20"],
      productionDecision: "NO-GO",
      recoveryItem: 12,
      rollbackSourceSha: "5ffe98ef735d4031933873d4e443c8b74a34c677",
      schemaVersion: "rituvia.recovery-item-12-acceptance.v1",
      stagingBoundary: "protected-authenticated-noindex-synthetic-test-only",
    });
    expect(recoveryItem12AcceptanceManifestSha256).toBe(
      createHash("sha256")
        .update(JSON.stringify(recoveryItem12AcceptanceManifest), "utf8")
        .digest("hex"),
    );
  });

  it("does not grant crypto or production authority", () => {
    expect(recoveryItem12AcceptanceManifest.excludedJourneys).toContain("FJ-15");
    expect(recoveryItem12AcceptanceManifest.productionDecision).toBe("NO-GO");
    expect(JSON.stringify(recoveryItem12AcceptanceManifest)).not.toMatch(
      /(?:production-approved|real-funds|real-crypto|live-stripe)/u,
    );
  });
});
