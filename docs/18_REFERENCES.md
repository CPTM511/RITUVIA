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

### Swiss Ephemeris selection checked 2026-07-26

- Licensing and activation conditions: https://www.astro.com/swisseph/swephinfo_e.htm
- GNU Affero General Public License v3: https://www.gnu.org/licenses/agpl-3.0.html
- June 2026 Professional Unlimited License contract:
  https://www.astro.com/swisseph/secont_e.pdf

### Independent astronomy comparison checked 2026-07-27

- Astronomy Engine source and validation description:
  https://github.com/cosinekitty/astronomy
- Pinned JavaScript package `2.1.19` and MIT metadata:
  https://www.npmjs.com/package/astronomy-engine/v/2.1.19
- NASA/JPL Horizons observer ecliptic-of-date semantics:
  https://ssd.jpl.nasa.gov/horizons/manual.html
- Current price page: https://www.astro.com/swisseph/swephprice_e.htm
- Library `2.10.03` programming history and `2022-08-27` release date:
  https://www.astro.com/swisseph/swephprg.htm
- Official source/data repository and separately pinned `v2.10.3final` snapshot:
  https://github.com/aloistr/swisseph
- Repository record:
  `content/sources/astrology/swiss-ephemeris-agpl.v2.json`

The library release and source/data snapshot are separate provenance fields. The exact snapshot
tag/commit and per-file checksums are pinned. D-069 records the owner's whole-project AGPL approval;
it does not activate production. Method approval, independent reference vectors, commit-level SCA,
the local Linux sanitizer/fuzzer gate, and kill-switch evidence are complete. Exact clean
release-revision Corresponding Source, release CI evidence, and public source-link delivery remain
pending. The Professional contract and price links remain historical comparison sources.

### Location and historical time-zone sources checked 2026-07-26

- GeoNames export and CC BY terms: https://www.geonames.org/export/
- GeoNames downloadable dumps: https://download.geonames.org/export/dump/
- Google Time Zone API historical limitation:
  https://developers.google.com/maps/documentation/timezone/requests-timezone
- OpenStreetMap Foundation public Nominatim usage policy:
  https://operations.osmfoundation.org/policies/nominatim/
- Node.js `process.versions` runtime/ICU/tzdata provenance:
  https://nodejs.org/download/release/v24.11.0/docs/api/process.html

D-067 selects a self-hosted GeoNames export as the intended production source and pins the
historical resolver to Node `24.18.0`, ICU `78.3`, and tzdata `2026b`. No production GeoNames
snapshot is imported: exact snapshot date, file inventory, SHA-256 digest, attribution placement,
update/rollback procedure, search-index limits, and operations evidence remain required.

## 5. Legal/trademark sources

Formal brand clearance should use official WIPO, USPTO, EUIPO, UKIPO, and local registries, plus counsel and domain/company/app-store searches. A lack of public-web results is not clearance. Record execution evidence in `docs/19_NAME_CLEARANCE_WORKSHEET.md`.

## 6. Freshness rule

Any fact involving provider policy, pricing, law, platform rules, model/config behavior, country availability, tax, or security guidance must be checked against a current primary source before implementation or launch. Record the date and exact dependency in the relevant ADR/vendor register.
