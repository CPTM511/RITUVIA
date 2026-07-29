import type { PublicRouteId } from "../_i18n/public-routes";
import { getGeoAnswerContext } from "../../server/geo-answer-context";

type GeoAnswerContextProps = Readonly<{
  brandName: string;
  locale: string;
  routeId: PublicRouteId;
  sourceLabels?: readonly string[];
}>;

export function GeoAnswerContext({
  brandName,
  locale,
  routeId,
  sourceLabels,
}: GeoAnswerContextProps) {
  const context = getGeoAnswerContext({
    brandName,
    locale,
    routeId,
    ...(sourceLabels === undefined ? {} : { sourceLabels }),
  });
  const headingId = `geo-${routeId.replaceAll(/[^a-z0-9]+/gu, "-")}`;

  return (
    <section
      aria-labelledby={headingId}
      className="shell geo-answer-context"
      data-geo-answer-context=""
      data-geo-entity-id={context.entity.id}
    >
      <h2 id={headingId}>{context.labels.answerContextHeading}</h2>

      <dl className="geo-answer-context-details">
        <div>
          <dt>{context.labels.entity}</dt>
          <dd>
            <strong>{context.entity.name}</strong>
            <span>{context.entity.definition}</span>
          </dd>
        </div>
        {context.classifications.map((item) => (
          <div data-geo-classification={item.kind} key={item.kind}>
            <dt>{item.label}</dt>
            <dd>{item.statement}</dd>
          </div>
        ))}
      </dl>

      <div className="geo-answer-context-authority">
        <div>
          <h3>{context.labels.sourceBasis}</h3>
          <ul>
            {context.sources.map((sourceLabel) => (
              <li key={sourceLabel}>{sourceLabel}</li>
            ))}
          </ul>
        </div>
        <dl>
          <div>
            <dt>{context.labels.reviewAuthority}</dt>
            <dd>
              {context.authority.kind === "decision"
                ? context.labels.decisionAuthority
                : context.labels.editorialAuthority}
            </dd>
          </div>
          <div>
            <dt>{context.labels.reviewed}</dt>
            <dd>{context.authority.reviewedDate}</dd>
          </div>
          {context.authority.reviewDueDate === null ? null : (
            <div>
              <dt>{context.labels.reviewDue}</dt>
              <dd>{context.authority.reviewDueDate}</dd>
            </div>
          )}
        </dl>
      </div>
    </section>
  );
}
