import { readFile } from "node:fs/promises";

import type { QuestionIntakeThemeCode, TarotReadingType } from "@rituvia/domain";
import { describe, expect, it } from "vitest";

import * as publicAi from "../src/index.js";
import {
  PreGenerationSafetyError,
  createInterpretationSafetyDecisionV1,
  evaluatePreGenerationSafetyV1,
  isInterpretationGenerationAuthorizationV1,
  isPreGenerationSafetyEvaluationV1,
  preGenerationSafetyClassifierAuthoritySchemaVersion,
  preGenerationSafetyClassifierRequestSchemaVersion,
  preGenerationSafetyClassifierResultSchemaVersion,
  preGenerationSafetyEvaluationSchemaVersion,
  preGenerationSafetyIntakePolicyVersion,
  preGenerationSafetyLimits,
  preGenerationSafetyPolicyAuthoritySchemaVersion,
  preGenerationSafetyPolicyVersion,
  runPreGenerationSafetyGateV1,
  type EvaluatePreGenerationSafetyInputV1,
  type InterpretationGenerationAuthorizationBindingV1,
  type PreGenerationSafetyClassifierRegistrationV1,
  type PreGenerationSafetyContinuationContextV1,
  type PreGenerationSafetyErrorCode,
  type PreGenerationSafetyRiskCategory,
  type PreGenerationSafetyRoute,
} from "../src/index.js";

type IntakeRequest = Readonly<{
  locale: "en";
  question?: string;
  schemaVersion: "1";
  themeCode: QuestionIntakeThemeCode;
}>;

type SafetyFixture = Readonly<{
  adversarialIntake: readonly Readonly<{
    classifierCategories: readonly PreGenerationSafetyRiskCategory[];
    expectedClassifierCalls: 0 | 1;
    expectedRoute: PreGenerationSafetyRoute;
    id: string;
    question: string;
    themeCode: QuestionIntakeThemeCode;
  }>[];
  classifierEscalations: readonly Readonly<{
    categories: readonly PreGenerationSafetyRiskCategory[];
    expectedRoute: PreGenerationSafetyRoute;
    id: string;
    question: string;
    status: "assessed" | "uncertain";
    themeCode: QuestionIntakeThemeCode;
  }>[];
  nonAllowedIntake: readonly Readonly<{
    expectedRoute: Exclude<PreGenerationSafetyRoute, "allowed">;
    id: string;
    question: string;
    themeCode: QuestionIntakeThemeCode;
  }>[];
  notice: string;
  schemaVersion: string;
  themeOnly: readonly Readonly<{
    id: string;
    readingType: TarotReadingType;
    request: IntakeRequest;
  }>[];
}>;

const fixtureUrl = new URL("./fixtures/pre-generation-safety-v1.json", import.meta.url);
const fixture = JSON.parse(await readFile(fixtureUrl, "utf8")) as SafetyFixture;

const asOf = "2026-07-18";
const requestId = "11111111-1111-4111-8111-111111111111";
const alternateRequestId = "22222222-2222-4222-8222-222222222222";
const policyApprovalReference = "test:rit-032:pre-generation-safety-en-v1";
const checksumA = `sha256:${"a".repeat(64)}`;
const checksumB = `sha256:${"b".repeat(64)}`;

const classifierRegistration = Object.freeze({
  classifier: Object.freeze({ id: "test.synthetic-safety-classifier", version: "1.0.0" }),
  policy: Object.freeze({
    approvalReference: "test:rit-032:synthetic-classifier-policy",
    checksum: checksumA,
    id: "test.synthetic-safety-classifier-policy",
    version: "1.0.0",
  }),
}) satisfies PreGenerationSafetyClassifierRegistrationV1;

const safeQuestionRequest = Object.freeze({
  locale: "en" as const,
  question: "What perspective could help me plan my next conversation?",
  schemaVersion: "1" as const,
  themeCode: "relationships" as const,
});

