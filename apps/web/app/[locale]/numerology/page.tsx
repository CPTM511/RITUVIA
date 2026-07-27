import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { NumerologyPublicationHub } from "../../_components/numerology-publication";
import { getMessages } from "../../_i18n/messages";
import { createNumerologyPublicMetadata } from "../../_i18n/numerology-public-metadata";
import { numerologyHubPathname } from "../../_i18n/numerology-public-routes";
import { parseLocale, supportedLocales, type Locale } from "../../_i18n/routing";
import { getWebRuntimeConfiguration } from "../../../config/server";
import { numerologyPublicationCatalog } from "../../../server/numerology-publication";

type NumerologyLibraryPageProps = Readonly<{
  params: Promise<Readonly<{ locale: string }>>;
}>;

export const dynamicParams = false;

const resolveLocale = async (params: NumerologyLibraryPageProps["params"]): Promise<Locale> => {
  const locale = parseLocale((await params).locale);
  if (locale === null) notFound();
  return locale;
};

export const generateStaticParams = () => supportedLocales.map((locale) => ({ locale }));

export const generateMetadata = async ({
  params,
}: NumerologyLibraryPageProps): Promise<Metadata> => {
  await resolveLocale(params);
  const configuration = getWebRuntimeConfiguration();
  const { description, title } = numerologyPublicationCatalog.hub;
  return createNumerologyPublicMetadata({
    brandName: configuration.brand.name,
    canonicalOrigin: configuration.brand.canonicalOrigin,
    deploymentEnvironment: configuration.deploymentEnvironment,
    description,
    pathname: numerologyHubPathname,
    title,
    type: "website",
  });
};

export default async function NumerologyLibraryPage({ params }: NumerologyLibraryPageProps) {
  const locale = await resolveLocale(params);
  const configuration = getWebRuntimeConfiguration();
  return (
    <NumerologyPublicationHub
      brandName={configuration.client.brand.name}
      brandTagline={configuration.client.brand.tagline}
      canonicalOrigin={configuration.brand.canonicalOrigin}
      locale={locale}
      messages={getMessages(locale).shared}
    />
  );
}
