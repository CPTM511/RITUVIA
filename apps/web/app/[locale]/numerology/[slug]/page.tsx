import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { NumerologyPublicationGuide } from "../../../_components/numerology-publication";
import { getMessages } from "../../../_i18n/messages";
import { createNumerologyPublicMetadata } from "../../../_i18n/numerology-public-metadata";
import {
  numerologyArticlePathname,
  numerologyArticleSlugs,
  parseNumerologyArticleSlug,
  type NumerologyArticleSlug,
} from "../../../_i18n/numerology-public-routes";
import { parseLocale, supportedLocales, type Locale } from "../../../_i18n/routing";
import { getWebRuntimeConfiguration } from "../../../../config/server";
import { getNumerologyPublicationGuide } from "../../../../server/numerology-publication";

type NumerologyGuidePageProps = Readonly<{
  params: Promise<Readonly<{ locale: string; slug: string }>>;
}>;

type ResolvedPage = Readonly<{
  locale: Locale;
  slug: NumerologyArticleSlug;
}>;

export const dynamicParams = false;

const resolvePage = async (params: NumerologyGuidePageProps["params"]): Promise<ResolvedPage> => {
  const values = await params;
  const locale = parseLocale(values.locale);
  const slug = parseNumerologyArticleSlug(values.slug);
  if (locale === null || slug === null) notFound();
  return { locale, slug };
};

export const generateStaticParams = () =>
  supportedLocales.flatMap((locale) => numerologyArticleSlugs.map((slug) => ({ locale, slug })));

export const generateMetadata = async ({ params }: NumerologyGuidePageProps): Promise<Metadata> => {
  const { slug } = await resolvePage(params);
  const configuration = getWebRuntimeConfiguration();
  const guide = getNumerologyPublicationGuide(slug);
  return createNumerologyPublicMetadata({
    brandName: configuration.brand.name,
    canonicalOrigin: configuration.brand.canonicalOrigin,
    deploymentEnvironment: configuration.deploymentEnvironment,
    description: guide.description,
    pathname: numerologyArticlePathname(slug),
    title: guide.title,
    type: "article",
  });
};

export default async function NumerologyGuidePage({ params }: NumerologyGuidePageProps) {
  const { locale, slug } = await resolvePage(params);
  const configuration = getWebRuntimeConfiguration();
  return (
    <NumerologyPublicationGuide
      brandName={configuration.client.brand.name}
      brandTagline={configuration.client.brand.tagline}
      canonicalOrigin={configuration.brand.canonicalOrigin}
      guide={getNumerologyPublicationGuide(slug)}
      locale={locale}
      messages={getMessages(locale).shared}
    />
  );
}
