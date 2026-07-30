import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { InlineAlert } from "@rituvia/ui";

import { CreditPackCheckout, type CreditPackView } from "../../_components/credit-pack-checkout";
import { PublicSiteFrame } from "../../_components/public-site-frame";
import { getCommerceMessages } from "../../_i18n/commerce-messages";
import { getMessages } from "../../_i18n/messages";
import {
  localeAccountPath,
  localePlansPath,
  localeSignInPath,
  parseLocale,
  supportedLocales,
  type Locale,
} from "../../_i18n/routing";
import { getWebRuntimeConfiguration } from "../../../config/server";
import { loadWebProductCatalogApplicationService } from "../../../server/product-catalog";

type PlansPageProps = Readonly<{ params: Promise<Readonly<{ locale: string }>> }>;

export const dynamicParams = false;
export const dynamic = "force-dynamic";

const resolveLocale = async (params: PlansPageProps["params"]): Promise<Locale> => {
  const locale = parseLocale((await params).locale);
  if (locale === null) notFound();
  return locale;
};

export const generateStaticParams = () => supportedLocales.map((locale) => ({ locale }));

export const generateMetadata = async ({ params }: PlansPageProps): Promise<Metadata> => {
  const locale = await resolveLocale(params);
  return {
    robots: { follow: false, index: false },
    title: getCommerceMessages(locale).plans.title,
  };
};

const readCreditPacks = async (locale: Locale): Promise<readonly CreditPackView[]> => {
  try {
    const now = Date.now();
    const catalog = await loadWebProductCatalogApplicationService().readActive();
    return Object.freeze(
      catalog.products
        .flatMap((product) => {
          if (
            product.status !== "active" ||
            product.kind !== "credit_pack" ||
            product.creditsGranted === null
          ) {
            return [];
          }
          const localization = product.localizations.find((entry) => entry.locale === locale);
          const prices = catalog.prices.filter(
            (price) =>
              price.status === "active" &&
              price.productCode === product.code &&
              price.productVersion === product.version &&
              price.billingInterval === "one_time" &&
              price.currencyCode === "USD" &&
              price.countryCodes.includes("US") &&
              price.providerEligibility.includes("stripe") &&
              Date.parse(price.effectiveFrom) <= now &&
              (price.effectiveUntil === null || now < Date.parse(price.effectiveUntil)),
          );
          const price = prices.at(0);
          return localization === undefined || price === undefined || prices.length !== 1
            ? []
            : [
                Object.freeze({
                  amountMinor: price.amountMinor,
                  code: product.code,
                  currencyCode: price.currencyCode,
                  description: localization.description,
                  exactContents: localization.exactContents,
                  title: localization.title,
                }),
              ];
        })
        .sort((left, right) => left.amountMinor - right.amountMinor),
    );
  } catch {
    return Object.freeze([]);
  }
};

export default async function PlansPage({ params }: PlansPageProps) {
  const locale = await resolveLocale(params);
  const configuration = getWebRuntimeConfiguration();
  const messages = getCommerceMessages(locale).plans;
  const plansHref = localePlansPath(locale);
  const products = await readCreditPacks(locale);

  return (
    <PublicSiteFrame
      brandName={configuration.client.brand.name}
      brandTagline={configuration.client.brand.tagline}
      currentPage={null}
      locale={locale}
      messages={getMessages(locale).shared}
    >
      <main className="experience-main" id="main-content" tabIndex={-1}>
        <header className="experience-heading">
          <p className="eyebrow">{messages.eyebrow}</p>
          <h1>{messages.title}</h1>
          <p className="experience-introduction">{messages.introduction}</p>
          <p className="experience-boundary">{messages.boundary}</p>
        </header>
        {products.length === 0 ? (
          <InlineAlert
            message={messages.unavailable}
            title={messages.unavailableTitle}
            tone="error"
          />
        ) : (
          <CreditPackCheckout
            accountHref={localeAccountPath(locale)}
            locale={locale}
            messages={messages}
            plansHref={plansHref}
            products={products}
            signInHref={localeSignInPath(locale)}
          />
        )}
      </main>
    </PublicSiteFrame>
  );
}
