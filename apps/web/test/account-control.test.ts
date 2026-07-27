import { describe, expect, it } from "vitest";

import {
  parseAccountConsentControlResponse,
  parseAccountConsentControls,
  parseAccountHistoryPage,
  parseAccountReadingPage,
  parseAccountSessionList,
} from "../app/_components/account-control";

const reading = {
  createdAt: "2026-07-24T01:00:00.000Z",
  id: "11111111-1111-4111-8111-111111111111",
  readingType: "one_card",
  themeCode: "self",
} as const;

const session = {
  createdAt: "2026-07-24T01:00:00.000Z",
  current: true,
  expiresAt: "2026-08-24T01:00:00.000Z",
  id: "22222222-2222-4222-8222-222222222222",
  lastSeenAt: "2026-07-24T02:00:00.000Z",
} as const;

describe("account control response parsing", () => {
  it("accepts only the three independent current purpose/version controls", () => {
    const controls = [
      {
        granted: true,
        noticeVersion: "rituvia.analytics-notice.v1",
        purpose: "optional_product_analytics",
        recordedAt: "2026-07-25T08:00:00.000Z",
      },
      {
        granted: false,
        noticeVersion: "rituvia.ai-personalization-notice.v1",
        purpose: "ai_personalization",
        recordedAt: null,
      },
      {
        granted: false,
        noticeVersion: "rituvia.model-improvement-notice.v1",
        purpose: "model_improvement",
        recordedAt: null,
      },
    ];
    expect(parseAccountConsentControls({ controls, schemaVersion: 1 })).toEqual(controls);
    expect(parseAccountConsentControlResponse({ control: controls[1], schemaVersion: 1 })).toEqual(
      controls[1],
    );
  });

  it.each([
    {
      controls: [
        {
          granted: true,
          noticeVersion: "rituvia.analytics-notice.v0",
          purpose: "optional_product_analytics",
          recordedAt: null,
        },
      ],
      schemaVersion: 1,
    },
    {
      controls: [
        {
          granted: true,
          noticeVersion: "rituvia.marketing-notice.v1",
          purpose: "marketing_communications",
          recordedAt: null,
        },
      ],
      schemaVersion: 1,
    },
  ])("rejects stale, bundled, or incomplete consent responses", (value) => {
    expect(parseAccountConsentControls(value)).toBeNull();
  });

  it("accepts all reviewed private-history summary types without private prose", () => {
    const parsed = parseAccountHistoryPage({
      items: [
        {
          occurredAt: reading.createdAt,
          readingType: reading.readingType,
          resourceId: reading.id,
          resourceType: "reading",
          status: "facts_ready",
          themeCode: reading.themeCode,
        },
        {
          occurredAt: "2026-07-24T00:00:00.000Z",
          readingType: null,
          resourceId: "44444444-4444-4444-8444-444444444444",
          resourceType: "intention",
          status: "active",
          themeCode: null,
        },
      ],
      nextCursor: null,
      schemaVersion: 1,
    });

    expect(parsed?.items.map((item) => item.resourceType)).toEqual(["reading", "intention"]);
  });

  it("rejects private prose and invalid type/status combinations in history", () => {
    expect(
      parseAccountHistoryPage({
        items: [
          {
            intentionText: "private canary",
            occurredAt: reading.createdAt,
            readingType: null,
            resourceId: reading.id,
            resourceType: "intention",
            status: "active",
            themeCode: null,
          },
        ],
        nextCursor: null,
        schemaVersion: 1,
      }),
    ).toBeNull();
    expect(
      parseAccountHistoryPage({
        items: [
          {
            occurredAt: reading.createdAt,
            readingType: "one_card",
            resourceId: reading.id,
            resourceType: "journal",
            status: "active",
            themeCode: "self",
          },
        ],
        nextCursor: null,
        schemaVersion: 1,
      }),
    ).toBeNull();
  });

  it("accepts bounded reading metadata without private prose", () => {
    const parsed = parseAccountReadingPage({
      items: [reading],
      nextCursor: "eyJyZWFkaW5nSWQiOiJvcGFxdWUifQ",
      schemaVersion: 1,
    });

    expect(parsed).toEqual({
      items: [reading],
      nextCursor: "eyJyZWFkaW5nSWQiOiJvcGFxdWUifQ",
    });
    expect(Object.isFrozen(parsed?.items)).toBe(true);
  });

  it.each([
    { items: [{ ...reading, question: "private canary" }], nextCursor: null, schemaVersion: 1 },
    { items: [{ ...reading, themeCode: "future_certainty" }], nextCursor: null, schemaVersion: 1 },
    { items: [reading, reading], nextCursor: null, schemaVersion: 1 },
    { items: [reading], nextCursor: "not+base64", schemaVersion: 1 },
  ])("rejects malformed or expanded reading history responses", (value) => {
    expect(parseAccountReadingPage(value)).toBeNull();
  });

  it("accepts exactly one current session with timestamp-only metadata", () => {
    const other = {
      ...session,
      current: false,
      id: "33333333-3333-4333-8333-333333333333",
    };
    const parsed = parseAccountSessionList({ items: [session, other], schemaVersion: 1 });

    expect(parsed).toEqual([session, other]);
    expect(Object.isFrozen(parsed)).toBe(true);
  });

  it.each([
    { items: [], schemaVersion: 1 },
    { items: [{ ...session, current: false }], schemaVersion: 1 },
    {
      items: [session, { ...session, id: "33333333-3333-4333-8333-333333333333" }],
      schemaVersion: 1,
    },
    { items: [{ ...session, deviceName: "private device" }], schemaVersion: 1 },
    {
      items: [{ ...session, lastSeenAt: "2026-09-24T01:00:00.000Z" }],
      schemaVersion: 1,
    },
  ])("rejects unsafe session-list responses", (value) => {
    expect(parseAccountSessionList(value)).toBeNull();
  });
});
