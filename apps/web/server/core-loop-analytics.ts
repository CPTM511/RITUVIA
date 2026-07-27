import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import {
  coreLoopAnalyticsConsentNoticeVersion,
  coreLoopAnalyticsConsentPurpose,
  coreLoopEventSchemaVersion,
  parseCoreLoopEvent,
  type CoreLoopEvent,
} from "@rituvia/analytics";
import type { AnonymousIdentityService, AnonymousSessionContext } from "@rituvia/db";

type CoreLoopEventIntent = CoreLoopEvent extends infer Event
  ? Event extends CoreLoopEvent
    ? Pick<Event, "eventName" | "locale" | "occurredAt" | "properties" | "source">
    : never
  : never;

export type CoreLoopReflectionRoot =
  | Readonly<{ kind: "intention"; intentionId: string }>
  | Readonly<{ kind: "reading"; readingId: string }>;

export type WebCoreLoopAnalyticsCapture = CoreLoopEventIntent &
  Readonly<{
    anonymousSessionToken: string | undefined;
    reflectionRoot: CoreLoopReflectionRoot;
    semanticReference: string;
  }>;

export type WebCoreLoopAnalytics = Readonly<{
  capture(input: WebCoreLoopAnalyticsCapture): Promise<boolean>;
}>;

export type WebCoreLoopAnalyticsSink = Readonly<{
  write(event: CoreLoopEvent): Promise<void>;
}>;

export type CoreLoopAnalyticsPseudonymKey = Readonly<{
  environment: "development" | "production" | "test";
  key: Uint8Array;
  version: string;
}>;

type AnalyticsIdentity = Pick<AnonymousIdentityService, "allowsConsent" | "resolveSession">;

const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const versionPattern = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u;

const safeOffCapture = async (): Promise<false> => false;

export const safeOffWebCoreLoopAnalytics: WebCoreLoopAnalytics = Object.freeze({
  capture: safeOffCapture,
});

export const captureCoreLoopAnalytics = async (
  analytics: WebCoreLoopAnalytics,
  input: WebCoreLoopAnalyticsCapture,
): Promise<boolean> => {
  try {
    return await analytics.capture(input);
  } catch {
    return false;
  }
};

const parseKey = (value: CoreLoopAnalyticsPseudonymKey): CoreLoopAnalyticsPseudonymKey => {
  if (
    !(value.key instanceof Uint8Array) ||
    value.key.byteLength < 32 ||
    value.key.byteLength > 64 ||
    !versionPattern.test(value.version)
  ) {
    throw new TypeError("The analytics pseudonym key is invalid.");
  }
  return Object.freeze({
    environment: value.environment,
    key: Uint8Array.from(value.key),
    version: value.version,
  });
};

const sameBytes = (left: Uint8Array, right: Uint8Array): boolean =>
  left.byteLength === right.byteLength && timingSafeEqual(left, right);

export const createCoreLoopAnalyticsPseudonymizer = (input: CoreLoopAnalyticsPseudonymKey) => {
  const parsed = parseKey(input);
  const derive = (
    prefix: "evt" | "flow" | "ses" | "sub",
    scope: string,
    source: string,
  ): string => {
    if (source.length < 1 || source.length > 512 || !versionPattern.test(scope)) {
      throw new TypeError("The analytics pseudonym input is invalid.");
    }
    const digest = createHmac("sha256", parsed.key)
      .update("rituvia.analytics.pseudonym.v1\0", "utf8")
      .update(parsed.environment, "utf8")
      .update("\0", "utf8")
      .update(parsed.version, "utf8")
      .update("\0", "utf8")
      .update(coreLoopAnalyticsConsentPurpose, "utf8")
      .update("\0", "utf8")
      .update(coreLoopAnalyticsConsentNoticeVersion, "utf8")
      .update("\0", "utf8")
      .update(scope, "utf8")
      .update("\0", "utf8")
      .update(source, "utf8")
      .digest("base64url");
    return `${prefix}_${digest}`;
  };

  return Object.freeze({
    derive,
    equals(left: string, right: string): boolean {
      return sameBytes(Buffer.from(left), Buffer.from(right));
    },
  });
};

export const createWebCoreLoopAnalytics = (input: {
  identity: AnalyticsIdentity;
  key: CoreLoopAnalyticsPseudonymKey;
  resolveReadingId(
    root: Extract<CoreLoopReflectionRoot, { kind: "intention" }>,
    context: AnonymousSessionContext,
  ): Promise<string | null>;
  sink: WebCoreLoopAnalyticsSink;
}): WebCoreLoopAnalytics => {
  const pseudonymizer = createCoreLoopAnalyticsPseudonymizer(input.key);

  return Object.freeze({
    async capture(capture: WebCoreLoopAnalyticsCapture): Promise<boolean> {
      try {
        if (
          capture.anonymousSessionToken === undefined ||
          !uuidV4Pattern.test(capture.semanticReference)
        ) {
          return false;
        }
        const allowed = await input.identity.allowsConsent({
          noticeVersion: coreLoopAnalyticsConsentNoticeVersion,
          purpose: coreLoopAnalyticsConsentPurpose,
          token: capture.anonymousSessionToken,
        });
        if (!allowed) return false;
        const context = await input.identity.resolveSession(capture.anonymousSessionToken);
        if (context === null) return false;
        const readingId =
          capture.reflectionRoot.kind === "reading"
            ? capture.reflectionRoot.readingId
            : await input.resolveReadingId(capture.reflectionRoot, context);
        if (readingId === null || !uuidV4Pattern.test(readingId)) return false;

        const event = parseCoreLoopEvent({
          analyticsSessionKey: pseudonymizer.derive("ses", "session", context.sessionId),
          analyticsSubjectKey: pseudonymizer.derive("sub", "subject", context.subjectId),
          consentNoticeVersion: coreLoopAnalyticsConsentNoticeVersion,
          consentPurpose: coreLoopAnalyticsConsentPurpose,
          eventId: pseudonymizer.derive(
            "evt",
            "semantic-event",
            `${capture.eventName}\0${capture.semanticReference}`,
          ),
          eventName: capture.eventName,
          locale: capture.locale,
          occurredAt: capture.occurredAt,
          properties: capture.properties,
          reflectionSessionKey: pseudonymizer.derive("flow", "reflection-session", readingId),
          schemaVersion: coreLoopEventSchemaVersion,
          source: capture.source,
        });
        await input.sink.write(event);
        return true;
      } catch {
        return false;
      }
    },
  });
};
