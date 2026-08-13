# Analytics, Metrics, and Experimentation

## 1. Measurement philosophy

Measure whether the product helps users complete a meaningful reflective loop while protecting trust. Avoid vanity engagement and avoid optimizing for compulsive repetition.

## 2. North-star metric

**Weekly Meaningful Reflection Sessions (WMRS)**

A distinct user/anonymous subject counts once per qualifying session when, within the same seven-day window, they complete:

1. A reading or guided reflection, and
2. At least one deeper step: intention saved, ritual completed, journal entry created, or scheduled revisit completed.

Define session boundaries, identity merge, bot filtering, consent scope, and late-arriving events before implementation.

### WMRS v1 implementation baseline

- Window: rolling UTC `[asOf - 7 days, asOf)`, using event time.
- Unit: distinct consented anonymous analytics subject, counted once even with multiple qualifying
  reflection sessions.
- Reflection session: one server-authoritative Tarot reading and its purpose-scoped pseudonymous
  root key.
- Qualification: deterministic reading completion followed by intention creation, ritual
  completion, private journal creation, or Revisit completion in the same window.
- Diagnostic: report qualifying reflection-session count separately; it is not WMRS.
- Identity: no anonymous-to-account merge until RIT-051; no cross-purpose identifiers.
- Bot handling: unavailable in v1 and disclosed as a data-quality limitation.
- Late data: recompute the bounded window by event time and expose late-observation count.
- Consent: only exact current `optional_product_analytics` consent; absent, denied, withdrawn,
  stale, or malformed state is excluded and emits no event.

This baseline is implemented as a synthetic, safe-off contract. It does not activate production
analytics or establish legal notice, retention, deletion, vendor, or backfill policy.

## 3. Metric tree

### Reach

- Qualified organic sessions.
- Direct/referral/creator sessions.
- Locale/country eligible traffic.
- Landing-page useful-action rate.

### Activation

- Start rate.
- Safe question/intake completion.
- Deterministic reading completion.
- Time to first useful result.
- Result → intention.
- Result/intention → free ritual.
- Full-loop completion.

### Retention

- D1/D7/D30 return.
- Revisit completion.
- Weekly meaningful sessions per active user, with dependency guardrail.
- Intention follow-up and journal return.
- Subscription retention/cancellation reasons.

### Revenue

- Eligible checkout start/success.
- Free → paid conversion by product and locale.
- Subscriber conversion and retention.
- One-time product repeat rate.
- Gross/net revenue, tax, fees, refunds, disputes, chargebacks.
- AI/payment/infrastructure/content cost contribution margin.

### Trust and safety guardrails

- Content report rate and severity.
- High-stakes request interception and safe resolution.
- Critical AI eval failure.
- Repeated redraw/regeneration patterns.
- Refund/chargeback/support complaint rate.
- Cancellation friction reports.
- Privacy/accessibility incidents.
- User-rated agency/helpfulness vs certainty/dependency concerns.

## 4. Event taxonomy

Use versioned names and typed properties. Suggested events:

RIT-046 freezes the current core-loop subset to `reading_started`,
`reading_deterministic_completed`, `interpretation_viewed`, `intention_created`, `ritual_started`,
`ritual_completed`, `journal_entry_created`, `revisit_scheduled`, and `revisit_completed`.
`interpretation_viewed` is intentionally distinct from generation completion: a generated result
is not counted as seen. The viewed contract has no active browser queue, beacon, or endpoint.

### Acquisition/content

- `page_viewed`
- `content_engaged`
- `calculator_started`
- `calculator_completed`
- `share_created`
- `share_opened`

### Reading

- `reading_started`
- `question_reframed`
- `reading_deterministic_completed`
- `interpretation_started`
- `interpretation_completed`
- `interpretation_fallback_used`
- `reading_saved`
- `reading_reported`

### Reflection loop

- `intention_created`
- `small_action_created`
- `ritual_started`
- `ritual_completed`
- `journal_entry_created`
- `revisit_scheduled`
- `revisit_completed`

### Identity

- `signup_started`
- `signup_completed`
- `anonymous_merged`
- `privacy_export_requested`
- `account_deletion_requested`

### Commerce

