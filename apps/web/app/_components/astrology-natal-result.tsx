"use client";

import { ActionLink, Button, InlineAlert, type LocalActionHref } from "@rituvia/ui";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import {
  astrologyNatalViewZodiacSigns,
  type AstrologyNatalViewBody,
  type AstrologyNatalViewFacts,
  type AstrologyNatalViewItem,
  type AstrologyNatalViewMajorAspect,
  type AstrologyNatalViewZodiacSign,
} from "../_contracts/astrology-natal-response";
import type {
  AstrologyConfidenceMessageCode,
  AstrologyMessages,
} from "../_i18n/astrology-messages";
import { requestAstrologyNatalView } from "./astrology-natal-transport";

type ViewerPhase =
  "empty" | "error" | "loading" | "offline" | "result" | "unauthorized" | "unavailable";

const bodySymbols = new Map<AstrologyNatalViewBody, string>([
  ["jupiter", "♃"],
  ["mars", "♂"],
  ["mercury", "☿"],
  ["moon", "☽"],
  ["neptune", "♆"],
  ["pluto", "♇"],
  ["saturn", "♄"],
  ["sun", "☉"],
  ["true_node", "☊"],
  ["uranus", "♅"],
  ["venus", "♀"],
]);

const signSymbols = new Map<AstrologyNatalViewZodiacSign, string>([
  ["aquarius", "♒"],
  ["aries", "♈"],
  ["cancer", "♋"],
  ["capricorn", "♑"],
  ["gemini", "♊"],
  ["leo", "♌"],
  ["libra", "♎"],
  ["pisces", "♓"],
  ["sagittarius", "♐"],
  ["scorpio", "♏"],
  ["taurus", "♉"],
  ["virgo", "♍"],
]);

export const astrologyPolarPoint = (
  longitudeDegrees: number,
  radius: number,
): Readonly<{ x: number; y: number }> => {
  const radians = ((longitudeDegrees - 90) * Math.PI) / 180;
  return Object.freeze({
    x: 160 + radius * Math.cos(radians),
    y: 160 + radius * Math.sin(radians),
  });
};

const numeric = (value: number): string => String(value);
const degrees = (value: number): string => `${numeric(value)}°`;
const confidenceCode = (facts: AstrologyNatalViewFacts): AstrologyConfidenceMessageCode =>
  facts.confidence.messageCode;

const bodyLabel = (messages: AstrologyMessages, body: AstrologyNatalViewBody): string => {
  switch (body) {
    case "sun":
      return messages.result.bodyLabels.sun;
    case "moon":
      return messages.result.bodyLabels.moon;
    case "mercury":
      return messages.result.bodyLabels.mercury;
    case "venus":
      return messages.result.bodyLabels.venus;
    case "mars":
      return messages.result.bodyLabels.mars;
    case "jupiter":
      return messages.result.bodyLabels.jupiter;
    case "saturn":
      return messages.result.bodyLabels.saturn;
    case "uranus":
      return messages.result.bodyLabels.uranus;
    case "neptune":
      return messages.result.bodyLabels.neptune;
    case "pluto":
      return messages.result.bodyLabels.pluto;
    case "true_node":
      return messages.result.bodyLabels.true_node;
  }
};

const signLabel = (messages: AstrologyMessages, sign: AstrologyNatalViewZodiacSign): string => {
  switch (sign) {
    case "aries":
      return messages.result.signLabels.aries;
    case "taurus":
      return messages.result.signLabels.taurus;
    case "gemini":
      return messages.result.signLabels.gemini;
    case "cancer":
      return messages.result.signLabels.cancer;
    case "leo":
      return messages.result.signLabels.leo;
    case "virgo":
      return messages.result.signLabels.virgo;
    case "libra":
      return messages.result.signLabels.libra;
    case "scorpio":
      return messages.result.signLabels.scorpio;
    case "sagittarius":
      return messages.result.signLabels.sagittarius;
    case "capricorn":
      return messages.result.signLabels.capricorn;
    case "aquarius":
      return messages.result.signLabels.aquarius;
    case "pisces":
      return messages.result.signLabels.pisces;
  }
};

const aspectLabel = (
  messages: AstrologyMessages,
  aspect: AstrologyNatalViewMajorAspect,
): string => {
  switch (aspect) {
    case "conjunction":
      return messages.result.aspectLabels.conjunction;
    case "sextile":
      return messages.result.aspectLabels.sextile;
    case "square":
      return messages.result.aspectLabels.square;
    case "trine":
      return messages.result.aspectLabels.trine;
    case "opposition":
      return messages.result.aspectLabels.opposition;
  }
};

