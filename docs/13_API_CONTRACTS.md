# API and Integration Contracts

## 1. Principles

- Internal domain APIs are typed and framework-independent.
- Public/private HTTP endpoints are versioned where contract stability matters.
- Schema validation applies to request, response, jobs, provider events, and stored JSON.
- Server authorizes every resource and recalculates money/policy.
- Idempotency is required for create, payment, merge, export, and job-triggering operations.
- Errors use stable codes plus localized user-safe messages.

## 2. Error shape

Use a Problem Details-style JSON response:

```json
{
  "type": "https://errors.rituvia.example/reading/not-eligible",
  "title": "This experience is not available",
  "status": 403,
  "code": "READING_NOT_ELIGIBLE",
  "detail": "Localized safe explanation",
  "instance": "/api/v1/readings/abc",
  "requestId": "...",
  "fields": []
}
```

The public error never includes stack traces, SQL/provider secrets, safety raw content, or sensitive IDs.

## 3. Idempotency

- Client supplies a random `Idempotency-Key` for applicable operations.
- Scope key to authenticated/anonymous subject, route/operation, and canonical request hash.
- Persist response/state for a defined window.
- Same key + different canonical request returns conflict.
- Payment provider idempotency is in addition to internal idempotency.

## 4. Candidate HTTP endpoints

Exact routing may adapt to Next.js conventions, but domain contracts remain.

### Session/account

- `POST /api/v1/anonymous/session`
  - Exact same-origin POST with no query and a high-entropy `Idempotency-Key`. When protected-Beta
    invite policy is disabled or a currently bound protected session is resumed, the request has
    no body/content type. Before first protected-Beta issuance it instead requires bounded JSON
    containing exactly `inviteToken` and
    `schemaVersion: protected-beta-admission.v1`; no alternate representation is accepted.
  - Returns `204` and creates or resumes only through the host-only
    `__Host-rituvia-anonymous-session` cookie. It never returns subject/session IDs or token
    material in a body.
  - A created cookie is `Secure`, `HttpOnly`, `SameSite=Strict`, `Path=/`, has no `Domain`, and uses
    the database-authoritative absolute expiry. Resume does not rotate or extend it.
  - Under `own-019.protected-beta-invite.v1`, a valid unexpired/unconsumed/unrevoked invite is
    consumed and bound in the same PostgreSQL transaction that creates the subject/session. A
    pre-policy active cookie is not admission authority. Exact retry can recover a dropped response;
    changed replay and concurrent double use fail closed.
  - Missing, invalid, used, expired, or revoked admission returns generic no-store/noindex `403`
    `BETA_ADMISSION_REQUIRED`. Disabled/unconfigured storage, conflicts, capacity limits, and
    unavailable requests use bounded responses and never expose cohort, token, or persistence state.
- `POST /api/v1/auth/start`
  - Exact same-origin JSON with only normalized `email` and reviewed local `returnTo`.
  - Returns the same `202` shape for every valid existing or unknown email:
    `accepted`, absolute `expiresAt`, and a constant local-only
    `/api/v1/auth/local-preview` path. It never returns email, token, state, provider subject, or
    a tokenized callback.
  - Sets a short-lived host-only `__Host-rituvia-auth-state` cookie with `Secure`, `HttpOnly`,
    `SameSite=Lax`, and `Path=/`. Database-atomic global/identifier limits return `429` plus a
    bounded `Retry-After`; unconfigured or non-local providers return `503`.
- `GET /api/v1/auth/local-preview`
  - Local development only, exact no-query route. Consumes the one-time challenge bound to the
    `HttpOnly` state cookie and redirects with `303`; missing, expired, or replayed state fails
    closed. It is not a production email-delivery contract.
- `GET /api/v1/auth/callback?challenge=...&state=...&token=...`
  - Reserved provider callback contract. Requires exact bounded query keys plus state equality with
    the initiating `HttpOnly` cookie, consumes hashes once, and redirects with `303`.
