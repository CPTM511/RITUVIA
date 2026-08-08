import "server-only";

import { createHash, randomUUID } from "node:crypto";

import { getVercelOidcToken, verifyVercelOidcToken } from "@vercel/oidc";

import {
  createVercelAiGatewayOpenAiStructuredGenerationProviderV1,
  parseTarotInterpretationInputJsonV1,
  parseTarotInterpretationOutputForInputV1,
  runPreGenerationSafetyGateV1,
  structuredGenerationRequestSchemaVersion,
  type JsonValue,
  type StructuredGenerationProviderV1,
  type TarotInterpretationOutputV1,
} from "@rituvia/ai";
import {
  createRecoveryItem11AiCreditPersistence,
  RecoveryItem11AiCreditPersistenceError,
  type RecoveryItem11AiCreditPersistence,
} from "@rituvia/db";
import type { CatalogVersionV1 } from "@rituvia/payments";

import { getWebRuntimeConfiguration } from "../config/server";
import { loadWebAccountIdentityService } from "./account-auth";
import { loadWebAiGenerationDatabase } from "./ai-generation-database";
import { loadWebProductCatalogApplicationService } from "./product-catalog";
import { createVercelAiGatewayOpenAiTransport } from "./vercel-ai-gateway-openai-transport";

const recoveryScope = "D-098:OWNER:item-11:protected-staging" as const;
const vercelProjectId = "prj_UzHHiLzjdPcf8DsJuCHYiDBVWs63";
const vercelOwnerId = "team_f6TQU7mloG5OnQGNmtXwFkOi";
const modelVersion = "2026.3.17";
const promptVersion = "1.0.0";
const outputSchemaVersion = "1.0.0";
const providerVersion = "1.0.0";
const idempotencyKeyPattern =
  /^(?:[A-Za-z0-9_-]{22,128}|[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/u;

const approvedContent = Object.freeze({
  contentId: "recovery.item11.tarot.lantern",
  meaning:
    "The Lantern is a synthetic protected-staging symbol for focused attention and one observable detail.",
  sourceRef: "content:recovery-item11:lantern:1",
  tradition: "secular-reflection",
  version: "1.0.0",
});

const systemPrompt = [
  "RITUVIA protected-staging synthetic reflection only.",
  "Explain only the supplied deterministic Lantern fact and approved content.",
  "Use tentative language such as may, might, can, or could.",
  "Never predict, guarantee, diagnose, advise professionally, intensify fear, or claim hidden knowledge.",
  "Return only JSON matching the strict schema. Do not add a ritual suggestion.",
].join(" ");

const outputSchema = Object.freeze({
  additionalProperties: false,
  properties: {
    boundaryNote: { maxLength: 800, minLength: 1, type: "string" },
    perspectives: {
      items: { maxLength: 800, minLength: 1, type: "string" },
      maxItems: 3,
      minItems: 1,
      type: "array",
      uniqueItems: true,
    },
    reflectionQuestions: {
      items: { maxLength: 500, minLength: 1, type: "string" },
      maxItems: 2,
      minItems: 1,
      type: "array",
      uniqueItems: true,
    },
    safety: {
      additionalProperties: false,
      properties: {
        certaintyLevel: { const: "reflective" },
        containsGuaranteedOutcome: { const: false },
        containsProfessionalAdvice: { const: false },
      },
      required: ["certaintyLevel", "containsGuaranteedOutcome", "containsProfessionalAdvice"],
      type: "object",
    },
    schemaVersion: { const: "1" },
    smallAction: {
      additionalProperties: false,
      properties: {
        label: { maxLength: 240, minLength: 1, type: "string" },
        rationale: { maxLength: 600, minLength: 1, type: "string" },
        timeHorizon: { enum: ["open", "this_week", "today"] },
      },
      required: ["label", "rationale", "timeHorizon"],
      type: "object",
    },
    sourceRefs: {
      items: { const: approvedContent.sourceRef },
      maxItems: 1,
      minItems: 1,
      type: "array",
    },
    summary: { maxLength: 1_200, minLength: 1, type: "string" },
    symbols: {
      items: {
        additionalProperties: false,
        properties: {
          factRef: { const: "tarot.position.perspective" },
          meaning: { maxLength: 800, minLength: 1, type: "string" },
          possibility: { maxLength: 800, minLength: 1, type: "string" },
        },
        required: ["factRef", "meaning", "possibility"],
        type: "object",
      },
      maxItems: 1,
      minItems: 1,
      type: "array",
    },
    title: { maxLength: 120, minLength: 1, type: "string" },
  },
  required: [
    "boundaryNote",
    "perspectives",
    "reflectionQuestions",
    "safety",
    "schemaVersion",
    "smallAction",
    "sourceRefs",
    "summary",
    "symbols",
    "title",
  ],
  type: "object",
}) satisfies JsonValue;

const fallbackOutput = Object.freeze({
  boundaryNote: "This is a symbolic reflection, not a prediction or professional instruction.",
  perspectives: Object.freeze([
    "The Lantern may invite attention to one detail that is already observable.",
  ]),
  reflectionQuestions: Object.freeze(["What is one detail you can notice without judging it?"]),
  safety: Object.freeze({
    certaintyLevel: "reflective" as const,
    containsGuaranteedOutcome: false as const,
    containsProfessionalAdvice: false as const,
  }),
  schemaVersion: "1" as const,
  smallAction: Object.freeze({
    label: "Write down one observation.",
    rationale: "A concrete observation can support a small, reversible next step.",
    timeHorizon: "today" as const,
  }),
  sourceRefs: Object.freeze([approvedContent.sourceRef]),
  summary: "The Lantern offers a bounded lens on focused attention.",
  symbols: Object.freeze([
    Object.freeze({
      factRef: "tarot.position.perspective",
      meaning: "The Lantern may represent focused attention.",
      possibility: "One visible detail could support a useful next step.",
    }),
  ]),
  title: "A bounded lens on attention",
}) satisfies TarotInterpretationOutputV1;

export const recoveryItem11AiErrorCodes = Object.freeze([
  "conflict",
  "daily_limit",
  "input_invalid",
  "insufficient_credits",
  "not_eligible",
  "session_required",
  "unavailable",
] as const);
export type RecoveryItem11AiErrorCode = (typeof recoveryItem11AiErrorCodes)[number];

export class RecoveryItem11AiError extends Error {
  readonly code: RecoveryItem11AiErrorCode;

  constructor(code: RecoveryItem11AiErrorCode) {
    super("The protected-staging AI interpretation is unavailable.");
    this.name = "RecoveryItem11AiError";
    this.code = code;
  }
}

type AccountGateway = Readonly<{
  getProfile(token: string): Promise<
    Readonly<{
      ageAttested: boolean;
      emailVerified: boolean;
      id: string;
      status: "active";
    }>
  >;
  resolveSession(token: string): Promise<Readonly<{ userId: string }> | null>;
}>;

export type RecoveryItem11AiDependencies = Readonly<{
  accounts: AccountGateway;
  catalog: Readonly<{ readActive(): Promise<CatalogVersionV1> }>;
  clock(): string;
  createProvider(oidcToken: string): StructuredGenerationProviderV1;
  credits: RecoveryItem11AiCreditPersistence;
  dailyUserLimit: 3;
  getVerifiedOidcToken(): Promise<string>;
  maxCostMicros: 25_000;
  maxOutputTokens: 384;
  model: "openai/gpt-5.4-nano";
  randomUuid(): string;
  recoveryScope: typeof recoveryScope;
  timeoutMs: 8_000;
}>;

export type RecoveryItem11AiResult = Readonly<{
  creditConsumed: boolean;
  kind: "fallback" | "generated";
  output: TarotInterpretationOutputV1;
  reason: "provider_failure" | "safety_block" | null;
  usage: Readonly<{
    estimatedCostMicros: number;
    inputTokens: number;
    outputTokens: number;
  }> | null;
}>;

const sha256Bytes = (value: string): Uint8Array<ArrayBuffer> =>
  new Uint8Array(createHash("sha256").update(value, "utf8").digest());
const sha256Reference = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;

const exactEmptyRequest = (value: unknown): void => {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.keys(value).length !== 0
  ) {
    throw new RecoveryItem11AiError("input_invalid");
  }
};

const requireIdempotencyKey = (value: unknown): string => {
  if (typeof value !== "string" || !idempotencyKeyPattern.test(value)) {
    throw new RecoveryItem11AiError("input_invalid");
  }
  return value;
};

const requireInstant = (value: string): string => {
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== value) {
    throw new RecoveryItem11AiError("unavailable");
  }
  return value;
};

