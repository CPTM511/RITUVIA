import type { CoreLoopEventName } from "./contracts.js";
import type { CoreLoopEventObservation } from "./ledger.js";

export const wmrsDefinitionVersion = "wmrs.consent-anonymous.v1" as const;
export const coreLoopFunnelDefinitionVersion = "core-loop-funnel.v1" as const;

export const coreLoopFunnelStages = Object.freeze([
  "reading_started",
  "reading_deterministic_completed",
  "interpretation_viewed",
  "intention_created",
  "ritual_started",
  "ritual_completed",
  "journal_entry_created",
  "revisit_scheduled",
  "revisit_completed",
] as const satisfies readonly CoreLoopEventName[]);

const deeperStepNames = new Set<CoreLoopEventName>([
  "intention_created",
  "ritual_completed",
  "journal_entry_created",
  "revisit_completed",
]);

export type CoreLoopSessionProjection = Readonly<{
  analyticsSubjectKey: string;
  firstEventAt: string;
  reflectionSessionKey: string;
  reachedStages: readonly CoreLoopEventName[];
}>;

export type CoreLoopMetricProjection = Readonly<{
  asOf: string;
  consentScope: typeof import("./contracts.js").coreLoopAnalyticsConsentPurpose;
  distinctAnalyticsSubjects: number;
  funnelDefinitionVersion: typeof coreLoopFunnelDefinitionVersion;
  lateEventCount: number;
  qualifyingReflectionSessions: number;
  sessions: readonly CoreLoopSessionProjection[];
  windowEnd: string;
  windowStart: string;
  wmrs: number;
  wmrsDefinitionVersion: typeof wmrsDefinitionVersion;
}>;

const parseAsOf = (asOf: string): number => {
  const milliseconds = Date.parse(asOf);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== asOf) {
    throw new TypeError("The analytics projection time is invalid.");
  }
  return milliseconds;
};

export const projectCoreLoopMetrics = (
  observations: readonly CoreLoopEventObservation[],
  asOf: string,
): CoreLoopMetricProjection => {
  const windowEndMs = parseAsOf(asOf);
  const windowStartMs = windowEndMs - 7 * 24 * 60 * 60 * 1_000;
  const seenEventIds = new Set<string>();
  const inWindow = observations
    .filter(({ event }) => {
      if (seenEventIds.has(event.eventId)) return false;
      seenEventIds.add(event.eventId);
      const occurredAt = Date.parse(event.occurredAt);
      return occurredAt >= windowStartMs && occurredAt < windowEndMs;
    })
    .sort(
      (left, right) =>
        Date.parse(left.event.occurredAt) - Date.parse(right.event.occurredAt) ||
        left.event.eventId.localeCompare(right.event.eventId),
    );

  const grouped = new Map<string, CoreLoopEventObservation[]>();
  for (const observation of inWindow) {
    const key = `${observation.event.analyticsSubjectKey}\0${observation.event.reflectionSessionKey}`;
    const current = grouped.get(key);
    if (current === undefined) grouped.set(key, [observation]);
    else current.push(observation);
  }

  const sessions: CoreLoopSessionProjection[] = [];
  const qualifyingSubjects = new Set<string>();
  let qualifyingReflectionSessions = 0;
  let lateEventCount = 0;

  for (const observation of inWindow) {
    if (
      Date.parse(observation.receivedAt) - Date.parse(observation.event.occurredAt) >
      86_400_000
    ) {
      lateEventCount += 1;
    }
  }

  for (const events of grouped.values()) {
    const first = events[0];
    if (first === undefined) continue;
    const firstByName = new Map<CoreLoopEventName, number>();
    for (const { event } of events) {
      if (!firstByName.has(event.eventName)) {
        firstByName.set(event.eventName, Date.parse(event.occurredAt));
      }
    }

    const reachedStages: CoreLoopEventName[] = [];
    let previousAt = Number.NEGATIVE_INFINITY;
    for (const stage of coreLoopFunnelStages) {
      const occurredAt = firstByName.get(stage);
      if (occurredAt === undefined || occurredAt < previousAt) break;
      reachedStages.push(stage);
      previousAt = occurredAt;
    }

    const readingCompletedAt = firstByName.get("reading_deterministic_completed");
    const deeperStepAt =
      readingCompletedAt === undefined
        ? undefined
        : [...deeperStepNames]
            .map((name) => firstByName.get(name))
            .filter((value): value is number => value !== undefined && value >= readingCompletedAt)
            .sort((left, right) => left - right)[0];
    if (readingCompletedAt !== undefined && deeperStepAt !== undefined) {
      qualifyingReflectionSessions += 1;
      qualifyingSubjects.add(first.event.analyticsSubjectKey);
    }

    sessions.push(
      Object.freeze({
        analyticsSubjectKey: first.event.analyticsSubjectKey,
        firstEventAt: first.event.occurredAt,
        reflectionSessionKey: first.event.reflectionSessionKey,
        reachedStages: Object.freeze(reachedStages),
      }),
    );
  }

  return Object.freeze({
    asOf,
    consentScope: "optional_product_analytics",
    distinctAnalyticsSubjects: new Set(inWindow.map(({ event }) => event.analyticsSubjectKey)).size,
    funnelDefinitionVersion: coreLoopFunnelDefinitionVersion,
    lateEventCount,
    qualifyingReflectionSessions,
    sessions: Object.freeze(
      sessions.sort(
        (left, right) =>
          left.firstEventAt.localeCompare(right.firstEventAt) ||
          left.reflectionSessionKey.localeCompare(right.reflectionSessionKey),
      ),
    ),
    windowEnd: new Date(windowEndMs).toISOString(),
    windowStart: new Date(windowStartMs).toISOString(),
    wmrs: qualifyingSubjects.size,
    wmrsDefinitionVersion,
  });
};
