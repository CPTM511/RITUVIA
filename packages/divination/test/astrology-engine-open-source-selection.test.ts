import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  assessAstrologyEngineOpenSourceReleaseV2,
  astrologyEngineOpenSourceEvidenceCodes,
  parseAstrologyEngineOpenSourceSelectionV2,
} from "../src/index.js";

const manifestPath = new URL(
  "../../../content/sources/astrology/swiss-ephemeris-agpl.v2.json",
  import.meta.url,
);
const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as unknown;
const sha256 = (value: string | Uint8Array): string =>
  createHash("sha256").update(value).digest("hex");

describe("Swiss Ephemeris AGPL selection V2", () => {
  it("parses the owner-approved whole-project AGPL contract without commercial execution claims", () => {
    const selection = parseAstrologyEngineOpenSourceSelectionV2(manifest);
    expect(selection.license).toMatchObject({
      model: "GNU Affero General Public License",
      professionalContractRequired: false,
      spdx: "AGPL-3.0-only",
      wholeProjectLicense: "AGPL-3.0-only",
    });
    expect(selection.supersedes).toEqual({
      schemaVersion: "astrology-engine-selection.v1",
      version: "1.0.0",
    });
  });

  it("requires independently verified claims and remains production safe-off", () => {
    const selection = parseAstrologyEngineOpenSourceSelectionV2(manifest);
    const unverified = assessAstrologyEngineOpenSourceReleaseV2(selection, new Set());
    expect(unverified.integrationAllowed).toBe(false);
    expect(unverified.productionActivationAllowed).toBe(false);

    const integration = assessAstrologyEngineOpenSourceReleaseV2(
      selection,
      new Set(["owner_agpl_approval", "whole_project_agpl_license"]),
    );
    expect(integration.integrationAllowed).toBe(true);
    expect(integration.productionActivationAllowed).toBe(false);
    expect(integration.missingReleaseEvidence).toContain("staging_kill_switch_exercise");
  });

  it("requires every release evidence code exactly once", () => {
    const selection = parseAstrologyEngineOpenSourceSelectionV2(manifest);
    expect(selection.requiredReleaseEvidence).toEqual(astrologyEngineOpenSourceEvidenceCodes);
  });

  it("binds the selection to the real vendor manifest, data inventory, and root AGPL text", async () => {
    const selection = parseAstrologyEngineOpenSourceSelectionV2(manifest);
    const vendorManifestUrl = new URL(
      "../../astrology-engine-native/native/vendor-manifest.json",
      import.meta.url,
    );
    const vendorManifestValue = await readFile(vendorManifestUrl);
    const vendorManifest = JSON.parse(vendorManifestValue.toString("utf8")) as {
      files: readonly Readonly<{ path: string; sha256: string }>[];
    };
    const dataInventory = `${vendorManifest.files
      .filter(({ path }) => path.startsWith("ephe/"))
      .map(({ path, sha256: digest }) => `${path}:${digest}`)
      .sort()
      .join("\n")}\n`;
    const license = await readFile(new URL("../../../LICENSE", import.meta.url), "utf8");

    expect(sha256(vendorManifestValue)).toBe(selection.upstreamManifest.manifestSha256);
    expect(sha256(dataInventory)).toBe(selection.dataPolicy.inventorySha256);
    expect(license).toContain("GNU AFFERO GENERAL PUBLIC LICENSE");
    expect(sha256(license)).toBe(
      "0d96a4ff68ad6d4b6f1f30f713b18d5184912ba8dd389f86aa7710db079abcb0",
    );
  });

  it("rejects a Professional contract injection", () => {
    expect(() =>
      parseAstrologyEngineOpenSourceSelectionV2({
        ...(manifest as Record<string, unknown>),
        license: {
          ...((manifest as Record<string, unknown>).license as Record<string, unknown>),
          professionalContractRequired: true,
        },
      }),
    ).toThrow(TypeError);
  });
});