- `product_viewed`
- `checkout_started`
- `checkout_returned`
- `order_paid`
- `entitlement_granted`
- `subscription_started`
- `subscription_canceled`
- `refund_requested`
- `refund_completed`
- `payment_disputed`

### Safety/operations

- `safety_boundary_shown`
- `provider_fallback_used`
- `job_dead_lettered`
- `reconciliation_difference_found`

## 5. Allowed event properties

Allowlist only:

- Event/schema version.
- Pseudonymous subject/session.
- Locale, coarse country/region eligibility, platform/device class.
- Modality/reading type/theme code—not raw question.
- Product/price/currency/order safe identifiers—not card/payment data.
- Feature/experiment variant.
- Status, error category, latency bucket.
- Content/prompt/model/engine/policy version.
- Paid/free and entitlement category.

The RIT-046 minimum deliberately excludes theme and safety state even though broader future
taxonomies may permit reviewed categorical forms; the combination can reveal sensitive context in
small cohorts.

Never include raw prayer, question, intention, journal, name, birth date/time/place, email, exact location, card data, crypto address, crisis text, or AI full prompt/output in product analytics.

## 6. Identity and consent

- Analytics subject is pseudonymous and purpose-scoped.
- Anonymous-to-user merge follows consent and avoids double counting.
- Consent state travels with event emission.
- Essential operational telemetry is separated from optional product/marketing analytics.
- Provide deletion/suppression behavior where required.
- Do not use cross-site ad trackers on private product flows without explicit reviewed need.
- The current runtime adapter is a no-op until exact notice, retention/deletion, sink, and
  production activation receive owner approval.

## 7. Funnels

### First-value funnel

Eligible landing → reading start → deterministic completion → interpretation viewed → meaningful reflection step → account save.

### Ritual loop

Result viewed → intention created → ritual started → ritual completed → journal/revisit.

### Commerce

Eligible product view → checkout start → provider session → verified payment → entitlement grant → first use → refund/cancel/dispute.

Always expose denominator, eligibility filters, locale/country, and time window.

### AI operations v1

The `ai-operations.v1` policy is essential operational reporting, not optional product analytics.
It accepts one exact 24-hour UTC aggregate with capture no more than six hours after window end.
The source is current for 30 hours. Unavailable, stale, or synthetic evidence blocks decisions and
produces null performance values.

Metrics cover terminal generation count, displayable completion, failure, reviewed fallback,
safe replacement, retry, average latency, the share exceeding 30 seconds, cost/token reporting
coverage, estimated cost, and average reported cost/tokens. Overall and version-group values
require at least 20 generations. Initial human-review thresholds are failure above 2%, reviewed
fallback above 10%, safe replacement above 5% of verified outcomes, more than 5% exceeding 30
seconds, and cost or token reporting coverage below 95%.

These thresholds open investigation only. They never change model/provider, timeout, retry,
fallback, safety, prompt, content, or production configuration. OWN-005 remains incomplete, so
there is no authorized daily monetary budget threshold and unavailable cost is never treated as
zero.

### SEO/GEO operations v1

The `seo-geo-operations.v1` policy consumes one strict offline aggregate snapshot for the exact
reviewed public inventory. It calculates crawl coverage, index coverage, CTR, average position,
consented referral useful-action rate, generative-referral share, route review freshness,
editorial-record review freshness, source review freshness, and rights-expiry status. Results are
grouped only by approved route, locale, content family, and coarse user intent.

The exact window is seven UTC days and capture must occur within 96 hours of its end. Crawl,
index/query, and referral source ages are capped at 24, 96, and 72 hours respectively.
Unavailable, stale, or synthetic streams cannot produce performance values or recommendations.
Route query/referral values are suppressed below a denominator of 20; denominators from 20 through
199 remain diagnostic and cannot trigger a performance recommendation; 200 or more may trigger a
bounded review prompt. The v1 snippet prompt requires average position at most 10 and CTR below
2%; the referral prompt requires useful-action rate below 1%.

Raw query text, full referrer URLs, user/session identifiers, private content, exact location,
arbitrary event properties, and cross-site tracking are prohibited. Referral exports must retain
explicit other/unknown and excluded aggregate buckets. Production analytics collection, provider
connection, notice, retention/deletion, and activation remain separately owner-gated.

