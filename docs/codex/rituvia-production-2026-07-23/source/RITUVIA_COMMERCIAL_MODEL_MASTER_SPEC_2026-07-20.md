# RITUVIA Commercial Model and Prototype Upgrade — Master Execution Prompt

## 1. Mission

Upgrade the current RITUVIA prototype and product architecture so that the commercial model becomes:

> Free deterministic reflection experiences + optional AI-powered deep readings + RITUVIA Plus subscription + non-transferable usage Credits + premium digital ritual objects and special rituals.

The product must remain calm, premium, private, ethically designed, and commercially viable. Payment must never be presented as making a reading, prayer, wish, or ritual more spiritually effective.

Do not perform a broad rewrite. Inspect and preserve the existing architecture, design language, tested user flows, accessibility standards, privacy rules, and anonymous-first experience.

---

## 2. Required Reality Audit

Before changing code:

1. Read all applicable `AGENTS.md` files.
2. Read:

   * `PROJECT_STATUS.md`
   * `BACKLOG.md`
   * `ROADMAP.md`
   * `DECISIONS.md`
   * `docs/00_PROJECT_CHARTER.md`
   * `docs/01_PRODUCT_REQUIREMENTS.md`
   * `docs/02_USER_EXPERIENCE.md`
   * `docs/03_DESIGN_SYSTEM.md`
   * `docs/04_ARCHITECTURE.md`
   * `docs/07_PAYMENTS_COMPLIANCE.md`
   * `docs/10_SECURITY_PRIVACY_RELIABILITY.md`
   * `docs/13_API_CONTRACTS.md`
   * `docs/14_TEST_STRATEGY.md`
3. Inspect the current product in a real browser on desktop and mobile.
4. Inspect the existing Tarot, Numerology, Astrology, Sanctuary, account, checkout, order, entitlement and refund implementation.
5. Document any difference between specifications, prototype behavior and repository reality.
6. Do not claim that local authentication, local checkout or fixed AI copy is a finished production feature.

Repository and browser reality override stale documentation.

---

## 3. Product Principles That Must Not Change

### 3.1 Core experience loop

Preserve the existing loop:

`Question → Interpretation → Intention → Ritual → Journal → Revisit`

RITUVIA is not merely a Tarot generator. Its differentiated product is the longitudinal relationship between reflection, intention, ritual, action and later review.

### 3.2 Free must remain complete

A free user must always be able to:

* Receive a useful daily Tarot result.
* View the identity and basic meaning of every drawn card.
* Use at least one free candle and one free incense experience.
* Write an intention.
* Complete a basic ritual.
* Write a private journal entry.
* Understand that no result is guaranteed or predictive.

Never draw cards first and then hide their core meanings behind payment.

### 3.3 Payment boundaries

Paid products may add:

* Personalization.
* Contextual synthesis.
* Greater depth.
* Additional perspectives.
* Visual design.
* Animation.
* Sound.
* Ritual environments.
* Collection value.
* Persistence and cross-device history.

Paid products may not claim:

* Better luck.
* Higher spiritual effectiveness.
* Greater likelihood of a wish being fulfilled.
* Knowledge of objective future events.
* Knowledge of another person's private thoughts.
* Medical, legal, investment or psychological certainty.

---

## 4. Free Product Model

### 4.1 Daily Tarot

Create a dedicated `Daily Tarot` experience.

The free Daily Tarot must:

* Draw one card per local calendar day.
* Use deterministic, reviewed database content.
* Make no external AI request.
* Include:

  * Card name.
  * Orientation.
  * Core symbolic theme.
  * One alternative interpretation.
  * One reflection question.
  * One grounded action.
* Allow the user to continue into Intention and Sanctuary.
* Cache public card content.
* Keep the server authoritative for production daily-draw eligibility.
* Never imply that the system detects energy, aura or destiny.

A user may revisit the same daily card without paying.

### 4.2 Standard multi-card reading

A one-card or three-card draw may remain available without payment.

For a three-card reading:

* The draw itself is free.
* Each card's reviewed database meaning is free.
* A basic position-by-position explanation is free.
* The optional AI synthesis of the user's question and the interaction among the cards costs Credits.

