import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SiteShell } from "../_components/site-shell";
import { getWebRuntimeConfiguration } from "../../config/server";
import { createPublicPageMetadata } from "../_i18n/metadata";
import { getMessages } from "../_i18n/messages";
import { parseLocale, supportedLocales, type Locale } from "../_i18n/routing";
import { loadNumerologyAvailability } from "../../server/numerology-state";

type LocalePageProps = Readonly<{
  params: Promise<Readonly<{ locale: string }>>;
}>;

export const dynamicParams = false;

const resolvePageLocale = async (params: LocalePageProps["params"]): Promise<Locale> => {
  const locale = parseLocale((await params).locale);
  if (locale === null) notFound();
  return locale;
};

export const generateStaticParams = () => supportedLocales.map((locale) => ({ locale }));

export async function generateMetadata({ params }: LocalePageProps): Promise<Metadata> {
  const locale = await resolvePageLocale(params);
  const configuration = getWebRuntimeConfiguration();

  return createPublicPageMetadata({
    brandName: configuration.brand.name,
    canonicalOrigin: configuration.brand.canonicalOrigin,
    deploymentEnvironment: configuration.deploymentEnvironment,
    locale,
    messages: getMessages(locale),
    page: "home",
  });
}

export default async function LocalePage({ params }: LocalePageProps) {
  const locale = await resolvePageLocale(params);
  const configuration = getWebRuntimeConfiguration();

  return (
    <SiteShell
      brandName={configuration.client.brand.name}
      brandTagline={configuration.client.brand.tagline}
      canonicalOrigin={configuration.brand.canonicalOrigin}
      locale={locale}
      messages={getMessages(locale)}
      numerologyEnabled={loadNumerologyAvailability() === "enabled"}
    />
  );
}
