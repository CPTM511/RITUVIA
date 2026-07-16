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

## 5. AI cost controls

- Use the smallest model that passes the quality/safety eval for a task; reserve the strongest reasoning model for architecture, safety, complex interpretation, and review.
- Keep prompts/context minimal and structured.
- Cache only non-private, version-safe reusable content.
- Use deterministic/template fallback for failure and low-value cases.
- Cap output length and regeneration.
- Batch offline eval/content tasks where safe.
- Track cost per completed meaningful loop, paid conversion, and retained user—not only per request.

Cost savings may never allow wrong deterministic facts or weaker safety.

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
