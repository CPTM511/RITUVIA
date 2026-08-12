import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AstrologyPublicationGuide } from "../../../_components/astrology-publication";
import { NumerologyPublicationGuide } from "../../../_components/numerology-publication";
import { RitualReflectionPublicationGuide } from "../../../_components/ritual-reflection-publication";
import {
  TarotPublicationCard,
  TarotPublicationSpread,
} from "../../../_components/tarot-publication";
import { createAstrologyPublicMetadata } from "../../../_i18n/astrology-public-metadata";
import { astrologyRouteId } from "../../../_i18n/astrology-public-routes";
import { getMessages } from "../../../_i18n/messages";
import { createNumerologyPublicMetadata } from "../../../_i18n/numerology-public-metadata";
import { numerologyRouteId } from "../../../_i18n/numerology-public-routes";
import { createRitualReflectionPublicMetadata } from "../../../_i18n/ritual-reflection-public-metadata";
import { ritualReflectionRouteId } from "../../../_i18n/ritual-reflection-public-routes";
import { createTarotPublicMetadata } from "../../../_i18n/tarot-public-metadata";
import { tarotRouteId } from "../../../_i18n/tarot-public-routes";
import {
  parseAstrologyRouteId,
  parseNumerologyRouteId,
  parseRitualReflectionRouteId,
  parseTarotRouteId,
  publicRouteRegistry,
} from "../../../_i18n/public-routes";
import { parseLocale, type Locale } from "../../../_i18n/routing";
import { getWebRuntimeConfiguration } from "../../../../config/server";
import { getAstrologyPublicationGuide } from "../../../../server/astrology-publication";
import { getNumerologyPublicationGuide } from "../../../../server/numerology-publication";
import { getRitualReflectionGuide } from "../../../../server/ritual-reflection-publication";
import { getTarotLibraryGuide } from "../../../../server/tarot-publication";

type PublicGuidePageProps = Readonly<{
  params: Promise<Readonly<{ locale: string; page: string; slug: string }>>;
}>;

type ResolvedPublicGuide = Readonly<{
  locale: Locale;
  route: (typeof publicRouteRegistry.records)[number];
}>;

export const dynamicParams = false;

const resolvePublicGuide = async (
  params: PublicGuidePageProps["params"],
): Promise<ResolvedPublicGuide> => {
  const values = await params;
  const locale = parseLocale(values.locale);
  if (locale === null) notFound();
  const route = publicRouteRegistry.routeByPathname(`/${locale}/${values.page}/${values.slug}`);
  if (route === null || route.segments.length !== 2) notFound();
  return { locale, route };
};

export const generateStaticParams = () =>
  publicRouteRegistry.records
    .filter((route) => route.segments.length === 2)
    .map((route) => ({
      locale: route.locale,
      page: route.segments[0],
      slug: route.segments[1],
    }));

