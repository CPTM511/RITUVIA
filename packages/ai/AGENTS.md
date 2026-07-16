# AI Interpretation Instructions

These instructions apply to `packages/ai/**`.

## Role

Generate bounded, transparent, culturally grounded reflective language from deterministic reading facts and curated content. AI is an interpretation layer, not the source of calculations or supernatural authority.

## Required pipeline

1. Accept a typed, minimal context object.
2. Retrieve only approved/versioned content.
3. Build a versioned prompt with explicit method/tradition and safety constraints.
4. Request structured output with a strict schema.
5. Validate structure, length, citations/provenance, banned claims, and locale.
6. Apply safety/dependency/crisis checks.
7. Persist versions, status, and privacy-safe operational metadata.
8. Return a deterministic safe fallback on timeout, malformed output, policy failure, or provider outage.

## Content contract

A normal interpretation should distinguish:

- `observed_symbols`: deterministic cards/positions/aspects/numbers.
- `possible_meanings`: non-exclusive symbolic possibilities.
- `reflection_questions`: autonomy-supporting prompts.
- `small_action`: one optional, practical, reversible action.
- `uncertainty_and_boundary`: no certainty or professional substitution.
- `source_provenance`: content pack/method/version, not invented citations.

## Prohibited behavior

Never generate or endorse:

- Guaranteed future events, guaranteed love/money/health/legal outcomes, curse removal, or paid efficacy.
- Medical/legal/financial diagnosis or personalized professional instructions.
- Fear escalation, dependency, exclusivity, urgency, repeated paid readings, or “only we can protect you.”
- Definitive claims about another person's thoughts, infidelity, pregnancy, death, crime, or supernatural attack.
- Targeting protected traits or vulnerable emotional state for monetization.
- Impersonated clergy/psychics/ancestors/deities or fabricated cultural authority.

## Sensitive contexts

- Detect self-harm, abuse, psychosis/paranoia, severe distress, and emergency language using a conservative safety layer.
- Do not continue the divination frame in acute-risk cases; provide calm, nonjudgmental grounding and region-appropriate help-routing without claiming diagnosis.
- Do not store raw sensitive text in eval/analytics datasets by default. Use consented, redacted, synthetic, or tightly governed samples.

## Evaluation and change control

- Every prompt/model/content/schema change has an eval set, baseline comparison, cost/latency impact, and rollback version.
- Evaluate factual grounding to deterministic inputs, non-determinism language, autonomy, prohibited claims, cultural fidelity, locale quality, and crisis handling.
- Red-team multilingual and adversarial prompts.
- Do not promote a new model/prompt because examples “look good”; require measured acceptance thresholds and independent review.
