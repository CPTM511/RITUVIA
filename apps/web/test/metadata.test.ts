import { describe, expect, it } from "vitest";

import { createHomeMetadata, createPublicPageMetadata } from "../app/_i18n/metadata";
import { getMessages } from "../app/_i18n/messages";

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
});