const confidenceMessage = (
  messages: AstrologyMessages,
  code: AstrologyConfidenceMessageCode,
): Readonly<{ label: string; message: string }> => {
  switch (code) {
    case "EXACT_TIME_FULL_FACTS":
      return {
        label: messages.result.confidenceLabels.EXACT_TIME_FULL_FACTS,
        message: messages.result.confidenceMessages.EXACT_TIME_FULL_FACTS,
      };
    case "APPROXIMATE_TIME_ANGLES_AND_HOUSES_SUPPRESSED":
      return {
        label: messages.result.confidenceLabels.APPROXIMATE_TIME_ANGLES_AND_HOUSES_SUPPRESSED,
        message: messages.result.confidenceMessages.APPROXIMATE_TIME_ANGLES_AND_HOUSES_SUPPRESSED,
      };
    case "UNKNOWN_TIME_NO_PLACEMENTS":
      return {
        label: messages.result.confidenceLabels.UNKNOWN_TIME_NO_PLACEMENTS,
        message: messages.result.confidenceMessages.UNKNOWN_TIME_NO_PLACEMENTS,
      };
    case "ENGINE_UNAVAILABLE_NO_PLACEMENTS":
      return {
        label: messages.result.confidenceLabels.ENGINE_UNAVAILABLE_NO_PLACEMENTS,
        message: messages.result.confidenceMessages.ENGINE_UNAVAILABLE_NO_PLACEMENTS,
      };
    case "ENGINE_OUTPUT_REJECTED_NO_PLACEMENTS":
      return {
        label: messages.result.confidenceLabels.ENGINE_OUTPUT_REJECTED_NO_PLACEMENTS,
        message: messages.result.confidenceMessages.ENGINE_OUTPUT_REJECTED_NO_PLACEMENTS,
      };
  }
};

const aspectClassName = (aspect: AstrologyNatalViewMajorAspect): string =>
  `astrology-wheel-aspect astrology-wheel-aspect--${aspect}`;

type NatalWheelProps = Readonly<{
  facts: AstrologyNatalViewFacts;
  messages: AstrologyMessages;
}>;

const NatalWheel = ({ facts, messages }: NatalWheelProps) => {
  const titleId = useId();
  const descriptionId = useId();
  const placementByBody = new Map(
    facts.placements.map((placement) => [placement.body, placement] as const),
  );

  return (
    <figure className="astrology-wheel-figure">
      <svg
        aria-labelledby={`${titleId} ${descriptionId}`}
        className="astrology-wheel"
        role="img"
        viewBox="0 0 320 320"
      >
        <title id={titleId}>{messages.result.chartTitle}</title>
        <desc id={descriptionId}>{messages.result.chartDescription}</desc>
        <circle className="astrology-wheel-boundary" cx="160" cy="160" r="148" />
        <circle className="astrology-wheel-orbit" cx="160" cy="160" r="112" />
        {astrologyNatalViewZodiacSigns.map((reviewedSign, index) => {
          const start = astrologyPolarPoint(index * 30, 112);
          const end = astrologyPolarPoint(index * 30, 148);
          const label = astrologyPolarPoint(index * 30 + 15, 132);
          return (
            <g key={reviewedSign}>
              <line
                className="astrology-wheel-sector"
                x1={start.x}
                x2={end.x}
                y1={start.y}
                y2={end.y}
              />
              <text
                aria-hidden="true"
                className="astrology-wheel-sign"
                textAnchor="middle"
                x={label.x}
                y={label.y}
              >
                {signSymbols.get(reviewedSign)}
              </text>
            </g>
          );
        })}
        {facts.houses?.cuspsDegrees.map((cusp) => {
          const start = astrologyPolarPoint(cusp, 42);
          const end = astrologyPolarPoint(cusp, 112);
          return (
            <line
              className="astrology-wheel-house"
              key={cusp}
              x1={start.x}
              x2={end.x}
              y1={start.y}
              y2={end.y}
            />
          );
        })}
        {facts.aspects.map((aspect, index) => {
          const first = placementByBody.get(aspect.bodyA);
          const second = placementByBody.get(aspect.bodyB);
          if (first === undefined || second === undefined) return null;
          const start = astrologyPolarPoint(first.eclipticLongitudeDegrees, 78);
          const end = astrologyPolarPoint(second.eclipticLongitudeDegrees, 78);
          return (
            <line
              className={aspectClassName(aspect.aspect)}
              key={`${aspect.bodyA}-${aspect.bodyB}-${aspect.aspect}-${index}`}
              x1={start.x}
              x2={end.x}
              y1={start.y}
              y2={end.y}
            />
          );
        })}
        {facts.placements.map((placement, index) => {
          const point = astrologyPolarPoint(
            placement.eclipticLongitudeDegrees,
            92 - (index % 3) * 11,
          );
          return (
            <g
              aria-label={`${bodyLabel(messages, placement.body)}, ${signLabel(messages, placement.sign)}, ${degrees(placement.signDegrees)}`}
              className="astrology-wheel-placement"
              key={placement.body}
              role="img"
              transform={`translate(${point.x} ${point.y})`}
            >
              <circle r="11" />
              <text aria-hidden="true" dominantBaseline="central" textAnchor="middle">
                {bodySymbols.get(placement.body)}
              </text>
            </g>
          );
        })}
        <circle className="astrology-wheel-core" cx="160" cy="160" r="36" />
      </svg>
      <figcaption>{messages.result.chartDescription}</figcaption>
    </figure>
  );
};