const syntheticInput = (requestId: string) =>
  parseTarotInterpretationInputJsonV1(
    JSON.stringify({
      approvedContent: [
        {
          checksum: sha256Reference(approvedContent.meaning),
          contentId: approvedContent.contentId,
          locale: "en",
          sourceRef: approvedContent.sourceRef,
          tradition: approvedContent.tradition,
          version: approvedContent.version,
        },
      ],
      approvedRitualTemplateCodes: [],
      deterministicFacts: {
        algorithmVersion: "partial-fisher-yates-rejection-uint8.v1",
        catalog: { id: "recovery.item11.catalog", version: "1.0.0" },
        deck: { id: "recovery.item11.synthetic-deck", version: "1.0.0" },
        engineName: "rituvia.tarot-draw",
        engineVersion: "1.0.0",
        method: "tarot",
        orientationPolicy: "upright_and_reversed",
        positions: [
          {
            cardId: "lantern",
            order: 1,
            orientation: "upright",
            positionId: "perspective",
          },
        ],
        replacementPolicy: "without_replacement",
        rulesVersion: "tarot-draw-rules.v1",
        schemaVersion: "tarot-draw-facts.v1",
        spread: { id: "one-card-perspective", version: "1.0.0" },
      },
      locale: "en",
      modality: "tarot",
      prompt: {
        checksum: sha256Reference(systemPrompt),
        id: "recovery.item11.synthetic-tarot",
        version: promptVersion,
      },
      readingType: "one_card",
      requestId,
      safetyDecision: {
        policyVersion: "pre-generation-safety.en.v1",
        route: "allowed",
        schemaVersion: "interpretation-safety-decision.v1",
      },
      schemaVersion: "tarot-interpretation-input.v1",
      themeCode: "open_reflection",
      tone: "grounded",
    }),
  );