const makeInput = (
  request: IntakeRequest,
  readingType: TarotReadingType = "one_card",
  id: string = requestId,
): EvaluatePreGenerationSafetyInputV1 => ({
  asOf,
  readingType,
  requestId: id,
  requestJson: JSON.stringify(request),
});

const classifierResult = (
  categories: readonly PreGenerationSafetyRiskCategory[] = [],
  status: "assessed" | "uncertain" = "assessed",
): Readonly<Record<string, unknown>> => ({
  categories,
  classifier: classifierRegistration.classifier,
  policy: {
    checksum: classifierRegistration.policy.checksum,
    id: classifierRegistration.policy.id,
    version: classifierRegistration.policy.version,
  },
  schemaVersion: preGenerationSafetyClassifierResultSchemaVersion,
  status,
});

type ClassifierOptions = Readonly<{
  authorizeClassifier?: NonNullable<EvaluatePreGenerationSafetyInputV1["authorizeClassifier"]>;
  classifier?: NonNullable<EvaluatePreGenerationSafetyInputV1["classifier"]>;
  classifierRegistration?: PreGenerationSafetyClassifierRegistrationV1;
  resultJson?: string;
}>;

const withClassifier = (
  input: EvaluatePreGenerationSafetyInputV1,
  categories: readonly PreGenerationSafetyRiskCategory[] = [],
  status: "assessed" | "uncertain" = "assessed",
  options: ClassifierOptions = {},
): EvaluatePreGenerationSafetyInputV1 => ({
  ...input,
  authorizeClassifier: options.authorizeClassifier ?? (() => true),
  classifier:
    options.classifier ??
    (() => options.resultJson ?? JSON.stringify(classifierResult(categories, status))),
  classifierRegistration: options.classifierRegistration ?? classifierRegistration,
});

type PolicyOptions = Readonly<{
  approvalReference?: string;
  authorizePolicy?: NonNullable<EvaluatePreGenerationSafetyInputV1["authorizePolicy"]>;
}>;

const withPolicy = (
  input: EvaluatePreGenerationSafetyInputV1,
  options: PolicyOptions = {},
): EvaluatePreGenerationSafetyInputV1 => ({
  ...input,
  authorizePolicy: options.authorizePolicy ?? (() => true),
  policyApprovalReference: options.approvalReference ?? policyApprovalReference,
});

const expectSafetyError = async (
  action: () => unknown | Promise<unknown>,
  expectedCode: PreGenerationSafetyErrorCode,
): Promise<PreGenerationSafetyError> => {
  let caught: unknown;
  try {
    await action();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(PreGenerationSafetyError);
  if (!(caught instanceof PreGenerationSafetyError)) {
    throw new Error("The expected pre-generation safety error was not thrown.");
  }
  expect(caught.code).toBe(expectedCode);
  return caught;
};

const expectDeepFrozen = (value: unknown): void => {
  if (typeof value !== "object" || value === null) return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) expectDeepFrozen(child);
};

const allowedContext = async (
  input: EvaluatePreGenerationSafetyInputV1,
): Promise<PreGenerationSafetyContinuationContextV1> => {
  const result = await runPreGenerationSafetyGateV1(withPolicy(input), (context) => context);
  expect(result.status).toBe("continued");
  if (result.status !== "continued")
    throw new Error("The synthetic allowed gate did not continue.");
  return result.value;
};

describe("pre-generation safety fixture coverage", () => {
  it("uses only an explicitly synthetic, versioned fixture", () => {
    expect(fixture.schemaVersion).toBe("test.pre-generation-safety-fixtures.v1");
    expect(fixture.notice).toContain("Synthetic test data only");
    expect(fixture.notice).toContain("must never be published");
  });

  it("retains every RIT-021 non-allowed fixture", () => {
    expect(fixture.nonAllowedIntake.map(({ id }) => id).sort()).toEqual(
      [
        "coercive-control",
        "criminal-guilt",
        "death-timing",
        "guaranteed-outcome",
        "immediate-danger",
        "instruction-injection",
        "investment-certainty",
        "legal-outcome",
        "medical-diagnosis",
        "relationship-mind-reading",
        "self-harm",
        "supernatural-persecution",
      ].sort(),
    );
  });
});

