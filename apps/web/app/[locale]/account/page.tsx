import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AccountExperience } from "../../_components/account-experience";
import { PublicSiteFrame } from "../../_components/public-site-frame";
import { getAccountMessages } from "../../_i18n/account-messages";
import { getMessages } from "../../_i18n/messages";
import {
  localeSanctuaryPath,
  localeAccountPrivacyPath,
  localeSignInPath,
  localeTarotOneCardPath,
  localeTarotThreeCardPath,
  parseLocale,
  supportedLocales,
  type Locale,
} from "../../_i18n/routing";
import { getWebRuntimeConfiguration } from "../../../config/server";

type AccountPageProps = Readonly<{
  params: Promise<Readonly<{ locale: string }>>;
}>;

export const dynamicParams = false;
export const dynamic = "force-dynamic";

const resolveLocale = async (params: AccountPageProps["params"]): Promise<Locale> => {
  const locale = parseLocale((await params).locale);
  if (locale === null) notFound();
  return locale;
};

export const generateStaticParams = () => supportedLocales.map((locale) => ({ locale }));

export const generateMetadata = async ({ params }: AccountPageProps): Promise<Metadata> => {
  const locale = await resolveLocale(params);
  return {
    robots: { follow: false, index: false },
    title: getAccountMessages(locale).account.title,
  };
};

export default async function AccountPage({ params }: AccountPageProps) {
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
        <AccountExperience
          locale={locale}
          messages={getAccountMessages(locale).account}
          oneCardHref={localeTarotOneCardPath(locale)}
          privacyHref={localeAccountPrivacyPath(locale)}
          sanctuaryHref={localeSanctuaryPath(locale)}
          signInHref={localeSignInPath(locale)}
          threeCardHref={localeTarotThreeCardPath(locale)}
        />
      </main>
    </PublicSiteFrame>
  );
}