- Successful completion sets host-only `__Host-rituvia-account-session` with `Secure`, `HttpOnly`,
  `SameSite=Strict`, `Path=/`, and fixed expiry, clears authentication state, and rotates only a
  same-account previous session captured at start.
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/logout-all`
- `POST /api/v1/auth/account-merge`
  - Requires exact same-origin empty `POST`, both host-only session cookies, a session-bound
    `X-CSRF-Token`, and a bounded `Idempotency-Key`.
  - Creates or exactly replays one immutable anonymous-subject link, revokes anonymous sessions,
    rotates the account session, clears the anonymous cookie, and returns `204` plus a successor
    account cookie and successor-bound `X-CSRF-Token`.
  - An exact retry using the original cookies and key returns the same successor cookie; a different
    key, source account session, or account returns `409` without partial revocation.
- `GET /api/v1/me`
- `PATCH /api/v1/me`
- `GET /api/v1/me/history?limit={1..50}&cursor={opaque}`
- `GET /api/v1/me/readings?limit={1..50}&cursor={opaque}`
- `GET /api/v1/me/sessions`
- `DELETE /api/v1/me/sessions/{id}`
- `GET /api/v1/me/consents`
- `POST /api/v1/me/consents`

`GET /api/v1/me` returns the account summary plus a one-way session-bound `X-CSRF-Token` header.
`PATCH /me`, merge, logout, logout-all, and targeted session deletion require that exact token.
Profile updates use the returned `profileVersion`; stale writes return `409`.

`GET /api/v1/me/history` accepts no user or subject identifier. It returns schema version, bounded
items, and an opaque next cursor. Items contain only resource ID/type, coarse status, occurrence
time, and optional reading type/theme. Existing expiry, soft deletion, parent deletion, and subject
expiry determine visibility. The reading-only endpoint remains a compatibility projection over the
same linked ownership boundary.

Session listing returns only current/other identity plus created, last-active, and expiry
timestamps. Targeted deletion cannot revoke the current session. Unknown or cross-owner session
deletion remains indistinguishable. Logout does not clear the browser cookie when durable
server-side revocation is unavailable.

Authentication completion accepts the current anonymous cookie as part of the same database
transaction. On success it clears that cookie and exposes linked history through account-scoped
queries. Merge conflict returns `409`; transient storage failure retains callback state for a safe
retry. Reflection resource routes do not opportunistically merge or rotate credentials.
An account cookie may authorize an exact linked reading detail request; anonymous and account
ownership failures retain the same private `404`.

Consent listing returns exactly the current technical controls for optional product analytics, AI
personalization, and model improvement. Each carries its own exact notice version and defaults to
not granted. Mutation requires exact same-origin/session-CSRF evidence, JSON content type, a
bounded `Idempotency-Key`, and one strict purpose/version/granted body. Login, merge, purchase, or
another purpose never grants consent. A false mutation records denial or withdrawal, and every
sensitive data-flow check rereads the latest committed account sequence rather than trusting the
browser or a cached session value. Production analytics, AI-provider private-content processing,
training, marketing, and service-notification delivery remain separate safe-off capabilities.

### Safe intake

- `POST /api/v1/intake/evaluate`
  - The browser first creates or resumes the required anonymous session through
    `POST /api/v1/anonymous/session`; this is invisible and adds no user-facing button.
  - Exact same-origin metadata and the active anonymous cookie are required before the server reads
    the bounded private JSON body.
  - A database-atomic session budget is consumed before evaluation. Excess returns `429` with a
    bounded `Retry-After`; missing policy/storage/privilege authority returns `503`; invalid or
    expired session returns `401`.
  - Returns allowed, reframed, blocked, or crisis flow; never persists the question or emits raw
    text to analytics, logs, metadata, URLs, or rate-limit records.

### Tarot

- `POST /api/v1/readings/tarot`
- `GET /api/v1/readings/{id}`
- `POST /api/v1/readings/{id}/interpretation`
- `POST /api/v1/readings/{id}/report`
- `POST /api/v1/readings/{id}/share`
- `DELETE /api/v1/readings/{id}`

### Numerology

- `POST /api/v1/readings/numerology`
- Public pure calculator uses `POST /api/v1/numerology/calculate` without persistence. The exact V1
  request is `birthDate`, `schemaVersion`, and an explicit four-digit `targetYear`; name input and
  client-authored results are rejected.

### Astrology

- `POST /api/v1/birth-profiles`
- `PATCH /api/v1/birth-profiles/{id}`
- `DELETE /api/v1/birth-profiles/{id}`
- `POST /api/v1/readings/astrology/natal`
- `POST /api/v1/locations/search` (D-068: authenticated same-origin JSON; raw query never enters
  URLs, logs, analytics, durable storage, or shared caches)

The listed location-search GET is an unresolved historical inventory entry, not an implementation
authorization. A birthplace query in a URL conflicts with private birth-data handling. RIT-091
adds no route; OWN-014 must approve a privacy-safe HTTP contract before RIT-094. D-067 recommends
authenticated same-origin session-CSRF-protected rate-limited POST JSON with `no-store`, redacted
telemetry, no raw-query retention, and no shared cache.

### Reflection

- `POST /api/v1/intentions`
- `PATCH /api/v1/intentions/{id}`
- `DELETE /api/v1/intentions/{id}`
- `GET /api/v1/ritual-objects`
- `POST /api/v1/ritual-sessions`
- `GET /api/v1/ritual-sessions/{id}`
- `PATCH /api/v1/ritual-sessions/{id}`
- `POST /api/v1/ritual-sessions/{id}/complete`
- `POST /api/v1/journal-entries`
- `PATCH /api/v1/journal-entries/{id}`
- `DELETE /api/v1/journal-entries/{id}`

Anonymous reflection creates and mutations, including intention, ritual, journal, Revisit, and
reading-report writes, share one database-atomic `protected_beta_mutation` request budget after
session/CSRF admission and before private-body parsing. A `429` response includes bounded
`Retry-After`; clients must not retry automatically. Domain idempotency and revision checks still
prevent duplicate or stale state. The request budget counts transport attempts, including exact
idempotent replay, while existing endpoint-specific quotas retain their own replay rules.

- `GET /api/v1/journal-entries/{id}`
- `PATCH /api/v1/journal-entries/{id}`
- `DELETE /api/v1/journal-entries/{id}`
- `GET /api/v1/revisits`
- `POST /api/v1/revisits`
- `GET /api/v1/revisits/{id}`
- `PATCH /api/v1/revisits/{id}`
- `DELETE /api/v1/revisits/{id}`
- `POST /api/v1/revisits/{id}/complete`

Intention creation retains the strict historical v1 request while new composers use
`reflection-intention.v2`: normalized agency-owned private text, a bounded small action,
private-only visibility, optional revisit date plus IANA time zone, explicit no-reminder default,
and an optional owner-scoped reading ID. A supplied revisit date must be later than the server
observation date in the submitted IANA time zone. `POST`, `PATCH`, and `DELETE` require exact
same-origin evidence plus a session-bound `X-CSRF-Token` kept only in browser memory. `PATCH` uses
strict action-specific `reflection-intention-mutation.v1` bodies with an expected revision and
idempotency key. `DELETE` requires an idempotency key plus an exact revision validator and performs
owner-hidden soft deletion; unknown, cross-owner, expired, and deleted resources remain
indistinguishable, and replaying the original create key after deletion cannot recover private
text.

`GET /api/v1/ritual-objects` returns the validated read-only `ritual-catalog.v1` source with exact
publication, template, item, access-requirement, and historical-mapping versions. It contains the
production-pack `free_candle`/`free_incense`, permanent-object, and consumable-ritual code sets but
no price, Credit cost, payment, ownership, entitlement fulfillment, or pass-consumption
authority. Historical `reflection-ritual.v1` request codes and resources remain unchanged and
readable only through their exact historical contract.

New starts use strict `ritual-session.v2` bodies containing only `intentionId`, canonical
`itemCode`, and `schemaVersion`. The server resolves one active approved catalog item and persists
its exact catalog, item, publication, template, and access snapshot. Free access accepts an active
anonymous or account owner; permanent access requires a linked active entitlement; consumable
access locks and consumes one matching pass in the same transaction that creates the session.
Start replay is owner-scoped and idempotent, while changed key reuse conflicts.

`PATCH /api/v1/ritual-sessions/{id}` accepts strict revision-checked pause, resume, or abandon
mutations. `POST /api/v1/ritual-sessions/{id}/complete` accepts the same mutation contract with the
`complete` action. Visible Sanctuary exit performs a durable pause rather than abandonment.
Lifecycle resources expose only bounded coarse elapsed time, current step, status, revision, exact
snapshot evidence, and timestamps; private owner reads remain no-store/noindex and
indistinguishable from unknown, cross-owner, expired, or deleted resources.

New linked journals use `private-journal.v2` create bodies and
`private-journal-mutation.v1` update/delete contracts. Creation requires the same owner's completed
v2 ritual and linked active intention. Reflection text is encrypted with owner- and
journal-ID-bound authenticated context; optimistic update re-encrypts it and deletion creates an
immediately hidden soft tombstone. All ritual and journal mutations require exact same-origin
evidence, a session-derived CSRF token, bounded JSON, and stable idempotency keys.

Revisit creation uses strict `reflection-revisit.v1` bodies containing one owned active v2
`intentionId`, `next_day`, `seven_days`, or `custom` schedule kind, a custom local date only when
required, an IANA time zone, optional valid quiet hours, `reminderPreference: "none"`, and a null
channel. The server derives the local scheduled date, snapshots the exact encrypted
intention/action/revision, and permits only one scheduled Revisit for that owner/intention.
Collection and resource reads are bounded, private, no-store/noindex, owner-union scoped, and hide
unknown, cross-owner, expired, deleted, or parent-deleted resources identically.

Reschedule and archive use strict `reflection-revisit-mutation.v1` revision-checked `PATCH`
requests. Completion uses the same mutation version at
`POST /api/v1/revisits/{id}/complete`, accepts a private factual reflection plus at most three
distinct allowlisted outcome tags, and remains valid before, on, or after the selected date.
`DELETE` requires `If-Match`, CSRF, and an idempotency key and creates a terminal soft tombstone.
Every write is recorded in an append-only operation ledger; exact same-key replay is stable and
changed key reuse conflicts. Quiet hours remain inert and no reminder channel, delivery adapter,
outbox job, analytics event, ritual link, or journal link exists in this contract.

RIT-045 adds a separate account-owned reminder preference contract without changing those Revisit
v1 fields:

- `GET /api/v1/me/revisit-reminders` returns a bounded private collection with explicit
  `accountAvailable`; anonymous users receive a safe `200` empty collection rather than a noisy
  authorization failure.
- `GET /api/v1/revisits/{id}/reminder` returns the current owner-scoped state or null.
- `POST /api/v1/revisits/{id}/reminder` accepts exactly
  `revisit-reminder-preference.v1`, `rituvia.revisit-reminder-notice.v1`, `email`, `once`, and
  `subscribe` or `unsubscribe`. It requires an active account session, same-origin evidence,
  session CSRF, JSON no larger than 1 KiB, and a stable idempotency key.

Unknown/cross-owner resources are indistinguishable. Exact same-key replay returns the recorded
result; changed reuse and mutation after delivery conflict. Responses expose only preference,
delivery state, locale/version, Revisit ID, and recorded time—never email, lease token, provider
payload, private prose, or internal failure detail. Production delivery is not an HTTP endpoint and
the composed provider remains disabled.

### Catalog/commerce

- `GET /api/v1/catalog`
- `GET /api/v1/catalog/products/{code}`
- `POST /api/v1/orders`
- `POST /api/v1/orders/{id}/checkout`
- `GET /api/v1/orders/{id}`
- `GET /api/v1/entitlements`
- `POST /api/v1/subscriptions/{id}/cancel`
- `POST /api/v1/refund-requests`
- `POST /api/v1/webhooks/payments/{provider}`
- `POST /api/v1/webhooks/crypto/{provider}`

`GET /api/v1/catalog` returns one complete `catalog-version.v1` document selected by server
environment and database time. It includes immutable version/source evidence, reviewed locales,
exact digital contents, Credit terms, and fiat price scope. The runtime first proves SELECT-only
catalog privileges. Missing, stale, ambiguous, disabled, malformed, or unapproved environment data
returns a finite `503 CATALOG_UNAVAILABLE` response with `no-store`; it never falls back to
hardcoded prices. Country Policy separately authorizes country/product/provider use. The endpoint
does not activate checkout or grant Credits/entitlements.

### Privacy/support

- `POST /api/v1/privacy/export`
- `GET /api/v1/privacy/exports/{id}`
- `POST /api/v1/privacy/exports/{id}/download`
- `POST /api/v1/privacy/deletions`
- `POST /api/v1/support/tickets`

The export request has an empty body, exact same-origin/session-CSRF evidence, and a high-entropy
idempotency key. It returns `202` private metadata only after recent authentication and a completed
encrypted local artifact. Metadata accepts no owner identifier. Download is an owner-scoped
same-origin POST so no bearer appears in a URL; it returns the versioned JSON package as an
attachment only while the database-clock expiry and recent-authentication window remain valid.
Every response is private/no-store/noindex.

Deletion uses strict JSON `{ "scope": "private_content" | "account" }`, exact same-origin and
session-derived CSRF evidence, a high-entropy idempotency key, configured rate/recent-auth windows,
and an active account session. It returns `202` only after one atomic database completion and
exposes version/scope/timestamps, fixed retained-category codes, and affected-row counts—never
private content. Selective scope keeps the account session; account scope clears the cookie and
revokes all ordinary sessions. A lost account-deletion response may be replayed only with the same
revoked request token and exact idempotency key/scope.
The route is safe-off unless both deletion policy windows and the dedicated
`PRIVACY_DELETION_DATABASE_URL` are present; it never falls back to the ordinary application
database credential.

### Admin

Use protected `/api/admin/v1/...` endpoints or server actions with equivalent contracts for content, policy, catalog, orders, prompts, translations, flags, and audit. Every action is authorized/audited.

## 5. Reading creation contract

Input contains modality-specific safe fields, locale, theme, and idempotency. Server returns:

```json
{
  "readingId": "...",
  "status": "facts_ready",
  "facts": {},
  "interpretation": {
    "status": "queued",
    "pollUrl": "/api/v1/readings/..."
  },
  "policyVersion": "...",
  "contentVersion": "..."
}
```

Do not accept client-supplied card IDs, numerology result, chart placements, paid status, or entitlement.

## 6. Interpretation contract

- Can be synchronous streaming or queued, but final stored result conforms to the canonical schema.
- Streaming events are typed: metadata, section_delta, completed, fallback, error.
- The client treats streamed text as provisional until completion/validation.
- Regeneration creates a new interpretation linked to the previous one and subject to limits.

## 7. Checkout contract

Input: order/product identifier, return route token, provider preference only if policy permits. Output:

- Internal order ID.
- Hosted checkout URL/session token.
- Expiry.
- Public pending status.

The return route never grants access. Verified server-side event/reconciliation controls fulfillment.

## 8. Provider adapter interfaces

```ts
interface FiatPaymentProvider {
  createCheckout(input: CreateCheckoutInput): Promise<HostedCheckout>;
  verifyWebhook(rawBody: Uint8Array, headers: Headers): VerifiedProviderEvent;
  fetchPayment(reference: string): Promise<ProviderPayment>;
  refund(input: RefundInput): Promise<ProviderRefund>;
  createPortal?(input: PortalInput): Promise<HostedPortal>;
}

