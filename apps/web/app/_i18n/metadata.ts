import type { Metadata } from "next";

import { getPublicPageMessages, type ShellMessages } from "./messages";
import type { QuestionIntakeMessages } from "./question-intake-messages";
import type { TarotOneCardMessages } from "./tarot-one-card-messages";
import type { TarotThreeCardMessages } from "./tarot-three-card-messages";
import { createLocalizedPublicAlternates } from "./public-route-metadata";
import type { Locale, PublicPageId } from "./routing";
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
  const alternates = createLocalizedPublicAlternates(canonicalOrigin, locale, page);
  const canonical = alternates?.canonical as string | undefined;
  const indexable = deploymentEnvironment === "production" && alternates !== null;

  return {
    title: `${brandName} — ${pageMessages.metadata.title}`,
    description: pageMessages.metadata.description,
    ...(alternates === null ? {} : { alternates }),
    openGraph: {
      type: "website",
      siteName: brandName,
      title: `${brandName} — ${pageMessages.metadata.title}`,
      description: pageMessages.metadata.description,
      ...(canonical === undefined ? {} : { url: canonical }),
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

export const createTarotOneCardMetadata = (
  brandName: string,
  messages: TarotOneCardMessages,
): Metadata => ({
  description: messages.metadata.description,
  robots: { follow: false, index: false },
  title: `${brandName} — ${messages.metadata.title}`,
});

export const createTarotThreeCardMetadata = (
  brandName: string,
  messages: TarotThreeCardMessages,
): Metadata => ({
  description: messages.metadata.description,
  robots: { follow: false, index: false },
  title: `${brandName} — ${messages.metadata.title}`,
});
