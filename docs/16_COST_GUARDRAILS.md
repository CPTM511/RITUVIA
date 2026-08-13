# Cost and Unit-Economic Guardrails

## 1. Goal

A one-person company must know where every marginal dollar goes. Automate cost visibility and limits before traffic or AI usage scales.

## 2. Cost centers

- Web/compute/serverless and worker runtime.
- PostgreSQL, cache/queue, object storage, bandwidth/CDN.
- AI input/output, classification, embeddings, and evals.
- Email/SMS/push and geocoding/time-zone/astrology providers.
- Payment fees, fraud tooling, refunds, chargebacks, tax/MoR.
- Monitoring/security/backups.
- Content, artwork, licenses, translation, legal/compliance.
- Marketing, affiliates, creators, and domain/brand.

## 3. Required cost telemetry

Tag or allocate by:

- Environment.
- Provider/model/service.
- Feature/modality.
- Locale/country where lawful/useful.
- Free vs paid entitlement.
- Request/job/content/prompt version.
- Customer/order cohort for aggregate contribution analysis, not invasive profiling.

## 4. Budgets

The owner sets configuration for:

- Monthly total operating budget.
- Daily AI budget and per-feature/model limits.
- Per-user/anonymous usage caps.
- Worker concurrency and queue retry caps.
- Storage/export/share-image limits.
- Email/notification volume.
- Paid marketing and affiliate budget (manual approval only).
- Refund automation threshold and fraud-loss tolerance.

No automation raises these limits or creates a new paid vendor without approval.

D-069 supersedes D-066's planned CHF 700 Professional License with whole-project
`AGPL-3.0-only`; no license payment or countersigned commercial contract is budgeted. AGPL does not
provide private support, uptime, response-time, correctness, or fitness commitments. RITUVIA owns
availability and MTTR, so operating budgets must include Corresponding Source packaging,
compatibility review, native-build maintenance, validation, incident response, and replacement
capacity rather than assuming vendor support.

D-067 selects a self-hosted GeoNames export as the intended location source and rejects public
Nominatim or a request-priced hosted time-zone API as a default production dependency. This avoids
per-request provider spend and sending private birth-location queries to a remote service, but
RITUVIA owns snapshot import/update, attribution, local search indexing, storage, memory, latency,
monitoring, rollback, and abuse-control costs. No paid geocoding vendor or production snapshot is
activated by RIT-091.

## 5. AI cost controls

- Use the smallest model that passes the quality/safety eval for a task; reserve the strongest reasoning model for architecture, safety, complex interpretation, and review.
- Keep prompts/context minimal and structured.
- Cache only non-private, version-safe reusable content.
- Use deterministic/template fallback for failure and low-value cases.
- Cap output length and regeneration.
- Batch offline eval/content tasks where safe.
- Track cost per completed meaningful loop, paid conversion, and retained user—not only per request.

Cost savings may never allow wrong deterministic facts or weaker safety.

RIT-038 records provider-estimated cost only when the existing runtime metadata marks it reported
and valid. The daily brief separately reports cost coverage and never converts missing cost to
zero. Cost coverage below 95% opens a human data-quality review. Because OWN-005 has not approved
daily or model budgets, RIT-038 does not invent a monetary anomaly threshold, pause traffic, switch
models, or raise/lower runtime cost limits. Budget enforcement remains RIT-127.

RIT-120 surfaces unavailable production cost as `unknown` rather than a compliant zero-cost state.
D-105 adds `cost-guardrail.v1` only as a fixed-registry private safe-off simulation: proposed
provider/feature lines reconcile exactly, missing/unbudgeted cost remains explicit, essential
controls are alert-only, arbitrary labels are rejected, every non-essential spend authorization is
denied, and no action executes. D-106 approves OWN-005 Option A exactly, preserving this safe-off
posture for the protected free Beta. Option A explicitly leaves RIT-127 Blocked until exact Option B
policy bytes plus durable atomic reserve/commit/release/reconcile and fixed alert-delivery evidence
exist. It may not activate a paid vendor, raise spend, change a production model, or weaken
safety/privacy to satisfy a budget.

The exact Owner decision and remaining Option B table are in
`docs/reports/RITUVIA_OWN_005_COST_BUDGET_DECISION_REQUEST_2026-08-02.md`. Production paid-provider
budgets and runtime enforcement remain unavailable.

## 6. Infrastructure controls

- Managed services with auto-scaling caps and budget alerts.
- Preview environment expiry.
- Log/trace sampling and retention tiers with sensitive-data safeguards.
- Object lifecycle and image/audio variants.
- Query/index review before scaling database size.
- Queue retry/dead-letter limits to prevent storms.
- CDN cache public content; never cache private/payment content in shared layers.

## 7. Contribution model

For each product/cohort:

```text
Net revenue
- tax borne by merchant/MoR
- payment/crypto provider fees
- refunds and chargeback losses
- AI inference
- incremental compute/storage/notification
- content/license/royalty allocation
- support allocation
= contribution before fixed overhead and acquisition
```

Track subscription and one-time goods separately. Do not use gross revenue as evidence of sustainable economics.

## 8. Unit metrics

- AI cost per deterministic/complete interpretation.
- Cost per WMRS.
- Payment cost and success by provider/country/method.
- Refund/chargeback loss per order.
- Gross and contribution ARPPU.
- LTV range with retention uncertainty.
- CAC/payback only after attribution/data quality are credible.
- Free-to-paid subsidy and content-acquisition contribution.

## 9. Cost anomaly actions

Automation may:

- Alert and annotate.
- Reduce non-critical background concurrency.
- Pause non-essential content generation.
- Use an approved fallback model/template.
- Disable an abusive endpoint via preapproved rate controls.

It may not degrade safety, payment integrity, backups, privacy rights, or existing paid entitlements. Material user-facing degradation requires owner awareness.

## 10. Vendor concentration

Maintain a vendor register with spend, data handled, contract/renewal, lock-in, substitute, export path, outage fallback, and termination impact. Prioritize exit plans for AI, payment, database, auth, and astrology providers.
