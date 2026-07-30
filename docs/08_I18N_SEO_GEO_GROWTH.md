# Internationalization, SEO, GEO, and Ethical Growth

## 1. Global strategy

Build one global product architecture, then activate languages and countries in reviewed waves. Language availability does not automatically mean paid service or every modality is legally/payment-supported in that country.

## 2. Locale roadmap

### Tier 0 — launch

- English: `en` with locale variants introduced only where content/legal differences require them.

### Tier 1 — first expansion

- Latin American Spanish: `es-419`.
- Brazilian Portuguese: `pt-BR`.
- French: `fr`.
- German: `de`.

### Tier 2 — high-value localization

- Japanese: `ja`.
- Korean: `ko`.
- Simplified Chinese: `zh-Hans`.
- Traditional Chinese: `zh-Hant`.
- Hindi: `hi`.
- Arabic: `ar` with full RTL.
- Indonesian: `id`.

### Tier 3 — evidence-led

- Italian, Turkish, Polish, Dutch, Vietnamese, Thai, and other locales after search demand, payment eligibility, content capacity, and support readiness are validated.

Use BCP 47 locale identifiers. Country policy and locale are separate dimensions.

## 3. Internationalization architecture

### MUST

- Locale-prefixed canonical paths such as `/en/tarot/one-card`.
- Source-language message keys, ICU plural/select support, number/date/time/currency/unit formatting, relative time, list formatting, and time zones.
- No concatenated translated fragments.
- No UI copy in business logic.
- Locale-aware content slugs with stable internal IDs and redirect history.
- Server and client resolve the same locale deterministically.
- Fallback chain is explicit and visible to editors; never silently mix languages in a user flow.
- RTL layout primitives and directional icon handling.
- Locale-specific font stacks and line-breaking rules.
- Translation status blocks public publication when required content is missing.
- Legal/payment/safety copy may require country-specific variants beyond generic translation.

## 4. Translation workflow

1. English source content reaches `source_ready` with clear context, screenshots, variables, character constraints, and source references.
2. Machine draft MAY accelerate low-risk UI copy.
3. Human or qualified reviewer checks spiritual/cultural, safety, legal, payment, and marketing content.
4. Automated QA checks placeholders, ICU syntax, glossary, forbidden terms, links, length, markup, and untranslated strings.
5. In-context preview tests mobile, desktop, dark mode, and RTL.
6. Reviewer approves locale/content version.
7. Publish behind locale/country feature flags.
8. Monitor search, support, reports, and fallback rate.

Never auto-publish machine translations of interpretations, spiritual claims, crisis resources, legal terms, payment terms, or culturally specific rituals.

## 5. Terminology and style

Maintain a per-locale glossary for:

- Product name/tagline.
- Reading, interpretation, intention, ritual, sanctuary, journal, revisit.
- Tarot card/spread names.
- Astrology planets/signs/houses/aspects.
- Numerology terms and calculation rules.
- Subscription, renewal, refund, digital product, hosted crypto checkout.
- Safety and professional-advice boundaries.

Allow cultural adaptation where literal translation would mislead. Record deviations.

## 6. Technical SEO foundation

### MUST

- Server-rendered meaningful HTML.
- Unique title, description, canonical, Open Graph, and structured data.
- XML sitemap indexes by locale/content type, updated timestamps based on substantive change.
- Correct hreflang pairs including self-reference and optional `x-default`.
- Robots directives at page and environment level; preview/staging never indexable.
- Clean stable URLs and redirect registry.
- Breadcrumbs and contextual internal links.
- Fast mobile performance and image/font optimization.
- No private, user-generated, paywalled-sensitive, query-string, checkout, admin, or account pages in search.
- Search Console/Bing-style verification and crawl/index monitoring through adapters/operational checks.

RIT-103 implements this boundary through stable route IDs and approval-bound locale records.
English is the only published locale. `/sitemap.xml` is a production-only index over exact
non-empty locale/content-type shards, and canonical/hreflang/redirect targets derive from the same
reviewed matrix. Synthetic locale fixtures test localized slugs and same-locale stale redirects
without entering runtime. A real locale still requires owner selection, reviewed content,
localized messages/support, country alignment, and launch approval; missing content never falls
back into an indexable mixed-language route.