const userPrompt = (requestId: string): string =>
  JSON.stringify({
    approvedContent: approvedContent.meaning,
    deterministicFact: {
      cardId: "lantern",
      orientation: "upright",
      positionId: "perspective",
    },
    requestId,
    sourceRef: approvedContent.sourceRef,
    synthetic: true,
    themeCode: "open_reflection",
  });

const forbiddenOutputPattern =
  /\b(?:curse|diagnos(?:e|is)|financial advice|guarantee(?:d|s)?|hidden truth|legal advice|medical advice|must happen|only I can|psychic certainty|will definitely)\b/iu;
const tentativeLanguagePattern = /\b(?:can|could|invite|may|might|offer)\w*\b/iu;

const passesPostGenerationSafety = (output: TarotInterpretationOutputV1): boolean => {
  const serialized = JSON.stringify(output);
  return (
    !forbiddenOutputPattern.test(serialized) &&
    /\bsymbolic\b/iu.test(output.boundaryNote) &&
    /\bnot\b/iu.test(output.boundaryNote) &&
    output.symbols.every(
      ({ meaning, possibility }) =>
        tentativeLanguagePattern.test(meaning) && tentativeLanguagePattern.test(possibility),
    )
  );
};

const mapCreditError = (error: unknown): never => {
  if (error instanceof RecoveryItem11AiError) throw error;
  if (error instanceof RecoveryItem11AiCreditPersistenceError) {
    if (error.code === "conflict") throw new RecoveryItem11AiError("conflict");
    if (error.code === "insufficient_credits") {
      throw new RecoveryItem11AiError("insufficient_credits");
    }
  }
  throw new RecoveryItem11AiError("unavailable");
};