describe("pre-generation safety routing", () => {
  it.each(fixture.themeOnly)("allows $id without any external classifier", async (testCase) => {
    const evaluation = await evaluatePreGenerationSafetyV1(
      makeInput(testCase.request, testCase.readingType),
    );

    expect(evaluation).toEqual({
      canContinue: true,
      classifier: null,
      evaluatedAsOf: asOf,
      intakePolicyVersion: preGenerationSafetyIntakePolicyVersion,
      locale: "en",
      modality: "tarot",
      policyVersion: preGenerationSafetyPolicyVersion,
      readingType: testCase.readingType,
      requestId,
      route: "allowed",
      schemaVersion: preGenerationSafetyEvaluationSchemaVersion,
      suggestedQuestionCode: null,
      themeCode: testCase.request.themeCode,
    });
    expect(isPreGenerationSafetyEvaluationV1(evaluation)).toBe(true);
  });

  it.each(fixture.nonAllowedIntake)(
    "keeps RIT-021 fixture $id on its non-allowed route",
    async (testCase) => {
      let classifierCalls = 0;
      const request: IntakeRequest = {
        locale: "en",
        question: testCase.question,
        schemaVersion: "1",
        themeCode: testCase.themeCode,
      };
      const input = withClassifier(makeInput(request), [], "assessed", {
        classifier: () => {
          classifierCalls += 1;
          return JSON.stringify(classifierResult());
        },
      });

      const evaluation = await evaluatePreGenerationSafetyV1(input);

      expect(evaluation.route).toBe(testCase.expectedRoute);
      expect(evaluation.canContinue).toBe(false);
      expect(classifierCalls).toBe(testCase.expectedRoute === "crisis" ? 0 : 1);
      if (testCase.expectedRoute === "crisis") {
        expect(evaluation.suggestedQuestionCode).toBeNull();
      }
    },
  );

  it.each(fixture.adversarialIntake)(
    "handles the synthetic mixed/confusable case $id",
    async (testCase) => {
      let classifierCalls = 0;
      const input = withClassifier(
        makeInput({
          locale: "en",
          question: testCase.question,
          schemaVersion: "1",
          themeCode: testCase.themeCode,
        }),
        testCase.classifierCategories,
        "assessed",
        {
          classifier: () => {
            classifierCalls += 1;
            return JSON.stringify(classifierResult(testCase.classifierCategories));
          },
        },
      );

      const evaluation = await evaluatePreGenerationSafetyV1(input);

      expect(evaluation.route).toBe(testCase.expectedRoute);
      expect(evaluation.canContinue).toBe(testCase.expectedRoute === "allowed");
      expect(classifierCalls).toBe(testCase.expectedClassifierCalls);
      if (testCase.expectedRoute === "crisis") {
        expect(evaluation.suggestedQuestionCode).toBeNull();
      }
    },
  );

  it.each(fixture.classifierEscalations)(
    "applies the fixed route hierarchy for $id",
    async (testCase) => {
      const input = withClassifier(
        makeInput({
          locale: "en",
          question: testCase.question,
          schemaVersion: "1",
          themeCode: testCase.themeCode,
        }),
        testCase.categories,
        testCase.status,
      );

      const evaluation = await evaluatePreGenerationSafetyV1(input);

      expect(evaluation.route).toBe(testCase.expectedRoute);
      expect(evaluation.canContinue).toBe(testCase.expectedRoute === "allowed");
      expect(evaluation.classifier?.status).toBe(testCase.status);
    },
  );

  it("passes exact frozen authority and a bounded transient question to the classifier", async () => {
    let capturedAuthority: unknown;
    let capturedRequest: unknown;
    const input = withClassifier(makeInput(safeQuestionRequest), [], "assessed", {
      authorizeClassifier: (authority) => {
        capturedAuthority = authority;
        return true;
      },
      classifier: (request) => {
        capturedRequest = request;
        return JSON.stringify(classifierResult());
      },
    });

    await expect(evaluatePreGenerationSafetyV1(input)).resolves.toMatchObject({ route: "allowed" });
    expect(capturedAuthority).toEqual({
      asOf,
      classifier: classifierRegistration,
      locale: "en",
      modality: "tarot",
      policyVersion: preGenerationSafetyPolicyVersion,
      schemaVersion: preGenerationSafetyClassifierAuthoritySchemaVersion,
    });
    expect(capturedRequest).toEqual({
      locale: "en",
      modality: "tarot",
      question: safeQuestionRequest.question,
      schemaVersion: preGenerationSafetyClassifierRequestSchemaVersion,
      themeCode: safeQuestionRequest.themeCode,
    });
    expectDeepFrozen(capturedAuthority);
    expectDeepFrozen(capturedRequest);
  });
});

