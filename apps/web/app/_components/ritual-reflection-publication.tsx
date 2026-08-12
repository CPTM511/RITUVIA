import { ActionLink } from "@rituvia/ui";

import type { SharedMessages } from "../_i18n/messages";
import {
  ritualReflectionGuidePathname,
  ritualReflectionHubPathname,
  ritualReflectionRouteId,
} from "../_i18n/ritual-reflection-public-routes";
import { localePublicPagePath, localeSanctuaryPath } from "../_i18n/routing";
import {
  getRitualReflectionSourceLabel,
  ritualReflectionPublication,
  type RitualReflectionGuideV1,
} from "../../server/ritual-reflection-publication";
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

export function RitualReflectionPublicationHub({
  brandName,
  brandTagline,
  canonicalOrigin,
  locale,
  messages,
}: SharedProps) {
  const { guides, hub, labels, sources } = ritualReflectionPublication;
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
        routeId="ritual-reflection-hub"
        title={hub.title}
      />
      <main className="ritual-guide-main" id="main-content" tabIndex={-1}>
        <header className="shell ritual-guide-hero">
          <p className="eyebrow">{hub.eyebrow}</p>
          <h1>{hub.title}</h1>
          <p className="ritual-guide-answer">{hub.answer}</p>
          <p className="ritual-guide-boundary">{hub.boundary}</p>
        </header>

        <GeoAnswerContext
          brandName={brandName}
          locale={locale}
          routeId="ritual-reflection-hub"
          sourceLabels={sources.map(({ sourceId, version }) =>
            getRitualReflectionSourceLabel(`${sourceId}@${version}`),
          )}
        />

        <section aria-labelledby="ritual-guide-list-heading" className="shell ritual-guide-section">
          <h2 id="ritual-guide-list-heading">{labels.guideListTitle}</h2>
          <div className="ritual-guide-grid">
            {guides.map((guide) => (
              <article className="ritual-guide-card" key={guide.slug}>
                <h3>
                  <a href={ritualReflectionGuidePathname(guide.slug)}>{guide.title}</a>
                </h3>
                <p>{guide.description}</p>
              </article>
            ))}
          </div>
        </section>

        <nav aria-label={labels.relatedTitle} className="shell ritual-guide-actions">
          <ActionLink href={localeSanctuaryPath(locale)}>{labels.experienceAction}</ActionLink>
          <ActionLink href={localePublicPagePath(locale, "safety")} variant="secondary">
            {labels.safetyAction}
          </ActionLink>
        </nav>
      </main>
    </PublicSiteFrame>
  );
}

export function RitualReflectionPublicationGuide({
  brandName,
  brandTagline,
  canonicalOrigin,
  guide,
  locale,
  messages,
}: SharedProps & Readonly<{ guide: RitualReflectionGuideV1 }>) {
  const { hub, labels } = ritualReflectionPublication;
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
        routeId={ritualReflectionRouteId(guide.slug)}
        title={guide.title}
      />
      <main className="ritual-guide-main" id="main-content" tabIndex={-1}>
        <article>
          <header className="shell ritual-guide-hero">
            <p className="eyebrow">{hub.eyebrow}</p>
            <h1>{guide.title}</h1>
            <p className="ritual-guide-answer">{guide.answer}</p>
            <p className="ritual-guide-boundary">{hub.boundary}</p>
          </header>

          <GeoAnswerContext
            brandName={brandName}
            locale={locale}
            routeId={ritualReflectionRouteId(guide.slug)}
            sourceLabels={guide.sourceRefs.map(getRitualReflectionSourceLabel)}
          />

          <div className="shell ritual-guide-content">
            <section aria-labelledby="ritual-guide-steps-heading">
              <h2 id="ritual-guide-steps-heading">{labels.stepsTitle}</h2>
              <ol>
                {guide.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </section>

            <section aria-labelledby="ritual-guide-questions-heading">
              <h2 id="ritual-guide-questions-heading">{labels.questionsTitle}</h2>
              <ul>
                {guide.reflectionQuestions.map((question) => (
                  <li key={question}>{question}</li>
                ))}
              </ul>
            </section>

            <section aria-labelledby="ritual-guide-limits-heading">
              <h2 id="ritual-guide-limits-heading">{labels.limitsTitle}</h2>
              <ul>
                {guide.limitations.map((limitation) => (
                  <li key={limitation}>{limitation}</li>
                ))}
              </ul>
            </section>
          </div>
        </article>

        <nav aria-label={labels.relatedTitle} className="shell ritual-guide-actions">
          <ActionLink href={localeSanctuaryPath(locale)}>{labels.experienceAction}</ActionLink>
          <a href={ritualReflectionHubPathname}>{labels.backToHub}</a>
        </nav>
      </main>
    </PublicSiteFrame>
  );
}
