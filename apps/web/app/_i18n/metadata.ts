import type { Metadata } from "next";

import { getPublicPageMessages, type ShellMessages } from "./messages";
import type { QuestionIntakeMessages } from "./question-intake-messages";
import { localePublicPagePath, type Locale, type PublicPageId } from "./routing";
import type { DeploymentEnvironment } from "./seo";

type PublicPageMetadataInput = Readonly<{
  brandName: string;
  canonicalOrigin: string;
  deploymentEnvironment: DeploymentEnvironment;
  locale: Locale;
  messages: ShellMessages;
  page: PublicPageId;
}>;

export const createPublicPageMetadata = ({
  brandName,
  canonicalOrigin,
  deploymentEnvironment,
  locale,
  messages,
  page,
}: PublicPageMetadataInput): Metadata => {
  const pageMessages = page === "home" ? messages.home : getPublicPageMessages(messages, page);
  const canonical = new URL(localePublicPagePath(locale, page), canonicalOrigin).toString();
  const indexable = deploymentEnvironment === "production";

  return {
    title: `${brandName} — ${pageMessages.metadata.title}`,
    description: pageMessages.metadata.description,
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
      title: `${brandName} — ${pageMessages.metadata.title}`,
      description: pageMessages.metadata.description,
      url: canonical,
    },
    robots: {
      index: indexable,
      follow: indexable,
    },
  };
};

export const createHomeMetadata = (input: Omit<PublicPageMetadataInput, "page">): Metadata =>
  createPublicPageMetadata({ ...input, page: "home" });

export const createQuestionIntakeMetadata = (
  brandName: string,
  messages: QuestionIntakeMessages,
): Metadata => ({
  description: messages.metadata.description,
  robots: { follow: false, index: false },
  title: `${brandName} — ${messages.metadata.title}`,
});
