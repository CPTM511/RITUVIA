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

## 7. Search content architecture

### Tarot clusters

- Individual card pages: upright/reversed, symbols, reflection questions, actions, source notes.
- Spread guides and interactive tools.
- Theme guides: love, work, creativity, decisions—without guaranteed outcomes.
- Educational methodology and ethical use.

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
fixed subject, preview, body, and private-route action contain no reflection details and remain
safe for lock screens. Locale is reread at claim/authorization time and unsupported locales fail
closed. RIT-104 owns reviewed localized templates and fallback previews; production legal copy,
email domain/provider, and sending remain owner-gated.

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
