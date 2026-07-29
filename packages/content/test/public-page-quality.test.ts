import { describe, expect, it } from "vitest";

import {
  assessPublicPageQuality,
  assertPublicPageQuality,
  type PublicPageQualityInput,
} from "../src/index.js";

const paragraph = (subject: string): string =>
  `${subject} offers a bounded explanation with concrete context, explicit limitations, practical examples, reflective questions, source notes, and one calm next step that remains under the reader's control.`;

const page = (
  routeId: string,
  override: Partial<PublicPageQualityInput> = {},
): PublicPageQualityInput => ({
  authority: {
    kind: "editorial_record",
    reference: `rituvia.${routeId}@1.0.0`,
    reviewDueDate: "2027-07-29",
    reviewedDate: "2026-07-29",
    sourcePaths: [`content/editorial/${routeId}.json`],
    sourceSha256: "a".repeat(64),
  },
  canonicalPath: `/en/${routeId}`,
  contentDigest: (routeId === "alpha" ? "a" : "b").repeat(64),
  contentFamily: "testing",
  contentShape: `guide-${routeId}`,
  description: `${routeId} explains one distinct reviewed subject for reflective use without prediction or certainty.`,
  headings: [`Understanding ${routeId}`, `Limits for ${routeId}`],
  internalRouteIds: [routeId === "alpha" ? "beta" : "alpha"],
  locale: "en",
  pathname: `/en/${routeId}`,
  personalized: false,
  private: false,
  publicationApproved: true,
  routeId,
  structuredParentRouteId: routeId === "alpha" ? "beta" : "alpha",
  textBlocks: Array.from({ length: 8 }, (_, index) => paragraph(`${routeId} section ${index + 1}`)),
  title: `Understanding the ${routeId} reflection guide`,
  userIntent: `understand-${routeId}`,
  ...override,
});

describe("public-page quality", () => {
  it("produces deterministic passing inventory evidence", () => {
    const records = assertPublicPageQuality([page("alpha"), page("beta")], "2026-07-29");

    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({
      canonicalPath: "/en/alpha",
      nearestRouteId: "beta",
      qualityStatus: "passed",
      routeId: "alpha",
    });
    expect(records[0]?.contentDigest).toMatch(/^[0-9a-f]{64}$/u);
    expect(records[0]?.wordCount).toBeGreaterThan(120);
  });

  it("rejects exact, near, and template-only substitutions", () => {
    const exact = page("beta", {
      contentShape: "guide-alpha",
      description: page("alpha").description,
      headings: page("alpha").headings,
      textBlocks: page("alpha").textBlocks,
      title: page("alpha").title,
    });
    expect(
      assessPublicPageQuality([page("alpha"), exact], "2026-07-29").findings.map(
        ({ code }) => code,
      ),
    ).toContain("content_duplicate");

    const near = page("beta", {
      contentShape: "guide-alpha",
      description: page("alpha").description,
      headings: page("alpha").headings,
      textBlocks: [...page("alpha").textBlocks.slice(0, 7), paragraph("one distinct ending")],
      title: page("alpha").title,
    });
    expect(
      assessPublicPageQuality([page("alpha"), near], "2026-07-29").findings.map(({ code }) => code),
    ).toContain("content_near_duplicate");

    const template = page("beta", {
      contentShape: "guide-alpha",
      description: page("alpha").description,
      headings: page("alpha").headings,
      textBlocks: [
        ...page("alpha").textBlocks.slice(0, 5),
        paragraph("distinct evidence one"),
        paragraph("distinct evidence two"),
        paragraph("distinct evidence three"),
      ],
      title: page("alpha").title,
    });
    expect(
      assessPublicPageQuality([page("alpha"), template], "2026-07-29").findings.map(
        ({ code }) => code,
      ),
    ).toContain("template_substitution");

    const contained = page("beta", {
      contentShape: "expanded-guide",
      description: page("alpha").description,
      headings: page("alpha").headings,
      textBlocks: [
        ...page("alpha").textBlocks,
        ...Array.from({ length: 8 }, (_, index) =>
          paragraph(`additional independent evidence ${index + 1}`),
        ),
      ],
      title: page("alpha").title,
    });
    expect(
      assessPublicPageQuality([page("alpha"), contained], "2026-07-29").findings.map(
        ({ code }) => code,
      ),
    ).toContain("content_near_duplicate");
  });

  it("rejects thin, cannibalizing, unreviewed, private, and unsafe routes", () => {
    const unsafe = page("beta", {
      authority: {
        ...page("beta").authority,
        reviewDueDate: "2026-07-28",
      },
      canonicalPath: "/en/account?view=private",
      internalRouteIds: ["missing"],
      pathname: "/en/account?view=private",
      personalized: true,
      private: true,
      publicationApproved: false,
      textBlocks: ["Too short."],
      userIntent: "understand-alpha",
    });
    const codes = assessPublicPageQuality([page("alpha"), unsafe], "2026-07-29").findings.map(
      ({ code }) => code,
    );

    expect(codes).toEqual(
      expect.arrayContaining([
        "content_thin",
        "exposure",
        "intent",
        "internal_link",
        "path",
        "review",
      ]),
    );
  });

  it("allows decision evidence to bind reviewed UI and editorial sources only", () => {
    const approvedDecision = page("beta", {
      authority: {
        ...page("beta").authority,
        kind: "decision",
        reference: "D-086",
        sourcePaths: [
          "apps/web/app/_i18n/messages.ts",
          "content/editorial/geo-answer-context.en.v1.json",
        ],
      },
    });
    expect(
      assessPublicPageQuality([page("alpha"), approvedDecision], "2026-07-29").findings.map(
        ({ code }) => code,
      ),
    ).not.toContain("source");

    const ungovernedDecision = page("beta", {
      authority: {
        ...approvedDecision.authority,
        sourcePaths: ["content/traditions/unreviewed.json"],
      },
    });
    expect(
      assessPublicPageQuality([page("alpha"), ungovernedDecision], "2026-07-29").findings.map(
        ({ code }) => code,
      ),
    ).toContain("source");
  });
});
