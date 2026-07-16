# References and Verification Register

## 1. Internal retained artifacts

- `reference/lumora_business_plan_zh.html` — original market, business, payment, compliance, architecture, and rollout strategy. `LUMORA` is a legacy working codename.
- `reference/lumora_interactive_prototype.html` — original interactive visual concept. Use as inspiration, not production code.

## 2. Official Codex documentation

Verify against current documentation when behavior/config changes:

- Codex project instructions / AGENTS.md: https://learn.chatgpt.com/docs/codex/agents-md
- Long-running tasks: https://learn.chatgpt.com/docs/codex/long-running-work
- Subagents: https://learn.chatgpt.com/docs/codex/subagents
- Prompting: https://learn.chatgpt.com/docs/codex/prompting
- Non-interactive `codex exec`: https://learn.chatgpt.com/docs/codex/noninteractive
- Codex GitHub Action: https://learn.chatgpt.com/docs/codex/github-action
- Rules: https://learn.chatgpt.com/docs/codex/rules
- Configuration basics/reference: https://learn.chatgpt.com/docs/codex/config-basic and https://learn.chatgpt.com/docs/codex/config-file/config-reference

The included `.codex` configuration is a starting baseline as of 2026-07-16. Codex configuration/model identifiers evolve; update them intentionally through a reviewed ADR/PR.

## 3. Market/product evidence retained from the original strategy

The retained business plan contains the complete citation list and context. Key sources included:

- Pew/AP reporting on U.S. usage and industry proxy.
- Allied Market Research directionally sized astrology market.
- Astrotalk FY25 company/press reporting.
- Sadhana digital ritual usage reporting.
- Payment provider restricted/prohibited business policies.
- EU sensitive-data and AI transparency guidance.
- Swiss Ephemeris licensing information.
- Apple/Google app payment policy sources.
- Research on AI tarot and user autonomy.

Do not copy numeric market claims into public materials without re-verifying source date, methodology, and rights.

## 4. Implementation verification register

Before selecting/activating any vendor, add a source record with:

- Official product/policy/price/security/legal URL.
- Access/review date.
- Exact capability/restriction relied upon.
- Country/product scope.
- Contract/approval evidence location.
- Owner and next review date.

This applies to auth, AI, payments, crypto, tax/MoR, database, hosting, queue, storage, email, analytics, monitoring, geocoding/time zone, astrology engine, fonts, artwork, and content sources.

## 5. Legal/trademark sources

Formal brand clearance should use official WIPO, USPTO, EUIPO, UKIPO, and local registries, plus counsel and domain/company/app-store searches. A lack of public-web results is not clearance. Record execution evidence in `docs/19_NAME_CLEARANCE_WORKSHEET.md`.

## 6. Freshness rule

Any fact involving provider policy, pricing, law, platform rules, model/config behavior, country availability, tax, or security guidance must be checked against a current primary source before implementation or launch. Record the date and exact dependency in the relevant ADR/vendor register.