Clearly separate:

`The cards you drew` from `AI-generated deeper interpretation`.

---

## 5. Paid AI Deep Readings

Add a `Deep Readings` section inside the existing Readings area.

Do not create new top-level navigation items for Relationship or Annual readings. They are premium reading formats under `Deep Readings`.

### 5.1 Product catalogue

| Deep reading                              | Credit cost |
| ----------------------------------------- | ----------: |
| One-card personalized deep interpretation |    1 Credit |
| Three-card contextual synthesis           |   2 Credits |
| Relationship Reflection                   |   3 Credits |
| 30-Day Theme                              |   4 Credits |
| Your Year in Reflection                   |   6 Credits |

### 5.2 Relationship Reflection

The product must focus on the user’s own experience:

* Their needs.
* Interaction patterns.
* Boundaries.
* Choices.
* Communication.
* What they may be overlooking.
* A grounded next step.

It must never claim to determine:

* Whether another person secretly loves the user.
* Whether an ex will return.
* What another person is thinking.
* Whether a relationship is “destined.”
* How to control, attract or manipulate another person.

Suggested public name:

`Relationship Reflection`

Avoid:

`Love Prediction`, `Will They Return?`, or similar deterministic framing.

### 5.3 Annual reading

Use the name:

`Your Year in Reflection`

The reading may provide:

* Twelve monthly themes.
* Questions to consider.
* Potential areas of attention.
* Suggested actions.
* Periodic review prompts.

It must not be marketed as an objective forecast of what will happen.

### 5.4 AI generation behavior

Before a user spends Credits, show:

* Exact Credit cost.
* What input will be used.
* What output will be generated.
* That the result is AI-generated.
* The product's safety limitations.

Credit consumption must be idempotent.

Correct transaction order:

1. Authorize the requested Credit amount.
2. Reserve the Credits.
3. Generate the result.
4. Run output safety validation.
5. Persist the completed reading.
6. Finalize Credit consumption.

If generation fails, times out, violates safety requirements or produces no usable result:

* Release or automatically return the reserved Credits.
* Show a clear retry state.
* Do not charge twice on retry.

---

## 6. AI Architecture

Implement an LLM-agnostic provider adapter.

Initial provider priority may be:

1. DeepSeek as the cost-efficient default.
2. Kimi as a fallback or selected higher-quality provider.
3. A configurable premium model for annual or unusually complex readings.

Do not hard-code the product to one vendor.

Required interface concepts:

* `AIProvider`
* `ModelPolicy`
* `PromptVersion`
* `SafetyPolicyVersion`
* `InterpretationRequest`
* `InterpretationResult`
* `GenerationUsage`
* `ProviderFailure`
* `FallbackDecision`

Keep deterministic facts separate from AI prose:

* AI cannot choose Tarot cards.
* AI cannot alter card orientation.
* AI cannot modify Numerology calculations.
* AI cannot invent Astrology placements or aspects.
* AI may only interpret facts produced by approved deterministic systems.

### 6.1 Cost controls

Implement:

* Maximum input length.
* Maximum output length.
* Per-product model policy.
* Per-user rate limit.
* Per-account daily limit.
* Timeout.
* Retry limit.
* Provider circuit breaker.
* Cost telemetry without private content.
* Cached generation where the input is genuinely identical and privacy-safe.
* Automatic fallback only when permitted by product policy.

Do not self-host a GPU model during the MVP unless measured API costs demonstrate that self-hosting is economically superior.

### 6.2 Privacy controls

Never place raw private questions, birth data, relationship details, intentions or journal content in:

* Analytics.
* URLs.
* Browser history.
* Payment metadata.
* Screenshots.
* Error reporting.
* Model provider logs where retention can be disabled.
* Training datasets without separate, explicit consent.

AI personalization consent must be separate from service notifications, marketing consent and analytics consent.

---

## 7. Credits System

Credits are closed-loop, non-transferable usage entitlements.

They are not:

* Money.
* Cryptocurrency.
* A stored-value wallet.
* A token.
* A gift card.
* Transferable property.
* Redeemable for cash.
* Withdrawable.
* Tradable between users.

