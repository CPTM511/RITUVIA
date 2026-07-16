# Country Policy Engine Instructions

These instructions apply to `packages/country-policy/**`.

## Role

Return a versioned, auditable decision for what a user may see or buy in a jurisdiction and context. It is a policy engine, not a geo-IP truth oracle or legal opinion generator.

## Inputs

Use only justified inputs such as declared country, billing country, IP-derived country with confidence, locale, age/consent status, product, currency, provider approval, legal version, and feature rollout. Resolve conflicts conservatively and allow correction where lawful.

## Outputs

A typed decision includes:

- Allowed/denied/degraded status and reason code.
- Available methods/features/products.
- Fiat/crypto providers and currencies.
- Required disclosures/consents/age gates.
- Data-location/retention or support constraints where applicable.
- Policy version, evidence references, effective date, and next review date.

## Rules

- Default deny for unapproved paid combinations; allow safe free reflective features where lawful and specified.
- Never infer religion, ethnicity, legal status, or vulnerability from location/language.
- Do not hide denials behind generic payment failures; show a calm, accurate user message without exposing risk rules.
- Policy changes are data/config plus review evidence, not ad hoc conditionals scattered across code.
- Support dry-run comparison before activation and instant rollback/kill switch.

## Testing

Maintain decision tables for every launch country/provider/product and regression tests for boundary, conflict, stale evidence, missing input, and rollback. A policy record without owner/legal/provider evidence cannot enable paid production use.