describe("external classifier trust boundary", () => {
  it.each([
    ["returns false", () => false],
    ["throws", () => Promise.reject(new Error("synthetic authority failure"))],
  ] as const)("fails closed when classifier authority $0", async (_label, authorizeClassifier) => {
    const input = withClassifier(makeInput(safeQuestionRequest), [], "assessed", {
      authorizeClassifier,
    });
    await expectSafetyError(
      () => evaluatePreGenerationSafetyV1(input),
      "PRE_GENERATION_SAFETY_CLASSIFIER_NOT_APPROVED",
    );
  });

  it("fails closed when classifier configuration is missing or partial", async () => {
    await expectSafetyError(
      () => evaluatePreGenerationSafetyV1(makeInput(safeQuestionRequest)),
      "PRE_GENERATION_SAFETY_CLASSIFIER_UNAVAILABLE",
    );
    await expectSafetyError(
      () =>
        evaluatePreGenerationSafetyV1({
          ...makeInput(safeQuestionRequest),
          classifier: () => JSON.stringify(classifierResult()),
        }),
      "PRE_GENERATION_SAFETY_INPUT_INVALID",
    );
  });

  it("maps classifier exceptions to a categorical, non-leaking error", async () => {
    const privateCanary = "SYNTHETIC_PRIVATE_CLASSIFIER_ERROR_CANARY";
    const input = withClassifier(makeInput(safeQuestionRequest), [], "assessed", {
      classifier: () => {
        throw new Error(privateCanary);
      },
    });

    const error = await expectSafetyError(
      () => evaluatePreGenerationSafetyV1(input),
      "PRE_GENERATION_SAFETY_CLASSIFIER_UNAVAILABLE",
    );
    expect(String(error)).not.toContain(privateCanary);
    expect(JSON.stringify(error)).not.toContain(privateCanary);
  });

  const validResult = classifierResult(["self_harm", "medical_determination"]);
  const invalidClassifierResults = [
    ["malformed JSON", "{"],
    ["an extra key", JSON.stringify({ ...validResult, extra: true })],
    [
      "an unsupported schema version",
      JSON.stringify({
        ...validResult,
        schemaVersion: "pre-generation-safety-classifier-result.v2",
      }),
    ],
    [
      "a mismatched classifier version",
      JSON.stringify({
        ...validResult,
        classifier: { ...classifierRegistration.classifier, version: "2.0.0" },
      }),
    ],
    [
      "a mismatched policy version",
      JSON.stringify({
        ...validResult,
        policy: {
          checksum: classifierRegistration.policy.checksum,
          id: classifierRegistration.policy.id,
          version: "2.0.0",
        },
      }),
    ],
    [
      "a malformed checksum",
      JSON.stringify({
        ...validResult,
        policy: {
          checksum: "sha256:not-a-digest",
          id: classifierRegistration.policy.id,
          version: classifierRegistration.policy.version,
        },
      }),
    ],
    [
      "a mismatched valid checksum",
      JSON.stringify({
        ...validResult,
        policy: {
          checksum: checksumB,
          id: classifierRegistration.policy.id,
          version: classifierRegistration.policy.version,
        },
      }),
    ],
    ["an unknown category", JSON.stringify({ ...validResult, categories: ["unknown_risk"] })],
    [
      "non-canonical category order",
      JSON.stringify({ ...validResult, categories: ["medical_determination", "self_harm"] }),
    ],
    [
      "duplicate categories",
      JSON.stringify({ ...validResult, categories: ["self_harm", "self_harm"] }),
    ],
    [
      "an oversized UTF-8 result",
      `"${"💠".repeat(preGenerationSafetyLimits.classifierResultJsonMaximumBytes)}"`,
    ],
  ] as const;

  it.each(invalidClassifierResults)(
    "rejects classifier result with $0",
    async (_label, resultJson) => {
      const input = withClassifier(makeInput(safeQuestionRequest), [], "assessed", { resultJson });
      await expectSafetyError(
        () => evaluatePreGenerationSafetyV1(input),
        "PRE_GENERATION_SAFETY_CLASSIFIER_INVALID",
      );
    },
  );

  it("rejects malformed classifier registration versions and checksums before calling it", async () => {
    let classifierCalls = 0;
    const registrations = [
      {
        ...classifierRegistration,
        classifier: { ...classifierRegistration.classifier, version: "latest" },
      },
      {
        ...classifierRegistration,
        policy: { ...classifierRegistration.policy, checksum: "sha256:bad" },
      },
    ] as unknown as readonly PreGenerationSafetyClassifierRegistrationV1[];

    for (const registration of registrations) {
      const input = withClassifier(makeInput(safeQuestionRequest), [], "assessed", {
        classifier: () => {
          classifierCalls += 1;
          return JSON.stringify(classifierResult());
        },
        classifierRegistration: registration,
      });
      await expectSafetyError(
        () => evaluatePreGenerationSafetyV1(input),
        "PRE_GENERATION_SAFETY_INPUT_INVALID",
      );
    }
    expect(classifierCalls).toBe(0);
  });
});

