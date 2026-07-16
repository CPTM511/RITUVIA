import { describe, expect, it } from "vitest";

import { createHomeMetadata } from "../app/_i18n/metadata";
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

    expect(metadata.title).toBe(`Configured Brand — ${input.messages.metadata.title}`);
    expect(metadata.description).toBe(input.messages.metadata.description);
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
