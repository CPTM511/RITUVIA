import type { Metadata } from "next";
import { ActionLink } from "@rituvia/ui";
import { notFound } from "next/navigation";

import { NumerologyCalculator } from "../../../_components/numerology-calculator";
import { PublicSiteFrame } from "../../../_components/public-site-frame";
import { getMessages } from "../../../_i18n/messages";
import { getNumerologyMessages } from "../../../_i18n/numerology-messages";
import {
  localeNumerologyLibraryPath,
  parseLocale,
  supportedLocales,
  type Locale,
} from "../../../_i18n/routing";
import { getWebRuntimeConfiguration } from "../../../../config/server";

type NumerologyPageProps = Readonly<{
  params: Promise<Readonly<{ locale: string }>>;
}>;

export const dynamicParams = false;
export const dynamic = "force-dynamic";

const resolveLocale = async (params: NumerologyPageProps["params"]): Promise<Locale> => {
  const locale = parseLocale((await params).locale);
  if (locale === null) notFound();
  return locale;
};

export const generateStaticParams = () => supportedLocales.map((locale) => ({ locale }));

export const generateMetadata = async ({ params }: NumerologyPageProps): Promise<Metadata> => {
  const locale = await resolveLocale(params);
  const messages = getNumerologyMessages(locale);
  const brandName = getWebRuntimeConfiguration().brand.name;
  return {
    description: messages.metadata.description,
    robots: { follow: false, index: false },
    title: `${brandName} — ${messages.metadata.title}`,
  };
};

export default async function NumerologyPage({ params }: NumerologyPageProps) {
  const locale = await resolveLocale(params);
  const configuration = getWebRuntimeConfiguration();
  const messages = getNumerologyMessages(locale);

  return (
    <PublicSiteFrame
      brandName={configuration.client.brand.name}
      brandTagline={configuration.client.brand.tagline}
      currentPage={null}
      locale={locale}
      messages={getMessages(locale).shared}
    >
      <main className="experience-main numerology-main" id="main-content" tabIndex={-1}>
        <header className="experience-heading">
          <p className="eyebrow">{messages.page.eyebrow}</p>
          <h1>{messages.page.title}</h1>
          <p className="experience-introduction">{messages.page.introduction}</p>
          <p className="experience-boundary">{messages.page.boundary}</p>
          <p className="experience-privacy">{messages.page.privacy}</p>
          <ActionLink href={localeNumerologyLibraryPath(locale)} variant="secondary">
            {messages.page.libraryAction}
          </ActionLink>
        </header>
        <NumerologyCalculator messages={messages} />
      </main>
    </PublicSiteFrame>
  );
}
