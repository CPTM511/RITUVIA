# Product Requirements Document

## 1. Requirement conventions

- `MUST`: required for launch or safety.
- `SHOULD`: expected unless evidence justifies deferral.
- `MAY`: optional enhancement.
- Every requirement must map to backlog tasks and tests before release.

## 2. Global shell and navigation

### MUST

- Responsive header, footer, primary navigation, account controls, locale selector, legal/trust links, and accessible skip navigation.
- Locale-prefixed URLs and canonical/hreflang behavior.
- Server-rendered public pages with no login requirement.
- A clear distinction between educational content, deterministic calculation, and AI interpretation.
- A persistent privacy-safe way to resume an in-progress anonymous flow on the same device.
- Feature flags and country policy checks at page, API, checkout, and job boundaries—not UI only.

### Primary public routes

- Home.
- Tarot, astrology, numerology hubs.
- Individual educational/calculator pages.
- Sanctuary and ritual explanation.
- Pricing/catalog.
- About/methodology/safety/cultural integrity.
- Help/refunds/contact.
- Legal and privacy pages.

## 3. Anonymous identity and account conversion

### MUST

- Create a random anonymous subject identifier without collecting email.
- Store only essential anonymous session data with defined expiry.
- Permit a first tarot/numerology experience without signup.
- Offer account creation after value is delivered, to save history, sync, subscribe, or purchase.
- Merge anonymous artifacts into the new account exactly once, with idempotency and audit logging.
- Support magic-link/passkey and approved social auth through an adapter.
- Protect against account enumeration and brute force.
- Provide account sessions, device/session management, logout everywhere, export, and deletion.

### Edge cases

- Anonymous session expires during flow.
- User signs in to an account that already has a reading with same idempotency key.
- Two tabs convert at once.
- Email link opens in a different browser/device.
- User rejects non-essential cookies/storage.

## 4. Safe question intake

### MUST

- Offer structured themes: self, relationships, work, creativity, transition, grief, courage, gratitude, release, and open reflection.
- Give examples of agency-preserving questions, such as “What perspective could help me approach this conversation?”
- Detect and intercept requests for medical diagnosis, legal outcome, investment certainty, death timing, criminal guilt, coercive relationship control, self-harm, supernatural persecution, or guaranteed outcomes.
- Preserve dignity: explain the boundary, offer a safe reframing, and show crisis/professional resources when appropriate.
- Never send intercepted high-risk raw content to marketing analytics.

## 5. Tarot

### Launch modes

1. One card: theme + perspective + reflection question + small action.
2. Three cards: Situation / Action / Possibility.

### Later modes

- Relationship dynamics without mind reading or guaranteed reunion.
- Choice exploration without telling the user what will objectively happen.
- Weekly/monthly theme.

### MUST

- Use a server-authoritative cryptographically secure draw, with a recorded deck version and draw order.
- Support upright/reversed cards as a configurable product rule.
- Prevent client tampering and duplicate paid draw creation.
- Show card title, orientation, visual, concise canonical meaning, AI interpretation, limitations, reflective question, and action.
- Provide a “draw again” rule that does not encourage compulsive rerolling; enforce product limits and explain them calmly.
- Make results savable, shareable in redacted form, and continuable into intention/ritual.
- Never include the user's private question on a share card by default.

### Content model

Every card/orientation must have versioned meanings by theme, constructive tension, shadow/limitation, questions, actions, cultural/source notes, and translation status.

## 6. Numerology

### Launch calculations

- Life Path Number.
- Birthday Number.
- Personal Year.
- Optional Expression/Name Number only for language systems with an approved mapping.

### MUST

- Show the input, formula, reduction steps, master-number rule, locale/alphabet rule, and result.
- Keep calculations deterministic and separately testable.
- Do not apply a Latin-letter name mapping to non-Latin scripts without a documented locale method.
- Treat names as sensitive profile data; do not put them in URLs, analytics, or logs.
- Let the AI explain the result but not alter the number.

## 7. Western astrology

### Launch scope after licensing approval

- Birth date, local time, place, time zone, and uncertainty handling.
- Sun, Moon, Ascendant, planets, houses, major aspects, and a basic natal overview.
- Clear confidence messaging when birth time is unknown or approximate.

### MUST

