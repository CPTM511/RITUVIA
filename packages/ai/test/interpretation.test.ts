import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  InterpretationContractError,
  interpretationContractLimits,
  interpretationTimeHorizons,
  interpretationTones,
  preGenerationSafetyPolicyVersion,
  parseTarotInterpretationInputJsonV1,
  parseTarotInterpretationOutputForInputV1,
  tarotInterpretationFactRefsV1,
  type InterpretationContractErrorCode,
  type TarotInterpretationInputV1,
  type TarotInterpretationOutputV1,
} from "../src/index.js";

type FixtureCase = Readonly<{
  input: unknown;
  name: string;
  output: unknown;
}>;

const fixture = JSON.parse(
  await readFile(new URL("./fixtures/tarot-interpretation-v1.json", import.meta.url), "utf8"),
) as Readonly<{ cases: readonly FixtureCase[] }>;

const clone = <Value>(value: Value): Value => JSON.parse(JSON.stringify(value)) as Value;

const parseInput = (value: unknown): TarotInterpretationInputV1 =>
  parseTarotInterpretationInputJsonV1(JSON.stringify(value));

const parseOutputJson = (input: unknown, value: string): TarotInterpretationOutputV1 =>
  parseTarotInterpretationOutputForInputV1(parseInput(input), value);

const expectDeepFrozen = (value: unknown): void => {
  if (typeof value !== "object" || value === null) return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) expectDeepFrozen(child);
};

const expectContractError = (
  operation: () => unknown,
  code: InterpretationContractErrorCode,
): void => {
  try {
    operation();
    expect.unreachable("The invalid interpretation contract must fail.");
  } catch (error) {
    expect(error).toBeInstanceOf(InterpretationContractError);
    expect((error as InterpretationContractError).code).toBe(code);
    expect((error as Error).message).not.toMatch(
      /private-canary|question|journal|birth|email|session|token/iu,
    );
  }
};

const firstCase = (): FixtureCase => {
  const candidate = fixture.cases.at(0);
  if (candidate === undefined) throw new Error("The one-card fixture is unavailable.");
  return candidate;
};

const secondCase = (): FixtureCase => {
  const candidate = fixture.cases.at(1);
  if (candidate === undefined) throw new Error("The three-card fixture is unavailable.");
  return candidate;
};