RIT-102 adds test-only CJK and Devanagari engineering evidence without publishing another locale.
Local fallback stacks, script-specific line breaking/shaping, actual platform-font inspection,
hydrated composition input, NFC private-text preservation, legitimate ZWJ/ZWNJ support, and
locale/time-zone formatting are CI-gated. NFKC may be used on an isolated safety-matching copy but
must not rewrite stored user-authored text. Native and deterministic dates retain explicit
Gregorian ISO values independent of localized display.

## 7. Search content architecture

### Tarot clusters

- Individual card pages: upright/reversed, symbols, reflection questions, actions, source notes.
- Spread guides and interactive tools.
- Theme guides: love, work, creativity, decisions—without guaranteed outcomes.
- Educational methodology and ethical use.

RIT-111 publishes a finite D-081-approved English cluster with one hub, 22 Major Arcana card pages, and
two spread guides. Upright and reversed meanings remain sections of the same card page; themes,
personalized results, and high-risk keywords never become indexable route variants. The cluster
binds the exact approved local catalog and enters routes, robots, and sitemaps only through the
production publication-integrity gate. It remains unavailable to AI retrieval; D-081 binds the exact
candidate digest, SEO rights, reviewer evidence, and 25-route inventory.

### Astrology clusters

- Signs, planets, houses, aspects, chart basics.
- Calculators with transparent astronomical inputs/method.
- Birth-time uncertainty and time-zone education.
- Transit/period content only when deterministic data is correct.

### Numerology clusters

- Number meanings and calculation guides.
- Life Path and Personal Year calculators.
- Locale/alphabet methodology pages.
- Worked examples using synthetic names/data.

The first approved English cluster is intentionally smaller than the general roadmap inventory:
`/en/numerology` links to substantive Life Path, Birthday Number, Personal Year, and master-number
guides. The private calculator remains at `/en/readings/numerology` and is not indexable. The
twelve approved number profiles are editorial and AI source records, not public routes; creating
keyword-substitution profile pages requires a new quality review rather than automatic expansion.
All five public documents use synthetic date examples, exact RITUVIA V1 arithmetic, visible
source/review notes, canonical and `hreflang` metadata, breadcrumbs, JSON-LD, sitemap timestamps,
and explicit non-scientific/non-predictive boundaries.

### Ritual/reflection clusters

- Intentions, journaling prompts, symbolic ritual guides, mindful pauses, occasion rituals.
- Emphasize practical reflective value and transparent cultural context.

## 8. Programmatic SEO quality bar

A generated/indexable page MUST have:

- A real user intent and unique answer.
- Deterministic/calculated or editorial utility that cannot be replaced by swapping one keyword.
- Original structured explanation, examples, caveats, and internal links.
- Source/content version and editorial ownership.
- Index/noindex decision based on quality and demand.
- No personalized/private data.
- No unsupported health, legal, financial, or supernatural claims.
- Duplicate/cannibalization checks.

Do not generate millions of combinations. Start with a curated inventory, measure crawl/index/engagement, and expand only where quality remains high.

## 9. GEO: generative-engine discoverability

GEO is not keyword stuffing for AI. Make RITUVIA a clear, attributable, structured source:

- Answer the main question near the top in plain language.
- Use stable entity names and definitions.
- Distinguish fact, tradition, interpretation, and product policy.
- Provide concise tables, FAQs, examples, and transparent calculations.
- Expose author/editor, review date, source references, methodology, and revision history where useful.
- Use semantic HTML and structured data.
- Keep pages accessible without scripts or login.
- Maintain unique canonical content rather than paraphrasing competitors.
- Build quotable factual explanations without sensational claims.
- Monitor referral/citation patterns where analytics permit, but do not create content solely for bots.

## 10. Structured data

Use only types accurately matching visible content, such as:

- `Organization` / `WebSite`.
- `Article` / `HowTo` where requirements are genuinely met.
- `FAQPage` only when visible and eligible.
- `BreadcrumbList`.
- `Product` and `Offer` for exact purchasable digital products, including truthful availability/pricing.
- `SoftwareApplication` if the product page qualifies.

