# AI Interpretation, Evaluation, and Safety

## 1. Purpose

AI transforms validated symbolic facts and curated content into readable reflection. It is not the source of truth for draws, calculations, prices, policies, or user identity, and it is not a spiritual authority.

## 2. Separation of concerns

### Deterministic layer owns

- Tarot card/spread/orientation.
- Numerology formulas/results.
- Astrology positions/houses/aspects/confidence.
- Product, price, entitlement, country, age, and usage limits.
- Source/content/prompt versions.

### AI layer owns

- Plain-language synthesis.
- Alternative interpretations.
- Reflective questions.
- Agency-preserving small actions.
- Optional symbolic ritual suggestion from an approved catalog.
- Tone/locale adaptation within reviewed boundaries.

The AI output can never override or silently modify deterministic facts.

## 3. Input bundle

Use a typed bundle such as:

```ts
type InterpretationInput = {
  requestId: string;
  modality: "tarot" | "numerology" | "astrology";
  readingType: string;
  locale: string;
  tone: "grounded" | "gentle" | "concise" | "poetic-light";
  themeCode?: string;
  safeQuestion?: string; // encrypted in storage; minimize model exposure
  deterministicFacts: unknown; // modality-specific validated schema
  approvedContent: Array<{
    contentId: string;
    version: string;
    tradition: string;
    excerpt: string;
  }>;
  userContext?: {
    priorIntentions?: string[]; // only with explicit personalization consent
    accessibilityPreferences?: string[];
  };
  safety: {
    policyVersion: string;
    riskCategories: string[];
    prohibitedClaims: string[];
  };
};
```

Minimize context. Do not include full journal history, payment data, contact data, or unrelated sensitive records.

## 4. Structured output contract

```ts
type InterpretationOutput = {
  schemaVersion: "1";
  title: string;
  summary: string;
  symbols: Array<{
    factRef: string;
    meaning: string;
    possibility: string;
    limitation?: string;
  }>;
  perspectives: string[];
  reflectionQuestions: string[];
  smallAction: {
    label: string;
    rationale: string;
    timeHorizon: "today" | "this_week" | "open";
  };
  ritualSuggestion?: {
    approvedTemplateCode: string;
    reason: string;
  };
  boundaryNote: string;
  sourceRefs: string[];
  safety: {
    certaintyLevel: "reflective";
    containsProfessionalAdvice: false;
    containsGuaranteedOutcome: false;
  };
};
```

Validate length, references, locale, allowed template codes, deterministic fact mentions, and disallowed phrases before display.

## 5. Generation pipeline

1. Normalize and validate input.
2. Run question/risk classifier and deterministic policy rules.
3. Reframe/refuse before generation if the request is unsafe.
4. Retrieve only approved content for the exact modality/tradition/version/locale.
5. Assemble prompt with explicit facts, boundaries, output schema, and no unsupported context.
6. Generate through provider adapter with timeout and cost limit.
7. Parse and schema-validate.
8. Verify every fact reference against deterministic input.
9. Run post-generation policy checks and optional reviewer model/rules.
10. If safe, persist versioned result; if not, use reviewed fallback or safe boundary response.
11. Emit privacy-safe metrics and eval tags.

## 6. Prohibited behavior

The system must not:

- State that a future event, death, pregnancy, diagnosis, legal ruling, market move, crime, or another person's private thoughts are known.
- Guarantee reunion, attraction, wealth, cure, protection, luck, or ritual efficacy.
- Tell a user to stop medication, avoid professional help, make an investment, break a law, or confront a person based on a reading.
- Reinforce supernatural persecution, curses, possession, surveillance, thought control, or grandiose special status.
- Encourage repeated readings because danger is imminent or because the “energy changed.”
- Imply payment unlocks truth or spiritual power.
- Shame skepticism, disagreement, cancellation, or not completing a streak.
- Fabricate sources, cultural claims, card meanings, chart facts, or user history.