const PlacementsTable = ({ facts, messages }: NatalWheelProps) => (
  <section aria-labelledby="astrology-placements-heading" className="astrology-table-section">
    <h3 id="astrology-placements-heading">{messages.result.placementsTitle}</h3>
    <div className="astrology-table-scroll" tabIndex={0}>
      <table>
        <caption>{messages.result.placementsCaption}</caption>
        <thead>
          <tr>
            <th scope="col">{messages.result.columns.body}</th>
            <th scope="col">{messages.result.columns.sign}</th>
            <th scope="col">{messages.result.columns.signDegrees}</th>
            <th scope="col">{messages.result.columns.longitude}</th>
            <th scope="col">{messages.result.columns.latitude}</th>
            <th scope="col">{messages.result.columns.distance}</th>
            <th scope="col">{messages.result.columns.longitudeSpeed}</th>
            <th scope="col">{messages.result.columns.flags}</th>
          </tr>
        </thead>
        <tbody>
          {facts.placements.map((placement) => (
            <tr key={placement.body}>
              <th scope="row">
                <span aria-hidden="true">{bodySymbols.get(placement.body)} </span>
                {bodyLabel(messages, placement.body)}
              </th>
              <td>{signLabel(messages, placement.sign)}</td>
              <td dir="ltr">{degrees(placement.signDegrees)}</td>
              <td dir="ltr">{degrees(placement.eclipticLongitudeDegrees)}</td>
              <td dir="ltr">{degrees(placement.eclipticLatitudeDegrees)}</td>
              <td dir="ltr">{numeric(placement.distanceAu)}</td>
              <td dir="ltr">{degrees(placement.longitudeSpeedDegreesPerDay)}</td>
              <td dir="ltr">{numeric(placement.returnedEphemerisFlags)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </section>
);

const HousesAndAngles = ({ facts, messages }: NatalWheelProps) => {
  if (facts.houses === null) return null;
  const angles = facts.houses.angles;
  const angleRows = [
    {
      key: "ascendant",
      label: messages.result.angleLabels.ascendant,
      value: angles.ascendantDegrees,
    },
    {
      key: "midheaven",
      label: messages.result.angleLabels.midheaven,
      value: angles.midheavenDegrees,
    },
    { key: "armc", label: messages.result.angleLabels.armc, value: angles.armcDegrees },
    { key: "vertex", label: messages.result.angleLabels.vertex, value: angles.vertexDegrees },
  ] as const;
  return (
    <div className="astrology-table-pair">
      <section aria-labelledby="astrology-houses-heading" className="astrology-table-section">
        <h3 id="astrology-houses-heading">{messages.result.housesTitle}</h3>
        <div className="astrology-table-scroll" tabIndex={0}>
          <table>
            <caption>{messages.result.housesCaption}</caption>
            <thead>
              <tr>
                <th scope="col">{messages.result.columns.house}</th>
                <th scope="col">{messages.result.columns.cusp}</th>
              </tr>
            </thead>
            <tbody>
              {facts.houses.cuspsDegrees.map((cusp, index) => (
                <tr key={index}>
                  <th scope="row">{index + 1}</th>
                  <td dir="ltr">{degrees(cusp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section aria-labelledby="astrology-angles-heading" className="astrology-table-section">
        <h3 id="astrology-angles-heading">{messages.result.anglesTitle}</h3>
        <div className="astrology-table-scroll" tabIndex={0}>
          <table>
            <caption>{messages.result.anglesCaption}</caption>
            <thead>
              <tr>
                <th scope="col">{messages.result.columns.name}</th>
                <th scope="col">{messages.result.columns.value}</th>
              </tr>
            </thead>
            <tbody>
              {angleRows.map((angle) => (
                <tr key={angle.key}>
                  <th scope="row">{angle.label}</th>
                  <td dir="ltr">{degrees(angle.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

const AspectsTable = ({ facts, messages }: NatalWheelProps) =>
  facts.aspects.length === 0 ? null : (
    <section aria-labelledby="astrology-aspects-heading" className="astrology-table-section">
      <h3 id="astrology-aspects-heading">{messages.result.aspectsTitle}</h3>
      <div className="astrology-table-scroll" tabIndex={0}>
        <table>
          <caption>{messages.result.aspectsCaption}</caption>
          <thead>
            <tr>
              <th scope="col">{messages.result.columns.aspect}</th>
              <th scope="col">{messages.result.columns.bodyA}</th>
              <th scope="col">{messages.result.columns.bodyB}</th>
              <th scope="col">{messages.result.columns.separation}</th>
              <th scope="col">{messages.result.columns.exactAngle}</th>
              <th scope="col">{messages.result.columns.orb}</th>
            </tr>
          </thead>
          <tbody>
            {facts.aspects.map((aspect, index) => (
              <tr key={`${aspect.bodyA}-${aspect.bodyB}-${aspect.aspect}-${index}`}>
                <th scope="row">
                  <span
                    aria-hidden="true"
                    className={`astrology-aspect-key astrology-aspect-key--${aspect.aspect}`}
                  />
                  {aspectLabel(messages, aspect.aspect)}
                </th>
                <td>{bodyLabel(messages, aspect.bodyA)}</td>
                <td>{bodyLabel(messages, aspect.bodyB)}</td>
                <td dir="ltr">{degrees(aspect.separationDegrees)}</td>
                <td dir="ltr">{degrees(aspect.exactAngleDegrees)}</td>
                <td dir="ltr">{degrees(aspect.orbDegrees)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );

type VerifiedResultProps = Readonly<{
  item: AstrologyNatalViewItem;
  messages: AstrologyMessages;
}>;

export const AstrologyNatalPresentation = ({ item, messages }: VerifiedResultProps) => {
  const facts = item.facts;
  const code = confidenceCode(facts);
  const confidence = confidenceMessage(messages, code);
  const hasChart = facts.placements.length > 0;
  const savedAt = new Intl.DateTimeFormat("en", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    timeZone: "UTC",
    timeZoneName: "short",
    year: "numeric",
  }).format(new Date(item.createdAt));
  const approximationWindow =
    facts.approximationWindowMinutes === null
      ? null
      : new Intl.NumberFormat("en", {
          style: "unit",
          unit: "minute",
          unitDisplay: "long",
        }).format(facts.approximationWindowMinutes);

  return (
    <article className="astrology-result">
      <header className="astrology-result-heading">
        <p className="eyebrow">
          {messages.result.savedAt}: <span dir="ltr">{savedAt}</span>
        </p>
        <h2>{messages.result.title}</h2>
        <InlineAlert
          message={confidence.message}
          title={confidence.label}
          tone={code === "EXACT_TIME_FULL_FACTS" ? "success" : "warning"}
        />
        {approximationWindow === null ? null : (
          <p className="astrology-approximation-note">
            {messages.result.approximationWindow}: <strong dir="ltr">{approximationWindow}</strong>
          </p>
        )}
      </header>
      {hasChart ? <NatalWheel facts={facts} messages={messages} /> : null}
      {facts.placements.length > 0 ? <PlacementsTable facts={facts} messages={messages} /> : null}
      <HousesAndAngles facts={facts} messages={messages} />
      <AspectsTable facts={facts} messages={messages} />
      <details className="astrology-method">
        <summary>{messages.result.methodDetails}</summary>
        <p>{messages.result.methodNote}</p>
        <dl>
          <div>
            <dt>{messages.result.profileRevision}</dt>
            <dd dir="ltr">{facts.profileRevision}</dd>
          </div>
          <div>
            <dt>{messages.result.method}</dt>
            <dd>
              <code dir="ltr">
                {facts.method.methodVersion} · {facts.method.aspectPolicyVersion} ·{" "}
                {facts.houseSystem}
              </code>
            </dd>
          </div>
          <div>
            <dt>{messages.result.engine}</dt>
            <dd>
              <code dir="ltr">
                {facts.engine.libraryVersion} · {facts.engine.adapterVersion} ·{" "}
                {facts.engine.abiVersion}
              </code>
            </dd>
          </div>
          <div>
            <dt>{messages.result.source}</dt>
            <dd>
              <code dir="ltr">
                {facts.engine.sourceSnapshotTag} · {facts.engine.sourceCommit}
              </code>
            </dd>
          </div>
          <div>
            <dt>{messages.result.requestedFlags}</dt>
            <dd dir="ltr">{facts.requestedEphemerisFlags}</dd>
          </div>
          {facts.julianDayUt === null ? null : (
            <div>
              <dt>{messages.result.julianDay}</dt>
              <dd dir="ltr">{numeric(facts.julianDayUt)}</dd>
            </div>
          )}
        </dl>
      </details>
    </article>
  );
};

const failureState = (
  phase: Exclude<ViewerPhase, "empty" | "loading" | "result">,
  messages: AstrologyMessages,
) => {
  switch (phase) {
    case "error":
      return messages.states.error;
    case "offline":
      return messages.states.offline;
    case "unauthorized":
      return messages.states.unauthorized;
    case "unavailable":
      return messages.states.unavailable;
  }
};

type AstrologyNatalResultProps = Readonly<{
  messages: AstrologyMessages;
  signInHref: LocalActionHref;
}>;

export function AstrologyNatalResult({ messages, signInHref }: AstrologyNatalResultProps) {
  const [item, setItem] = useState<AstrologyNatalViewItem | null>(null);
  const [phase, setPhase] = useState<ViewerPhase>("loading");
  const abortController = useRef<AbortController | null>(null);
  const requestSequence = useRef(0);
  const resultRegion = useRef<HTMLElement | null>(null);

  const load = useCallback(async (): Promise<void> => {
    const sequence = requestSequence.current + 1;
    requestSequence.current = sequence;
    const controller = new AbortController();
    abortController.current?.abort();
    abortController.current = controller;
    setItem(null);
    setPhase("loading");
    const result = await requestAstrologyNatalView({
      isOnline: () => navigator.onLine,
      signal: controller.signal,
    });
    if (sequence !== requestSequence.current || result.kind === "aborted") return;
    if (result.kind === "success") {
      setItem(result.item);
      setPhase("result");
    } else {
      setPhase(result.kind);
    }
    if (abortController.current === controller) abortController.current = null;
  }, []);

  useEffect(() => {
    const pendingLoad = window.setTimeout(() => void load(), 0);
    return () => {
      window.clearTimeout(pendingLoad);
      requestSequence.current += 1;
      abortController.current?.abort();
    };
  }, [load]);

  useEffect(() => {
    if (phase !== "loading") resultRegion.current?.focus();
  }, [phase]);

  const failure =
    phase === "error" || phase === "offline" || phase === "unauthorized" || phase === "unavailable"
      ? failureState(phase, messages)
      : null;

  return (
    <section
      aria-busy={phase === "loading" || undefined}
      aria-live="polite"
      className="astrology-viewer"
      ref={resultRegion}
      tabIndex={-1}
    >
      <noscript>
        <InlineAlert
          message={messages.states.error.message}
          title={messages.states.error.title}
          tone="warning"
        />
      </noscript>
      {phase === "loading" ? (
        <InlineAlert
          live="polite"
          message={messages.states.loading.message}
          title={messages.states.loading.title}
        />
      ) : null}
      {phase === "empty" ? (
        <InlineAlert message={messages.states.empty.message} title={messages.states.empty.title} />
      ) : null}
      {failure === null ? null : (
        <div className="astrology-viewer-state">
          <InlineAlert
            live="polite"
            message={failure.message}
            title={failure.title}
            tone={phase === "offline" || phase === "unauthorized" ? "warning" : "error"}
          />
          {phase === "unauthorized" ? (
            <ActionLink href={signInHref}>{messages.states.unauthorized.action}</ActionLink>
          ) : (
            <Button
              label={
                phase === "offline"
                  ? messages.states.offline.retry
                  : phase === "unavailable"
                    ? messages.states.unavailable.retry
                    : messages.states.error.retry
              }
              onPress={() => void load()}
              tone="secondary"
            />
          )}
        </div>
      )}
      {phase === "result" && item !== null ? (
        <AstrologyNatalPresentation item={item} messages={messages} />
      ) : null}
    </section>
  );
}
