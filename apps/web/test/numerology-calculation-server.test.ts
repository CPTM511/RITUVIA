import { describe, expect, it } from "vitest";

import {
  calculateWebNumerologyAt,
  webNumerologyCatalogAsOf,
} from "../server/numerology-calculation";
import { evaluateNumerologyAvailability, webNumerologyCatalog } from "../server/numerology-state";

describe("Web numerology calculation boundary", () => {
  it("binds the approved catalog and explicit target year without ambient time", () => {
    const facts = calculateWebNumerologyAt(
      {
        birthDate: "1990-11-28",
        schemaVersion: "numerology-calculation-request.v1",
        targetYear: 2026,
      },
      webNumerologyCatalogAsOf,
    );

    expect(webNumerologyCatalogAsOf).toBe("2026-07-25");
    expect(facts.input).toEqual({ birthDate: "1990-11-28", targetYear: 2026 });
    expect(
      facts.calculations.map(({ calculationCode, result }) => [calculationCode, result]),
    ).toEqual([
      ["life_path", 4],
      ["birthday_number", 1],
      ["personal_year", 22],
    ]);
    expect(facts.catalog).toEqual({
      id: "rituvia.numerology.date-reduction.en",
      version: "1.0.0",
    });
  });

  it.each([
    {
      birthDate: "1990-11-28",
      latinName: "private-name",
      schemaVersion: "numerology-calculation-request.v1",
      targetYear: 2026,
    },
    { birthDate: "1990-11-28", schemaVersion: "numerology-calculation-request.v1" },
    {
      birthDate: "１９９０-１１-２８",
      schemaVersion: "numerology-calculation-request.v1",
      targetYear: 2026,
    },
  ])("rejects unsupported or incomplete input without normalization %#", (request) => {
    expect(() => calculateWebNumerologyAt(request, webNumerologyCatalogAsOf)).toThrow(
      "The numerology calculation request is invalid.",
    );
  });

  it("fails closed when approval is invalid, expired, or unavailable", () => {
    const altered = {
      ...webNumerologyCatalog,
      editorial: {
        ...webNumerologyCatalog.editorial,
        approvalReference: "OWN-011:altered",
      },
    };

    expect(evaluateNumerologyAvailability(webNumerologyCatalog, "2026-07-25")).toBe("enabled");
    expect(evaluateNumerologyAvailability(altered, "2026-07-25")).toBe("disabled");
    expect(evaluateNumerologyAvailability(webNumerologyCatalog, "2027-07-24")).toBe("disabled");
    expect(evaluateNumerologyAvailability(null, "2026-07-25")).toBe("disabled");
  });
});
