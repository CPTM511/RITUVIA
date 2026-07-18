import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CheckoutReturn } from "../../../_components/checkout-return";
import { PublicSiteFrame } from "../../../_components/public-site-frame";
import { getCommerceMessages } from "../../../_i18n/commerce-messages";
import { getMessages } from "../../../_i18n/messages";
import {
  localeAccountPath,
  localeSanctuaryPath,
  parseLocale,
  supportedLocales,
  type Locale,
} from "../../../_i18n/routing";
import { getWebRuntimeConfiguration } from "../../../../config/server";

type CheckoutReturnPageProps = Readonly<{
  params: Promise<Readonly<{ locale: string }>>;
  searchParams: Promise<Readonly<{ order_id?: string | string[] }>>;
}>;

export const dynamicParams = false;
export const dynamic = "force-dynamic";

const resolveLocale = async (params: CheckoutReturnPageProps["params"]): Promise<Locale> => {
  const locale = parseLocale((await params).locale);
  if (locale === null) notFound();
  return locale;
};

export const generateStaticParams = () => supportedLocales.map((locale) => ({ locale }));

export const generateMetadata = async ({ params }: CheckoutReturnPageProps): Promise<Metadata> => {
  const locale = await resolveLocale(params);
  return {
    robots: { follow: false, index: false },
    title: getCommerceMessages(locale).checkoutReturn.title,
  };
};

export default async function CheckoutReturnPage({
  params,
  searchParams,
}: CheckoutReturnPageProps) {
  const locale = await resolveLocale(params);
  const configuration = getWebRuntimeConfiguration();
  const query = await searchParams;
  const orderId = typeof query.order_id === "string" ? query.order_id : null;

  return (
    <PublicSiteFrame
      brandName={configuration.client.brand.name}
      brandTagline={configuration.client.brand.tagline}
      currentPage={null}
      locale={locale}
      messages={getMessages(locale).shared}
    >
      <main className="experience-main checkout-return-main" id="main-content" tabIndex={-1}>
        <CheckoutReturn
          accountHref={localeAccountPath(locale)}
          messages={getCommerceMessages(locale).checkoutReturn}
          orderId={orderId}
          sanctuaryHref={localeSanctuaryPath(locale)}
        />
      </main>
    </PublicSiteFrame>
  );
}
