import type { Route } from "next";
import Link from "next/link";

import type { GoldenShellLocale, GoldenShellMessages } from "../_i18n/golden-shell-messages";
import { GoldenShellHeader } from "./golden-shell-header";

type SiteShellProps = Readonly<{
  brandName: string;
  locale: GoldenShellLocale;
  messages: GoldenShellMessages;
}>;

type FooterLink = Readonly<{
  disabled?: boolean;
  href: Route;
  label: string;
}>;

const methodIcons = Object.freeze(["☼", "✦", "∞"] as const);
const heroMetaIcons = Object.freeze(["◉", "⌁", "✦", "◌"] as const);

const footerLinks = (
  locale: GoldenShellLocale,
  messages: GoldenShellMessages,
): Readonly<{
  account: readonly FooterLink[];
  begin: readonly FooterLink[];
  continue: readonly FooterLink[];
}> => {
  const home = `/${locale}` as Route;
  const englishJourney = locale === "en";
  return Object.freeze({
    account: messages.footer.account.map((label, index) => ({
      disabled: index !== 0,
      href: index === 0 ? (`${home}#loop` as Route) : home,
      label,
    })),
    begin: messages.footer.begin.map((label, index) => ({
      disabled: !englishJourney || index > 1,
      href: (index === 0 ? "/en/tarot/one-card" : index === 1 ? "/en/intake" : home) as Route,
      label,
    })),
    continue: messages.footer.continue.map((label, index) => ({
      disabled: !englishJourney || index === 3,
      href: (index < 2
        ? "/en/sanctuary"
        : index === 2
          ? "/en/revisit"
          : `${home}#free-path`) as Route,
      label,
    })),
  });
};

function GoldenFooterColumn({
  heading,
  links,
}: Readonly<{ heading: string; links: readonly FooterLink[] }>) {
  return (
    <div>
      <h2>{heading}</h2>
      {links.map((link) =>
        link.disabled === true ? (
          <span aria-disabled="true" className="golden-footer-link disabled" key={link.label}>
            {link.label}
          </span>
        ) : (
          <Link className="golden-footer-link" href={link.href} key={link.label}>
            {link.label}
          </Link>
        ),
      )}
    </div>
  );
}