- Use a licensed deterministic ephemeris/provider behind an adapter.
- Resolve historical time zone and geolocation with traceable provider data.
- Store UTC instant, original local input, location identifier, time-zone version/source, and confidence.
- Make every calculated position reproducible from stored inputs and engine version.
- Never allow AI to invent placements or aspects.
- Support deletion and redaction of birth profiles independently from the whole account.
- Treat relationship comparison as a later, separately consented feature.

### Blocker

No production natal-chart release until the engine license and usage rights are documented.

## 8. Interpretation engine

### MUST

- Assemble structured deterministic facts, user-selected theme, approved content excerpts, safety state, locale, tone, and output schema.
- Return typed sections: summary, symbols, possibilities, limits, reflection questions, small action, optional ritual suggestion, safety note, source/version metadata.
- Validate schema and all deterministic references before display.
- Run post-generation checks for certainty, high-stakes advice, fear, dependency, fabricated facts, cultural mixing, and disallowed claims.
- Fall back to a reviewed deterministic template when generation fails or is unsafe.
- Label AI-generated explanations clearly.
- Allow users to report content and request regeneration with a reason, without creating an unlimited compulsive reroll loop.

## 9. Intention

### MUST

- Let the user select or write one concise intention in their own words.
- Suggest an agency-based wording, not magical control of another person.
- Associate the intention with a reading or create it independently.
- Offer one small action, due/revisit date, privacy state, and reminder preference.
- Permit editing, completion, archive, and deletion.
- Never publicly expose the intention by default.

## 10. Digital sanctuary and ritual

### Ritual flow

1. Choose a purpose/theme.
2. Review or write the intention.
3. Choose a free or owned ritual object.
4. Enter a focused full-screen ritual scene.
5. Perform accessible interactions: light, place, breathe, listen, write, or pause.
6. Complete and record the ritual.
7. Optionally journal and choose a revisit.

### MUST

- Always provide at least one free candle and one free incense experience.
- Paid objects may change art, animation, sound, arrangement, duration, memory, or collection status only.
- Clearly state that virtual objects are symbolic digital experiences and do not guarantee an external result.
- Respect reduced-motion, muted-audio, no-audio, keyboard-only, and screen-reader modes.
- Do not use autoplay audio without consent.
- Provide a clear end state; do not optimize for endless ritual duration.
- Save completion, object, intention reference, duration class, and optional reflection—but not invasive behavior telemetry.
- Support graceful degradation when animation, audio, or WebGL is unavailable.

## 11. Catalog, entitlements, and purchases

### Product types

- Subscription plan.
- One-time reading/report.
- Sanctuary theme.
- Ritual object/collection.
- Occasion pack.
- Gift entitlement, only after legal/refund design.

### MUST

- Show localized title, exact digital contents, price/currency, tax treatment, subscription cadence, renewal/cancellation, expiration, refund eligibility, and country availability before checkout.
- Buy a named product directly; no prepaid credit wallet.
- Use immutable catalog version and price snapshot on every order.
- Grant entitlement only after verified payment state.
- Make entitlement handling idempotent and reversible for refund/chargeback.
- Preserve purchased access according to the published product terms even if catalog content changes.
- Provide purchase history, invoices/receipts link, subscription management, cancellation, and refund request path.

## 12. Fiat checkout

### MUST

- Provider-hosted checkout or secure payment elements.
- Country-policy check before session creation and again on webhook fulfillment.
- Explicit consent for recurring billing.
- Signed webhook verification, replay protection, idempotency, out-of-order handling, and reconciliation.
- States: created, pending, authorized, paid, failed, canceled, refunded, partially_refunded, disputed, chargeback_lost.
- No client-trusted amount, currency, product, discount, tax, or entitlement.
- Customer-facing failure/retry states that do not duplicate orders.

## 13. Cryptocurrency checkout

### MUST

- Hidden unless country, provider, product, amount, and asset are approved.
- Third-party hosted and non-custodial.
- No platform-created wallet, keys, deposit address custody, exchange, transfer, or user balance.
- Clear network/asset, quote expiry, confirmation state, refund method, volatility, and finality disclosures.
- Reconcile provider settlement rather than blockchain assumptions in product code.
- Require separate owner approval before production activation.

## 14. Journal and history

### MUST