### Cost guardrails v1 safe-off preparation

`cost-guardrail.v1` consumes one exact 24-hour UTC provider/feature aggregate and either an
unavailable or explicitly unapproved proposed policy. Provider and feature values come from finite
code registries; arbitrary labels, identifiers, free text, private content, and raw provider
payloads are rejected. Proposed lines must reconcile exactly to the proposed total, while missing,
partial, stale, synthetic, unavailable, or unbudgeted cost never becomes zero or spend authority.

The report always keeps `decisionStatus=blocked`, non-essential spend denied, and
`automaticActionsExecuted=false`. It can simulate warning/exhaustion and essential alert-only
behavior for review, but it exposes no admission API and cannot reserve money or execute
degradation. OWN-005, a decision-bound policy digest, durable atomic reservation/reconciliation,
provider ingestion, and fixed alert delivery are required before RIT-127 can complete.

### Owner operations v1

The `owner-operations.v1` policy is a private read-only summary, not optional product analytics and
not a live admin control plane. It accepts exactly eight categorical source envelopes in canonical
order: health, revenue, core loop, AI, queue, support, cost, and approvals. Each output shows the
source environment/kind, observed-through time, exact window when present, maximum age, freshness,
data quality, approval reference, evidence, runbook, state, and a fixed known gap.

Health, queue, and support evidence expires after one hour; revenue, core-loop, AI, and cost evidence
after 30 hours; approval state after 168 hours. Missing, future, stale, or synthetic evidence is
forced to `unknown`. The v1 surface carries no arbitrary metric/value map, private content, user or
session identifier, raw provider payload/error, or free-text operator note. Detailed quantitative
reports remain in their named source systems and must retain their own denominator, window,
low-sample, approval, and privacy contracts.

The release panel displays D-106-approved OWN-005 Option A safe-off, D-104-approved OWN-019,
RIT-127 blocked pending exact Option B and durable enforcement, completed repository-local RIT-128,
the planned RIT-130 release-evidence task, standing staging, Gate H, and independent-security state.
Even complete evidence remains subject to explicit Owner deployment approval. Production readers,
Web/admin routes, automation, budgets, providers, deployment, and launch are separate tasks and
gates.

## 8. Experiments

Every experiment needs:

- ID, owner, hypothesis, target decision, primary metric, guardrails.
- Eligibility, unit of assignment, sample/ramp, exposure event.
- Predefined duration/stopping rule and analysis plan.
- Safety/privacy/cultural review.
- Rollback and cleanup date.
- Result and decision recorded.

### Forbidden experiments

- Hiding or weakening safety/legal/payment disclosures.
- Fear/urgency/shame/dependency copy.
- Making free rituals visually undignified or inaccessible.
- Personalized price based on sensitive spiritual/private content.
- Manipulating cancellation/refund friction.
- Crisis-flow experimentation without specialist and legal review.

## 9. Initial experiment backlog

After baseline traffic exists:

- Structured theme selection vs free-text-first intake.
- One concise interpretation vs progressive detail.
- Intention prompt timing after result.
- Free ritual CTA placement.
- Revisit timing chosen by user vs suggested default.
- Share-card content controls.
- Account-save prompt after intention vs after ritual.

Do not run multiple overlapping experiments on the core loop until instrumentation and assignment are trustworthy.

## 10. Reporting cadence

### Daily operational

Payment failures, entitlement lag, provider/AI errors, safety incidents, cost anomalies, availability.

### Weekly product

WMRS, activation, loop steps, D7, paid funnel, refunds, reports, top locale/content, experiment status.

### Monthly business/risk

Cohort retention, contribution economics, country/provider health, chargebacks, content quality, privacy/security, model drift, SEO/GEO, localization.

## 11. Data quality checks

- Event schema validation and version coverage.
- Duplicate/missing sequence checks.
- Server vs client reconciliation for money/core completion.
- Bot/internal traffic filters.
- Anonymous merge correctness.
- Time-zone/date-window tests.
- Consent enforcement.
- Metric definition tests against fixtures.
- Dashboard source/freshness labels.

No decision should rely on a metric until its definition, denominator, source, freshness, and known gaps are documented.
