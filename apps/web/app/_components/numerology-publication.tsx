import { ActionLink } from "@rituvia/ui";

import { numerologyRouteId, type NumerologyGuideSlug } from "../_i18n/numerology-public-routes";
import { numerologyPublicPathname } from "../_i18n/public-routes";
import {
  localeNumerologyLibraryPath,
  localeNumerologyPath,
  localePublicPagePath,
  type Locale,
} from "../_i18n/routing";
import type { SharedMessages } from "../_i18n/messages";
import {
  numerologyPublicationCatalog,
  type NumerologyPublicationGuideV1,
} from "../../server/numerology-publication";
import { GeoAnswerContext } from "./geo-answer-context";
import { PublicStructuredData } from "./public-structured-data";
import { PublicSiteFrame } from "./public-site-frame";

type SharedProps = Readonly<{
  brandName: string;
  brandTagline: string;
  canonicalOrigin: string;
  locale: Locale;
  messages: SharedMessages;
}>;

const sourceLabel = (reference: string): string => {
  const [sourceId, version] = reference.split("@");
  const source = numerologyPublicationCatalog.sources.find(
    (candidate) => candidate.sourceId === sourceId && candidate.version === version,
  );
  if (source === undefined) throw new TypeError("The approved numerology source is unavailable.");
  return `${source.title}, version ${source.version}`;
};

export function NumerologyPublicationHub({
  brandName,
  brandTagline,
  canonicalOrigin,
  locale,
  messages,
}: SharedProps) {
  const { guides, hub, labels, sources } = numerologyPublicationCatalog;
  return (
    <PublicSiteFrame
      brandName={brandName}
      brandTagline={brandTagline}
      currentPage={null}
      locale={locale}
      messages={messages}
    >
      <PublicStructuredData
        canonicalOrigin={canonicalOrigin}
        description={hub.answer}
        locale={locale}
        routeId="numerology-hub"
        title={hub.title}
      />
      <main className="numerology-library-main" id="main-content" tabIndex={-1}>
        <header className="shell numerology-library-hero">
          <p className="eyebrow">{hub.eyebrow}</p>
          <h1>{hub.title}</h1>
          <p className="numerology-library-answer">{hub.answer}</p>
          <p className="numerology-library-boundary">{hub.boundary}</p>
        </header>

        <GeoAnswerContext
          brandName={brandName}
          locale={locale}
          routeId="numerology-hub"
          sourceLabels={sources.map(({ sourceId, version }) =>
            sourceLabel(`${sourceId}@${version}`),
          )}
        />

        <section
          aria-labelledby="numerology-guide-list-heading"
          className="shell numerology-guide-section"
        >
          <h2 id="numerology-guide-list-heading">{labels.guideListTitle}</h2>
          <div className="numerology-guide-grid">
            {guides.map((guide) => (
              <article className="numerology-guide-card" key={guide.slug}>
                <h3>
                  <a href={numerologyPublicPathname(locale, guide.slug)}>{guide.title}</a>
                </h3>
                <p>{guide.description}</p>
                <p className="numerology-guide-example">
                  {labels.exampleResult}: <strong>{guide.example.result}</strong>
                </p>
              </article>
            ))}
          </div>
        </section>

        <nav aria-label={labels.relatedGuidesTitle} className="shell numerology-library-actions">
          <ActionLink href={localeNumerologyPath(locale)}>{labels.calculatorAction}</ActionLink>
          <ActionLink href={localePublicPagePath(locale, "safety")} variant="secondary">
            {labels.safetyAction}
          </ActionLink>
          <ActionLink href={localePublicPagePath(locale, "privacy")} variant="secondary">
            {labels.privacyAction}
          </ActionLink>
        </nav>
      </main>
    </PublicSiteFrame>
  );
}

export function NumerologyPublicationGuide({
  brandName,
  brandTagline,
  canonicalOrigin,
  guide,
  locale,
  messages,
}: SharedProps & Readonly<{ guide: NumerologyPublicationGuideV1 }>) {
  const { guides, hub, labels } = numerologyPublicationCatalog;
  const related = guides.filter((candidate) => candidate.slug !== guide.slug);
  return (
    <PublicSiteFrame
      brandName={brandName}
      brandTagline={brandTagline}
      currentPage={null}
      locale={locale}
      messages={messages}
    >
      <PublicStructuredData
        canonicalOrigin={canonicalOrigin}
        description={guide.answer}
        locale={locale}
        routeId={numerologyRouteId(guide.slug)}
        title={guide.title}
      />
      <main className="numerology-library-main" id="main-content" tabIndex={-1}>
        <article>
          <header className="shell numerology-library-hero">
            <p className="eyebrow">{hub.eyebrow}</p>
            <h1>{guide.title}</h1>
            <p className="numerology-library-answer">{guide.answer}</p>
            <p className="numerology-library-boundary">{hub.boundary}</p>
          </header>

          <GeoAnswerContext
            brandName={brandName}
            locale={locale}
            routeId={numerologyRouteId(guide.slug)}
            sourceLabels={guide.sourceRefs.map(sourceLabel)}
          />

          <div className="shell numerology-guide-content">
            <section>
              <h2>{labels.formulaTitle}</h2>
              <p dir="ltr">{guide.formula}</p>
            </section>

            <section>
              <h2>{labels.exampleTitle}</h2>
              <dl className="numerology-example">
                <div>
                  <dt>{labels.exampleInput}</dt>
                  <dd dir="ltr">{guide.example.input}</dd>
                </div>
                <div>
                  <dt>{labels.calculation}</dt>
                  <dd dir="ltr">{guide.example.calculation}</dd>
                </div>
                <div>
                  <dt>{labels.exampleResult}</dt>
                  <dd dir="ltr">{guide.example.result}</dd>
                </div>
              </dl>
            </section>

            <section>
              <h2>{labels.limitationsTitle}</h2>
              <ul>
                {guide.limitations.map((limitation) => (
                  <li key={limitation}>{limitation}</li>
                ))}
              </ul>
            </section>

            <section>
              <h2>{labels.reflectionTitle}</h2>
              <ul>
                {guide.reflectionQuestions.map((question) => (
                  <li key={question}>{question}</li>
                ))}
              </ul>
            </section>
          </div>
        </article>

        <nav aria-label={labels.relatedGuidesTitle} className="shell numerology-related-guides">
          <h2>{labels.relatedGuidesTitle}</h2>
          <ul>
            {related.map((candidate) => (
              <li key={candidate.slug}>
                <a href={numerologyPublicPathname(locale, candidate.slug)}>{candidate.title}</a>
              </li>
            ))}
          </ul>
          <div className="numerology-library-actions">
            <ActionLink href={localeNumerologyPath(locale)}>{labels.calculatorAction}</ActionLink>
            <ActionLink href={localeNumerologyLibraryPath(locale)} variant="secondary">
              {labels.backToHub}
            </ActionLink>
          </div>
        </nav>
      </main>
    </PublicSiteFrame>
  );
}

export type { NumerologyGuideSlug };
