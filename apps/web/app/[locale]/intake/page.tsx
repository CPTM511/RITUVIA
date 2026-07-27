import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublicSiteFrame } from "../../_components/public-site-frame";
import { QuestionIntakeForm } from "../../_components/question-intake-form";
import { createQuestionIntakeMetadata } from "../../_i18n/metadata";
import { getMessages } from "../../_i18n/messages";
import { getQuestionIntakeMessages } from "../../_i18n/question-intake-messages";
import {
  localeTarotOneCardPath,
  parseLocale,
  supportedLocales,
  type Locale,
} from "../../_i18n/routing";
import { getWebRuntimeConfiguration } from "../../../config/server";

type QuestionIntakePageProps = Readonly<{
  params: Promise<Readonly<{ locale: string }>>;
}>;

export const dynamicParams = false;

const resolveLocale = async (params: QuestionIntakePageProps["params"]): Promise<Locale> => {
  const locale = parseLocale((await params).locale);
  if (locale === null) notFound();
  return locale;
};

export const generateStaticParams = () => supportedLocales.map((locale) => ({ locale }));

export async function generateMetadata({ params }: QuestionIntakePageProps): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const configuration = getWebRuntimeConfiguration();
  return createQuestionIntakeMetadata(configuration.brand.name, getQuestionIntakeMessages(locale));
}

export default async function QuestionIntakePage({ params }: QuestionIntakePageProps) {
  const locale = await resolveLocale(params);
  const configuration = getWebRuntimeConfiguration();
  const messages = getQuestionIntakeMessages(locale);

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
        <QuestionIntakeForm messages={messages} readingHref={localeTarotOneCardPath(locale)} />
      </main>
    </PublicSiteFrame>
  );
}
