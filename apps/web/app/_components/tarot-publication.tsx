import { ActionLink } from "@rituvia/ui";

import type { SharedMessages } from "../_i18n/messages";
import {
  tarotGuidePathname,
  tarotHubPathname,
  tarotCardSlugs,
  tarotRouteId,
  tarotSpreadSlugs,
  type TarotCardSlug,
  type TarotSpreadSlug,
} from "../_i18n/tarot-public-routes";
import { localePublicPagePath, localeTarotOneCardPath } from "../_i18n/routing";
import {
  getTarotLibrarySourceLabel,
  tarotLibraryPublication,
  type TarotLibraryCardV1,
  type TarotLibrarySpreadV1,
} from "../../server/tarot-publication";
import { GeoAnswerContext } from "./geo-answer-context";
import { PublicStructuredData } from "./public-structured-data";
import { PublicSiteFrame } from "./public-site-frame";

type SharedProps = Readonly<{
  brandName: string;
  brandTagline: string;
  canonicalOrigin: string;
  locale: "en";
  messages: SharedMessages;
}>;

const guideTitle = (slug: TarotCardSlug | TarotSpreadSlug): string => {
  const guide = [...tarotLibraryPublication.cards, ...tarotLibraryPublication.spreads].find(
    (candidate) => candidate.slug === slug,
  );
  if (guide === undefined) throw new TypeError("The related Tarot library guide is unavailable.");
  return guide.title;
};

export function TarotPublicationHub({
  brandName,
  brandTagline,
  canonicalOrigin,
  locale,
  messages,
}: SharedProps) {
  const { cards, hub, labels, sources, spreads } = tarotLibraryPublication;
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
        routeId="tarot-hub"
        title={hub.title}
      />
      <main className="tarot-library-main" id="main-content" tabIndex={-1}>
        <header className="shell tarot-library-hero">
          <p className="eyebrow">{hub.eyebrow}</p>
          <h1>{hub.title}</h1>
          <p className="tarot-library-answer">{hub.answer}</p>
          <p className="tarot-library-boundary">{hub.boundary}</p>
        </header>

        <GeoAnswerContext
          brandName={brandName}
          locale={locale}
          routeId="tarot-hub"
          sourceLabels={sources.map(({ sourceId, version }) =>
            getTarotLibrarySourceLabel(`${sourceId}@${version}`),
          )}
        />

        <section aria-labelledby="tarot-card-list-heading" className="shell tarot-library-section">
          <h2 id="tarot-card-list-heading">{labels.cardListTitle}</h2>
          <ol className="tarot-library-grid">
            {cards.map((guide) => (
              <li key={guide.slug}>
                <article className="tarot-library-card">
                  <span aria-label={guide.altText} className="tarot-library-symbol" role="img">
                    {guide.symbol}
                  </span>
                  <p className="tarot-library-number">{guide.number}</p>
                  <h3>
                    <a href={tarotGuidePathname(guide.slug)}>{guide.card.title}</a>
                  </h3>
                  <p>{guide.upright.coreThemes.join(" · ")}</p>
                </article>
              </li>
            ))}
          </ol>
        </section>

        <section
          aria-labelledby="tarot-spread-list-heading"
          className="shell tarot-library-section"
        >
          <h2 id="tarot-spread-list-heading">{labels.spreadListTitle}</h2>
          <div className="tarot-spread-grid">
            {spreads.map((guide) => (
              <article className="tarot-library-card" key={guide.slug}>
                <h3>
                  <a href={tarotGuidePathname(guide.slug)}>{guide.title}</a>
                </h3>
                <p>{guide.description}</p>
              </article>
            ))}
          </div>
        </section>

        <nav aria-label={labels.relatedTitle} className="shell tarot-library-actions">
          <ActionLink href={localeTarotOneCardPath(locale)}>{labels.readingAction}</ActionLink>
          <ActionLink href={localePublicPagePath(locale, "safety")} variant="secondary">
            {labels.safetyAction}
          </ActionLink>
        </nav>
      </main>
    </PublicSiteFrame>
  );
}

const OrientationSection = ({
  content,
  heading,
  labels,
}: Readonly<{
  content: TarotLibraryCardV1["upright"];
  heading: string;
  labels: TarotLibraryPublicationLabels;
}>) => (
  <section className="tarot-orientation-section">
    <h2>{heading}</h2>
    <dl className="tarot-orientation-details">
      <div>
        <dt>{labels.themesTitle}</dt>
        <dd>{content.coreThemes.join(" · ")}</dd>
      </div>
      <div>
        <dt>{labels.possibilityTitle}</dt>
        <dd>{content.constructivePossibilities.join(" ")}</dd>
      </div>
      <div>
        <dt>{labels.tensionTitle}</dt>
        <dd>{content.tensions.join(" ")}</dd>
      </div>
      <div>
        <dt>{labels.questionTitle}</dt>
        <dd>{content.reflectionQuestions.join(" ")}</dd>
      </div>
      <div>
        <dt>{labels.actionTitle}</dt>
        <dd>{content.smallActions.join(" ")}</dd>
      </div>
      <div>
        <dt>{labels.limitsTitle}</dt>
        <dd>{content.cannotDetermine}</dd>
      </div>
    </dl>
  </section>
);

type TarotLibraryPublicationLabels = (typeof tarotLibraryPublication)["labels"];