interface HostedCryptoProvider {
  createCheckout(input: CryptoCheckoutInput): Promise<HostedCheckout>;
  verifyWebhook(rawBody: Uint8Array, headers: Headers): VerifiedProviderEvent;
  fetchPayment(reference: string): Promise<ProviderPayment>;
}

interface InterpretationProvider {
  generateStructured<T>(input: ModelInput<T>): Promise<ModelResult<T>>;
  streamStructured?<T>(input: ModelInput<T>): AsyncIterable<ModelStreamEvent<T>>;
  classify(input: ClassificationInput): Promise<ClassificationResult>;
}

interface AstrologyEngine {
  calculateNatal(input: NatalInput): Promise<NatalFacts>;
  engineMetadata(): EngineLicenseMetadata;
}
```

## 9. Job contracts

Suggested job types:

- `interpretation.generate.v1`
- `interpretation.evaluate.v1`
- `payment.event.process.v1`
- `payment.reconcile.v1`
- `entitlement.reconcile.v1`
- `email.transactional.send.v1`
- `revisit.reminder.send.v1`
- `privacy.export.build.v1`
- `privacy.delete.execute.v1`
- `share.image.generate.v1`
- `content.publish.propagate.v1`
- `seo.sitemap.refresh.v1`

Each job has schema version, idempotency, retries, timeout, dead-letter, trace ID, and sensitive-payload classification.

## 10. Pagination and filtering

- Cursor-based pagination for private/admin history.
- Stable sort and opaque cursor.
- Server allowlist for filters/sorts.
- Page-size limits.
- Search is authorization-scoped and avoids leaking existence/count across users.

## 11. Rate limits

Define route groups:

- Public read.
- Auth/session.
- Deterministic calculation.
- AI generation/regeneration.
- Checkout/payment.
- Privacy/export/delete.
- Support/upload.
- Admin.

Return user-safe retry information. Do not rely on client enforcement.

## 12. Compatibility

- Database/internal changes use expand-migrate-contract.
- Public contract changes are additive where possible.
- Stored JSON schemas have readers/migrations.
- Job consumers handle current and supported prior versions.
- Provider event adapters are fixture-tested against real documented payload versions.

## 13. RIT-125 internal operational case contract

RIT-125 intentionally adds no public or admin HTTP route. `createOperationalCaseService` is an
internal server-only contract for the later RIT-120 dashboard integration:

- `list({ queue, reasonCode, sessionToken, ticketReference })` returns at most the configured bounded
  active cases in stable priority/due/opened/ID order;
- `transition({ action, caseId, idempotencyKey, queue, reasonCode, sessionToken,
  ticketReference })` accepts only `triage`, `escalate`, or `resolve` and returns the projected case;
- every call performs role, recent-auth, same-session passkey, reason, ticket, database privilege,
  and audit checks;
- exact transition replay returns the current projected case; changed content with the same key is
  a conflict; invalid state and cross-queue access fail closed;
- responses contain category/state/priority/SLA/draft metadata only and never include source/private
  content; every draft is explicitly not sent.

Ordinary reading-report buttons continue to use their existing API. Privacy APIs and refund sources
enqueue in the same source transaction. A categorical support-ticket table exists, but there is no
ordinary Support button or support-ticket HTTP endpoint yet. Any future route must add the standard
origin, CSRF/session, body, idempotency, rate-limit, private-cache, and proxy allowlist controls
without broadening database privileges.

## 14. RIT-120 private owner operations contract

RIT-120 intentionally adds no public or admin HTTP route. `owner-operations-snapshot.v1` is one
bounded regular JSON manifest containing `capturedAt`, environment, release state, and exactly eight
ordered section envelopes. Each section accepts only a fixed ID/detail code, categorical state, and
closed source metadata: kind, observed-through time, optional window, approval reference, and safe
repository evidence path.

`projectOwnerOperationsReport` validates exact own enumerable data without invoking accessors,
rejects private/extra fields and unsafe paths, applies fixed section freshness, forces
unavailable/stale/future/synthetic sources to `unknown`, and derives release-evidence state without
deployment authority. `generateOwnerOperationsDashboardFiles` reads at most 1 MiB from one regular
non-symlink input and creates exclusive no-follow mode-0600 JSON and Markdown bound to the exact
input SHA-256 digest. It performs no network, provider, database, support, or deployment action.
