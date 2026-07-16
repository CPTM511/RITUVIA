# Analytics, Metrics, and Experimentation

## 1. Measurement philosophy

Measure whether the product helps users complete a meaningful reflective loop while protecting trust. Avoid vanity engagement and avoid optimizing for compulsive repetition.

## 2. North-star metric

**Weekly Meaningful Reflection Sessions (WMRS)**

A distinct user/anonymous subject counts once per qualifying session when, within the same seven-day window, they complete:

1. A reading or guided reflection, and
2. At least one deeper step: intention saved, ritual completed, journal entry created, or scheduled revisit completed.

Define session boundaries, identity merge, bot filtering, consent scope, and late-arriving events before implementation.

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

Never include raw prayer, question, intention, journal, name, birth date/time/place, email, exact location, card data, crypto address, crisis text, or AI full prompt/output in product analytics.

## 6. Identity and consent

- Analytics subject is pseudonymous and purpose-scoped.
- Anonymous-to-user merge follows consent and avoids double counting.
- Consent state travels with event emission.
- Essential operational telemetry is separated from optional product/marketing analytics.
- Provide deletion/suppression behavior where required.
- Do not use cross-site ad trackers on private product flows without explicit reviewed need.

## 7. Funnels

### First-value funnel

Eligible landing → reading start → deterministic completion → interpretation viewed → meaningful reflection step → account save.

### Ritual loop

Result viewed → intention created → ritual started → ritual completed → journal/revisit.

### Commerce

Eligible product view → checkout start → provider session → verified payment → entitlement grant → first use → refund/cancel/dispute.

Always expose denominator, eligibility filters, locale/country, and time window.

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
