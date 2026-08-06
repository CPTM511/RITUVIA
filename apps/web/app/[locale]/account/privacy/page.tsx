import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PrivacyControlExperience } from "../../../_components/privacy-control-experience";
import { PublicSiteFrame } from "../../../_components/public-site-frame";
import { getMessages } from "../../../_i18n/messages";
import { getPrivacyControlMessages } from "../../../_i18n/privacy-control-messages";
import {
  localeAccountPath,
  localeSignInPath,
  parseLocale,
  supportedLocales,
  type Locale,
} from "../../../_i18n/routing";
import { getWebRuntimeConfiguration } from "../../../../config/server";

type PrivacyPageProps = Readonly<{
  params: Promise<Readonly<{ locale: string }>>;
}>;

export const dynamicParams = false;
export const dynamic = "force-dynamic";

const resolveLocale = async (params: PrivacyPageProps["params"]): Promise<Locale> => {
  const locale = parseLocale((await params).locale);
  if (locale === null) notFound();
  return locale;
};

export const generateStaticParams = () => supportedLocales.map((locale) => ({ locale }));

export const generateMetadata = async ({ params }: PrivacyPageProps): Promise<Metadata> => {
  const locale = await resolveLocale(params);
  return {
    robots: { follow: false, index: false },
    title: getPrivacyControlMessages(locale).title,
  };
};

export default async function PrivacyPage({ params }: PrivacyPageProps) {
  const locale = await resolveLocale(params);
  const configuration = getWebRuntimeConfiguration();
  return (
    <PublicSiteFrame
      brandName={configuration.client.brand.name}
      brandTagline={configuration.client.brand.tagline}
      currentPage={null}
      locale={locale}
      messages={getMessages(locale).shared}
    >
      <main className="experience-main account-main" id="main-content" tabIndex={-1}>
        <PrivacyControlExperience
          accountHref={localeAccountPath(locale)}
          messages={getPrivacyControlMessages(locale)}
          signInHref={localeSignInPath(locale)}
        />
      </main>
    </PublicSiteFrame>
  );
}
