import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AstrologyPublicationHub } from "../../_components/astrology-publication";
import { NumerologyPublicationHub } from "../../_components/numerology-publication";
import { PublicInformationPage } from "../../_components/public-information-page";
import { RitualReflectionPublicationHub } from "../../_components/ritual-reflection-publication";
import { TarotPublicationHub } from "../../_components/tarot-publication";
import { createAstrologyPublicMetadata } from "../../_i18n/astrology-public-metadata";
import { getMessages } from "../../_i18n/messages";
import { createPublicPageMetadata } from "../../_i18n/metadata";
import { createNumerologyPublicMetadata } from "../../_i18n/numerology-public-metadata";
import { createRitualReflectionPublicMetadata } from "../../_i18n/ritual-reflection-public-metadata";
import { createTarotPublicMetadata } from "../../_i18n/tarot-public-metadata";
import {
  parseAstrologyRouteId,
  parseNumerologyRouteId,
  parseRitualReflectionRouteId,
  parseTarotRouteId,
  publicRouteRegistry,
  type PublicPageSlug,
} from "../../_i18n/public-routes";
import { parseLocale, type Locale } from "../../_i18n/routing";
import { getWebRuntimeConfiguration } from "../../../config/server";
import { astrologyPublicationCatalog } from "../../../server/astrology-publication";
import { numerologyPublicationCatalog } from "../../../server/numerology-publication";
import { ritualReflectionPublication } from "../../../server/ritual-reflection-publication";
import { tarotLibraryPublication } from "../../../server/tarot-publication";

type PublicPageProps = Readonly<{
  params: Promise<Readonly<{ locale: string; page: string }>>;
}>;

type ResolvedPublicPage = Readonly<{
  locale: Locale;
  route: (typeof publicRouteRegistry.records)[number];
}>;

export const dynamicParams = false;

const resolvePublicPage = async (
  params: PublicPageProps["params"],
): Promise<ResolvedPublicPage> => {
  const values = await params;
  const locale = parseLocale(values.locale);
  if (locale === null) notFound();
  const route = publicRouteRegistry.routeByPathname(`/${locale}/${values.page}`);
  if (route === null || route.segments.length !== 1) notFound();
  return { locale, route };
};

export const generateStaticParams = () =>
  publicRouteRegistry.records
    .filter((route) => route.segments.length === 1)
    .map((route) => ({ locale: route.locale, page: route.segments[0] }));

export async function generateMetadata({ params }: PublicPageProps): Promise<Metadata> {
  const { locale, route } = await resolvePublicPage(params);
  const configuration = getWebRuntimeConfiguration();
  const numerologyRoute = parseNumerologyRouteId(route.id);
  if (numerologyRoute === "hub") {
    const { description, title } = numerologyPublicationCatalog.hub;
    return createNumerologyPublicMetadata({
      brandName: configuration.brand.name,
      canonicalOrigin: configuration.brand.canonicalOrigin,
      deploymentEnvironment: configuration.deploymentEnvironment,
      description,
      locale,
      routeId: "numerology-hub",
      title,
      type: "website",
    });
  }
  const astrologyRoute = parseAstrologyRouteId(route.id);
  if (astrologyRoute === "hub") {
    const { description, title } = astrologyPublicationCatalog.hub;
    return createAstrologyPublicMetadata({
      brandName: configuration.brand.name,
      canonicalOrigin: configuration.brand.canonicalOrigin,
      deploymentEnvironment: configuration.deploymentEnvironment,
      description,
      locale,
      publicationApproved: true,
      routeId: "astrology-hub",
      title,
      type: "website",
    });
  }
  const tarotRoute = parseTarotRouteId(route.id);
  if (tarotRoute === "hub") {
    const { description, title } = tarotLibraryPublication.hub;
    return createTarotPublicMetadata({
      brandName: configuration.brand.name,
      canonicalOrigin: configuration.brand.canonicalOrigin,
      deploymentEnvironment: configuration.deploymentEnvironment,
      description,
      locale,
      publicationApproved: true,
      routeId: "tarot-hub",
      title,
      type: "website",
    });
  }
  const ritualReflectionRoute = parseRitualReflectionRouteId(route.id);
  if (ritualReflectionRoute === "hub") {
    const { description, title } = ritualReflectionPublication.hub;
    return createRitualReflectionPublicMetadata({
      brandName: configuration.brand.name,
      canonicalOrigin: configuration.brand.canonicalOrigin,
      deploymentEnvironment: configuration.deploymentEnvironment,
      description,
      locale,
      publicationApproved: true,
      routeId: "ritual-reflection-hub",
      title,
      type: "website",
    });
  }
  if (
    route.id === "home" ||
    numerologyRoute !== null ||
    astrologyRoute !== null ||
    tarotRoute !== null ||
    ritualReflectionRoute !== null
  )
    notFound();
  return createPublicPageMetadata({
    brandName: configuration.brand.name,
    canonicalOrigin: configuration.brand.canonicalOrigin,
    deploymentEnvironment: configuration.deploymentEnvironment,
    locale,
    messages: getMessages(locale),
    page: route.id as PublicPageSlug,
  });
}

export default async function PublicPage({ params }: PublicPageProps) {
  const { locale, route } = await resolvePublicPage(params);
  const configuration = getWebRuntimeConfiguration();
  const numerologyRoute = parseNumerologyRouteId(route.id);
  if (numerologyRoute === "hub") {
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
  const astrologyRoute = parseAstrologyRouteId(route.id);
  if (astrologyRoute === "hub") {
    return (
      <AstrologyPublicationHub
        brandName={configuration.client.brand.name}
        brandTagline={configuration.client.brand.tagline}
        canonicalOrigin={configuration.brand.canonicalOrigin}
        locale={locale}
        messages={getMessages(locale).shared}
      />
    );
  }
  const tarotRoute = parseTarotRouteId(route.id);
  if (tarotRoute === "hub") {
    return (
      <TarotPublicationHub
        brandName={configuration.client.brand.name}
        brandTagline={configuration.client.brand.tagline}
        canonicalOrigin={configuration.brand.canonicalOrigin}
        locale={locale}
        messages={getMessages(locale).shared}
      />
    );
  }
  const ritualReflectionRoute = parseRitualReflectionRouteId(route.id);
  if (ritualReflectionRoute === "hub") {
    return (
      <RitualReflectionPublicationHub
        brandName={configuration.client.brand.name}
        brandTagline={configuration.client.brand.tagline}
        canonicalOrigin={configuration.brand.canonicalOrigin}
        locale={locale}
        messages={getMessages(locale).shared}
      />
    );
  }
  if (
    route.id === "home" ||
    numerologyRoute !== null ||
    astrologyRoute !== null ||
    tarotRoute !== null ||
    ritualReflectionRoute !== null
  )
    notFound();
  return (
    <PublicInformationPage
      brandName={configuration.client.brand.name}
      brandTagline={configuration.client.brand.tagline}
      canonicalOrigin={configuration.brand.canonicalOrigin}
      locale={locale}
      messages={getMessages(locale)}
      page={route.id as PublicPageSlug}
    />
  );
}
