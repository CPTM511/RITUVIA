import { ActionLink } from "@rituvia/ui";

import { getPublicPageMessages, type ShellMessages } from "../_i18n/messages";
import {
  localePublicPagePath,
  localeSectionPath,
  type Locale,
  type PublicPageSlug,
} from "../_i18n/routing";
import { PublicSiteFrame } from "./public-site-frame";

type PublicInformationPageProps = Readonly<{
  brandName: string;
  brandTagline: string;
  locale: Locale;
  messages: ShellMessages;
  page: PublicPageSlug;
}>;

const nextStepHref = (locale: Locale, page: PublicPageSlug) => {
  switch (page) {
    case "methodology":
      return localeSectionPath(locale, "practice");
    case "safety":
      return localePublicPagePath(locale, "privacy");
    case "privacy":
      return localePublicPagePath(locale, "methodology");
  }
};

export function PublicInformationPage({
  brandName,
  brandTagline,
  locale,
  messages,
  page,
}: PublicInformationPageProps) {
  const content = getPublicPageMessages(messages, page);

  return (
    <PublicSiteFrame
      brandName={brandName}
      brandTagline={brandTagline}
      currentPage={page}
      locale={locale}
      messages={messages.shared}
    >
      <main className="information-main" id="main-content" tabIndex={-1}>
        <header className="shell information-hero">
          <p className="eyebrow">{content.eyebrow}</p>
          <h1>{content.title}</h1>
          <p className="information-introduction">{content.introduction}</p>
          <p className="information-status">{content.status}</p>
        </header>

        <div className="shell information-sections">
          {content.sections.map((section) => (
            <section className="information-section" key={section.title}>
              <h2>{section.title}</h2>
              <p>{section.description}</p>
              {section.items === undefined ? null : (
                <ul>
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        <section aria-labelledby="next-step-heading" className="shell information-next">
          <div>
            <h2 id="next-step-heading">{content.nextStep.title}</h2>
            <p>{content.nextStep.description}</p>
          </div>
          <ActionLink href={nextStepHref(locale, page)}>{content.nextStep.action}</ActionLink>
        </section>
      </main>
    </PublicSiteFrame>
  );
}
