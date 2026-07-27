import { describe, expect, it } from "vitest";

import {
  accountConsentNoticeVersions,
  accountConsentPurposes,
  parseAccountConsentMutationV1,
  parseAccountConsentPurpose,
} from "../src/index.js";

const accountConsentNoticeNoticeVersion = accountConsentNoticeVersions.optional_product_analytics;

describe("account consent controls", () => {
  it("keeps analytics and AI personalization independent and versioned", () => {
    expect(accountConsentPurposes).toEqual([
      "optional_product_analytics",
      "ai_personalization",
      "model_improvement",
    ]);
    expect(accountConsentNoticeVersions.optional_product_analytics).not.toBe(
      accountConsentNoticeVersions.ai_personalization,
    );
    expect(accountConsentNoticeVersions.model_improvement).not.toBe(
      accountConsentNoticeVersions.ai_personalization,
    );
    expect(parseAccountConsentPurpose("ai_personalization")).toBe("ai_personalization");
  });

  it.each(accountConsentPurposes)("accepts the exact current notice for %s", (purpose) => {
    expect(
      parseAccountConsentMutationV1({
        granted: true,
        noticeVersion: accountConsentNoticeVersions[purpose],
        purpose,
        schemaVersion: 1,
      }),
    ).toEqual({
      granted: true,
      noticeVersion: accountConsentNoticeVersions[purpose],
      purpose,
      schemaVersion: 1,
    });
  });

  it.each([
    null,
    {},
    {
      granted: true,
      noticeVersion: "rituvia.analytics-notice.v0",
      purpose: "optional_product_analytics",
      schemaVersion: 1,
    },
    {
      extra: true,
      granted: true,
      noticeVersion: accountConsentNoticeNoticeVersion,
      purpose: "optional_product_analytics",
      schemaVersion: 1,
    },
    {
      granted: true,
      noticeVersion: "rituvia.marketing-notice.v1",
      purpose: "marketing_communications",
      schemaVersion: 1,
    },
  ])("rejects stale, bundled, unknown, or expanded input", (candidate) => {
    expect(() => parseAccountConsentMutationV1(candidate)).toThrow(TypeError);
  });
});
