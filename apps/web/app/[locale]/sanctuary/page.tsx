import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublicSiteFrame } from "../../_components/public-site-frame";
import { SanctuaryFlow } from "../../_components/sanctuary-flow";
import { getMessages } from "../../_i18n/messages";
import {
  localeAccountPath,
  localeRevisitPath,
  localeSanctuaryPath,
  localeSignInPath,
  localeTarotOneCardPath,
  parseLocale,
  supportedLocales,
  type Locale,
} from "../../_i18n/routing";
import { getSanctuaryMessages } from "../../_i18n/sanctuary-messages";
import { getWebRuntimeConfiguration } from "../../../config/server";

type SanctuaryPageProps = Readonly<{
  params: Promise<Readonly<{ locale: string }>>;
}>;

export const dynamicParams = false;
export const dynamic = "force-dynamic";

const resolveLocale = async (params: SanctuaryPageProps["params"]): Promise<Locale> => {
  const locale = parseLocale((await params).locale);
  if (locale === null) notFound();
  return locale;
};

export const generateStaticParams = () => supportedLocales.map((locale) => ({ locale }));

export const generateMetadata = async ({ params }: SanctuaryPageProps): Promise<Metadata> => {
  const locale = await resolveLocale(params);
  return {
    robots: { follow: false, index: false },
    title: getSanctuaryMessages(locale).page.title,
  };
};

export default async function SanctuaryPage({ params }: SanctuaryPageProps) {
  const locale = await resolveLocale(params);
  const configuration = getWebRuntimeConfiguration();
  const messages = getSanctuaryMessages(locale);

  return (
    <PublicSiteFrame
      brandName={configuration.client.brand.name}
      brandTagline={configuration.client.brand.tagline}
      currentPage={null}
      locale={locale}
      messages={getMessages(locale).shared}
    >
      <main className="experience-main sanctuary-main" id="main-content" tabIndex={-1}>
        <header className="experience-heading">
          <p className="eyebrow">{messages.page.eyebrow}</p>
          <h1>{messages.page.title}</h1>
          <p className="experience-introduction">{messages.page.introduction}</p>
          <p className="experience-boundary">{messages.page.boundary}</p>
          <p className="experience-privacy">{messages.page.privacy}</p>
        </header>
        <SanctuaryFlow
          accountHref={localeAccountPath(locale)}
          messages={messages}
          readingHref={localeTarotOneCardPath(locale)}
          revisitHref={localeRevisitPath(locale)}
          sanctuaryHref={localeSanctuaryPath(locale)}
          signInHref={localeSignInPath(locale)}
        />
      </main>
    </PublicSiteFrame>
  );
}