export function TarotPublicationCard({
  brandName,
  brandTagline,
  canonicalOrigin,
  guide,
  locale,
  messages,
}: SharedProps & Readonly<{ guide: TarotLibraryCardV1 }>) {
  const { hub, labels } = tarotLibraryPublication;
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
        description={guide.upright.constructivePossibilities.join(" ")}
        locale={locale}
        routeId={tarotRouteId(guide.slug)}
        title={guide.title}
      />
      <main className="tarot-library-main" id="main-content" tabIndex={-1}>
        <article>
          <header className="shell tarot-library-hero tarot-card-hero">
            <span aria-label={guide.altText} className="tarot-card-symbol" role="img">
              {guide.symbol}
            </span>
            <p className="eyebrow">
              {labels.cardEyebrow} {guide.number}
            </p>
            <h1>{guide.title}</h1>
            <p className="tarot-library-answer">
              {guide.upright.constructivePossibilities.join(" ")}
            </p>
            <p className="tarot-library-boundary">{hub.boundary}</p>
          </header>

          <GeoAnswerContext
            brandName={brandName}
            locale={locale}
            routeId={tarotRouteId(guide.slug)}
            sourceLabels={guide.sourceRefs.map(getTarotLibrarySourceLabel)}
          />

          <div className="shell tarot-guide-content">
            <OrientationSection
              content={guide.upright}
              heading={labels.uprightTitle}
              labels={labels}
            />
            <OrientationSection
              content={guide.reversed}
              heading={labels.reversedTitle}
              labels={labels}
            />
          </div>
        </article>

        <nav aria-label={labels.relatedTitle} className="shell tarot-related-guides">
          <h2>{labels.relatedTitle}</h2>
          <ul>
            <li>
              <a href={tarotGuidePathname(guide.previousSlug)}>{labels.previousCard}</a>
            </li>
            <li>
              <a href={tarotGuidePathname(guide.nextSlug)}>{labels.nextCard}</a>
            </li>
            {tarotSpreadSlugs.map((slug) => (
              <li key={slug}>
                <a href={tarotGuidePathname(slug)}>{guideTitle(slug)}</a>
              </li>
            ))}
          </ul>
          <div className="tarot-library-actions">
            <ActionLink href={localeTarotOneCardPath(locale)}>{labels.readingAction}</ActionLink>
            <a href={tarotHubPathname}>{labels.backToHub}</a>
          </div>
        </nav>
      </main>
    </PublicSiteFrame>
  );
}

export function TarotPublicationSpread({
  brandName,
  brandTagline,
  canonicalOrigin,
  guide,
  locale,
  messages,
}: SharedProps & Readonly<{ guide: TarotLibrarySpreadV1 }>) {
  const { hub, labels } = tarotLibraryPublication;
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
        routeId={tarotRouteId(guide.slug)}
        title={guide.title}
      />
      <main className="tarot-library-main" id="main-content" tabIndex={-1}>
        <article>
          <header className="shell tarot-library-hero">
            <p className="eyebrow">{labels.spreadEyebrow}</p>
            <h1>{guide.title}</h1>
            <p className="tarot-library-answer">{guide.answer}</p>
            <p className="tarot-library-boundary">{hub.boundary}</p>
          </header>

          <GeoAnswerContext
            brandName={brandName}
            locale={locale}
            routeId={tarotRouteId(guide.slug)}
            sourceLabels={guide.sourceRefs.map(getTarotLibrarySourceLabel)}
          />

          <div className="shell tarot-guide-content">
            <section>
              <h2>{labels.positionsTitle}</h2>
              <ol className="tarot-spread-positions">
                {guide.spread.positions.map((position) => (
                  <li key={position.positionId}>
                    <h3>{position.title}</h3>
                    <p>{position.description}</p>
                  </li>
                ))}
              </ol>
            </section>
            <section>
              <h2>{labels.stepsTitle}</h2>
              <ol>
                {guide.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </section>
            <section>
              <h2>{labels.questionTitle}</h2>
              <ul>
                {guide.reflectionQuestions.map((question) => (
                  <li key={question}>{question}</li>
                ))}
              </ul>
            </section>
            <section>
              <h2>{labels.limitsTitle}</h2>
              <ul>
                {guide.limitations.map((limitation) => (
                  <li key={limitation}>{limitation}</li>
                ))}
              </ul>
            </section>
          </div>
        </article>

        <nav aria-label={labels.relatedTitle} className="shell tarot-related-guides">
          <h2>{labels.relatedTitle}</h2>
          <ul>
            {tarotCardSlugs.slice(0, 4).map((slug: TarotCardSlug) => (
              <li key={slug}>
                <a href={tarotGuidePathname(slug)}>{guideTitle(slug)}</a>
              </li>
            ))}
            {tarotSpreadSlugs
              .filter((slug: TarotSpreadSlug) => slug !== guide.slug)
              .map((slug) => (
                <li key={slug}>
                  <a href={tarotGuidePathname(slug)}>{guideTitle(slug)}</a>
                </li>
              ))}
          </ul>
          <div className="tarot-library-actions">
            <ActionLink href={localeTarotOneCardPath(locale)}>{labels.readingAction}</ActionLink>
            <a href={tarotHubPathname}>{labels.backToHub}</a>
          </div>
        </nav>
      </main>
    </PublicSiteFrame>
  );
}
