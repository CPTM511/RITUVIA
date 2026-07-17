import { describe, expect, it } from "vitest";

import {
  createHomeMetadata,
  createPublicPageMetadata,
  createQuestionIntakeMetadata,
  createTarotOneCardMetadata,
  createTarotThreeCardMetadata,
} from "../app/_i18n/metadata";
import { getMessages } from "../app/_i18n/messages";
import { getQuestionIntakeMessages } from "../app/_i18n/question-intake-messages";
import { getTarotOneCardMessages } from "../app/_i18n/tarot-one-card-messages";
import { getTarotThreeCardMessages } from "../app/_i18n/tarot-three-card-messages";

const input = {
  brandName: "Configured Brand",
  canonicalOrigin: "https://example.test",
  locale: "en" as const,
  messages: getMessages("en"),
};

describe("localized home metadata", () => {
  it("binds title, canonical, Open Graph, and alternates to configured brand and locale", () => {
    const metadata = createHomeMetadata({ ...input, deploymentEnvironment: "production" });

    expect(metadata.title).toBe(`Configured Brand — ${input.messages.home.metadata.title}`);
    expect(metadata.description).toBe(input.messages.home.metadata.description);
    expect(metadata.alternates).toEqual({
      canonical: "https://example.test/en",
      languages: {
        en: "https://example.test/en",
        "x-default": "https://example.test/en",
      },
    });
    expect(metadata.openGraph).toMatchObject({
      siteName: "Configured Brand",
      url: "https://example.test/en",
    });
  });

  it("emits unique exact metadata for every finite public page", () => {
    const records = (["home", "methodology", "safety", "privacy"] as const).map((page) =>
      createPublicPageMetadata({
        ...input,
        deploymentEnvironment: "production",
        page,
      }),
    );

    expect(records.map((metadata) => metadata.alternates?.canonical)).toEqual([
      "https://example.test/en",
      "https://example.test/en/methodology",
      "https://example.test/en/safety",
      "https://example.test/en/privacy",
    ]);
    expect(new Set(records.map((metadata) => metadata.title))).toHaveLength(4);
    expect(new Set(records.map((metadata) => metadata.description))).toHaveLength(4);
  });

  it("allows indexing only for the production environment", () => {
    expect(createHomeMetadata({ ...input, deploymentEnvironment: "production" }).robots).toEqual({
      index: true,
      follow: true,
    });

    for (const deploymentEnvironment of ["local", "preview", "staging"] as const) {
      expect(createHomeMetadata({ ...input, deploymentEnvironment }).robots).toEqual({
        index: false,
        follow: false,
      });
    }
  });

  it("keeps private intake metadata noindex without canonical or social URLs", () => {
    const metadata = createQuestionIntakeMetadata(
      "Configured Brand",
      getQuestionIntakeMessages("en"),
    );

    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(metadata.title).toContain("Private reflection intake");
    expect(metadata.alternates).toBeUndefined();
    expect(metadata.openGraph).toBeUndefined();
  });

  it("keeps the private one-card result noindex without canonical or social URLs", () => {
    const metadata = createTarotOneCardMetadata("Configured Brand", getTarotOneCardMessages("en"));

    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(metadata.title).toContain("Private one-card reflection");
    expect(metadata.alternates).toBeUndefined();
    expect(metadata.openGraph).toBeUndefined();
  });

  it("keeps the private three-card result noindex without canonical or social URLs", () => {
    const metadata = createTarotThreeCardMetadata(
      "Configured Brand",
      getTarotThreeCardMessages("en"),
    );

    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(metadata.title).toContain("Private three-card reflection");
    expect(metadata.alternates).toBeUndefined();
    expect(metadata.openGraph).toBeUndefined();
  });
});
