import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublicSiteFrame } from "../../../_components/public-site-frame";
import { TarotOneCardFlow } from "../../../_components/tarot-one-card-flow";
import { createTarotOneCardMetadata } from "../../../_i18n/metadata";
import { getMessages } from "../../../_i18n/messages";
import { getTarotOneCardMessages } from "../../../_i18n/tarot-one-card-messages";
import {
  localePublicPagePath,
  localeSanctuaryPath,
  localeTarotLibraryPath,
  parseLocale,
  supportedLocales,
  type Locale,
} from "../../../_i18n/routing";
import { getWebRuntimeConfiguration } from "../../../../config/server";

type TarotOneCardPageProps = Readonly<{
  params: Promise<Readonly<{ locale: string }>>;
}>;

export const dynamicParams = false;

const resolveLocale = async (params: TarotOneCardPageProps["params"]): Promise<Locale> => {
  const locale = parseLocale((await params).locale);
  if (locale === null) notFound();
  return locale;
};

export const generateStaticParams = () => supportedLocales.map((locale) => ({ locale }));

export async function generateMetadata({ params }: TarotOneCardPageProps): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const configuration = getWebRuntimeConfiguration();
  return createTarotOneCardMetadata(configuration.brand.name, getTarotOneCardMessages(locale));
}

export default async function TarotOneCardPage({ params }: TarotOneCardPageProps) {
  const locale = await resolveLocale(params);
  const configuration = getWebRuntimeConfiguration();
  const messages = getTarotOneCardMessages(locale);

  return (
    <PublicSiteFrame
      accountNavigation={configuration.deploymentEnvironment !== "staging"}
      brandName={configuration.client.brand.name}
      brandTagline={configuration.client.brand.tagline}
      currentPage={null}
      locale={locale}
      messages={getMessages(locale).shared}
    >
      <main className="tarot-reading-main" id="main-content" tabIndex={-1}>
        <header className="tarot-reading-heading">
          <p className="eyebrow">{messages.page.eyebrow}</p>
          <h1 id="tarot-one-card-heading">{messages.page.title}</h1>
          <p className="tarot-reading-introduction">{messages.page.introduction}</p>
          <p className="tarot-reading-boundary">{messages.page.boundary}</p>
          <p className="tarot-reading-privacy">{messages.page.privacy}</p>
        </header>
        <TarotOneCardFlow
          enhancedInterpretationAvailable={configuration.deploymentEnvironment !== "staging"}
          locale={locale}
          messages={messages}
          methodologyHref={localePublicPagePath(locale, "methodology")}
          sanctuaryHref={localeSanctuaryPath(locale)}
          {...(configuration.deploymentEnvironment === "staging"
            ? {}
            : {
                brandName: configuration.client.brand.name,
                shareCanonicalUrl: new URL(
                  localeTarotLibraryPath(locale),
                  configuration.client.brand.canonicalOrigin,
                ).toString(),
              })}
        />
      </main>
    </PublicSiteFrame>
  );
}