- Private by default and excluded from product analytics/search indexing.
- Rich-enough text entry without executing arbitrary HTML/Markdown.
- Associate entries with reading, intention, ritual, and revisit while allowing standalone entries.
- User-controlled tags/mood using non-clinical language.
- Search and filter performed with privacy-aware design.
- Export in human-readable and machine-readable forms.
- Delete one item, a date range, a birth profile, or the account according to policy.
- Do not train models on journal/prayer content without a separate explicit opt-in product and legal review.

## 15. Revisit and reminders

### MUST

- Offer optional next-day, seven-day, or user-selected revisit.
- Let users compare original intention/action with what occurred, without “the cards were right” framing.
- Respect time zone, locale, notification consent, quiet hours, frequency cap, unsubscribe, and channel preference.
- Avoid emotionally coercive copy, streak loss, or urgency.
- Notification content must not expose sensitive question/ritual details on a lock screen by default.

## 16. Share cards

### MUST

- Opt-in only.
- Default to card/number/theme and a generic reflection line; omit private question, birth data, journal, and intention.
- Provide preview and redaction controls.
- Generate localized accessible alt text.
- Include canonical URL and unobtrusive brand attribution.
- Prevent Open Graph metadata from exposing private data.

## 17. Subscription and usage limits

### MUST

- Entitlements, not scattered plan checks, govern access.
- Limits are transparent and consistent across Web/API/job layers.
- Provide non-coercive limit messages and a free next step.
- Cancellation must be simple; access behavior after cancellation is explicit.
- Trial, discount, grace, retry, and dunning behavior require owner-approved policy.
- Never use repeated frightening predictions to convert.

## 18. Privacy center

### MUST

- Plain-language summary of collected data and purpose.
- Consent and preference controls.
- Download/export request.
- Delete readings, entries, birth profile, or entire account.
- Manage AI data use and optional personalization.
- Manage email/notification consent.
- Show active sessions and revoke them.
- Explain retention and delayed deletion where legally required.
- Track request state and verify identity for high-risk actions.

## 19. Admin and operations

### Roles

- Owner/superadmin.
- Content editor.
- Support/refund reviewer.
- Risk/safety reviewer.
- Analyst/read-only.

A one-person company may use only the owner initially, but authorization boundaries must exist.

### MUST

- Content, card meanings, numerology rules, ritual scripts, translations, prompt versions, and source metadata.
- Catalog, prices, products, entitlements, country policy, payment-provider routing, and feature flags.
- Orders, subscriptions, refunds, disputes, webhook/event timeline, and reconciliation.
- Safety reports, AI traces with redaction, user reports, and crisis-event metadata.
- Experiments, locale rollout, content publishing, SEO metadata, and redirects.
- Audit log of all privileged changes.
- Two-step confirmation for high-impact actions and no mass destructive default.

## 20. Support

### MUST

- Searchable help center.
- Contact form with category, locale, order reference, and safe attachment policy.
- Automated acknowledgement and triage.
- Never ask users to email full card details, private keys, passwords, or sensitive journal content.
- SLA tiers for payment, safety/privacy, access, and general content.
- Escalate legal/privacy/safety and chargeback matters to the owner.

## 21. Country Policy Engine

Each policy version MUST govern:

- Service availability.
- Minimum age and verification requirement.
- Allowed modalities and terminology.
- Required disclaimers/legal documents.
- Allowed products and subscriptions.
- Fiat provider/methods/currencies.
- Crypto availability/assets/provider.
- Tax/Merchant-of-Record path.
- Refund/cancellation behavior.
- Data residency/retention flags.
- Supported languages and support channels.
- Marketing restrictions.

Policy is evaluated server-side and attached to orders/readings for auditability.

## 22. Performance and availability targets

Initial targets, to be validated with real usage:

- Public content LCP p75 ≤ 2.5 seconds on mobile field data.
- Interaction latency p75 ≤ 200 ms for local UI response.
- Deterministic reading creation API p95 ≤ 800 ms excluding AI generation.
- Streaming first interpretation token p95 ≤ 3 seconds where provider permits; deterministic fallback always available.
- Checkout creation p95 ≤ 2 seconds excluding provider page load.
- Core service monthly availability objective 99.9% after public launch.
- Zero loss of confirmed paid entitlements under duplicate/reordered webhook tests.

## 23. Release acceptance

A capability is not release-ready until the relevant requirements have traceable tests, analytics, security/privacy review, localized content status, observability, support documentation, and rollback behavior.