export const generateMetadata = async ({ params }: PublicGuidePageProps): Promise<Metadata> => {
  const { locale, route } = await resolvePublicGuide(params);
  const configuration = getWebRuntimeConfiguration();
  const numerologySlug = parseNumerologyRouteId(route.id);
  if (numerologySlug !== null && numerologySlug !== "hub") {
    const guide = getNumerologyPublicationGuide(numerologySlug);
    return createNumerologyPublicMetadata({
      brandName: configuration.brand.name,
      canonicalOrigin: configuration.brand.canonicalOrigin,
      deploymentEnvironment: configuration.deploymentEnvironment,
      description: guide.description,
      locale,
      routeId: numerologyRouteId(numerologySlug),
      title: guide.title,
      type: "article",
    });
  }
  const astrologySlug = parseAstrologyRouteId(route.id);
  if (astrologySlug !== null && astrologySlug !== "hub") {
    const guide = getAstrologyPublicationGuide(astrologySlug);
    return createAstrologyPublicMetadata({
      brandName: configuration.brand.name,
      canonicalOrigin: configuration.brand.canonicalOrigin,
      deploymentEnvironment: configuration.deploymentEnvironment,
      description: guide.description,
      locale,
      publicationApproved: true,
      routeId: astrologyRouteId(astrologySlug),
      title: guide.title,
      type: "article",
    });
  }
  const tarotSlug = parseTarotRouteId(route.id);
  if (tarotSlug !== null && tarotSlug !== "hub") {
    const guide = getTarotLibraryGuide(tarotSlug);
    return createTarotPublicMetadata({
      brandName: configuration.brand.name,
      canonicalOrigin: configuration.brand.canonicalOrigin,
      deploymentEnvironment: configuration.deploymentEnvironment,
      description: guide.description,
      locale,
      publicationApproved: true,
      routeId: tarotRouteId(tarotSlug),
      title: guide.title,
      type: "article",
    });
  }
  const ritualReflectionSlug = parseRitualReflectionRouteId(route.id);
  if (ritualReflectionSlug !== null && ritualReflectionSlug !== "hub") {
    const guide = getRitualReflectionGuide(ritualReflectionSlug);
    return createRitualReflectionPublicMetadata({
      brandName: configuration.brand.name,
      canonicalOrigin: configuration.brand.canonicalOrigin,
      deploymentEnvironment: configuration.deploymentEnvironment,
      description: guide.description,
      locale,
      publicationApproved: true,
      routeId: ritualReflectionRouteId(ritualReflectionSlug),
      title: guide.title,
      type: "article",
    });
  }
  notFound();
};

export default async function PublicGuidePage({ params }: PublicGuidePageProps) {
  const { locale, route } = await resolvePublicGuide(params);
  const configuration = getWebRuntimeConfiguration();
  const numerologySlug = parseNumerologyRouteId(route.id);
  if (numerologySlug !== null && numerologySlug !== "hub") {
    return (
      <NumerologyPublicationGuide
        brandName={configuration.client.brand.name}
        brandTagline={configuration.client.brand.tagline}
        canonicalOrigin={configuration.brand.canonicalOrigin}
        guide={getNumerologyPublicationGuide(numerologySlug)}
        locale={locale}
        messages={getMessages(locale).shared}
      />
    );
  }
  const astrologySlug = parseAstrologyRouteId(route.id);
  if (astrologySlug !== null && astrologySlug !== "hub") {
    return (
      <AstrologyPublicationGuide
        brandName={configuration.client.brand.name}
        brandTagline={configuration.client.brand.tagline}
        canonicalOrigin={configuration.brand.canonicalOrigin}
        guide={getAstrologyPublicationGuide(astrologySlug)}
        locale={locale}
        messages={getMessages(locale).shared}
      />
    );
  }
  const tarotSlug = parseTarotRouteId(route.id);
  if (tarotSlug !== null && tarotSlug !== "hub") {
    const guide = getTarotLibraryGuide(tarotSlug);
    const sharedProps = {
      brandName: configuration.client.brand.name,
      brandTagline: configuration.client.brand.tagline,
      canonicalOrigin: configuration.brand.canonicalOrigin,
      locale,
      messages: getMessages(locale).shared,
    };
    return guide.kind === "card" ? (
      <TarotPublicationCard {...sharedProps} guide={guide} />
    ) : (
      <TarotPublicationSpread {...sharedProps} guide={guide} />
    );
  }
  const ritualReflectionSlug = parseRitualReflectionRouteId(route.id);
  if (ritualReflectionSlug !== null && ritualReflectionSlug !== "hub") {
    return (
      <RitualReflectionPublicationGuide
        brandName={configuration.client.brand.name}
        brandTagline={configuration.client.brand.tagline}
        canonicalOrigin={configuration.brand.canonicalOrigin}
        guide={getRitualReflectionGuide(ritualReflectionSlug)}
        locale={locale}
        messages={getMessages(locale).shared}
      />
    );
  }
  notFound();
}