describe("tarot interpretation contracts v1", () => {
  it.each(fixture.cases)("parses and freezes the synthetic $name fixture", ({ input, output }) => {
    const inputBefore = JSON.stringify(input);
    const outputBefore = JSON.stringify(output);

    const parsedInput = parseInput(input);
    const parsedOutput = parseTarotInterpretationOutputForInputV1(
      parsedInput,
      JSON.stringify(output),
    );

    expect(JSON.stringify(input)).toBe(inputBefore);
    expect(JSON.stringify(output)).toBe(outputBefore);
    expect(parsedInput.modality).toBe("tarot");
    expect(parsedOutput.safety).toEqual({
      certaintyLevel: "reflective",
      containsGuaranteedOutcome: false,
      containsProfessionalAdvice: false,
    });
    expect(parsedOutput.symbols.map(({ factRef }) => factRef)).toEqual(
      tarotInterpretationFactRefsV1(parsedInput),
    );
    expect(new Set(parsedInput.approvedContent.map(({ sourceRef }) => sourceRef))).toEqual(
      new Set(parsedOutput.sourceRefs),
    );
    expectDeepFrozen(parsedInput);
    expectDeepFrozen(parsedOutput);
  });

  it("supports every bounded tone and time horizon without adding another modality", () => {
    const { input, output } = firstCase();
    for (const tone of interpretationTones) {
      expect(
        parseInput({
          ...(clone(input) as Record<string, unknown>),
          tone,
        }).tone,
      ).toBe(tone);
    }
    for (const timeHorizon of interpretationTimeHorizons) {
      const candidate = clone(output) as Record<string, unknown>;
      const smallAction = candidate.smallAction as Record<string, unknown>;
      candidate.smallAction = { ...smallAction, timeHorizon };
      expect(parseOutputJson(input, JSON.stringify(candidate)).smallAction).toEqual(
        expect.objectContaining({ timeHorizon }),
      );
    }
  });

  it("rejects private or server-internal input shapes and every non-allowed route", () => {
    const { input } = firstCase();
    const valid = clone(input) as Record<string, unknown>;
    const facts = valid.deterministicFacts;

    for (const privateField of [
      "question",
      "journal",
      "birthData",
      "email",
      "readingId",
      "sessionId",
      "payment",
      "idempotencyKeyDigest",
    ]) {
      expectContractError(
        () => parseInput({ ...valid, [privateField]: "private-canary" }),
        "INTERPRETATION_INPUT_INVALID",
      );
    }

    expectContractError(
      () =>
        parseInput({
          ...valid,
          deterministicFacts: {
            audit: {
              entropy: { bytesConsumed: 1, commitment: "private-canary", rejectedSamples: 0 },
              idempotencyKeyDigest: "private-canary",
              requestDigest: "private-canary",
            },
            facts,
            schemaVersion: "tarot-draw-execution.v1",
          },
        }),
      "INTERPRETATION_INPUT_INVALID",
    );

    for (const route of ["blocked", "crisis", "reframed"]) {
      expectContractError(
        () =>
          parseInput({
            ...valid,
            safetyDecision: {
              policyVersion: preGenerationSafetyPolicyVersion,
              route,
              schemaVersion: "interpretation-safety-decision.v1",
            },
          }),
        "INTERPRETATION_INPUT_INVALID",
      );
    }
  });

  it("rejects unsupported or malformed input versions, keys, locale, facts, and provenance", () => {
    const { input } = firstCase();
    const valid = clone(input) as Record<string, unknown>;
    const approvedContent = valid.approvedContent as readonly unknown[];
    const content = approvedContent.at(0) as Record<string, unknown>;

    expectContractError(
      () => parseInput({ ...valid, schemaVersion: "2" }),
      "INTERPRETATION_SCHEMA_UNSUPPORTED",
    );
    expectContractError(
      () => parseInput({ ...valid, locale: "EN" }),
      "INTERPRETATION_INPUT_INVALID",
    );
    expectContractError(
      () => parseInput({ ...valid, tone: "authoritative" }),
      "INTERPRETATION_INPUT_INVALID",
    );
    expectContractError(
      () => parseInput({ ...valid, requestId: "not-a-request" }),
      "INTERPRETATION_INPUT_INVALID",
    );
    expectContractError(
      () =>
        parseInput({
          ...valid,
          approvedContent: [content, clone(content)],
        }),
      "INTERPRETATION_INPUT_INVALID",
    );
    expectContractError(
      () =>
        parseInput({
          ...valid,
          approvedContent: [{ ...content, checksum: "private-canary" }],
        }),
      "INTERPRETATION_INPUT_INVALID",
    );
    expectContractError(
      () =>
        parseInput({
          ...valid,
          readingType: "three_card",
        }),
      "INTERPRETATION_INPUT_INVALID",
    );
  });

  it("rejects object, accessor, inherited, and proxy input without executing property access", () => {
    let getterReads = 0;
    const hostile = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(hostile, "schemaVersion", {
      enumerable: true,
      get: () => {
        getterReads += 1;
        return "tarot-interpretation-input.v1";
      },
    });
    const inherited = Object.create({ schemaVersion: "tarot-interpretation-input.v1" }) as Record<
      string,
      unknown
    >;
    const proxy = new Proxy(hostile, {
      get: () => {
        getterReads += 1;
        return "private-canary";
      },
    });

    for (const value of [hostile, inherited, proxy]) {
      expectContractError(
        () => parseTarotInterpretationInputJsonV1(value as unknown as string),
        "INTERPRETATION_INPUT_INVALID",
      );
    }
    expect(getterReads).toBe(0);
    expectContractError(
      () =>
        parseTarotInterpretationInputJsonV1(
          '{"__proto__":{},"schemaVersion":"tarot-interpretation-input.v1"}',
        ),
      "INTERPRETATION_INPUT_INVALID",
    );
  });

  it("rejects malformed JSON, schema drift, extra keys, unsafe claims, and unsafe text", () => {
    const { input, output } = firstCase();
    const valid = clone(output) as Record<string, unknown>;
    const safety = valid.safety as Record<string, unknown>;

    expectContractError(() => parseOutputJson(input, "{"), "INTERPRETATION_OUTPUT_INVALID");
    expectContractError(
      () => parseOutputJson(input, JSON.stringify({ ...valid, schemaVersion: "2" })),
      "INTERPRETATION_SCHEMA_UNSUPPORTED",
    );
    expectContractError(
      () => parseOutputJson(input, JSON.stringify({ ...valid, extra: true })),
      "INTERPRETATION_OUTPUT_INVALID",
    );
    expectContractError(
      () =>
        parseOutputJson(
          input,
          JSON.stringify({
            ...valid,
            safety: { ...safety, containsGuaranteedOutcome: true },
          }),
        ),
      "INTERPRETATION_OUTPUT_INVALID",
    );
    expectContractError(
      () =>
        parseOutputJson(
          input,
          JSON.stringify({ ...valid, title: "<script>private-canary</script>" }),
        ),
      "INTERPRETATION_OUTPUT_INVALID",
    );
    for (const unsafe of [
      "control\ntext",
      "hidden\u200btext",
      "override\u202etext",
      "Cafe\u0301",
    ]) {
      expectContractError(
        () => parseOutputJson(input, JSON.stringify({ ...valid, summary: unsafe })),
        "INTERPRETATION_OUTPUT_INVALID",
      );
    }
  });

  it("rejects empty, duplicate, invalid, or excessive output collections and references", () => {
    const { input, output } = secondCase();
    const valid = clone(output) as Record<string, unknown>;
    const symbols = valid.symbols as readonly unknown[];
    const firstSymbol = symbols.at(0) as Record<string, unknown>;

    for (const change of [
      { symbols: [] },
      { symbols: [firstSymbol, clone(firstSymbol)] },
      { symbols: [{ ...firstSymbol, factRef: "Tarot.position.situation" }] },
      { sourceRefs: [] },
      { sourceRefs: ["content:lantern:1", "content:lantern:1"] },
      { sourceRefs: ["content:lantern:\u0430"] },
      { perspectives: [] },
      { reflectionQuestions: [] },
    ]) {
      expectContractError(
        () => parseOutputJson(input, JSON.stringify({ ...valid, ...change })),
        "INTERPRETATION_OUTPUT_INVALID",
      );
    }

    expectContractError(
      () =>
        parseOutputJson(
          input,
          JSON.stringify({
            ...valid,
            title: "x".repeat(interpretationContractLimits.titleMaximum + 1),
          }),
        ),
      "INTERPRETATION_OUTPUT_INVALID",
    );
    expectContractError(
      () =>
        parseOutputJson(
          input,
          JSON.stringify({
            ...valid,
            symbols: Array.from(
              { length: interpretationContractLimits.symbolsMaximum + 1 },
              (_, index) => ({ ...firstSymbol, factRef: `tarot.position.position-${index}` }),
            ),
          }),
        ),
      "INTERPRETATION_OUTPUT_INVALID",
    );
    expectContractError(
      () => parseOutputJson(input, "x".repeat(interpretationContractLimits.jsonMaximum + 1)),
      "INTERPRETATION_OUTPUT_INVALID",
    );
  });

  it("binds every final fact, source, and ritual reference to the parsed input", () => {
    const { input, output } = secondCase();
    const parsedInput = parseInput(input);
    const valid = clone(output) as Record<string, unknown>;
    const symbols = valid.symbols as readonly Record<string, unknown>[];
    const mutations = [
      {
        ...valid,
        symbols: [{ ...symbols[0], factRef: "tarot.position.invented" }, ...symbols.slice(1)],
      },
      { ...valid, symbols: symbols.slice(1) },
      {
        ...valid,
        symbols: [
          ...symbols,
          {
            factRef: "tarot.position.invented",
            meaning: "An invented symbol must not pass.",
            possibility: "It is not part of the deterministic draw.",
          },
        ],
      },
      { ...valid, sourceRefs: ["content:invented:1"] },
      {
        ...valid,
        sourceRefs: [...(valid.sourceRefs as readonly string[]), "content:invented:1"],
      },
      {
        ...valid,
        ritualSuggestion: {
          approvedTemplateCode: "unapproved.ritual.v1",
          reason: "A syntactically valid but unapproved template must not pass.",
        },
      },
    ];

    for (const mutation of mutations) {
      expectContractError(
        () => parseTarotInterpretationOutputForInputV1(parsedInput, JSON.stringify(mutation)),
        "INTERPRETATION_OUTPUT_INVALID",
      );
    }

    expectContractError(
      () =>
        parseTarotInterpretationOutputForInputV1(
          clone(input) as TarotInterpretationInputV1,
          JSON.stringify(output),
        ),
      "INTERPRETATION_INPUT_INVALID",
    );
  });

  it("keeps the fixture boundary free of private and provider-secret fields", () => {
    const serialized = JSON.stringify(fixture);
    expect(serialized).not.toMatch(
      /safeQuestion|rawQuestion|journal|intention|birth|email|phone|payment|accountId|readingId|sessionId|apiKey|authorization|idempotency|entropy|commitment|audit/iu,
    );
  });

  it("retains exact static result types after runtime parsing", () => {
    const parsedInput: TarotInterpretationInputV1 = parseInput(firstCase().input);
    const parsedOutput: TarotInterpretationOutputV1 = parseTarotInterpretationOutputForInputV1(
      parsedInput,
      JSON.stringify(firstCase().output),
    );
    expect(parsedInput.readingType).toBe("one_card");
    expect(parsedOutput.schemaVersion).toBe("1");
  });
});
