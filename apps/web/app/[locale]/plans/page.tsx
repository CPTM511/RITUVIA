import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublicSiteFrame } from "../../_components/public-site-frame";
import { RecoveryPlans } from "../../_components/recovery-commerce";
import { getCommerceMessages } from "../../_i18n/commerce-messages";
import { getMessages } from "../../_i18n/messages";
import { localeSignInPath, parseLocale, supportedLocales } from "../../_i18n/routing";
import { getWebRuntimeConfiguration } from "../../../config/server";

export const dynamic = "force-dynamic";
export const dynamicParams = false;
export const generateStaticParams = () => supportedLocales.map((locale) => ({ locale }));

const resolveLocale = async (params: Promise<{ locale: string }>) => {
  const locale = parseLocale((await params).locale);
  if (locale === null) notFound();
  return locale;
};

export const generateMetadata = async ({
  params,
}: Readonly<{ params: Promise<{ locale: string }> }>): Promise<Metadata> => {
  const locale = await resolveLocale(params);
  return {
    robots: { follow: false, index: false },
    title: getCommerceMessages(locale).recoveryCommerce.plansTitle,
  };
};

export default async function PlansPage({
  params,
}: Readonly<{ params: Promise<{ locale: string }> }>) {
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
      <main className="experience-main" id="main-content" tabIndex={-1}>
        <RecoveryPlans
          messages={getCommerceMessages(locale).recoveryCommerce}
          signInHref={localeSignInPath(locale)}
        />
      </main>
    </PublicSiteFrame>
  );
}