Use the public wording:

`Credits let you unlock selected RITUVIA digital experiences.`

Avoid:

`Balance`, `wallet`, `currency`, `investment`, `cash value`, or `earn Credits`.

### 7.1 Credit packs

| Pack       |    Price |
| ---------- | -------: |
| 6 Credits  |  US$5.99 |
| 15 Credits | US$11.99 |
| 40 Credits | US$24.99 |

Do not process direct US$0.99 or US$1.99 payments.

### 7.2 Credit types

Maintain separate internal buckets:

* `subscription_credit`
* `purchased_credit`
* `promotional_credit`
* `refund_adjustment`

Rules:

* Purchased Credits do not expire unless applicable law requires a different treatment.
* Subscription Credits are allocated monthly.
* Annual subscribers receive 8 Credits each month, not all 96 immediately.
* Subscription Credits expire at the end of their stated allocation period.
* Promotional Credits may have a clearly disclosed expiry.
* Consume subscription Credits first, then promotional Credits, then purchased Credits.
* Never silently change expiry terms after purchase.

### 7.3 Credit ledger

Do not store only a mutable integer balance.

Create an append-only Credit ledger containing:

* Transaction ID.
* User ID.
* Credit type.
* Amount.
* Direction.
* Reason.
* Product code.
* Order ID.
* Subscription period.
* Reservation ID.
* Generation ID.
* Created time.
* Expiry time where applicable.
* Idempotency key.
* Reversal reference.
* Policy and terms versions.

Current Credit availability must be derived from authoritative ledger entries or a transactionally maintained projection.

The client must never determine:

* Price.
* Credit amount.
* Credit balance.
* Product eligibility.
* Entitlement.
* Payment success.
* Refund success.

---

## 8. RITUVIA Plus

Activate the prototype presentation of RITUVIA Plus using:

| Plan    |         Price |               Included Credits |
| ------- | ------------: | -----------------------------: |
| Monthly | US$9.99/month |           8 Credits each month |
| Annual  | US$69.99/year | 8 Credits allocated each month |

Plus benefits:

* Monthly Credits.
* Cross-device synchronization.
* Longer reading history.
* Full Journal and Revisit history.
* Additional Sanctuary environments.
* Seasonal reflection themes.
* Reminder controls.
* New reading formats.
* Priority access to selected new experiences.

Do not offer unlimited AI generation.

The pricing UI must show:

* Renewal frequency.
* Included Credits.
* Credit allocation timing.
* Expiry behavior.
* Cancellation method.
* Access after cancellation.
* Refund-policy placeholder pending jurisdiction approval.
* Applicable taxes shown at checkout.

Subscription state model must include:

* `trialing`, if ever enabled.
* `active`.
* `past_due`.
* `grace_period`.
* `paused`.
* `cancel_at_period_end`.
* `cancelled`.
* `expired`.
* `refunded`.

Never remove purchased Credits because a subscription is cancelled.

---

## 9. Sanctuary Commercial Catalogue

Keep a complete free candle and free incense experience.

Separate paid Sanctuary experiences into two classes.

### 9.1 Permanent collectible objects

| Object                | Credit cost | Access               |
| --------------------- | ----------: | -------------------- |
| Mindful Incense       |           3 | Permanent collection |
| Moonlit Lotus         |           5 | Permanent collection |
| Amethyst Guardian     |           6 | Permanent collection |
| Golden Intention Bowl |           8 | Permanent collection |

A permanent object may add:

* Artwork.
* Animation.
* Sound.
* Visual atmosphere.
* Completion keepsake.
* Collection history.

### 9.2 Consumable special rituals

| Ritual                           | Credit cost |
| -------------------------------- | ----------: |
| Guided Light Ritual              |           2 |
| Flower or Incense Offering       |           2 |
| Moon Phase Ritual                |           3 |
| Relationship Release Ritual      |           3 |
| Annual Opening or Closing Ritual |           4 |

Consumable rituals may be used once per purchase.

They must be described as designed digital experiences, not supernatural services.

A user must see:

