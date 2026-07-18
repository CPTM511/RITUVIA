import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LocalCheckout } from "../../../_components/local-checkout";
import { PublicSiteFrame } from "../../../_components/public-site-frame";
import { getCommerceMessages } from "../../../_i18n/commerce-messages";
import { getMessages } from "../../../_i18n/messages";
import {
  localeCheckoutReturnPath,
  localeLocalCheckoutPath,
  localeSanctuaryPath,
  localeSignInPath,
  parseLocale,
  supportedLocales,
  type Locale,
} from "../../../_i18n/routing";
import { getWebRuntimeConfiguration } from "../../../../config/server";

type LocalCheckoutPageProps = Readonly<{
  params: Promise<Readonly<{ locale: string }>>;
  searchParams: Promise<Readonly<{ checkout_id?: string | string[] }>>;
}>;

export const dynamicParams = false;
export const dynamic = "force-dynamic";

const resolveLocale = async (params: LocalCheckoutPageProps["params"]): Promise<Locale> => {
  const locale = parseLocale((await params).locale);
  if (locale === null) notFound();
  return locale;
};

export const generateStaticParams = () => supportedLocales.map((locale) => ({ locale }));

export const generateMetadata = async ({ params }: LocalCheckoutPageProps): Promise<Metadata> => {
  const locale = await resolveLocale(params);
  return {
    robots: { follow: false, index: false },
    title: getCommerceMessages(locale).localCheckout.title,
  };
};

export default async function LocalCheckoutPage({ params, searchParams }: LocalCheckoutPageProps) {
  const locale = await resolveLocale(params);
  const configuration = getWebRuntimeConfiguration();
  const query = await searchParams;
  const checkoutId = typeof query.checkout_id === "string" ? query.checkout_id : null;

  return (
    <PublicSiteFrame
      brandName={configuration.client.brand.name}
      brandTagline={configuration.client.brand.tagline}
      currentPage={null}
      locale={locale}
      messages={getMessages(locale).shared}
    >
      <main className="experience-main local-checkout-main" id="main-content" tabIndex={-1}>
        <LocalCheckout
          checkoutId={checkoutId}
          checkoutReturnHref={localeCheckoutReturnPath(locale)}
          localCheckoutHref={localeLocalCheckoutPath(locale)}
          messages={getCommerceMessages(locale).localCheckout}
          sanctuaryHref={localeSanctuaryPath(locale)}
          signInHref={localeSignInPath(locale)}
        />
      </main>
    </PublicSiteFrame>
  );
}