## 7. High-stakes and crisis handling

### Medical, legal, and financial

- State that RITUVIA cannot determine or advise the outcome.
- Offer a safe reflective reframing focused on the user's values, questions for a qualified professional, or emotional preparation.
- Do not continue interpreting the high-stakes prediction itself.

### Self-harm or immediate danger

- Use a dedicated, reviewed crisis response appropriate to locale where available.
- Encourage immediate local emergency/crisis support and reaching a trusted person.
- Do not continue with divination content in that turn.
- Store only minimal safety metadata required for operations/legal purposes.

### Delusion/paranoia/supernatural persecution

- Do not validate the supernatural claim.
- Acknowledge distress, ground in uncertainty and observable reality, and encourage trusted/professional support where appropriate.
- Do not sell a ritual/remedy.

### Abuse/coercion

- Avoid advice that could increase danger.
- Focus on safety planning resources and user-controlled next steps.
- Never reveal private data or infer another person's intention.

All locale resources require legal/content review and freshness management.

## 8. Emotional dependency safeguards

- Frequency caps and calm limits on redraw/regeneration.
- No “only RITUVIA understands you” language.
- No anthropomorphic claims of consciousness, spiritual connection, or secret insight.
- Encourage real-world action and relationships.
- Provide completion and pause, not infinite conversational hooks.
- Track repeated high-frequency use as a product-safety signal without diagnosing the user.
- Do not use vulnerable themes for personalized ads or upsells.

## 9. Prompt and content versioning

Every production interpretation records:

- Prompt ID/version/checksum.
- Output schema version.
- Safety policy/version.
- Curated content IDs/versions.
- Model provider and model identifier.
- Deterministic engine/version.
- Locale and tone.
- Generation timestamp and evaluation tags.

Changing any of these requires a release/eval decision. Preserve ability to render historical results without silently changing their text.

## 10. Model/provider abstraction

Define capabilities rather than vendor-specific calls:

- Structured generation.
- Streaming.
- Classification/moderation.
- Embeddings/retrieval if used.
- Batch eval.
- Cost/usage reporting.

Adapters must support timeouts, retries only where safe, fallback, circuit breaking, redaction, region/data controls, and provider exit. Model names are configuration and never hardcoded into domain logic.

## 11. Retrieval and sources

- Content retrieval is allowlisted by tradition, modality, content status, version, and locale.
- Keep source excerpts small and attributable.
- Never retrieve unpublished, unlicensed, contradictory, or cross-tradition content by default.
- Store source metadata for admin and methodology views.
- A model's pretraining knowledge is not an accepted source for culturally specific claims.

## 12. Evaluation framework

### Fixed test sets

- Correct mention of deterministic facts.
- No fabricated card/number/placement.
- Reflective vs deterministic wording.
- Medical/legal/financial boundary.
- Self-harm/crisis response.
- Delusion/paranoia non-reinforcement.
- Relationship mind-reading/reunion guarantee.
- Paid efficacy/fear upsell.
- Cultural mixing/source fidelity.
- Locale quality and pronoun/name handling.
- Prompt injection in user question or retrieved content.
- Long/empty/ambiguous input.

### Metrics

- Deterministic fact accuracy: 100% required on release set.
- Schema validity: 100% after retry/fallback path.
- Critical safety failure: zero allowed in release set.
- Unsupported claim rate.
- Source-reference validity.
- Helpfulness/agency rating by human rubric.
- Tone/locale quality.
- Latency and cost.

Do not reduce quality to one model-as-judge score. Use deterministic validators, adversarial fixtures, human review samples, and model graders as complementary evidence.

## 13. Release process for AI changes

1. Create prompt/model/content candidate version.
2. Run fixed regression and adversarial evals.
3. Inspect failures and representative outputs manually.
4. Compare latency/cost and safety.
5. Canary behind a server flag on low-risk traffic.
6. Monitor reports, regeneration, fallback, and safety metrics.
7. Owner approves production model/safety changes.
8. Preserve immediate rollback to prior version.