* Exact Credit cost.
* Whether the item is permanent or single-use.
* What is included.
* Whether audio is optional.
* Approximate duration.
* Accessibility alternatives.
* Refund or failure behavior.

Purchases must never interrupt an active ritual unexpectedly.

---

## 10. Information Architecture and UX Changes

### 10.1 Global navigation

Preserve the calm navigation structure.

Recommended primary destinations:

* Home.
* Readings.
* Sanctuary.
* Journal.
* Revisit.
* Plans & Credits.
* Account.

Do not add separate global navigation items for every paid reading.

### 10.2 Readings page

Add the following hierarchy:

1. Daily Tarot — Free.
2. Tarot — One-card and three-card basic reading.
3. Deep Readings — AI-powered, Credit-based.
4. Numerology.
5. Western Astrology.

Every product card must clearly show one of:

* `Free`
* `Included with Plus`
* `1 Credit`
* `2 Credits`
* etc.

### 10.3 Plans & Credits page

Replace the current prototype-only low-price object catalogue with:

1. Free plan explanation.
2. RITUVIA Plus monthly and annual cards.
3. Credit packs.
4. Deep Reading Credit costs.
5. Sanctuary permanent objects.
6. Special ritual costs.
7. Clear explanation of what Credits are and are not.
8. Purchase history and support access.

### 10.4 Account

Add:

* Available Credits.
* Breakdown by Credit type.
* Next subscription allocation date.
* Credit expiry information.
* Recent Credit activity.
* Subscription status.
* Purchased objects.
* Completed premium readings.
* Special ritual history.
* Orders, refunds and receipts.

Do not make Credit balance visually resemble a banking or cryptocurrency wallet.

### 10.5 Purchase confirmation

Before consumption, use language such as:

`This interpretation uses 2 Credits. You will have 6 Credits remaining.`

For a permanent object:

`Unlock permanently for 5 Credits.`

For a consumable ritual:

`Begin this one-time ritual for 3 Credits.`

Do not use countdown timers, artificial scarcity, fear, loss framing or compulsive upselling.

---

## 11. Payment Architecture

Use Stripe Hosted Checkout in Test Mode before any production activation.

Required rules:

* Client sends only product code and idempotency key.
* Server controls price, currency, tax behavior, terms version and country eligibility.
* Create an internal order before creating Checkout.
* Return URLs never grant Credits or entitlements.
* Only verified provider Webhooks can confirm payment.
* Webhooks must support:

  * Signature validation.
  * Raw-body verification.
  * Timestamp checks.
  * Replay prevention.
  * Duplicate events.
  * Out-of-order events.
  * Refunds.
  * Disputes.
  * Subscription changes.
* Credits, orders and entitlements must reconcile against Stripe.
* Payment failure must not create Credits.
* Refunds must reverse unused Credits or apply the approved refund policy.
* Consumed digital content must follow jurisdiction-specific refund rules.

Production payment remains behind an explicit owner approval gate.

---

## 12. Accounting and Revenue Data

Track separately:

* Gross sales.
* Discounts.
* Payment fees.
* Refunds.
* Chargebacks.
* Subscription revenue.
* Credit-pack sales.
* Credits issued.
* Credits consumed.
* Unused purchased Credits.
* AI generation costs.
* Hosting costs.
* Tax collected.
* Tax remitted.
* Foreign-exchange differences.

For management reporting, unused purchased Credits must be visible as an unfulfilled-service obligation rather than treated as proof that the entire sale has already been economically earned.

Do not make final statutory accounting assumptions in application code. Keep reporting configurable for the selected legal entity and accountant-approved policy.

---

## 13. Product Underwriting and Public Copy

RITUVIA must be described truthfully as:

* A symbolic self-reflection product.
* A private journaling and intention product.
* A digital ritual experience.
* An AI-assisted interpretation product.
* Entertainment and personal reflection, not professional advice.

Do not conceal Tarot, Astrology, Numerology or ritual functions from a payment provider.

The website must clearly contain:

* Legal seller name.
* Product descriptions.
* Prices.
* Subscription terms.
* Refund policy.
* Contact and support information.
* Privacy policy.
* Terms.
* 18+ requirement.
* Delivery and access rules.
* Digital-product description.
* No-guarantee and safety boundaries.

