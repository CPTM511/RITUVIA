import { ActionLink } from "@rituvia/ui";

import {
  numerologyArticlePathname,
  numerologyHubPathname,
  type NumerologyGuideSlug,
} from "../_i18n/numerology-public-routes";
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

const StructuredData = ({ value }: Readonly<{ value: unknown }>) => (
  <script
    dangerouslySetInnerHTML={{
      __html: JSON.stringify(value).replaceAll("<", "\\u003c"),
    }}
    type="application/ld+json"
  />
);

export function NumerologyPublicationHub({
  brandName,
  brandTagline,
  canonicalOrigin,
  locale,
  messages,
}: SharedProps) {
  const { editorial, guides, hub, labels } = numerologyPublicationCatalog;
  const canonicalPath = localeNumerologyLibraryPath(locale);
  const canonicalUrl = new URL(canonicalPath, canonicalOrigin).toString();
  return (
    <PublicSiteFrame
      brandName={brandName}
      brandTagline={brandTagline}
      currentPage={null}
      locale={locale}
      messages={messages}
    >
      <StructuredData
        value={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "CollectionPage",
              dateModified: editorial.reviewedDate,
              datePublished: editorial.effectiveDate,
              description: hub.description,
              hasPart: guides.map((guide) => ({
                "@type": "Article",
                headline: guide.title,
                url: new URL(numerologyArticlePathname(guide.slug), canonicalOrigin).toString(),
              })),
              headline: hub.title,
              inLanguage: "en",
              url: canonicalUrl,
            },
            {
              "@type": "BreadcrumbList",
              itemListElement: [
                {
                  "@type": "ListItem",
                  item: new URL("/en", canonicalOrigin).toString(),
                  name: brandName,
                  position: 1,
                },
                {
                  "@type": "ListItem",
                  item: canonicalUrl,
                  name: hub.title,
                  position: 2,
                },
              ],
            },
          ],
        }}
      />
      <main className="numerology-library-main" id="main-content" tabIndex={-1}>
        <header className="shell numerology-library-hero">
          <p className="eyebrow">{hub.eyebrow}</p>
          <h1>{hub.title}</h1>
          <p className="numerology-library-answer">{hub.answer}</p>
          <p className="numerology-library-boundary">{hub.boundary}</p>
        </header>

        <section
          aria-labelledby="numerology-guide-list-heading"
          className="shell numerology-guide-section"
        >
          <h2 id="numerology-guide-list-heading">{labels.guideListTitle}</h2>
          <div className="numerology-guide-grid">
            {guides.map((guide) => (
              <article className="numerology-guide-card" key={guide.slug}>
                <h3>
                  <a href={numerologyArticlePathname(guide.slug)}>{guide.title}</a>
                </h3>
                <p>{guide.description}</p>
                <p className="numerology-guide-example">
                  {labels.exampleResult}: <strong>{guide.example.result}</strong>
                </p>
              </article>
            ))}
          </div>
        </section>

        <section
          aria-labelledby="numerology-source-heading"
          className="shell numerology-source-note"
        >
          <h2 id="numerology-source-heading">{labels.sourceTitle}</h2>
          <p>{hub.sourceNote}</p>
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
  const { editorial, guides, hub, labels } = numerologyPublicationCatalog;
  const canonicalPath = numerologyArticlePathname(guide.slug);
  const canonicalUrl = new URL(canonicalPath, canonicalOrigin).toString();
  const hubUrl = new URL(numerologyHubPathname, canonicalOrigin).toString();
  const related = guides.filter((candidate) => candidate.slug !== guide.slug);
  return (
    <PublicSiteFrame
      brandName={brandName}
      brandTagline={brandTagline}
      currentPage={null}
      locale={locale}
      messages={messages}
    >
      <StructuredData
        value={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Article",
              author: { "@type": "Organization", name: brandName },
              dateModified: editorial.reviewedDate,
              datePublished: editorial.effectiveDate,
              description: guide.description,
              headline: guide.title,
              inLanguage: "en",
              isPartOf: { "@type": "CollectionPage", url: hubUrl },
              publisher: { "@type": "Organization", name: brandName },
              url: canonicalUrl,
            },
            {
              "@type": "BreadcrumbList",
              itemListElement: [
                {
                  "@type": "ListItem",
                  item: new URL("/en", canonicalOrigin).toString(),
                  name: brandName,
                  position: 1,
                },
                {
                  "@type": "ListItem",
                  item: hubUrl,
                  name: hub.title,
                  position: 2,
                },
                {
                  "@type": "ListItem",
                  item: canonicalUrl,
                  name: guide.title,
                  position: 3,
                },
              ],
            },
          ],
        }}
      />
      <main className="numerology-library-main" id="main-content" tabIndex={-1}>
        <article>
          <header className="shell numerology-library-hero">
            <p className="eyebrow">{hub.eyebrow}</p>
            <h1>{guide.title}</h1>
            <p className="numerology-library-answer">{guide.answer}</p>
            <p className="numerology-library-boundary">{hub.boundary}</p>
          </header>

          <div className="shell numerology-guide-content">
            <section>
              <h2>{labels.formulaTitle}</h2>
              <p>{guide.formula}</p>
            </section>

            <section>
              <h2>{labels.exampleTitle}</h2>
              <dl className="numerology-example">
                <div>
                  <dt>{labels.exampleInput}</dt>
                  <dd>{guide.example.input}</dd>
                </div>
                <div>
                  <dt>{labels.calculation}</dt>
                  <dd>{guide.example.calculation}</dd>
                </div>
                <div>
                  <dt>{labels.exampleResult}</dt>
                  <dd>{guide.example.result}</dd>
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

            <section className="numerology-source-note">
              <h2>{labels.sourceTitle}</h2>
              <ul>
                {guide.sourceRefs.map((reference) => (
                  <li key={reference}>{sourceLabel(reference)}</li>
                ))}
              </ul>
              <p>{hub.sourceNote}</p>
            </section>
          </div>
        </article>

        <nav aria-label={labels.relatedGuidesTitle} className="shell numerology-related-guides">
          <h2>{labels.relatedGuidesTitle}</h2>
          <ul>
            {related.map((candidate) => (
              <li key={candidate.slug}>
                <a href={numerologyArticlePathname(candidate.slug)}>{candidate.title}</a>
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
