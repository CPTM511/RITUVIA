import type { Metadata } from "next";

import type { ShellMessages } from "./messages";
import { localeHomePath, type Locale } from "./routing";

type DeploymentEnvironment = "local" | "preview" | "production" | "staging";

type HomeMetadataInput = Readonly<{
  brandName: string;
  canonicalOrigin: string;
  deploymentEnvironment: DeploymentEnvironment;
  locale: Locale;
  messages: ShellMessages;
}>;

export const createHomeMetadata = ({
  brandName,
  canonicalOrigin,
  deploymentEnvironment,
  locale,
  messages,
}: HomeMetadataInput): Metadata => {
  const canonical = new URL(localeHomePath(locale), canonicalOrigin).toString();
  const indexable = deploymentEnvironment === "production";

  return {
    title: `${brandName} — ${messages.metadata.title}`,
    description: messages.metadata.description,
    alternates: {
      canonical,
      languages: {
        en: canonical,
        "x-default": canonical,
      },
    },
    openGraph: {
      type: "website",
      siteName: brandName,
      title: `${brandName} — ${messages.metadata.title}`,
      description: messages.metadata.description,
      url: canonical,
    },
    robots: {
      index: indexable,
      follow: indexable,
    },
  };
};