Production payment cannot be enabled until the selected payment provider confirms that it supports the actual product category and business model.

---

## 14. Security and Abuse Controls

Implement:

* Server-authoritative Credit ledger.
* Rate limits.
* Idempotent reservations and consumption.
* Protection against replay and double spending.
* Multi-tab concurrency tests.
* Account-switch protection.
* Cross-user access-denial tests.
* Admin authorization.
* Audit trails.
* Refund and reversal linkage.
* Prompt injection defenses.
* Output safety checks.
* Sensitive-log redaction.
* Provider-failure recovery.
* No private data in payment disputes.

---

## 15. Required Implementation Sequence

### Phase 0 — Reality and commercial-model audit

* Audit current repository and browser behavior.
* Document gaps.
* Update status, backlog and decisions.
* Produce the proposed schema and migration plan.
* Do not activate production payment.

### Phase 1 — Prototype commercial UX

Implement prototype-level screens and state transitions for:

* Daily Tarot.
* Deep Readings.
* Plus.
* Credit packs.
* Credit balance and history.
* Permanent versus consumable ritual products.
* Purchase and consumption confirmation.
* Failure and automatic Credit-return states.

No external payment or real AI call is required to finish this phase.

### Phase 2 — Credit ledger and entitlements

Implement:

* Server-side Credit ledger.
* Reservations.
* Consumption.
* Reversals.
* Subscription allocation.
* Object entitlement.
* Special ritual usage.
* Concurrency and idempotency tests.

### Phase 3 — AI adapter

Implement:

* Provider abstraction.
* DeepSeek and Kimi adapters where approved.
* Model policy.
* Prompt versioning.
* Safety validation.
* Cost tracking.
* Timeout, fallback and Credit reversal.

### Phase 4 — Stripe Test Mode

Implement:

* Credit packs.
* Plus monthly and annual.
* Webhooks.
* Subscription lifecycle.
* Refunds.
* Reconciliation.
* Test-mode customer portal.

### Phase 5 — Beta acceptance

Verify the complete path:

`Daily Tarot → free result → optional deep reading → Credit confirmation → AI interpretation → intention → free or premium ritual → journal → revisit → account history → subscription management → order/refund history`

---

## 16. Acceptance Criteria

The work is not complete unless:

1. Free Daily Tarot makes no model request.
2. The free core result is useful and visible before payment.
3. AI content is clearly labeled.
4. A failed AI request cannot permanently consume Credits.
5. Concurrent requests cannot double-spend Credits.
6. Purchased Credits survive subscription cancellation.
7. Subscription Credits follow the disclosed allocation policy.
8. Permanent objects remain available after purchase.
9. Consumable rituals cannot be reused without another authorized consumption.
10. Free candle and incense remain available.
11. Relationship readings do not claim access to another person's mind.
12. Annual readings are reflective rather than predictive.
13. Client-controlled prices or balances are rejected.
14. Refund, dispute and reversal paths are tested.
15. No private content appears in analytics, logs, payment evidence or URLs.
16. Desktop, mobile, keyboard, screen-reader and reduced-motion paths pass.
17. Browser console has no unexpected errors.
18. Network inspection shows no unintended private-data transmission.
19. Existing Tarot, Numerology, Astrology, Sanctuary, Journal and Revisit flows are not regressed.
20. Production payment and production AI remain disabled until owner approval.

---

## 17. Required Final Report

Return:

### Completed

One sentence describing the completed phase.

### Changed

Files, modules, schemas and user-visible behavior.

### Commercial model

Exact prices, Credit rules and entitlement behavior implemented.

### Verified

Exact test commands, browser routes, devices, console results and network results.

### Evidence

Commit, screenshots, traces and reports.

### Costs

Measured or estimated AI, infrastructure and payment cost impact.

### Risks and approvals

Provider underwriting, tax, legal, content, AI and production-payment gates.

### State updated

Backlog, project status and decision changes.

### Next

Only the next highest-priority vertical slice.

Do not claim completion based only on source inspection or unit tests.