export const createRecoveryItem11AiApplicationService = (
  dependencies: RecoveryItem11AiDependencies,
) => {
  if (
    dependencies.recoveryScope !== recoveryScope ||
    dependencies.dailyUserLimit !== 3 ||
    dependencies.maxCostMicros !== 25_000 ||
    dependencies.maxOutputTokens !== 384 ||
    dependencies.model !== "openai/gpt-5.4-nano" ||
    dependencies.timeoutMs !== 8_000
  ) {
    throw new RecoveryItem11AiError("unavailable");
  }
  return Object.freeze({
    async generate(input: {
      idempotencyKey: unknown;
      request: unknown;
      sessionToken: string | undefined;
    }): Promise<RecoveryItem11AiResult> {
      exactEmptyRequest(input.request);
      const idempotencyKey = requireIdempotencyKey(input.idempotencyKey);
      if (input.sessionToken === undefined) throw new RecoveryItem11AiError("session_required");
      const now = requireInstant(dependencies.clock());
      let userId: string;
      let productVersion: string;
      let catalogVersion: string;
      try {
        const session = await dependencies.accounts.resolveSession(input.sessionToken);
        if (session === null) throw new RecoveryItem11AiError("session_required");
        const [profile, catalog, consumedToday] = await Promise.all([
          dependencies.accounts.getProfile(input.sessionToken),
          dependencies.catalog.readActive(),
          dependencies.credits.countConsumedToday({
            asOf: now,
            recoveryScope,
            userId: session.userId,
          }),
        ]);
        const product = catalog.products.find(
          (candidate) =>
            candidate.code === "deep_one" &&
            candidate.status === "active" &&
            candidate.kind === "deep_reading" &&
            candidate.creditsCost === 1 &&
            candidate.creditsGranted === null &&
            candidate.creditsPerMonth === null &&
            candidate.subscriptionInterval === null,
        );
        if (
          session.userId !== profile.id ||
          profile.status !== "active" ||
          !profile.emailVerified ||
          !profile.ageAttested ||
          !catalog.version.startsWith("recovery.item11.") ||
          product === undefined
        ) {
          throw new RecoveryItem11AiError("not_eligible");
        }
        if (consumedToday >= dependencies.dailyUserLimit) {
          throw new RecoveryItem11AiError("daily_limit");
        }
        userId = session.userId;
        productVersion = product.version;
        catalogVersion = catalog.version;
      } catch (error) {
        return mapCreditError(error);
      }

      const requestId = dependencies.randomUuid();
      const interpretationInput = syntheticInput(requestId);
      const canonicalRequest = JSON.stringify({
        catalogVersion,
        model: dependencies.model,
        outputSchemaChecksum: sha256Reference(JSON.stringify(outputSchema)),
        productCode: "deep_one",
        productVersion,
        promptChecksum: sha256Reference(systemPrompt),
        recoveryScope,
        schemaVersion: "recovery-item11-ai-request.v1",
      });
      let reservation: Awaited<ReturnType<RecoveryItem11AiCreditPersistence["reserve"]>>;
      try {
        reservation = await dependencies.credits.reserve({
          asOf: now,
          canonicalRequestHash: sha256Bytes(canonicalRequest),
          catalogVersion,
          expiresAt: new Date(Date.parse(now) + 10 * 60 * 1_000).toISOString(),
          idempotencyKeyHash: sha256Bytes(idempotencyKey),
          productCode: "deep_one",
          productVersion,
          recoveryScope,
          userId,
        });
      } catch (error) {
        return mapCreditError(error);
      }
      if (reservation.kind !== "created" || reservation.status !== "active") {
        throw new RecoveryItem11AiError("conflict");
      }

      const releaseAndFallback = async (
        reason: "provider_failure" | "safety_block",
      ): Promise<RecoveryItem11AiResult> => {
        try {
          await dependencies.credits.release({
            asOf: requireInstant(dependencies.clock()),
            recoveryScope,
            reservationId: reservation.reservationId,
            userId,
          });
        } catch (error) {
          return mapCreditError(error);
        }
        return Object.freeze({
          creditConsumed: false,
          kind: "fallback" as const,
          output: fallbackOutput,
          reason,
          usage: null,
        });
      };

      try {
        const gate = await runPreGenerationSafetyGateV1(
          {
            asOf: now.slice(0, 10),
            authorizePolicy: (authority) =>
              authority.approvalReference === "D-098:OWNER:item-11:synthetic-safety" &&
              authority.policyVersion === "pre-generation-safety.en.v1",
            policyApprovalReference: "D-098:OWNER:item-11:synthetic-safety",
            readingType: "one_card",
            requestId,
            requestJson: JSON.stringify({
              locale: "en",
              schemaVersion: "1",
              themeCode: "open_reflection",
            }),
          },
          async ({ authorization }) => {
            const oidcToken = await dependencies.getVerifiedOidcToken();
            return dependencies.createProvider(oidcToken).generateStructured(
              {
                authorization,
                maxOutputTokens: dependencies.maxOutputTokens,
                messages: Object.freeze([
                  Object.freeze({ content: systemPrompt, role: "system" as const }),
                  Object.freeze({ content: userPrompt(requestId), role: "user" as const }),
                ]),
                model: Object.freeze({ id: dependencies.model, version: modelVersion }),
                outputSchema: Object.freeze({
                  checksum: sha256Reference(JSON.stringify(outputSchema)),
                  id: "recovery.item11.tarot-output",
                  version: outputSchemaVersion,
                }),
                prompt: interpretationInput.prompt,
                requestId,
                schemaVersion: structuredGenerationRequestSchemaVersion,
                timeoutMs: dependencies.timeoutMs,
              },
              Object.freeze({
                attempt: 1 as const,
                attemptId: dependencies.randomUuid(),
                cancellation: Object.freeze({
                  aborted: false,
                  subscribe: () => () => undefined,
                }),
              }),
            );
          },
        );
        if (gate.status !== "continued" || gate.value.status !== "succeeded") {
          return releaseAndFallback("provider_failure");
        }
        if (
          gate.value.finishReason !== "stop" ||
          gate.value.usage.estimatedCost === undefined ||
          gate.value.usage.estimatedCost.currencyCode !== "USD" ||
          gate.value.usage.estimatedCost.amountMicros > dependencies.maxCostMicros
        ) {
          return releaseAndFallback("provider_failure");
        }
        let output: TarotInterpretationOutputV1;
        try {
          output = parseTarotInterpretationOutputForInputV1(
            interpretationInput,
            gate.value.outputJson,
          );
        } catch {
          return releaseAndFallback("safety_block");
        }
        if (!passesPostGenerationSafety(output)) {
          return releaseAndFallback("safety_block");
        }
        try {
          await dependencies.credits.consume({
            asOf: requireInstant(dependencies.clock()),
            generationId: requestId,
            recoveryScope,
            reservationId: reservation.reservationId,
            userId,
          });
        } catch (error) {
          try {
            await dependencies.credits.release({
              asOf: requireInstant(dependencies.clock()),
              recoveryScope,
              reservationId: reservation.reservationId,
              userId,
            });
          } catch {
            return mapCreditError(error);
          }
          return mapCreditError(error);
        }
        return Object.freeze({
          creditConsumed: true,
          kind: "generated" as const,
          output,
          reason: null,
          usage: Object.freeze({
            estimatedCostMicros: gate.value.usage.estimatedCost.amountMicros,
            inputTokens: gate.value.usage.inputTokens,
            outputTokens: gate.value.usage.outputTokens,
          }),
        });
      } catch (error) {
        if (error instanceof RecoveryItem11AiError) throw error;
        return releaseAndFallback("provider_failure");
      }
    },
  });
};