describe("allowed-only continuation and policy authority", () => {
  it("never invokes policy authority or continuation for non-allowed routes", async () => {
    let policyAuthorityCalls = 0;
    let continuationCalls = 0;

    for (const testCase of fixture.nonAllowedIntake) {
      const input = {
        ...withClassifier(
          makeInput({
            locale: "en",
            question: testCase.question,
            schemaVersion: "1",
            themeCode: testCase.themeCode,
          }),
        ),
        authorizePolicy: () => {
          policyAuthorityCalls += 1;
          return true;
        },
        policyApprovalReference: " malformed approval reference ",
      } satisfies EvaluatePreGenerationSafetyInputV1;

      const result = await runPreGenerationSafetyGateV1(input, () => {
        continuationCalls += 1;
        return "must-not-run";
      });
      expect(result.status).toBe("stopped");
      expect(result.evaluation.route).toBe(testCase.expectedRoute);
    }

    expect(policyAuthorityCalls).toBe(0);
    expect(continuationCalls).toBe(0);
  });

  it("rejects missing, false, throwing, non-boolean, and malformed policy approval before continuation", async () => {
    const allowed = makeInput(fixture.themeOnly[0]?.request ?? safeQuestionRequest);
    const attempts = [
      allowed,
      withPolicy(allowed, { authorizePolicy: () => false }),
      withPolicy(allowed, {
        authorizePolicy: () => Promise.reject(new Error("synthetic policy authority failure")),
      }),
      withPolicy(allowed, { authorizePolicy: () => "true" as unknown as boolean }),
      withPolicy(allowed, { approvalReference: " malformed approval reference " }),
    ];
    let continuationCalls = 0;

    for (const input of attempts) {
      await expectSafetyError(
        () =>
          runPreGenerationSafetyGateV1(input, () => {
            continuationCalls += 1;
            return "must-not-run";
          }),
        "PRE_GENERATION_SAFETY_POLICY_NOT_APPROVED",
      );
    }
    expect(continuationCalls).toBe(0);
  });

  it("invokes the allowed continuation exactly once after exact policy authority", async () => {
    let capturedAuthority: unknown;
    let continuationCalls = 0;
    const allowed = withPolicy(makeInput(fixture.themeOnly[1]?.request ?? safeQuestionRequest), {
      authorizePolicy: (authority) => {
        capturedAuthority = authority;
        return true;
      },
    });

    const result = await runPreGenerationSafetyGateV1(allowed, (context) => {
      continuationCalls += 1;
      expect(context.policyApprovalReference).toBe(policyApprovalReference);
      return "continued-once";
    });

    expect(result).toMatchObject({ status: "continued", value: "continued-once" });
    expect(continuationCalls).toBe(1);
    expect(capturedAuthority).toEqual({
      approvalReference: policyApprovalReference,
      asOf,
      intakePolicyVersion: preGenerationSafetyIntakePolicyVersion,
      locale: "en",
      modality: "tarot",
      policyVersion: preGenerationSafetyPolicyVersion,
      schemaVersion: preGenerationSafetyPolicyAuthoritySchemaVersion,
    });
    expectDeepFrozen(capturedAuthority);
  });

  it("never invokes continuation for malformed JSON or invalid Unicode", async () => {
    let classifierCalls = 0;
    let continuationCalls = 0;
    const invalidInputs = [
      { ...withPolicy(makeInput(safeQuestionRequest)), requestJson: "{" },
      withPolicy(
        withClassifier(
          makeInput({
            locale: "en",
            question: "What can I reflect on about sui\ud800cide?",
            schemaVersion: "1",
            themeCode: "self",
          }),
          [],
          "assessed",
          {
            classifier: () => {
              classifierCalls += 1;
              return JSON.stringify(classifierResult());
            },
          },
        ),
      ),
    ];
    for (const invalid of invalidInputs) {
      await expectSafetyError(
        () =>
          runPreGenerationSafetyGateV1(invalid, () => {
            continuationCalls += 1;
            return "must-not-run";
          }),
        "PRE_GENERATION_SAFETY_INPUT_INVALID",
      );
    }
    expect(classifierCalls).toBe(0);
    expect(continuationCalls).toBe(0);
  });
});

