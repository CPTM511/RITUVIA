import { ActionLink, createUiControlId } from "@rituvia/ui";
import Image from "next/image";

import type { ShellMessages } from "../_i18n/messages";
import {
  localeNumerologyPath,
  localePublicPagePath,
  localeSanctuaryPath,
  localeTarotOneCardPath,
  localeTarotThreeCardPath,
  type Locale,
} from "../_i18n/routing";
import { PublicSiteFrame } from "./public-site-frame";

const oracleHeadingId = createUiControlId("oracle-heading");

type SiteShellProps = Readonly<{
  brandName: string;
  brandTagline: string;
  locale: Locale;
  messages: ShellMessages;
  numerologyEnabled: boolean;
}>;

export function SiteShell({
  brandName,
  brandTagline,
  locale,
  messages,
  numerologyEnabled,
}: SiteShellProps) {
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
              <ActionLink href={localeTarotOneCardPath(locale)}>
                {content.hero.primaryAction}
              </ActionLink>
              <ActionLink href={localeSanctuaryPath(locale)} variant="secondary">
                {content.hero.secondaryAction}
              </ActionLink>
            </div>
          </div>
          <div className="hero-art">
            <Image
              alt={content.sanctuaryPreview.imageAlt}
              className="hero-orb-image"
              height={1402}
              loading="eager"
              sizes="(max-width: 640px) 88vw, (max-width: 928px) 60vw, 38vw"
              src="/images/rituvia-sanctuary-orb.png"
              width={1122}
            />
          </div>
        </section>

        <aside aria-label={content.trust.label} className="trust-bar">
          <ul className="shell trust-list">
            {content.trust.items.map((item) => (
              <li className="trust-item" key={item}>
                {item}
              </li>
            ))}
          </ul>
        </aside>

        <section aria-labelledby={oracleHeadingId} className="shell content-section" id="oracle">
          <div className="section-heading oracle-heading">
            <p className="eyebrow">{content.oracle.eyebrow}</p>
            <h2 id={oracleHeadingId}>{content.oracle.title}</h2>
            <p className="section-introduction">{content.oracle.introduction}</p>
          </div>
          <div
            className={`oracle-card-grid${numerologyEnabled ? " oracle-card-grid-expanded" : ""}`}
          >
            <article className="oracle-card oracle-card-featured">
              <p className="eyebrow">{content.oracle.oneCard.eyebrow}</p>
              <h3>{content.oracle.oneCard.title}</h3>
              <p>{content.oracle.oneCard.description}</p>
              <p className="oracle-note">{content.oracle.oneCard.note}</p>
              <ActionLink href={localeTarotOneCardPath(locale)}>
                {content.oracle.oneCard.action}
              </ActionLink>
            </article>
            <article className="oracle-card">
              <p className="eyebrow">{content.oracle.threeCard.eyebrow}</p>
              <h3>{content.oracle.threeCard.title}</h3>
              <p>{content.oracle.threeCard.description}</p>
              <p className="oracle-note">{content.oracle.threeCard.note}</p>
              <ActionLink href={localeTarotThreeCardPath(locale)} variant="secondary">
                {content.oracle.threeCard.action}
              </ActionLink>
            </article>
            <article className="oracle-card">
              <p className="eyebrow">{content.oracle.sanctuary.eyebrow}</p>
              <h3>{content.oracle.sanctuary.title}</h3>
              <p>{content.oracle.sanctuary.description}</p>
              <p className="oracle-note">{content.oracle.sanctuary.note}</p>
              <ActionLink href={localeSanctuaryPath(locale)} variant="secondary">
                {content.oracle.sanctuary.action}
              </ActionLink>
            </article>
            {numerologyEnabled ? (
              <article className="oracle-card">
                <p className="eyebrow">{content.oracle.numerology.eyebrow}</p>
                <h3>{content.oracle.numerology.title}</h3>
                <p>{content.oracle.numerology.description}</p>
                <p className="oracle-note">{content.oracle.numerology.note}</p>
                <ActionLink href={localeNumerologyPath(locale)} variant="secondary">
                  {content.oracle.numerology.action}
                </ActionLink>
              </article>
            ) : null}
          </div>
        </section>

        <section className="sanctuary-preview" aria-labelledby="sanctuary-preview-heading">
          <div className="shell sanctuary-preview-inner">
            <div className="sanctuary-preview-art">
              <Image
                alt=""
                aria-hidden="true"
                className="sanctuary-preview-image"
                height={1402}
                loading="lazy"
                sizes="(max-width: 640px) 94vw, 48vw"
                src="/images/rituvia-sanctuary-orb.png"
                width={1122}
              />
            </div>
            <div className="sanctuary-preview-copy">
              <p className="eyebrow">{content.sanctuaryPreview.eyebrow}</p>
              <h2 id="sanctuary-preview-heading">{content.sanctuaryPreview.title}</h2>
              <p>{content.sanctuaryPreview.description}</p>
              <p className="privacy-note">{content.sanctuaryPreview.note}</p>
              <ActionLink href={localeSanctuaryPath(locale)}>
                {content.sanctuaryPreview.action}
              </ActionLink>
            </div>
          </div>
        </section>

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
