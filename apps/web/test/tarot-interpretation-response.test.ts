import { describe, expect, it } from "vitest";

import {
  parseTarotInterpretationResponseV1,
  tarotInterpretationResponseSchemaVersion,
} from "../app/_contracts/tarot-interpretation-response";

const readingId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const otherReadingId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const output = () => ({
  boundaryNote: "This is a symbolic possibility, not a prediction.",
  perspectives: ["A narrow focus may make one detail easier to notice."],
  reflectionQuestions: ["What is observable now?"],
  ritualSuggestion: { reason: "A quiet pause may support reflection." },
  smallAction: {
    label: "Write down one observation.",
    rationale: "An observation can support a reversible next step.",
    timeHorizon: "today",
  },
  summary: "The symbol offers one bounded lens on attention.",
  symbols: [
    {
      limitation: "It cannot determine an outcome.",
      meaning: "The symbol may represent focused attention.",
      possibility: "One detail may be useful without resolving every uncertainty.",
    },
  ],
  title: "A bounded lens on attention",
});

const finalResponse = (status: "reviewed_fallback" | "verified" = "verified") => ({
  displayable: true,
  output: output(),
  readingId,
  schemaVersion: tarotInterpretationResponseSchemaVersion,
  status,
});

const invalidResponse = (value: unknown): void => {
  expect(() => parseTarotInterpretationResponseV1(value, readingId)).toThrow(
    "The tarot interpretation response is invalid.",
  );
};