Never mark AI interpretations as medical/professional advice or use review/rating schema without legitimate visible data.

## 11. Acquisition channels

Priority order:

1. Organic search and useful calculators/libraries.
2. Shareable redacted result cards.
3. Email/revisit reminders with consent.
4. Creator/editorial partnerships with transparent sponsorship.
5. Referral/gifting after fraud and consent design.
6. Paid acquisition only after activation, retention, refunds, and unit economics are understood.

Avoid high-pressure “your soulmate is…” ads, crisis targeting, protected/sensitive trait targeting, or creatives implying guaranteed outcomes.

## 12. Lifecycle communication

- Welcome after value, not before.
- Reminder based on user-selected intention/revisit schedule.
- Weekly reflection summary only with consent.
- Product/payment/service messages separated from marketing consent.
- Frequency caps, quiet hours, locale/time zone, unsubscribe, and preference center.
- Lock-screen-safe subject lines; no private question, ritual, or relationship detail by default.
- No re-engagement that uses fear or claims the user's energy/window is closing.

RIT-045 activates only an English once-only Revisit email contract for signed-in accounts. The
subject, preview, body, and private-route action contain no reflection details and remain safe for
lock screens. Locale is reread at claim/authorization time and unsupported locales fail closed.

RIT-104 replaces hardcoded Worker copy with a checksummed `lifecycle_messages` source/runtime
catalog and semantic HTML/plain-text renderers for the Revisit reminder and a support-receipt
preview. Exact template ID, version, source checksum, locale, and fallback state are persisted and
checked again before provider use. Delivery suppresses unsupported locales; only explicit local
preview may fall back to English, with one deduplicated non-identifying event. The reminder
preference URL is GET-safe and focuses the control without mutating consent. English remains the
only authorized message locale. Production legal/unsubscribe text, support address and service
level, email domain/provider, scheduling, actual sending, and any non-English activation remain
owner-gated.

## 13. Ethical conversion

Measure conversion while preserving autonomy:

- Explain paid depth before checkout.
- Provide a useful free result and ritual.
- Offer upgrade after a completed value moment.
- Use transparent comparison, not deliberately crippled free output.
- Do not personalize price or urgency from sensitive content.
- Do not A/B test manipulative safety/legal disclosures away.

## 14. SEO/GEO analytics

Track by locale and content type:

- Valid indexable URLs, crawl errors, canonical/hreflang errors.
- Impressions, clicks, CTR, position, indexed ratio.
- Organic landing → first useful result → core-loop completion.
- Content-assisted signup/paid conversion.
- Search query intent categories without storing unnecessary sensitive terms.
- Backlinks/mentions and generative referral/citation signals where detectable.
- Page quality: engagement, return, report rate, support issues, freshness.

## 15. Growth automation

Codex/automation may:

- Identify content gaps from approved, privacy-safe search data.
- Draft briefs, outlines, metadata, internal links, schema, and translations.
- Run duplicate, source, claim, link, accessibility, and localization checks.
- Open review PRs.

It may not automatically publish culturally sensitive, legal, safety, payment, or high-stakes content; change pricing; buy ads; send mass campaigns; or launch a locale/country without owner approval.

### 15.1 Offline search operations contract

RIT-117 and D-087 bind weekly search operations to one exact seven-day UTC window and the current
45-route reviewed inventory. Crawl, index, query, and consented referral evidence enters only
through a bounded offline aggregate file. The operation performs no provider request and rejects
raw queries, full referrer URLs, user identifiers, private content, arbitrary metadata, symlinks,
oversized files, path drift, and authority accessors.

Every stream names its source kind, approval reference, observed-through time, maximum age, and
freshness. Crawl evidence expires after 24 hours, index and query exports after 96 hours, and
referral aggregates after 72 hours. Unavailable, stale, or synthetic evidence produces null
performance values and a blocked decision status rather than an inferred trend. Query or referral
route detail is suppressed below 20 observations; 20–199 observations are diagnostic only; a
performance recommendation requires at least 200 observations. Referral denominators separately
report included, other/unknown, excluded, and useful-action sessions.