describe("generation authorization binding and privacy", () => {
  it("does not expose either generic authorization issuer through the package root", () => {
    expect(Object.hasOwn(publicAi, "issueInterpretationGenerationAuthorizationV1")).toBe(false);
    expect(Object.hasOwn(publicAi, "issuePreGenerationSafetyAuthorizationV1")).toBe(false);
  });

  it("binds authorization exactly and rejects clones, JSON copies, forgeries, and reuse", async () => {
    const context = await allowedContext(
      makeInput(fixture.themeOnly[0]?.request ?? safeQuestionRequest),
    );
    const expectedBinding: InterpretationGenerationAuthorizationBindingV1 = {
      intakePolicyVersion: preGenerationSafetyIntakePolicyVersion,
      locale: "en",
      modality: "tarot",
      policyApprovalReference,
      readingType: "one_card",
      requestId,
      safetyPolicyVersion: preGenerationSafetyPolicyVersion,
      themeCode: fixture.themeOnly[0]?.request.themeCode ?? "self",
    };

    expect(isInterpretationGenerationAuthorizationV1(context.authorization)).toBe(true);
    expect(isInterpretationGenerationAuthorizationV1(context.authorization, expectedBinding)).toBe(
      true,
    );

    const mismatchedBindings = [
      { ...expectedBinding, requestId: alternateRequestId },
      { ...expectedBinding, readingType: "three_card" as const },
      { ...expectedBinding, locale: "en-US" },
      { ...expectedBinding, themeCode: "gratitude" as const },
      { ...expectedBinding, intakePolicyVersion: "question-intake.en.v2" },
      { ...expectedBinding, policyApprovalReference: "test:rit-032:different-approval" },
      { ...expectedBinding, safetyPolicyVersion: "pre-generation-safety.en.v2" },
    ] satisfies readonly InterpretationGenerationAuthorizationBindingV1[];
    for (const binding of mismatchedBindings) {
      expect(isInterpretationGenerationAuthorizationV1(context.authorization, binding)).toBe(false);
    }

    expect(isInterpretationGenerationAuthorizationV1({ ...context.authorization })).toBe(false);
    expect(
      isInterpretationGenerationAuthorizationV1(JSON.parse(JSON.stringify(context.authorization))),
    ).toBe(false);
    expect(
      isInterpretationGenerationAuthorizationV1({
        binding: expectedBinding,
        policyVersion: preGenerationSafetyPolicyVersion,
        route: "allowed",
        schemaVersion: "interpretation-safety-decision.v1",
      }),
    ).toBe(false);
  });

  it("rejects cloned or forged safety evaluations before decision issuance", async () => {
    const evaluation = await evaluatePreGenerationSafetyV1(
      makeInput(fixture.themeOnly[0]?.request ?? safeQuestionRequest),
    );
    const clones = [
      { ...evaluation },
      JSON.parse(JSON.stringify(evaluation)),
      {
        ...evaluation,
        route: "allowed",
      },
    ];

    for (const clone of clones) {
      expect(isPreGenerationSafetyEvaluationV1(clone)).toBe(false);
      await expectSafetyError(
        () => createInterpretationSafetyDecisionV1(clone as typeof evaluation),
        "PRE_GENERATION_SAFETY_AUTHORIZATION_DENIED",
      );
    }
  });

  it("keeps the raw-question canary out of evaluation, decision, authorization, context, and errors", async () => {
    const privateCanary = "SYNTHETIC_PRIVATE_QUESTION_CANARY_7F8C1A";
    let capturedClassifierRequest: unknown;
    const input = withClassifier(
      makeInput({
        locale: "en",
        question: `What perspective could help me reflect on ${privateCanary}?`,
        schemaVersion: "1",
        themeCode: "self",
      }),
      [],
      "assessed",
      {
        classifier: (request) => {
          capturedClassifierRequest = request;
          return JSON.stringify(classifierResult());
        },
      },
    );
    const context = await allowedContext(input);
    const artifacts = [context.evaluation, context.decision, context.authorization, context];

    expect(capturedClassifierRequest).toMatchObject({
      question: `What perspective could help me reflect on ${privateCanary}?`,
    });
    for (const artifact of artifacts) expect(JSON.stringify(artifact)).not.toContain(privateCanary);

    const error = await expectSafetyError(
      () =>
        evaluatePreGenerationSafetyV1(
          withClassifier(input, [], "assessed", {
            classifier: () => {
              throw new Error(privateCanary);
            },
          }),
        ),
      "PRE_GENERATION_SAFETY_CLASSIFIER_UNAVAILABLE",
    );
    expect(String(error)).not.toContain(privateCanary);
    expect(JSON.stringify(error)).not.toContain(privateCanary);
  });

  it("returns deterministic, recursively frozen evaluations and continuation artifacts", async () => {
    let classifierAuthority: unknown;
    let classifierRequest: unknown;
    const input = withClassifier(makeInput(safeQuestionRequest), [], "assessed", {
      authorizeClassifier: (authority) => {
        classifierAuthority = authority;
        return true;
      },
      classifier: (request) => {
        classifierRequest = request;
        return JSON.stringify(classifierResult());
      },
    });
    const first = await evaluatePreGenerationSafetyV1(input);
    const second = await evaluatePreGenerationSafetyV1(input);

    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expectDeepFrozen(first);
    expectDeepFrozen(second);
    expectDeepFrozen(classifierAuthority);
    expectDeepFrozen(classifierRequest);

    const context = await allowedContext(
      makeInput(fixture.themeOnly[0]?.request ?? safeQuestionRequest),
    );
    expectDeepFrozen(context);
    expectDeepFrozen(context.authorization);
    expectDeepFrozen(context.authorization.binding);
    expectDeepFrozen(context.decision);
  });
});