describe("tarot interpretation public response contract", () => {
  it("parses and recursively freezes only the minimal verified projection", () => {
    const source = finalResponse();
    const parsed = parseTarotInterpretationResponseV1(source, readingId);

    expect(parsed).toEqual(source);
    expect(Object.isFrozen(parsed)).toBe(true);
    if (parsed.status !== "verified") throw new Error("Expected verified response.");
    expect(Object.isFrozen(parsed.output)).toBe(true);
    expect(Object.isFrozen(parsed.output.symbols)).toBe(true);
    expect(Object.isFrozen(parsed.output.symbols[0])).toBe(true);
    expect(Object.isFrozen(parsed.output.perspectives)).toBe(true);
    expect(Object.isFrozen(parsed.output.reflectionQuestions)).toBe(true);
    expect(Object.isFrozen(parsed.output.smallAction)).toBe(true);
    expect(Object.isFrozen(parsed.output.ritualSuggestion)).toBe(true);

    source.output.title = "Changed after parsing";
    source.output.symbols[0]!.meaning = "Changed after parsing";
    expect(parsed.output.title).toBe("A bounded lens on attention");
    expect(parsed.output.symbols[0]?.meaning).toBe("The symbol may represent focused attention.");
  });

  it("accepts the exact processing, failed, and reviewed-fallback arms", () => {
    expect(
      parseTarotInterpretationResponseV1(
        {
          displayable: false,
          pollAfterMs: 1_500,
          readingId,
          schemaVersion: tarotInterpretationResponseSchemaVersion,
          status: "processing",
        },
        readingId,
      ),
    ).toEqual({
      displayable: false,
      pollAfterMs: 1_500,
      readingId,
      schemaVersion: tarotInterpretationResponseSchemaVersion,
      status: "processing",
    });
    expect(
      parseTarotInterpretationResponseV1(
        {
          displayable: false,
          readingId,
          schemaVersion: tarotInterpretationResponseSchemaVersion,
          status: "failed",
        },
        readingId,
      ),
    ).toEqual({
      displayable: false,
      readingId,
      schemaVersion: tarotInterpretationResponseSchemaVersion,
      status: "failed",
    });

    const fallback = finalResponse("reviewed_fallback");
    Reflect.deleteProperty(fallback.output, "ritualSuggestion");
    Reflect.deleteProperty(fallback.output.symbols[0]!, "limitation");
    expect(parseTarotInterpretationResponseV1(fallback, readingId)).toEqual(fallback);
  });

  it("enforces the exact status/displayable/output/polling discriminants", () => {
    const cases: unknown[] = [
      { ...finalResponse(), displayable: false },
      { ...finalResponse(), output: undefined },
      { ...finalResponse(), pollAfterMs: 1_500 },
      { ...finalResponse(), status: "processing" },
      {
        displayable: true,
        pollAfterMs: 1_500,
        readingId,
        schemaVersion: tarotInterpretationResponseSchemaVersion,
        status: "processing",
      },
      {
        displayable: false,
        output: output(),
        readingId,
        schemaVersion: tarotInterpretationResponseSchemaVersion,
        status: "failed",
      },
      {
        displayable: false,
        readingId,
        schemaVersion: tarotInterpretationResponseSchemaVersion,
        status: "processing",
      },
      {
        displayable: false,
        pollAfterMs: 249,
        readingId,
        schemaVersion: tarotInterpretationResponseSchemaVersion,
        status: "processing",
      },
      {
        displayable: false,
        pollAfterMs: 30_001,
        readingId,
        schemaVersion: tarotInterpretationResponseSchemaVersion,
        status: "processing",
      },
      {
        displayable: false,
        pollAfterMs: 1_500.5,
        readingId,
        schemaVersion: tarotInterpretationResponseSchemaVersion,
        status: "processing",
      },
      {
        displayable: false,
        readingId,
        schemaVersion: tarotInterpretationResponseSchemaVersion,
        status: "pending_verification",
      },
    ];
    for (const candidate of cases) invalidResponse(candidate);
  });

  it("binds the response to an exact lowercase UUIDv4 reading ID and schema", () => {
    invalidResponse({ ...finalResponse(), readingId: otherReadingId });
    invalidResponse({ ...finalResponse(), readingId: readingId.toUpperCase() });
    invalidResponse({ ...finalResponse(), readingId: "11111111-1111-1111-8111-111111111111" });
    invalidResponse({ ...finalResponse(), schemaVersion: "tarot-interpretation-response.v2" });
    expect(() => parseTarotInterpretationResponseV1(finalResponse(), otherReadingId)).toThrow(
      TypeError,
    );
    expect(() => parseTarotInterpretationResponseV1(finalResponse(), "not-a-reading-id")).toThrow(
      TypeError,
    );
  });

  it("rejects extra and private keys at every public projection boundary", () => {
    const topLevel = { ...finalResponse(), provider: "private-provider-canary" };
    const outputPrivate = finalResponse();
    Object.assign(outputPrivate.output, {
      safety: { certaintyLevel: "reflective" },
      sourceRefs: ["private-source-canary"],
    });
    const symbolPrivate = finalResponse();
    Object.assign(symbolPrivate.output.symbols[0]!, { factRef: "tarot.position.perspective" });
    const actionPrivate = finalResponse();
    Object.assign(actionPrivate.output.smallAction, { requestId: readingId });
    const ritualPrivate = finalResponse();
    Object.assign(ritualPrivate.output.ritualSuggestion!, {
      approvedTemplateCode: "free.candle.v1",
    });
    const protoPollution = JSON.parse(
      JSON.stringify(finalResponse()).replace(
        /\{"displayable"/u,
        '{"__proto__":{"provider":"private-provider-canary"},"displayable"',
      ),
    ) as unknown;

    for (const candidate of [
      topLevel,
      outputPrivate,
      symbolPrivate,
      actionPrivate,
      ritualPrivate,
      protoPollution,
    ]) {
      invalidResponse(candidate);
    }
  });

  it("rejects symbol-keyed private fields outside the JSON contract", () => {
    const symbolKey = finalResponse() as Record<PropertyKey, unknown>;
    symbolKey[Symbol("private")] = "private-canary";
    invalidResponse(symbolKey);
  });

  it("rejects unsafe Unicode, HTML, Markdown links, and URLs in displayable text", () => {
    const unsafe = [
      "line one\nline two",
      "C1\u0085control",
      "direction\u202ereversed",
      "zero\u200bwidth",
      "<strong>authoritative</strong>",
      "Read [this source](notes)",
      "Visit https://example.com/path",
      "Visit example.com/path",
      "Cafe\u0301",
      " leading space",
      "unpaired \ud800 surrogate",
    ];

    for (const text of unsafe) {
      const candidate = finalResponse();
      candidate.output.summary = text;
      invalidResponse(candidate);
    }
  });

  it("applies the same text policy to every nested displayable leaf", () => {
    const mutations: Array<(candidate: ReturnType<typeof finalResponse>) => void> = [
      (candidate) => void (candidate.output.title = "https://private.example"),
      (candidate) => void (candidate.output.symbols[0]!.meaning = "https://private.example"),
      (candidate) => void (candidate.output.symbols[0]!.possibility = "https://private.example"),
      (candidate) => void (candidate.output.symbols[0]!.limitation = "https://private.example"),
      (candidate) => void (candidate.output.perspectives[0] = "https://private.example"),
      (candidate) => void (candidate.output.reflectionQuestions[0] = "https://private.example"),
      (candidate) => void (candidate.output.smallAction.label = "https://private.example"),
      (candidate) => void (candidate.output.smallAction.rationale = "https://private.example"),
      (candidate) => void (candidate.output.ritualSuggestion!.reason = "https://private.example"),
      (candidate) => void (candidate.output.boundaryNote = "https://private.example"),
    ];

    for (const mutate of mutations) {
      const candidate = finalResponse();
      mutate(candidate);
      invalidResponse(candidate);
    }
  });

  it("rejects oversized text, collections, invalid optional values, and duplicate lists", () => {
    const mutations: Array<(candidate: ReturnType<typeof finalResponse>) => void> = [
      (candidate) => void (candidate.output.title = "x".repeat(121)),
      (candidate) => void (candidate.output.summary = "x".repeat(1_201)),
      (candidate) => void (candidate.output.boundaryNote = "x".repeat(801)),
      (candidate) => void (candidate.output.symbols[0]!.meaning = "x".repeat(801)),
      (candidate) => void (candidate.output.perspectives[0] = "x".repeat(801)),
      (candidate) => void (candidate.output.reflectionQuestions[0] = "x".repeat(501)),
      (candidate) => void (candidate.output.smallAction.label = "x".repeat(241)),
      (candidate) => void (candidate.output.smallAction.rationale = "x".repeat(601)),
      (candidate) => void (candidate.output.ritualSuggestion!.reason = "x".repeat(601)),
      (candidate) => void (candidate.output.symbols = []),
      (candidate) =>
        void (candidate.output.symbols = Array.from({ length: 13 }, output).flatMap(
          ({ symbols }) => symbols,
        )),
      (candidate) => void (candidate.output.perspectives = []),
      (candidate) =>
        void (candidate.output.perspectives = Array.from(
          { length: 7 },
          (_, index) => `Perspective ${index}`,
        )),
      (candidate) => void (candidate.output.reflectionQuestions = []),
      (candidate) =>
        void (candidate.output.reflectionQuestions = Array.from(
          { length: 5 },
          (_, index) => `Question ${index}?`,
        )),
      (candidate) => void (candidate.output.perspectives = ["Duplicate", "Duplicate"]),
      (candidate) => void Object.assign(candidate.output, { ritualSuggestion: undefined }),
      (candidate) => void Object.assign(candidate.output.symbols[0]!, { limitation: undefined }),
      (candidate) => void (candidate.output.smallAction.timeHorizon = "tomorrow"),
    ];

    for (const mutate of mutations) {
      const candidate = finalResponse();
      mutate(candidate);
      invalidResponse(candidate);
    }
  });

  it("accepts all internal time horizons and the polling boundaries", () => {
    for (const timeHorizon of ["open", "this_week", "today"] as const) {
      const candidate = finalResponse();
      candidate.output.smallAction.timeHorizon = timeHorizon;
      expect(parseTarotInterpretationResponseV1(candidate, readingId)).toMatchObject({
        output: { smallAction: { timeHorizon } },
      });
    }
    for (const pollAfterMs of [250, 30_000]) {
      expect(
        parseTarotInterpretationResponseV1(
          {
            displayable: false,
            pollAfterMs,
            readingId,
            schemaVersion: tarotInterpretationResponseSchemaVersion,
            status: "processing",
          },
          readingId,
        ),
      ).toMatchObject({ pollAfterMs });
    }
  });
});