export type RecoveryItem11AiApplicationService = ReturnType<
  typeof createRecoveryItem11AiApplicationService
>;

let service: RecoveryItem11AiApplicationService | undefined;

export const loadWebRecoveryItem11AiApplicationService = (): RecoveryItem11AiApplicationService => {
  if (service !== undefined) return service;
  const configuration = getWebRuntimeConfiguration();
  if (
    configuration.deploymentEnvironment !== "staging" ||
    configuration.recoveryItem11Sandbox === undefined
  ) {
    throw new RecoveryItem11AiError("unavailable");
  }
  const ai = configuration.recoveryItem11Sandbox.ai;
  const accounts = loadWebAccountIdentityService();
  service = createRecoveryItem11AiApplicationService({
    accounts: {
      getProfile: (token) => accounts.getProfile(token),
      resolveSession: (token) => accounts.resolveSession(token),
    },
    catalog: loadWebProductCatalogApplicationService(),
    clock: () => new Date().toISOString(),
    createProvider: (oidcToken) =>
      createVercelAiGatewayOpenAiStructuredGenerationProviderV1({
        executeRequest: createVercelAiGatewayOpenAiTransport({ bearerToken: oidcToken }),
        maximumEstimatedCostMicros: ai.maxCostMicros,
        provider: Object.freeze({ id: "vercel.ai-gateway", version: providerVersion }),
        resolveEstimatedCost: ({ usage }) => ({
          amountMicros: Math.ceil((usage.inputTokens * 20 + usage.outputTokens * 125) / 100),
          currencyCode: "USD",
        }),
        resolveModelId: () => ai.model,
        resolveOutputSchema: (reference) =>
          reference.id === "recovery.item11.tarot-output" &&
          reference.version === outputSchemaVersion &&
          reference.checksum === sha256Reference(JSON.stringify(outputSchema))
            ? outputSchema
            : null,
      }),
    credits: createRecoveryItem11AiCreditPersistence(loadWebAiGenerationDatabase()),
    dailyUserLimit: ai.dailyUserLimit,
    getVerifiedOidcToken: async () => {
      const token = await getVercelOidcToken({
        expirationBufferMs: 60_000,
        project: vercelProjectId,
        team: vercelOwnerId,
      });
      await verifyVercelOidcToken(token, {
        environment: "staging",
        ownerId: vercelOwnerId,
        projectId: vercelProjectId,
      });
      return token;
    },
    maxCostMicros: ai.maxCostMicros,
    maxOutputTokens: ai.maxOutputTokens,
    model: ai.model,
    randomUuid: randomUUID,
    recoveryScope,
    timeoutMs: ai.timeoutMs,
  });
  return service;
};
