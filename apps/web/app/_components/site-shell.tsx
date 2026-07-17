import { ActionLink } from "@rituvia/ui";

import type { ShellMessages } from "../_i18n/messages";
import {
  localeHomePath,
  localeSectionPath,
  type Locale,
  type ShellSectionId,
} from "../_i18n/routing";

type SiteShellProps = Readonly<{
  brandName: string;
  brandTagline: string;
  locale: Locale;
  messages: ShellMessages;
}>;

type SectionLink = Readonly<{
  label: string;
  section: ShellSectionId | "home";
}>;

const sectionHref = (locale: Locale, section: SectionLink["section"]): string =>
  section === "home" ? localeHomePath(locale) : localeSectionPath(locale, section);

export function SiteShell({ brandName, brandTagline, locale, messages }: SiteShellProps) {
  const navigationLinks: readonly SectionLink[] = [
    { label: messages.navigation.home, section: "home" },
    { label: messages.navigation.practice, section: "practice" },
    { label: messages.navigation.principles, section: "principles" },
    { label: messages.navigation.privacy, section: "privacy" },
  ];

  return (
    <>
      <a className="skip-link" href="#main-content">
        {messages.accessibility.skipToContent}
      </a>

      <header className="site-header">
        <div className="shell header-inner">
          <a
            aria-label={messages.navigation.homeLabel.replace("{brand}", brandName)}
            className="brand-link"
            href={localeHomePath(locale)}
          >
            {brandName}
          </a>

          <nav aria-label={messages.navigation.primaryLabel} className="primary-navigation">
            <ul className="navigation-list">
              {navigationLinks.map((link) => (
                <li key={link.section}>
                  <a
                    aria-current={link.section === "home" ? "page" : undefined}
                    className="navigation-link"
                    href={sectionHref(locale, link.section)}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="header-actions">
            <div className="locale-control">
              <label className="locale-label" htmlFor="locale-select">
                {messages.navigation.localeLabel}
              </label>
              <select
                aria-describedby="locale-hint"
                className="locale-select"
                defaultValue={locale}
                id="locale-select"
                name="locale"
              >
                <option value={locale}>{messages.navigation.localeName}</option>
              </select>
              <span className="visually-hidden" id="locale-hint">
                {messages.navigation.localeHint}
              </span>
            </div>
            <ActionLink href={localeSectionPath(locale, "practice")}>
              {messages.navigation.primaryAction}
            </ActionLink>
          </div>
        </div>
      </header>

      <noscript>
        <p className="no-script-note">{messages.accessibility.noScript}</p>
      </noscript>

      <main id="main-content" tabIndex={-1}>
        <section aria-labelledby="home-heading" className="shell hero">
          <div className="hero-copy">
            <span className="status-pill">{messages.hero.status}</span>
            <p className="eyebrow">{messages.hero.eyebrow}</p>
            <h1 id="home-heading">{messages.hero.title}</h1>
            <p className="hero-introduction">{messages.hero.introduction}</p>
            <p className="hero-boundary">{messages.hero.boundary}</p>
            <div className="hero-actions">
              <ActionLink href={localeSectionPath(locale, "practice")}>
                {messages.hero.primaryAction}
              </ActionLink>
              <ActionLink href={localeSectionPath(locale, "privacy")} variant="secondary">
                {messages.hero.secondaryAction}
              </ActionLink>
            </div>
          </div>
          <div aria-hidden="true" className="hero-art">
            <span className="hero-art-mark" />
          </div>
        </section>

        <aside aria-label={messages.trust.label} className="trust-bar">
          <ul className="shell trust-list">
            {messages.trust.items.map((item) => (
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
            <p className="eyebrow">{messages.practice.eyebrow}</p>
            <h2 id="practice-heading">{messages.practice.title}</h2>
            <p className="section-introduction">{messages.practice.introduction}</p>
          </div>
          <ol className="path-list">
            {messages.practice.steps.map((step, index) => (
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
              <p className="eyebrow">{messages.principles.eyebrow}</p>
              <h2 id="principles-heading">{messages.principles.title}</h2>
              <p className="section-introduction">{messages.principles.introduction}</p>
            </div>
            <div className="principles-grid">
              {messages.principles.items.map((item) => (
                <article className="principle-card" key={item.title}>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby="privacy-heading" className="shell content-section" id="privacy">
          <div className="privacy-panel">
            <div>
              <p className="eyebrow">{messages.privacy.eyebrow}</p>
              <h2 id="privacy-heading">{messages.privacy.title}</h2>
            </div>
            <div className="privacy-copy">
              <p>{messages.privacy.description}</p>
              <p className="privacy-note">{messages.privacy.note}</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="shell footer-inner">
          <div>
            <p className="footer-brand">{brandName}</p>
            {brandTagline === "" ? null : <p className="footer-tagline">{brandTagline}</p>}
            <p className="footer-note">{messages.footer.foundationNote}</p>
          </div>
          <nav aria-label={messages.footer.navigationLabel}>
            <ul className="footer-navigation">
              {navigationLinks.map((link) => (
                <li key={link.section}>
                  <a className="footer-link" href={sectionHref(locale, link.section)}>
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </footer>
    </>
  );
}
