import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublicSiteFrame } from "../../_components/public-site-frame";
import { RevisitExperience } from "../../_components/revisit-experience";
import { getMessages } from "../../_i18n/messages";
import { getRevisitMessages } from "../../_i18n/revisit-messages";
import {
  localeSanctuaryPath,
  parseLocale,
  supportedLocales,
  type Locale,
} from "../../_i18n/routing";
import { getWebRuntimeConfiguration } from "../../../config/server";

type RevisitPageProps = Readonly<{
  params: Promise<Readonly<{ locale: string }>>;
}>;

export const dynamicParams = false;
export const dynamic = "force-dynamic";

const resolveLocale = async (params: RevisitPageProps["params"]): Promise<Locale> => {
  const locale = parseLocale((await params).locale);
  if (locale === null) notFound();
  return locale;
};

export const generateStaticParams = () => supportedLocales.map((locale) => ({ locale }));

export const generateMetadata = async ({ params }: RevisitPageProps): Promise<Metadata> => {
  const locale = await resolveLocale(params);
  return {
    robots: { follow: false, index: false },
    title: getRevisitMessages(locale).title,
  };
};

export default async function RevisitPage({ params }: RevisitPageProps) {
  const locale = await resolveLocale(params);
  const configuration = getWebRuntimeConfiguration();
  const messages = getRevisitMessages(locale);
  return (
    <PublicSiteFrame
      accountNavigation={configuration.deploymentEnvironment !== "staging"}
      brandName={configuration.client.brand.name}
      brandTagline={configuration.client.brand.tagline}
      currentPage={null}
      locale={locale}
      messages={getMessages(locale).shared}
    >
      <main className="experience-main revisit-main" id="main-content" tabIndex={-1}>
        <header className="experience-heading">
          <p className="eyebrow">{messages.eyebrow}</p>
          <h1>{messages.title}</h1>
          <p className="experience-introduction">{messages.description}</p>
          <p className="experience-boundary">{messages.reminderBoundary}</p>
          <p className="experience-privacy">{messages.privacy}</p>
        </header>
        <RevisitExperience
          coreLoopOnly={configuration.deploymentEnvironment === "staging"}
          messages={messages}
          sanctuaryHref={localeSanctuaryPath(locale)}
        />
      </main>
    </PublicSiteFrame>
  );
}
