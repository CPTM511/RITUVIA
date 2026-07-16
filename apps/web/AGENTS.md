# Web Application Instructions

These instructions apply to `apps/web/**` and override broader repository guidance where they are more specific.

## Mission

Build the public English-first, multilingual Web/PWA experience for RITUVIA. The product must feel calm, trustworthy, emotionally warm, private, accessible, and fast—never manipulative, occult-horror themed, casino-like, or falsely authoritative.

## Architecture and boundaries

- Use Next.js App Router with server components by default and client components only for real interactivity.
- Keep domain calculations and policy decisions in shared packages. UI code must not reimplement tarot, astrology, numerology, entitlement, payment, or country-policy logic.
- All server actions and route handlers validate input, authorize access, enforce rate limits where needed, and return typed errors.
- Do not import provider SDKs directly into pages/components. Use application services and adapters.
- Treat every route as potentially indexed, localized, shared, and rendered at narrow mobile widths.

## Required route families

- Public: home, methods, tarot, astrology, numerology, sanctuary explanation, pricing, trust/safety, privacy, terms, accessibility, editorial articles, help.
- Experience: onboarding, reading setup, results, intention, ritual, journal, revisit, account, purchases, subscription, data/privacy controls.
- Shared: loading, empty, error, retry, offline/degraded, maintenance, age/country restriction, payment unavailable.

## UX rules

- Preserve the canonical loop: Question → Interpretation → Intention → Ritual → Journal → Revisit.
- Always offer a meaningful free path. Paid objects enhance presentation, ambience, duration, collection, or personalization—not spiritual efficacy.
- Interpretation pages distinguish deterministic facts, symbolic interpretation, user reflection, and suggested action.
- Never use countdowns, fake scarcity, fear, shame, “your fate is blocked,” or repeated upsells after emotional content.
- Do not expose private question, prayer, journal, birth-time, or relationship text in URLs, metadata, analytics, logs, notifications, share previews, or browser history labels.
- Sharing is opt-in and defaults to a privacy-safe card without private text.

## Accessibility and responsive requirements

- Meet WCAG 2.2 AA as a release floor.
- Full keyboard operation, visible focus, semantic landmarks/headings, form labels, error association, screen-reader announcements, reduced-motion behavior, and sufficient contrast are mandatory.
- Minimum touch target 44×44 CSS pixels where practical.
- Support 320px width through wide desktop, zoom to 200%, long translations, and RTL mirroring.
- Animations must pause/disable under reduced motion and must never block task completion.

## Localization

- No production copy is hardcoded in components; use typed message keys.
- Locale comes from a validated routing strategy; never infer sensitive traits from language.
- Use locale-aware dates, numbers, currency, time zones, names, pluralization, and text direction.
- Metadata, structured data, sitemap, canonicals, and hreflang must match rendered locale/content.
- Fallback to English is explicit and observable, not silent corruption.

## SEO/GEO

- Public educational pages must be useful without login, answer-first, original, source-governed, and internally linked.
- Reading results, journals, sanctuaries, account pages, checkout, and sensitive/private routes are `noindex` and excluded from sitemaps.
- Structured data must match visible content and must not make medical, financial, legal, supernatural, or outcome guarantees.
- Provide crawlable semantic HTML; do not hide essential content behind client-only rendering.

## Performance

- Set and enforce budgets for JavaScript, images, fonts, LCP, INP, CLS, and API latency.
- Prefer local/optimized assets, responsive images, route-level code splitting, caching with safe invalidation, and streaming where useful.
- No remote third-party script without documented necessity, consent classification, security review, and performance budget.

## Testing and completion

For changed user-facing flows, add/update:

- Component/unit tests for behavior and state.
- Accessibility checks.
- Locale/RTL snapshots or assertions.
- Mobile and desktop E2E happy path plus failure/degraded path.
- Metadata/canonical/noindex tests where relevant.
- Visual regression tests only for stable high-value screens; do not use them to replace behavioral assertions.

Before finishing, test the full affected loop in a real browser and inspect console/network errors. Never claim visual verification from source inspection alone.
