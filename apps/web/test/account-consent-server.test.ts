import { describe, expect, it, vi } from "vitest";

import { selectConsentedAiPersonalizationExcerptWithService } from "../server/account-consent";

describe("account consent data-flow boundary", () => {
  it("rechecks the exact AI-personalization purpose and notice on every data flow", async () => {
    const allows = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const service = { allows };
    const input = {
      selectedExcerpt: "explicitly selected private excerpt",
      sessionToken: "s".repeat(43),
    };

    await expect(selectConsentedAiPersonalizationExcerptWithService(service, input)).resolves.toBe(
      input.selectedExcerpt,
    );
    await expect(
      selectConsentedAiPersonalizationExcerptWithService(service, input),
    ).resolves.toBeNull();
    expect(allows).toHaveBeenCalledTimes(2);
    expect(allows).toHaveBeenNthCalledWith(1, {
      noticeVersion: "rituvia.ai-personalization-notice.v1",
      purpose: "ai_personalization",
      sessionToken: input.sessionToken,
    });
  });

  it.each([
    { selectedExcerpt: null, sessionToken: "s".repeat(43) },
    { selectedExcerpt: "", sessionToken: "s".repeat(43) },
    { selectedExcerpt: "x".repeat(5_201), sessionToken: "s".repeat(43) },
    { selectedExcerpt: "private", sessionToken: undefined },
  ])("fails closed before reading consent for invalid or unavailable input", async (input) => {
    const allows = vi.fn(async () => true);
    await expect(
      selectConsentedAiPersonalizationExcerptWithService({ allows }, input),
    ).resolves.toBeNull();
    expect(allows).not.toHaveBeenCalled();
  });
});
