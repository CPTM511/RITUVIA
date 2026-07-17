import { ActionLink } from "@rituvia/ui";

import type { ShellMessages } from "../_i18n/messages";
import { localePublicPagePath, localeSectionPath, type Locale } from "../_i18n/routing";
import { PublicSiteFrame } from "./public-site-frame";

type SiteShellProps = Readonly<{
  brandName: string;
  brandTagline: string;
  locale: Locale;
  messages: ShellMessages;
}>;

export function SiteShell({ brandName, brandTagline, locale, messages }: SiteShellProps) {
  const content = messages.home;

  return (
    <PublicSiteFrame
      brandName={brandName}
      brandTagline={brandTagline}
      currentPage="home"
      locale={locale}
      messages={messages.shared}
    >
      <main id="main-content" tabIndex={-1}>
        <section aria-labelledby="home-heading" className="shell hero">
          <div className="hero-copy">
            <span className="status-pill">{content.hero.status}</span>
            <p className="eyebrow">{content.hero.eyebrow}</p>
            <h1 id="home-heading">{content.hero.title}</h1>
            <p className="hero-introduction">{content.hero.introduction}</p>
            <p className="hero-boundary">{content.hero.boundary}</p>
            <div className="hero-actions">
              <ActionLink href={localeSectionPath(locale, "practice")}>
                {content.hero.primaryAction}
              </ActionLink>
              <ActionLink href={localePublicPagePath(locale, "methodology")} variant="secondary">
                {content.hero.secondaryAction}
              </ActionLink>
            </div>
          </div>
          <div aria-hidden="true" className="hero-art">
            <span className="hero-art-mark" />
          </div>
        </section>

        <aside aria-label={content.trust.label} className="trust-bar">
          <ul className="shell trust-list">
            {content.trust.items.map((item) => (
              <li className="trust-item" key={item}>
                <span aria-hidden="true" className="trust-mark">
                  •
                </span>
                {item}
              </li>
            ))}
          </ul>
        </aside>

        <section aria-labelledby="practice-heading" className="shell content-section" id="practice">
          <div className="section-heading">
            <p className="eyebrow">{content.practice.eyebrow}</p>
            <h2 id="practice-heading">{content.practice.title}</h2>
            <p className="section-introduction">{content.practice.introduction}</p>
          </div>
          <ol className="path-list">
            {content.practice.steps.map((step, index) => (
              <li className="path-card" key={step.title}>
                <span aria-hidden="true" className="path-number">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </li>
            ))}
          </ol>
        </section>

        <section
          aria-labelledby="principles-heading"
          className="principles-section"
          id="principles"
        >
          <div className="shell principles-inner">
            <div className="section-heading">
              <p className="eyebrow">{content.principles.eyebrow}</p>
              <h2 id="principles-heading">{content.principles.title}</h2>
              <p className="section-introduction">{content.principles.introduction}</p>
            </div>
            <div className="principles-grid">
              {content.principles.items.map((item) => (
                <article className="principle-card" key={item.title}>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby="trust-heading" className="shell content-section" id="trust">
          <div className="privacy-panel">
            <div>
              <p className="eyebrow">{content.boundary.eyebrow}</p>
              <h2 id="trust-heading">{content.boundary.title}</h2>
            </div>
            <div className="privacy-copy">
              <p>{content.boundary.description}</p>
              <p className="privacy-note">{content.boundary.note}</p>
              <ActionLink href={localePublicPagePath(locale, "privacy")} variant="secondary">
                {content.boundary.action}
              </ActionLink>
            </div>
          </div>
        </section>
      </main>
    </PublicSiteFrame>
  );
}
