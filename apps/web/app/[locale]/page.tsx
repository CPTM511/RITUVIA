import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SiteShell } from "../_components/site-shell";
import { getWebRuntimeConfiguration } from "../../config/server";
import {
  getGoldenShellMessages,
  goldenShellHomePath,
  goldenShellLocales,
  parseGoldenShellLocale,
  type GoldenShellLocale,
} from "../_i18n/golden-shell-messages";

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

  return {
    alternates: locale === "en" ? { canonical } : undefined,
    description: messages.metadata.description,
    robots:
      configuration.deploymentEnvironment === "production" && locale === "en"
        ? undefined
        : { follow: false, index: false, nocache: true },
    title: `${configuration.brand.name} — ${messages.metadata.title}`,
  };
}

export default async function LocalePage({ params }: LocalePageProps) {
  const locale = await resolvePageLocale(params);
  const configuration = getWebRuntimeConfiguration();

  return (
    <SiteShell
      brandName={configuration.client.brand.name}
      locale={locale}
      messages={getGoldenShellMessages(locale)}
    />
  );
}