The resulting JSON and Markdown bind SHA-256 digests for the input, public-page inventory, and
editorial authority. Recommendations are human-review investigation prompts only. They cannot
publish or rewrite content, request indexing, expand routes, activate a locale, connect a provider,
change metadata, or alter production.

## 16. Ritual and reflection publication boundary

RIT-112 and D-082 approve exactly six English paths: one `/en/rituals` hub plus virtual
candle, virtual incense, intention-and-small-action, private-reflection-journal, and
revisit-a-reflection guides. They are distinct answer-first explanations of RITUVIA's original
secular product loop, not historical or religious practice claims and not a template for
occasion-, relationship-, belief-, outcome-, or profile-keyword expansion.

The exact approved artifact is registered in the shared editorial repository and active localized
route registry. Its metadata remains noindex in local, preview, and staging and becomes indexable
only when the production publication inventory is current. The six URLs occupy one dedicated English
ritual sitemap shard and no other ritual path may enter robots or sitemap output. Activation does
not approve deployment, DNS, public launch, another locale, a regional tradition, personalized
results, user-submitted journal text, AI retrieval, physical fire/smoke instructions, or efficacy
claims.

## 17. Public-page inventory and quality authorization

RIT-113 and D-083 bind every active public route to one checked-in record generated from the
approval-bound route registry and its current reviewed source. The inventory contains exactly 45
English pages across core, numerology, astrology, Tarot, and ritual/reflection families. Each
record carries stable route, locale, family, shape, intent, canonical, authority, source-set
digest, review, content digest, structured substance, internal-link, and nearest-page similarity
evidence.

The offline deterministic gate uses exact normalized content, three-token Jaccard, five-token
containment, explicit intent ownership, and family-specific structure. It rejects exact and bounded
near duplicates, keyword/template substitution, short-page containment, thin or padded pages,
canonical or intent collisions, stale authority, missing links, and any private, personalized,
query-bearing, framework, unknown, or unapproved route. It sends no content to an external
provider.

Canonical/hreflang, robots, sitemap, production configuration, and build validation consume the
same complete inventory. Any missing, extra, stale, malformed, duplicated, expired, or failing
record suppresses the entire crawl inventory: canonical alternates are omitted, metadata is
noindex, robots disallows all, and sitemap output is unavailable. Expanding the inventory still
requires the original content, locale, country, deployment, and public-launch approvals.

## 18. Structured-data and crawl authorization

RIT-114 and D-084 emit one minimal JSON-LD graph node from the complete current public-page
inventory. The reviewed mapping is `WebSite` for the product landing page, `WebPage` for the three
public trust articles, `CollectionPage` for the four education hubs, and `Article` for the 37
approved guides. Each node binds the exact canonical URL, English language, visible H1, and a
description present in visible main content.

Page hierarchy is explicit evidence, not a caller-supplied guess. Core trust pages and family hubs
belong to the English home page; every guide belongs to its exact family hub and must visibly link
to it. Breadcrumb schema is omitted because no visible breadcrumb UI exists. Author, publisher,
date, FAQ, HowTo, Product, Offer, rating, and review claims remain denied until visible source
authority exists.

Build and production HTTP gates validate all 45 approved routes. A focused Chromium gate covers
all four schema types, representative content families, private-canary exclusion, local-only
requests, and inert script-breaking input. These checks do not constitute Search Console
verification, deployment, public launch, or actual indexing approval.

## 19. Localized private-result share output

RIT-115 publishes no result URL and no private social metadata. The English one-card artifact uses
the governed ICU source catalog for accessible text and includes only the stable public
`/en/tarot` canonical inside the local SVG and explicit native-share payload. The private
`/en/tarot/one-card` document remains noindex with no canonical, Open Graph, or Twitter output.

Production projection accepts only an active reviewed locale. `en-XA` and `ar-XB` remain test-only
and are rejected before projection; tests construct serializer-only fixtures to verify expanded
LTR and RTL geometry without authorizing a route, translation, hreflang, sitemap entry, or share
output. Every future locale needs reviewed source/translation evidence and the existing
owner-approved language launch decision.
