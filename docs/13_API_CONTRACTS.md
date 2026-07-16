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
- `POST /api/v1/auth/account-merge`
- `GET /api/v1/me`
- `GET /api/v1/me/sessions`
- `DELETE /api/v1/me/sessions/{id}`

### Safe intake

- `POST /api/v1/intake/evaluate`
  - Returns allowed, reframed, blocked, or crisis flow; never emits raw text to analytics.

### Tarot

- `POST /api/v1/readings/tarot`
- `GET /api/v1/readings/{id}`
- `POST /api/v1/readings/{id}/interpretation`
- `POST /api/v1/readings/{id}/report`
- `POST /api/v1/readings/{id}/share`
- `DELETE /api/v1/readings/{id}`

### Numerology

- `POST /api/v1/readings/numerology`
- Public pure calculator MAY use `POST /api/v1/calculators/numerology` without persistence.

### Astrology

- `POST /api/v1/birth-profiles`
- `PATCH /api/v1/birth-profiles/{id}`
- `DELETE /api/v1/birth-profiles/{id}`
- `POST /api/v1/readings/astrology/natal`
- `GET /api/v1/locations/search`

### Reflection

- `POST /api/v1/intentions`
- `PATCH /api/v1/intentions/{id}`
- `POST /api/v1/ritual-sessions`
- `POST /api/v1/ritual-sessions/{id}/complete`
- `POST /api/v1/journal-entries`
- `PATCH /api/v1/journal-entries/{id}`
- `DELETE /api/v1/journal-entries/{id}`
- `POST /api/v1/revisits`
- `POST /api/v1/revisits/{id}/complete`

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

### Privacy/support

- `POST /api/v1/privacy/exports`
- `GET /api/v1/privacy/exports/{id}`
- `POST /api/v1/privacy/deletions`
- `POST /api/v1/support/tickets`

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
