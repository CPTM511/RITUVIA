import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  astrologyAspectPolicyVersion,
  astrologyMethodCatalogSha256,
  astrologyNatalBodies,
  astrologyNatalMethodVersion,
  astrologyRequestedEphemerisFlags,
} from "../src/index.js";

const catalogUrl = new URL(
  "../../../content/sources/astrology/rituvia-western-natal-method.v1.json",
  import.meta.url,
);

describe("approved astrology method catalog", () => {
  it("binds the compiled method to the owner-approved checksummed catalog", async () => {
    const bytes = await readFile(catalogUrl);
    const catalog = JSON.parse(bytes.toString("utf8")) as Record<string, unknown>;

    expect(createHash("sha256").update(bytes).digest("hex")).toBe(astrologyMethodCatalogSha256);
    expect(catalog).toMatchObject({
      approval: {
        approvalReference: "D-070:owner-approval:2026-07-26",
        status: "approved",
      },
      aspectPolicyVersion: astrologyAspectPolicyVersion,
      bodies: astrologyNatalBodies,
      engineRequirements: {
        automaticEphemerisFallbackAllowed: false,
        requestedEphemerisFlags: astrologyRequestedEphemerisFlags,
      },
      housePolicy: {
        exactTimeHouseSystem: "placidus",
        fallbackHouseSystem: null,
        polarFailureBehavior: "unavailable_without_partial_facts",
      },
      methodVersion: astrologyNatalMethodVersion,
      node: "true_node",
      zodiac: "tropical",
    });
  });
});
