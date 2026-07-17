import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublicSiteFrame } from "../../../_components/public-site-frame";
import { TarotOneCardFlow } from "../../../_components/tarot-one-card-flow";
import { createTarotOneCardMetadata } from "../../../_i18n/metadata";
import { getMessages } from "../../../_i18n/messages";
import { getTarotOneCardMessages } from "../../../_i18n/tarot-one-card-messages";
import {
  localePublicPagePath,
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
      brandName={configuration.client.brand.name}
      brandTagline={configuration.client.brand.tagline}
      currentPage={null}
      locale={locale}
      messages={getMessages(locale).shared}
    >
      <main className="tarot-one-card-main" id="main-content" tabIndex={-1}>
        <header className="tarot-one-card-heading">
          <p className="eyebrow">{messages.page.eyebrow}</p>
          <h1 id="tarot-one-card-heading">{messages.page.title}</h1>
          <p className="tarot-one-card-introduction">{messages.page.introduction}</p>
          <p className="tarot-one-card-boundary">{messages.page.boundary}</p>
          <p className="tarot-one-card-privacy">{messages.page.privacy}</p>
        </header>
        <TarotOneCardFlow
          messages={messages}
          methodologyHref={localePublicPagePath(locale, "methodology")}
        />
      </main>
    </PublicSiteFrame>
  );
}
