import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProtectedBetaAdmissionForm } from "../../_components/protected-beta-admission-form";
import { PublicSiteFrame } from "../../_components/public-site-frame";
import { getMessages } from "../../_i18n/messages";
import { getProtectedBetaAdmissionMessages } from "../../_i18n/protected-beta-admission-messages";
import {
  localeQuestionIntakePath,
  parseLocale,
  supportedLocales,
  type Locale,
} from "../../_i18n/routing";
import { getWebRuntimeConfiguration } from "../../../config/server";

type ProtectedBetaPageProps = Readonly<{
  params: Promise<Readonly<{ locale: string }>>;
}>;

export const dynamicParams = false;

const resolveLocale = async (params: ProtectedBetaPageProps["params"]): Promise<Locale> => {
  const locale = parseLocale((await params).locale);
  if (locale === null) notFound();
  return locale;
};

export const generateStaticParams = () => supportedLocales.map((locale) => ({ locale }));

export async function generateMetadata({ params }: ProtectedBetaPageProps): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const configuration = getWebRuntimeConfiguration();
  const messages = getProtectedBetaAdmissionMessages(locale);
  return {
    description: messages.metadata.description,
    robots: { follow: false, index: false },
    title: `${configuration.brand.name} — ${messages.metadata.title}`,
  };
}

export default async function ProtectedBetaPage({ params }: ProtectedBetaPageProps) {
  const locale = await resolveLocale(params);
  const configuration = getWebRuntimeConfiguration();
  const messages = getProtectedBetaAdmissionMessages(locale);
  return (
    <PublicSiteFrame
      brandName={configuration.client.brand.name}
      brandTagline={configuration.client.brand.tagline}
      currentPage={null}
      locale={locale}
      messages={getMessages(locale).shared}
    >
      <main className="question-intake-main" id="main-content" tabIndex={-1}>
        <header className="question-intake-heading">
          <p className="eyebrow">{messages.page.eyebrow}</p>
          <h1>{messages.page.title}</h1>
          <p className="question-intake-introduction">{messages.page.introduction}</p>
          <p className="question-intake-boundary">{messages.page.boundary}</p>
          <p className="question-intake-privacy">{messages.page.privacy}</p>
        </header>
        <ProtectedBetaAdmissionForm
          continueHref={localeQuestionIntakePath(locale)}
          messages={messages}
        />
      </main>
    </PublicSiteFrame>
  );
}
