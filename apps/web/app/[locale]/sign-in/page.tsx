import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublicSiteFrame } from "../../_components/public-site-frame";
import { SignInForm } from "../../_components/sign-in-form";
import { safeLocalReturnTo } from "../../_contracts/reviewed-return-to";
import { getAccountMessages } from "../../_i18n/account-messages";
import { getMessages } from "../../_i18n/messages";
import { localeAccountPath, parseLocale, supportedLocales, type Locale } from "../../_i18n/routing";
import { getWebRuntimeConfiguration } from "../../../config/server";

type SignInPageProps = Readonly<{
  params: Promise<Readonly<{ locale: string }>>;
  searchParams: Promise<Readonly<{ returnTo?: string | string[]; status?: string | string[] }>>;
}>;

export const dynamicParams = false;
export const dynamic = "force-dynamic";

const resolveLocale = async (params: SignInPageProps["params"]): Promise<Locale> => {
  const locale = parseLocale((await params).locale);
  if (locale === null) notFound();
  return locale;
};

export const generateStaticParams = () => supportedLocales.map((locale) => ({ locale }));

export const generateMetadata = async ({ params }: SignInPageProps): Promise<Metadata> => {
  const locale = await resolveLocale(params);
  return {
    robots: { follow: false, index: false },
    title: getAccountMessages(locale).signIn.title,
  };
};

export default async function SignInPage({ params, searchParams }: SignInPageProps) {
  const locale = await resolveLocale(params);
  const configuration = getWebRuntimeConfiguration();
  const query = await searchParams;
  const rawReturnTo = typeof query.returnTo === "string" ? query.returnTo : null;
  const returnTo = safeLocalReturnTo(rawReturnTo, localeAccountPath(locale));
  const invalid = query.status === "invalid";

  return (
    <PublicSiteFrame
      brandName={configuration.client.brand.name}
      brandTagline={configuration.client.brand.tagline}
      currentPage={null}
      locale={locale}
      messages={getMessages(locale).shared}
    >
      <main className="experience-main sign-in-main" id="main-content" tabIndex={-1}>
        <SignInForm
          invalidInitial={invalid}
          messages={getAccountMessages(locale).signIn}
          returnTo={returnTo}
        />
      </main>
    </PublicSiteFrame>
  );
}
