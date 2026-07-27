import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublicSiteFrame } from "../../../_components/public-site-frame";
import { TarotThreeCardFlow } from "../../../_components/tarot-three-card-flow";
import { createTarotThreeCardMetadata } from "../../../_i18n/metadata";
import { getMessages } from "../../../_i18n/messages";
import { getTarotThreeCardMessages } from "../../../_i18n/tarot-three-card-messages";
import {
  localePublicPagePath,
  localeSanctuaryPath,
  parseLocale,
  supportedLocales,
  type Locale,
} from "../../../_i18n/routing";
import { getWebRuntimeConfiguration } from "../../../../config/server";

type TarotThreeCardPageProps = Readonly<{
  params: Promise<Readonly<{ locale: string }>>;
}>;

export const dynamicParams = false;

const resolveLocale = async (params: TarotThreeCardPageProps["params"]): Promise<Locale> => {
  const locale = parseLocale((await params).locale);
  if (locale === null) notFound();
  return locale;
};

export const generateStaticParams = () => supportedLocales.map((locale) => ({ locale }));

export async function generateMetadata({ params }: TarotThreeCardPageProps): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const configuration = getWebRuntimeConfiguration();
  return createTarotThreeCardMetadata(configuration.brand.name, getTarotThreeCardMessages(locale));
}

export default async function TarotThreeCardPage({ params }: TarotThreeCardPageProps) {
  const locale = await resolveLocale(params);
  const configuration = getWebRuntimeConfiguration();
  const messages = getTarotThreeCardMessages(locale);

  return (
    <PublicSiteFrame
      brandName={configuration.client.brand.name}
      brandTagline={configuration.client.brand.tagline}
      currentPage={null}
      locale={locale}
      messages={getMessages(locale).shared}
    >
      <main className="tarot-reading-main" id="main-content" tabIndex={-1}>
        <header className="tarot-reading-heading">
          <p className="eyebrow">{messages.page.eyebrow}</p>
          <h1 id="tarot-three-card-heading">{messages.page.title}</h1>
          <p className="tarot-reading-introduction">{messages.page.introduction}</p>
          <p className="tarot-reading-boundary">{messages.page.boundary}</p>
          <p className="tarot-reading-privacy">{messages.page.privacy}</p>
        </header>
        <TarotThreeCardFlow
          messages={messages}
          methodologyHref={localePublicPagePath(locale, "methodology")}
          sanctuaryHref={localeSanctuaryPath(locale)}
        />
      </main>
    </PublicSiteFrame>
  );
}
