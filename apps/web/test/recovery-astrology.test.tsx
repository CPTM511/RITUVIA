import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { createAstrologyNatalViewResponse } from "../app/_contracts/astrology-natal-response";
import {
  recoveryAstrologyRequestSchemaVersion,
  parseRecoveryAstrologyRequest,
} from "../app/_contracts/recovery-astrology";
import { RecoveryAstrologyCalculator } from "../app/_components/recovery-astrology-calculator";
import {
  anonymousSessionEndpoint,
  recoveryAstrologyEndpoint,
  requestRecoveryAstrology,
} from "../app/_components/recovery-astrology-transport";
import { recoveryAstrologyMessages } from "../app/_i18n/recovery-astrology-messages";
import {
  createApproximateAstrologyFacts,
  createAstrologyCalculationResource,
  createExactAstrologyFacts,
  createUnknownTimeAstrologyFacts,
} from "./fixtures/astrology-natal";
import {
  createRecoveryAstrologyLocationTimeZoneAdapter,
  createRecoveryAstrologyService,
  RecoveryAstrologyServiceError,
} from "../server/recovery-item-8-astrology";

const exactRequest = Object.freeze({
  approximationWindowMinutes: null,
  birthDate: "2000-01-01",
  birthTime: "07:00",
  disambiguation: null,
  locationId: "geonames:5128581",
  schemaVersion: recoveryAstrologyRequestSchemaVersion,
  timeCertainty: "exact",
} as const);

const createService = () => {
  const calculateNatal = vi.fn(async (request: { timeCertainty: string }) => {
    switch (request.timeCertainty) {
      case "exact":
        return createExactAstrologyFacts();
      case "approximate":
        return createApproximateAstrologyFacts();
      case "unknown":
        return createUnknownTimeAstrologyFacts();
      default:
        throw new TypeError("unexpected certainty");
    }
  });
  const service = createRecoveryAstrologyService({
    clock: () => Date.parse("2026-08-06T08:00:00.000Z"),
    createId: () => "33333333-3333-4333-8333-333333333333",
    loadEphemeris: async () => ({ calculateNatal, engineMetadata: vi.fn() }),
    locationTimeZone: createRecoveryAstrologyLocationTimeZoneAdapter(),
  });
  return { calculateNatal, service };
};

describe("Recovery Item 8 astrology service", () => {
  it("strictly parses the bounded synthetic request contract", () => {
    expect(parseRecoveryAstrologyRequest(exactRequest)).toEqual(exactRequest);
    expect(() =>
      parseRecoveryAstrologyRequest({ ...exactRequest, privateNote: "must-not-pass" }),
    ).toThrow(TypeError);
    expect(() =>
      parseRecoveryAstrologyRequest({ ...exactRequest, birthDate: "1799-12-31" }),
    ).toThrow(TypeError);
  });

  it("resolves exact historical civil time and requests complete natal facts", async () => {
    const { calculateNatal, service } = createService();
    const calculation = await service.calculate(exactRequest);

    expect(calculation).toMatchObject({
      createdAt: "2026-08-06T08:00:00.000Z",
      id: "33333333-3333-4333-8333-333333333333",
    });
    expect(calculateNatal).toHaveBeenCalledWith(
      expect.objectContaining({
        approximationWindowMinutes: null,
        houseSystem: "placidus",
        latitudeE6: 40_714_300,
        longitudeE6: -74_006_000,
        timeCertainty: "exact",
        utcInstant: "2000-01-01T12:00:00.000Z",
      }),
    );
    expect(calculation.facts.placements).toHaveLength(11);
    expect(calculation.facts.houses?.cuspsDegrees).toHaveLength(12);
  });

  it("suppresses houses, angles, and aspects for approximate time", async () => {
    const { calculateNatal, service } = createService();
    const calculation = await service.calculate({
      ...exactRequest,
      approximationWindowMinutes: 90,
      timeCertainty: "approximate",
    });

    expect(calculateNatal).toHaveBeenCalledWith(
      expect.objectContaining({ approximationWindowMinutes: 90, timeCertainty: "approximate" }),
    );
    expect(calculation.facts.placements).toHaveLength(11);
    expect(calculation.facts.houses).toBeNull();
    expect(calculation.facts.aspects).toEqual([]);
  });

  it("never invents an instant or placements when time is unknown", async () => {
    const { calculateNatal, service } = createService();
    const calculation = await service.calculate({
      ...exactRequest,
      birthTime: null,
      timeCertainty: "unknown",
    });

    expect(calculateNatal).toHaveBeenCalledWith(
      expect.objectContaining({ timeCertainty: "unknown", utcInstant: null }),
    );
    expect(calculation.facts.placements).toEqual([]);
    expect(calculation.facts.houses).toBeNull();
    expect(calculation.facts.aspects).toEqual([]);
  });

  it("requires explicit overlap disambiguation and rejects nonexistent local time", async () => {
    const { service } = createService();
    await expect(
      service.calculate({ ...exactRequest, birthDate: "2024-11-03", birthTime: "01:30" }),
    ).rejects.toMatchObject({ code: "RECOVERY_ASTROLOGY_AMBIGUITY_REQUIRED" });
    await expect(
      service.calculate({ ...exactRequest, birthDate: "2024-03-10", birthTime: "02:30" }),
    ).rejects.toMatchObject({ code: "RECOVERY_ASTROLOGY_LOCAL_TIME_NONEXISTENT" });
    await expect(service.calculate({ ...exactRequest, birthTime: "25:00" })).rejects.toBeInstanceOf(
      RecoveryAstrologyServiceError,
    );
  });
});

