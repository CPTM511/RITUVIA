import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublicStructuredData } from "../_components/public-structured-data";
import { SiteShell } from "../_components/site-shell";
import { getWebRuntimeConfiguration } from "../../config/server";
import {
  getGoldenShellMessages,
  goldenShellHomePath,
  goldenShellLocales,
  parseGoldenShellLocale,
  type GoldenShellLocale,
} from "../_i18n/golden-shell-messages";

import "../golden-shell.css";

type LocalePageProps = Readonly<{
  params: Promise<Readonly<{ locale: string }>>;
}>;

export const dynamicParams = false;

const resolvePageLocale = async (params: LocalePageProps["params"]): Promise<GoldenShellLocale> => {
  const locale = parseGoldenShellLocale((await params).locale);
  if (locale === null) notFound();
  return locale;
};

export const generateStaticParams = () => goldenShellLocales.map((locale) => ({ locale }));

export async function generateMetadata({ params }: LocalePageProps): Promise<Metadata> {
  const locale = await resolvePageLocale(params);
  const configuration = getWebRuntimeConfiguration();
  const messages = getGoldenShellMessages(locale);
  const canonical = new URL(
    goldenShellHomePath(locale),
    configuration.brand.canonicalOrigin,
  ).toString();
  const title = `${configuration.brand.name} — ${messages.metadata.title}`;
  const indexable = configuration.deploymentEnvironment === "production" && locale === "en";

  return {
    alternates:
      locale === "en"
        ? {
            canonical,
            languages: { en: canonical, "x-default": canonical },
          }
        : undefined,
    description: messages.metadata.description,
    openGraph:
      locale === "en"
        ? {
            description: messages.metadata.description,
            siteName: configuration.brand.name,
            title,
            type: "website",
            url: canonical,
          }
        : undefined,
    robots: {
      follow: indexable,
      index: indexable,
    },
    title,
  };
}

export default async function LocalePage({ params }: LocalePageProps) {
  const locale = await resolvePageLocale(params);
  const configuration = getWebRuntimeConfiguration();
  const messages = getGoldenShellMessages(locale);

  return (
    <>
      {locale === "en" ? (
        <PublicStructuredData
          canonicalOrigin={configuration.brand.canonicalOrigin}
          description={messages.hero.introduction}
          locale={locale}
          routeId="home"
          title={`${messages.hero.titleLead} ${messages.hero.titleAccent}`}
        />
      ) : null}
      <SiteShell brandName={configuration.client.brand.name} locale={locale} messages={messages} />
    </>
  );
}
