import { describe, expect, it } from "vitest";

import { parseOsvCommitResponse } from "../scripts/native-sca-policy.mjs";

const commit = "af9823fe7b06ffefe3d3968fdc5680be8b5eec5f";

describe("native OSV commit policy", () => {
  it("accepts an explicit zero-vulnerability response", () => {
    expect(parseOsvCommitResponse({}, commit)).toEqual({
      commit,
      vulnerabilityIds: [],
    });
  });

  it("sorts vulnerability identifiers for stable fail-closed output", () => {
    expect(
      parseOsvCommitResponse(
        {
          vulns: [{ id: "OSV-2026-002" }, { id: "CVE-2026-0001" }],
        },
        commit,
      ),
    ).toEqual({
      commit,
      vulnerabilityIds: ["CVE-2026-0001", "OSV-2026-002"],
    });
  });

  it.each([
    null,
    [],
    { vulns: "none" },
    { vulns: [{ id: "unsafe id" }] },
    { vulns: [{ id: "CVE-2026-0001" }, { id: "CVE-2026-0001" }] },
  ])("rejects malformed or ambiguous responses", (response) => {
    expect(() => parseOsvCommitResponse(response, commit)).toThrow(/Native SCA/u);
  });
});