describe("Recovery Item 8 astrology client boundary", () => {
  it("server-renders a synthetic-only form without account or browser persistence surfaces", () => {
    const html = renderToStaticMarkup(
      createElement(RecoveryAstrologyCalculator, {
        locale: "en",
        messages: recoveryAstrologyMessages,
        sourceSha: "1".repeat(40),
      }),
    );

    expect(html).toContain('name="birth-date"');
    expect(html).toContain('name="birth-time"');
    expect(html).toContain('name="time-certainty"');
    expect(html).toContain("Clear synthetic birth data");
    expect(html).toContain("AGPL-3.0-only");
    expect(html).not.toMatch(/localStorage|sessionStorage|indexedDB/iu);
    expect(html).not.toMatch(/href="[^"]*(?:sign-in|account)/iu);
  });

  it("creates an anonymous session, posts CSRF-protected JSON, and verifies the response", async () => {
    const resource = await createAstrologyCalculationResource();
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, { headers: { "x-csrf-token": "csrf-test" }, status: 204 }),
      )
      .mockResolvedValueOnce(Response.json(createAstrologyNatalViewResponse(resource)));
    const result = await requestRecoveryAstrology({
      fetcher: fetcher as typeof fetch,
      isOnline: () => true,
      request: exactRequest,
      signal: new AbortController().signal,
    });

    expect(result).toEqual({
      item: createAstrologyNatalViewResponse(resource).item,
      kind: "success",
    });
    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      anonymousSessionEndpoint,
      expect.objectContaining({ credentials: "same-origin", method: "POST" }),
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      recoveryAstrologyEndpoint,
      expect.objectContaining({
        body: JSON.stringify(exactRequest),
        credentials: "same-origin",
        headers: expect.objectContaining({ "x-csrf-token": "csrf-test" }),
        method: "POST",
      }),
    );
  });

  it.each([
    [400, "invalid"],
    [409, "ambiguous"],
    [422, "nonexistent"],
    [503, "unavailable"],
  ] as const)("maps HTTP %s to %s without fallback", async (status, kind) => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, { headers: { "x-csrf-token": "csrf-test" }, status: 204 }),
      )
      .mockResolvedValueOnce(new Response(null, { status }));
    await expect(
      requestRecoveryAstrology({
        fetcher: fetcher as typeof fetch,
        isOnline: () => true,
        request: exactRequest,
        signal: new AbortController().signal,
      }),
    ).resolves.toEqual({ kind });
  });
});
