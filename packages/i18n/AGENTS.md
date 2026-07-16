# Internationalization Instructions

These instructions apply to `packages/i18n/**` and translation resources.

## Locale strategy

- Launch source locale: `en`.
- Planned priority: `es-419`, `pt-BR`, `fr`, `de`; then `ja`, `ko`, `zh-Hans`, `zh-Hant`, `hi`, `ar`, `id` based on evidence and review capacity.
- Architecture supports arbitrary valid BCP 47 locales, but public launch requires content, safety, legal, support, SEO, and QA readiness—not only translated strings.

## Engineering rules

- Typed keys and compile-time missing-key detection where possible.
- ICU-compatible plural/select grammar; no string concatenation that breaks grammar.
- Locale-aware number, currency, percentage, date, time, relative time, list, and display-name formatting.
- Explicit locale fallback chain and observable fallback rate.
- Separate language, region, currency, country policy, and time zone; never assume one from another without user control.
- Full RTL support: logical CSS properties, mirrored direction-sensitive icons, bidi isolation, and mixed-script tests.

## Translation governance

- Keep source, translation, glossary, context note, status, reviewer, model/vendor, and version metadata.
- Lock protected terms and product/legal/safety glossaries.
- Machine translation is draft-only for high-impact content until qualified review.
- Do not translate sacred/culturally specific concepts into false equivalents; retain original terms with contextual explanation where needed.
- Avoid gender, relationship, family, religion, and name assumptions.

## QA

Every locale launch requires automated key/placeholder/markup checks plus human or qualified review for core loop, payment, legal, privacy, crisis/safety, emails, notifications, metadata, and top landing pages. Test pseudo-localization, expansion, CJK wrapping, Arabic RTL, fonts, search, and locale switching without losing user state.