export function SiteShell({ brandName, locale, messages }: SiteShellProps) {
  const links = footerLinks(locale, messages);
  const englishJourney = locale === "en";
  const home = `/${locale}` as Route;

  return (
    <div className="golden-shell-frame" id="golden-shell-frame">
      <a className="golden-skip-link" href="#main-content">
        {messages.accessibility.skipToContent}
      </a>

      <GoldenShellHeader brandName={brandName} locale={locale} messages={messages} />

      <main id="main-content" tabIndex={-1}>
        <section className="golden-hero" id="top">
          <div className="golden-shell-container golden-hero-grid">
            <div>
              <p className="golden-eyebrow">{messages.hero.eyebrow}</p>
              <h1>
                {messages.hero.titleLead}
                <br />
                <span>{messages.hero.titleAccent}</span>
              </h1>
              <p className="golden-lede">{messages.hero.introduction}</p>
              <div className="golden-button-row">
                {englishJourney ? (
                  <Link className="golden-primary-button" href="/en/tarot/one-card">
                    {messages.hero.primaryAction}
                  </Link>
                ) : (
                  <Link className="golden-primary-button" href={`${home}#readings` as Route}>
                    {messages.hero.primaryAction}
                  </Link>
                )}
                <Link className="golden-ghost-button" href={`${home}#readings` as Route}>
                  {messages.hero.secondaryAction}
                </Link>
              </div>
              <ul aria-label={messages.hero.eyebrow} className="golden-hero-meta">
                {messages.hero.meta.map((item, index) => (
                  <li className="golden-pill" key={item}>
                    <span aria-hidden="true">{heroMetaIcons[index]}</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div aria-hidden="true" className="golden-hero-visual">
              <span className="golden-orbit one" />
              <span className="golden-orbit two" />
              <span className="golden-orbit three" />
              <div className="golden-card-stack">
                <span className="golden-mystic-card back-a" />
                <span className="golden-mystic-card back-b" />
                <span className="golden-mystic-card front">
                  <span>
                    <span className="golden-sigil">✦</span>
                    <small>{messages.hero.cardLabel}</small>
                  </span>
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="golden-section" id="readings">
          <div className="golden-shell-container">
            <div className="golden-section-heading">
              <div>
                <p className="golden-eyebrow">{messages.wayIn.eyebrow}</p>
                <h2>{messages.wayIn.title}</h2>
              </div>
              <p>{messages.wayIn.introduction}</p>
            </div>
            <div className="golden-grid-three">
              {messages.wayIn.methods.map((method, index) => {
                const enabled = englishJourney && index < 2;
                const href = index === 0 ? "/en/tarot/one-card" : "/en/intake";
                return (
                  <article className="golden-method-card" key={method.title}>
                    <span aria-hidden="true" className="golden-method-icon">
                      {methodIcons[index]}
                    </span>
                    <span className={`golden-badge ${index < 2 ? "free" : "info"}`}>
                      {method.badge}
                    </span>
                    <h3>{method.title}</h3>
                    <p>{method.description}</p>
                    <div className="golden-method-footer">
                      <span>{method.footer}</span>
                      {enabled ? (
                        <Link className="golden-soft-button" href={href}>
                          {method.action} <span aria-hidden="true">→</span>
                        </Link>
                      ) : (
                        <span
                          aria-disabled="true"
                          className="golden-soft-button disabled"
                          title={messages.accessibility.disabledAction}
                        >
                          {method.action} <span aria-hidden="true">→</span>
                        </span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="golden-section alternate" id="free-path">
          <div className="golden-shell-container">
            <div className="golden-section-heading">
              <div>
                <p className="golden-eyebrow">{messages.freePath.eyebrow}</p>
                <h2>{messages.freePath.title}</h2>
              </div>
              <p>{messages.freePath.introduction}</p>
            </div>
            <div className="golden-grid-three">
              {messages.freePath.cards.map((card, index) => (
                <article className="golden-value-card" key={card.title}>
                  <span
                    className={`golden-badge ${index === 0 ? "free" : index === 1 ? "credit" : "info"}`}
                  >
                    {card.badge}
                  </span>
                  <h3>{card.title}</h3>
                  <p>{card.description}</p>
                </article>
              ))}
            </div>
            <div className="golden-button-row">
              <span
                aria-disabled="true"
                className="golden-primary-button disabled"
                title={messages.accessibility.disabledAction}
              >
                {messages.freePath.action}
              </span>
            </div>
          </div>
        </section>

        <section className="golden-section" id="loop">
          <div className="golden-shell-container">
            <div className="golden-section-heading">
              <div>
                <p className="golden-eyebrow">{messages.loop.eyebrow}</p>
                <h2>{messages.loop.title}</h2>
              </div>
              <p>{messages.loop.introduction}</p>
            </div>
            <ol className="golden-loop">
              {messages.loop.steps.map((step) => (
                <li className="golden-loop-step" key={step.title}>
                  <strong>{step.title}</strong>
                  <span>{step.description}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </main>

      <footer className="golden-site-footer">
        <div className="golden-shell-container golden-footer-grid">
          <div>
            <Link className="golden-brand" href={home}>
              <span aria-hidden="true" className="golden-brand-mark">
                ✦
              </span>
              <span>
                <span className="golden-brand-word">{brandName}</span>
                <span className="golden-brand-sub">{messages.navigation.brandTagline}</span>
              </span>
            </Link>
            <p>{messages.footer.introduction}</p>
          </div>
          <GoldenFooterColumn heading={messages.footer.beginHeading} links={links.begin} />
          <GoldenFooterColumn heading={messages.footer.continueHeading} links={links.continue} />
          <GoldenFooterColumn heading={messages.footer.accountHeading} links={links.account} />
        </div>
        <div className="golden-shell-container golden-footer-bottom">
          <span>{messages.footer.copyright}</span>
          <span>{messages.footer.legal}</span>
        </div>
      </footer>
    </div>
  );
}
