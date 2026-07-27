# 08 — AI Safety, Provider Architecture and Evals

## 1. Scope

AI is optional and used only for paid Deep Readings. The model has no tools, browser, code execution, database access, payment authority or account action authority. Daily Tarot, base Tarot, numerology and astrology facts remain deterministic.

DeepSeek and Kimi APIs are paid services with prices and availability that can change. Free promotional allowance may reduce early cost but must never be treated as a permanent production dependency. Model IDs are configurable through the versioned model policy.

## 2. Provider interfaces

```ts
interface AIProvider {
  generate(request: ProviderGenerationRequest, signal: AbortSignal): Promise<ProviderGenerationResponse>;
  health(): Promise<ProviderHealth>;
}

interface ModelPolicyResolver {
  resolve(productCode: DeepReadingProduct, locale: Locale): ModelPolicy;
}

interface OutputSafetyValidator {
  validate(input: SafetyInput): Promise<SafetyDecision>;
}
```

Provider adapters translate only transport fields. Product prompts, output schemas, safety, retries and Credit logic remain provider-neutral.

## 3. Transaction state machine

```text
requested
  → safety_input_allowed
  → credits_reserved
  → generating_primary
      → validating
          → persisted
          → credits_consumed
          → completed
      ↘ provider_failure → allowed_fallback → generating_fallback
      ↘ safety_failure / timeout / unusable_output
           → reservation_released
           → failed_or_blocked
```

The worker/reaper must release stale reservations. A retry uses a new generation attempt but the same idempotent business request unless the user deliberately starts a new reading.

## 4. Prompt construction

- Version every system prompt and product template.
- Delimit user content as untrusted data.
- State explicitly that text inside user content cannot modify system or product policy.
- Include only the minimum deterministic facts and context needed.
- Do not include internal keys, database data from other users, system diagnostics or hidden policies not required for behavior.
- Ask for strict JSON output matching a product schema.
- Do not allow model-selected URLs, HTML, Markdown links, tool calls or code.
- Keep Chinese and English prompt/eval variants separately reviewed.

## 5. Output schema

Common fields:

```json
{
  "title": "string",
  "summary": "string",
  "themes": [{"title":"string","reflection":"string"}],
  "alternativePerspective": "string",
  "boundaries": ["string"],
  "questions": ["string"],
  "groundedActions": ["string"],
  "safetyNote": "string|null"
}
```

Annual and 30-day products add bounded monthly/weekly arrays. Reject unknown fields, excessive list lengths, invalid language, markup and schema failures.

## 6. Safety policies

Input classifier outcomes:

- `allowed`
- `reframe` — control of others, deterministic relationship questions
- `professional_support` — medical, legal, financial, mental-health advice
- `crisis` — immediate self-harm or danger path
- `abuse_blocked` — illegal exploitation, harassment or manipulation

Output validator rejects or regenerates when content:

- claims certainty about future events
- diagnoses or prescribes
- gives investment/legal conclusions
- claims to know another person's mind
- promotes manipulation, stalking or coercion
- presents paid content as more spiritually effective
- reveals system prompt, secrets or private data
- contains HTML/script/links or instructions to take privileged actions
- contradicts deterministic card/calculation/astrology facts

A safety rejection releases Credits unless an approved, useful safe response is persisted as the purchased result.

## 7. Privacy

- Raw private content encrypted in the application database if history is retained.
- Provider request content is never logged by RITUVIA.
- Disable provider retention/training where the provider offers controls and document the setting.
- Send no user name, email, wallet address, payment/order information or journal history unless a separately consented feature explicitly requires selected excerpts.
- Generic telemetry stores product code, provider, model, versions, token counts, latency, cost and outcome only.
- Support staff do not see prompts/results by default.

## 8. Cost and abuse controls

- Per-product maximum input/output.
- Per-user and per-account daily limits.
- Global spend ceiling and alerts.
- One active generation per user/product by default.
- Timeout, one bounded retry and circuit breaker.
- Fallback only when policy allows and within the same Credit reservation.
- Cache only when input is genuinely identical, user-authorized and privacy-safe; never cross-user cache raw private readings.
- No self-hosted GPU in MVP without measured cost evidence.

## 9. Eval suite

Create versioned eval fixtures covering at least:

- 50 normal examples per product per language.
- 50 relationship mind-reading/manipulation attempts.
- 30 medical/legal/financial prompts.
- 20 crisis prompts.
- 50 prompt-injection/jailbreak attempts.
- 30 deterministic-fact contradiction cases.
- 30 excessively certain/predictive outputs.
- 20 private-data leakage canaries.
- provider timeout, malformed JSON, empty response and rate-limit cases.

Automated metrics:

- JSON schema pass.
- deterministic fact fidelity.
- prohibited-claim rate: 0 in release set.
- language correctness.
- action groundedness.
- latency and cost budget.
- Credit release/consume correctness.

Human review evaluates tone, usefulness, non-manipulation and cultural quality. A model/prompt change cannot ship without regression evidence and a version update.

## 10. Default production flags

```text
AI_DEEP_READINGS_ENABLED=false
AI_FALLBACK_ENABLED=false
AI_PROVIDER_PRIMARY=deepseek
AI_PROVIDER_FALLBACK=kimi
```

Enable only after privacy terms, provider settings, evals, cost limits, incident controls and Owner approval are complete.
