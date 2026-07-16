# RITUVIA Decision Log

This is an append-only summary of accepted architectural and product decisions. Detailed decisions may use `templates/ADR_TEMPLATE.md`. Do not rewrite historical rationale; supersede it with a new entry.

## Accepted decisions

### D-001 — Product category

- **Decision:** Position RITUVIA as symbolic self-reflection, personal ritual, and a private digital sanctuary—not as an oracle that guarantees objective future outcomes.
- **Reason:** Maximizes long-term trust, safety, global portability, and differentiated retention.
- **Date:** 2026-07-16

### D-002 — Core product loop

- **Decision:** Question → Interpretation → Intention → Ritual → Journal → Revisit.
- **Reason:** Turns a one-off reading into an ethical repeatable habit and measurable product loop.
- **Date:** 2026-07-16

### D-003 — Launch modalities

- **Decision:** Launch Tarot, Western astrology, and numerology; add regional traditions only as separately sourced and reviewed content packs.
- **Reason:** Balances immediate activation, persistent personalization, SEO acquisition, and global transferability.
- **Date:** 2026-07-16

### D-004 — Anonymous first

- **Decision:** Users can complete a useful first reading before creating an account; account creation is requested at a natural save/sync moment.
- **Reason:** Reduces activation friction and supports SEO landings.
- **Date:** 2026-07-16

### D-005 — Ethical ritual monetization

- **Decision:** Free ritual access always remains. Paid objects enhance expression, appearance, sound, duration, collection, or persistence, never claimed efficacy.
- **Reason:** Protects user autonomy and reduces manipulative or payment-network risk.
- **Date:** 2026-07-16

### D-006 — No stored-value wallet

- **Decision:** Sell named digital products and subscriptions directly. Do not require prepaid credits, transferable tokens, or cash-out balances.
- **Reason:** Clearer consumer value, refunds, accounting, and payment compliance.
- **Date:** 2026-07-16

### D-007 — Modular monolith

- **Decision:** Begin with a TypeScript modular monolith and worker, with explicit package boundaries and provider adapters.
- **Reason:** Best reliability/operability tradeoff for a one-person company; preserves a path to later extraction.
- **Date:** 2026-07-16

### D-008 — Deterministic engine / AI explanation separation

- **Decision:** Tarot draws, numerology, ephemeris positions, prices, entitlements, and country policy are deterministic. AI only produces bounded explanations and reflection prompts.
- **Reason:** Reproducibility, testing, safety, and trust.
- **Date:** 2026-07-16

### D-009 — Global architecture, phased launch

- **Decision:** Engineer for global locales/countries from the start, but activate countries and languages in controlled waves.
- **Reason:** Payment, legal, cultural, and support constraints differ materially by market.
- **Date:** 2026-07-16

### D-010 — Language order

- **Decision:** Launch English. Prepare Spanish (`es-419`), Brazilian Portuguese, French, German, Japanese, Korean, Simplified/Traditional Chinese, Hindi, Arabic/RTL, and Indonesian in staged waves.
- **Reason:** Broad global reach while preserving review quality and operational control.
- **Date:** 2026-07-16

### D-011 — Payment orchestration

- **Decision:** Use adapters and a Country Policy Engine, hosted fiat checkout, and optional hosted non-custodial crypto checkout. No single provider is embedded as the product architecture.
- **Reason:** Merchant-category and country restrictions require routing resilience.
- **Date:** 2026-07-16

### D-012 — Working brand

- **Decision:** Use `RITUVIA` as the configurable working brand pending formal clearance.
- **Reason:** It communicates a ritual path, is pronounceable, and had no obvious exact-match result in preliminary public-web screening.
- **Date:** 2026-07-16
- **Caveat:** This is not legal clearance or a guarantee of domain availability.

### D-013 — Human approval boundaries

- **Decision:** Production deploys, payments, legal copy, country activation, destructive data actions, model/safety changes, and material automated spend require owner approval.
- **Reason:** A one-person AI company still needs accountable human control over irreversible and regulated actions.
- **Date:** 2026-07-16

### D-014 — Canonical sources and generated evidence

- **Decision:** Individual repository files are canonical. `RITUVIA_CODEX_BUILD_MANUAL.md` is generated from an explicit source list, and `checksums.sha256` covers every package file except itself. Rebuild the manual before regenerating checksums whenever embedded sources change.
- **Reason:** Prevents a convenient handoff artifact or stale hash from silently contradicting the live backlog, status, policy, or specifications.
- **Date:** 2026-07-16
