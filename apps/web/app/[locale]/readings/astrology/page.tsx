import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AstrologyNatalResult } from "../../../_components/astrology-natal-result";
import { RecoveryAstrologyCalculator } from "../../../_components/recovery-astrology-calculator";
import { PublicSiteFrame } from "../../../_components/public-site-frame";
import { getAstrologyMessages } from "../../../_i18n/astrology-messages";
import { recoveryAstrologyMessages } from "../../../_i18n/recovery-astrology-messages";
import { getMessages } from "../../../_i18n/messages";
import {
  localeSignInPath,
  parseLocale,
  supportedLocales,
  type Locale,
} from "../../../_i18n/routing";
import { getWebRuntimeConfiguration } from "../../../../config/server";
import { inspectRecoveryStagingRuntime } from "../../../../server/recovery-staging";

type AstrologyPageProps = Readonly<{
  params: Promise<Readonly<{ locale: string }>>;
}>;

export const dynamic = "force-dynamic";
export const dynamicParams = false;

const resolveLocale = async (params: AstrologyPageProps["params"]): Promise<Locale> => {
  const locale = parseLocale((await params).locale);
  if (locale === null) notFound();
  return locale;
};

export const generateStaticParams = () => supportedLocales.map((locale) => ({ locale }));

export const generateMetadata = async ({ params }: AstrologyPageProps): Promise<Metadata> => {
  const locale = await resolveLocale(params);
  const recovery = inspectRecoveryStagingRuntime();
  const metadata =
    locale === "en" && recovery.ready && recovery.recoveryItem >= 8
      ? recoveryAstrologyMessages.astrology.metadata
      : getAstrologyMessages(locale).metadata;
  return {
    description: metadata.description,
    robots: { follow: false, index: false },
    title: metadata.title,
  };
};

export default async function AstrologyPage({ params }: AstrologyPageProps) {
  const locale = await resolveLocale(params);
  const configuration = getWebRuntimeConfiguration();
  const recovery = inspectRecoveryStagingRuntime();
  const recoveryEnabled = locale === "en" && recovery.ready && recovery.recoveryItem >= 8;
  const messages = recoveryEnabled
    ? recoveryAstrologyMessages.astrology
    : getAstrologyMessages(locale);

  return (
    <PublicSiteFrame
      accountNavigation={configuration.deploymentEnvironment !== "staging"}
      brandName={configuration.client.brand.name}
      brandTagline={configuration.client.brand.tagline}
      currentPage={null}
      locale={locale}
      messages={getMessages(locale).shared}
    >
      <main className="experience-main astrology-main" id="main-content" tabIndex={-1}>
        <header className="astrology-page-heading">
          <p className="eyebrow">{messages.page.eyebrow}</p>
          <h1>{messages.page.title}</h1>
          <p className="astrology-page-introduction">{messages.page.introduction}</p>
          <p className="astrology-page-boundary">{messages.page.boundary}</p>
          <p className="astrology-page-privacy">{messages.page.privacy}</p>
        </header>
        {recoveryEnabled ? (
          <RecoveryAstrologyCalculator
            locale={locale}
            messages={recoveryAstrologyMessages}
            sourceSha={recovery.sourceSha}
          />
        ) : (
          <AstrologyNatalResult
            locale={locale}
            messages={messages}
            signInHref={localeSignInPath(locale)}
          />
        )}
      </main>
    </PublicSiteFrame>
  );
}
