import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublicInformationPage } from "../../_components/public-information-page";
import { createPublicPageMetadata } from "../../_i18n/metadata";
import { getMessages } from "../../_i18n/messages";
import {
  parseLocale,
  parsePublicPageSlug,
  publicPageSlugs,
  supportedLocales,
  type Locale,
  type PublicPageSlug,
} from "../../_i18n/routing";
import { getWebRuntimeConfiguration } from "../../../config/server";

type PublicPageProps = Readonly<{
  params: Promise<Readonly<{ locale: string; page: string }>>;
}>;

type ResolvedPublicPage = Readonly<{
  locale: Locale;
  page: PublicPageSlug;
}>;

export const dynamicParams = false;

const resolvePublicPage = async (
  params: PublicPageProps["params"],
): Promise<ResolvedPublicPage> => {
  const values = await params;
  const locale = parseLocale(values.locale);
  const page = parsePublicPageSlug(values.page);
  if (locale === null || page === null) notFound();
  return { locale, page };
};

export const generateStaticParams = () =>
  supportedLocales.flatMap((locale) => publicPageSlugs.map((page) => ({ locale, page })));

export async function generateMetadata({ params }: PublicPageProps): Promise<Metadata> {
  const { locale, page } = await resolvePublicPage(params);
  const configuration = getWebRuntimeConfiguration();

  return createPublicPageMetadata({
    brandName: configuration.brand.name,
    canonicalOrigin: configuration.brand.canonicalOrigin,
    deploymentEnvironment: configuration.deploymentEnvironment,
    locale,
    messages: getMessages(locale),
    page,
  });
}

export default async function PublicPage({ params }: PublicPageProps) {
  const { locale, page } = await resolvePublicPage(params);
  const configuration = getWebRuntimeConfiguration();

  return (
    <PublicInformationPage
      brandName={configuration.client.brand.name}
      brandTagline={configuration.client.brand.tagline}
      locale={locale}
      messages={getMessages(locale)}
      page={page}
    />
  );
}
