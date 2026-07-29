import { ActionLink } from "@rituvia/ui";

import { astrologyRouteId } from "../_i18n/astrology-public-routes";
import { astrologyPublicPathname } from "../_i18n/public-routes";
import {
  localeAstrologyLibraryPath,
  localeAstrologyPath,
  localePublicPagePath,
  type Locale,
} from "../_i18n/routing";
import type { SharedMessages } from "../_i18n/messages";
import {
  astrologyPublicationCatalog,
  type AstrologyPublicationGuideV1,
} from "../../server/astrology-publication";
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
  const source = astrologyPublicationCatalog.sources.find(
    (candidate) => candidate.sourceId === sourceId && candidate.version === version,
  );
  if (source === undefined) throw new TypeError("The astrology publication source is unavailable.");
  return `${source.title}, version ${source.version}`;
};

export function AstrologyPublicationHub({
  brandName,
  brandTagline,
  canonicalOrigin,
  locale,
  messages,
}: SharedProps) {
  const { guides, hub, labels, sources } = astrologyPublicationCatalog;
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
        routeId="astrology-hub"
        title={hub.title}
      />
      <main
        className="numerology-library-main astrology-library-main"
        id="main-content"
        tabIndex={-1}
      >
        <header className="shell numerology-library-hero astrology-library-hero">
          <p className="eyebrow">{hub.eyebrow}</p>
          <h1>{hub.title}</h1>
          <p className="numerology-library-answer">{hub.answer}</p>
          <p className="numerology-library-boundary">{hub.boundary}</p>
        </header>

        <GeoAnswerContext
          brandName={brandName}
          locale={locale}
          routeId="astrology-hub"
          sourceLabels={sources.map(({ sourceId, version }) =>
            sourceLabel(`${sourceId}@${version}`),
          )}
        />

        <section
          aria-labelledby="astrology-guide-list-heading"
          className="shell numerology-guide-section"
        >
          <h2 id="astrology-guide-list-heading">{labels.guideListTitle}</h2>
          <div className="numerology-guide-grid astrology-guide-grid">
            {guides.map((guide) => (
              <article className="numerology-guide-card astrology-guide-card" key={guide.slug}>
                <h3>
                  <a href={astrologyPublicPathname(locale, guide.slug)}>{guide.title}</a>
                </h3>
                <p>{guide.description}</p>
                <p className="numerology-guide-example">{guide.answer}</p>
              </article>
            ))}
          </div>
        </section>

        <nav aria-label={labels.relatedGuidesTitle} className="shell numerology-library-actions">
          <ActionLink href={localeAstrologyPath(locale)}>{labels.calculatorAction}</ActionLink>
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

export function AstrologyPublicationGuide({
  brandName,
  brandTagline,
  canonicalOrigin,
  guide,
  locale,
  messages,
}: SharedProps & Readonly<{ guide: AstrologyPublicationGuideV1 }>) {
  const { guides, hub, labels } = astrologyPublicationCatalog;
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
        routeId={astrologyRouteId(guide.slug)}
        title={guide.title}
      />
      <main
        className="numerology-library-main astrology-library-main"
        id="main-content"
        tabIndex={-1}
      >
        <article>
          <header className="shell numerology-library-hero astrology-library-hero">
            <p className="eyebrow">{hub.eyebrow}</p>
            <h1>{guide.title}</h1>
            <p className="numerology-library-answer">{guide.answer}</p>
            <p className="numerology-library-boundary">{hub.boundary}</p>
          </header>

          <GeoAnswerContext
            brandName={brandName}
            locale={locale}
            routeId={astrologyRouteId(guide.slug)}
            sourceLabels={guide.sourceRefs.map(sourceLabel)}
          />

          <div className="shell numerology-guide-content astrology-guide-content">
            {guide.sections.map((section) => (
              <section key={section.heading}>
                <h2>{section.heading}</h2>
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                <ul>
                  {section.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              </section>
            ))}

            <section>
              <h2>{labels.tableTitle}</h2>
              <div
                aria-label={`${guide.table.caption} scrollable table`}
                className="astrology-reference-table-wrap"
                role="region"
                tabIndex={0}
              >
                <table className="astrology-reference-table">
                  <caption>{guide.table.caption}</caption>
                  <thead>
                    <tr>
                      {guide.table.columns.map((column) => (
                        <th key={column} scope="col">
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {guide.table.rows.map((row) => (
                      <tr key={row.join(":")}>
                        {row.map((cell, index) =>
                          index === 0 ? (
                            <th key={cell} scope="row">
                              {cell}
                            </th>
                          ) : (
                            <td key={cell}>{cell}</td>
                          ),
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h2>{labels.limitationsTitle}</h2>
              <ul>
                {guide.limitations.map((limitation) => (
                  <li key={limitation}>{limitation}</li>
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
                <a href={astrologyPublicPathname(locale, candidate.slug)}>{candidate.title}</a>
              </li>
            ))}
          </ul>
          <div className="numerology-library-actions">
            <ActionLink href={localeAstrologyPath(locale)}>{labels.calculatorAction}</ActionLink>
            <ActionLink href={localeAstrologyLibraryPath(locale)} variant="secondary">
              {labels.backToHub}
            </ActionLink>
          </div>
        </nav>
      </main>
    </PublicSiteFrame>
  );
}