## 14. Logging and privacy

- Default logs contain request ID, model/prompt/content versions, token/cost/latency, schema/safety result, and categorical theme—not raw question/journal/birth data.
- Raw traces, if temporarily needed for debugging, require explicit gated sampling, encryption, restricted access, retention expiry, and user/legal basis.
- Never send payment data, authentication secrets, private keys, or unnecessary identifiers to the model.

### AI operations v1

RIT-038 and D-088 project only aggregate operational metadata already authorized by D-040 and
D-041. The daily report groups by locale, reading type, provider/model, prompt, output schema,
safety policy, and public content version. It reports cost/token coverage, estimated cost,
latency, retries, failures, reviewed fallbacks, verified outcomes, and safe replacements.

The projection rejects questions, prompts, generated or fallback prose, retrieved excerpts,
detailed safety categories, raw provider errors, user/session/reading/request identifiers,
digests, leases, payment data, and arbitrary fields. Version-group and overall values require at
least 20 terminal generations. Unavailable, stale, or synthetic evidence produces null values and
a blocked decision status. A safe replacement is a protective outcome, not a critical safety
failure or permission to weaken verification.

The report is private offline evidence for the future RIT-120 owner surface. It does not activate a
provider, collect browser analytics, create an admin route, change a model or safety policy, or
enforce a monetary budget.

## 15. Numerology V1 safe-off boundary

RIT-083 adds no production model or calculator prose. A future English numerology interpretation
must recompute the exact deterministic facts, project only calculation code/result/rule and the
explicit Personal Year target, and exclude birth date, canonical digits, initial sums, and
reduction steps from provider context. Structured number and target-year fields remain
server-authoritative; model prose may contain neither digits nor number words.

Content must cover every reachable Life Path, Birthday Number, and Personal Year result before an
exact request-specific selection is made. Content, prompt, and fallback integrity are checked
separately from server-owned authorization. A provider candidate is single-use, input-identity and
digest bound, deterministically checked, independently reviewed, and non-displayable until the
final verified or approved-replacement result exists.

The canonical V1 catalog currently has AI interpretation disabled. D-065 resolves the exact
English content, rights, reviewer, fallback, and optional paid-product mapping, but local
evaluations do not authorize a provider, live reviewer, Credits consumption, persistence, the free
calculator surface, or launch. Those remain behind the production AI and release gates.

## 16. Astrology V1 safe-off boundary

RIT-095 adds no provider, live model, public natal prose, or calculation route. Available
`AstrologyNatalFactsV1` are reparsed and their major aspects are independently recomputed from the
authoritative placement longitudes before any artifact is accepted. Unknown-time, engine-failure,
and untrusted-output states stop before content or model work.

Provider context contains only body/sign placement references, approved aspect references,
uncertainty status, and bounded method/engine/source digests. It excludes birth date, time, place,
coordinates, profile revision, Julian day, exact degrees, house cusps, and private text. The model
cannot narrate deterministic labels or numbers; output binds every fact reference in exact order
and explicitly keeps degree narration and house interpretation false. Approximate-time input
retains its exact approved window and contains no house, angle, or aspect interpretation.

Content, prompt, and fallback artifacts require separate integrity and server authority. A
candidate is digest- and input-identity-bound, single-use, checked for fact drift, certainty,
professional advice, mind-reading, dependency, paid efficacy, persecution, self-harm, injection,
fixed personality, markup, hostile Unicode, and locale drift, then requires an independently
authorized semantic reviewer. Malformed, uncertain, unsafe, or reviewer-failure outcomes use the
approved deterministic replacement; trust failure produces no displayable output.

The fixed synthetic suite runs with zero external requests and zero paid calls. It proves the code
boundary only and does not approve production astrology meanings, a provider/model, a live
reviewer, Credits, persistence, UI activation, deployment, or public launch.
