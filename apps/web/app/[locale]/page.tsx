import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SiteShell } from "../_components/site-shell";
import { getWebRuntimeConfiguration } from "../../config/server";
import { createHomeMetadata } from "../_i18n/metadata";
import { getMessages } from "../_i18n/messages";
import { parseLocale, supportedLocales, type Locale } from "../_i18n/routing";

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

  return createHomeMetadata({
    brandName: configuration.brand.name,
    canonicalOrigin: configuration.brand.canonicalOrigin,
    deploymentEnvironment: configuration.deploymentEnvironment,
    locale,
    messages: getMessages(locale),
  });
}

export default async function LocalePage({ params }: LocalePageProps) {
  const locale = await resolvePageLocale(params);
  const configuration = getWebRuntimeConfiguration();

  return (
    <SiteShell
      brandName={configuration.client.brand.name}
      brandTagline={configuration.client.brand.tagline}
      locale={locale}
      messages={getMessages(locale)}
    />
  );
}
