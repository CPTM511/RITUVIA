# Worker Instructions

These instructions apply to `apps/worker/**`.

## Role

The worker runs asynchronous, retriable, observable tasks such as interpretation generation, email/push scheduling, content workflows, exports, reconciliation support, webhook follow-up, sitemap generation, and maintenance checks.

## Non-negotiable job contract

Every job must define:

- Typed payload schema and version.
- Stable idempotency key.
- Authorization/origin assumptions.
- Timeout and maximum attempts.
- Exponential backoff with jitter where appropriate.
- Retryable vs terminal error classification.
- Dead-letter behavior and operator recovery path.
- Sensitive-data classification and log redaction.
- Metrics for started/succeeded/failed/retried/duration/age.
- Safe cancellation and deployment compatibility.

## Data and privacy

- Pass identifiers instead of sensitive free text whenever possible; retrieve only the minimum data at execution time.
- Never place prayer, journal, birth-time, health, relationship, or private-question text into queue names, dedup keys, logs, traces, metrics, or alert payloads.
- Delete temporary artifacts promptly and use encrypted storage for necessary exports.
- Respect deletion, consent, retention, locale, country policy, and user notification preferences at execution time—not only enqueue time.

## Reliability

- Delivery is at-least-once unless a stronger guarantee is explicitly implemented; code accordingly.
- Money, entitlement, and webhook jobs use database transactions/outbox patterns and deterministic reconciliation.
- Jobs must be safe under duplicates, out-of-order execution, partial provider failure, deploy/restart, and stale payload versions.
- Bound concurrency and external API spend. Use circuit breakers or pause switches for failing providers.
- Never allow an AI/provider outage to corrupt deterministic readings or block access to already-purchased content.

## AI jobs

- Store prompt/template/model/content/schema versions and generation status.
- Require structured output validation and deterministic fallback copy.
- Run safety checks before persistence or delivery.
- Do not auto-retry safety-blocked outputs without changing strategy; route to a safe fallback.

## Testing

Add job tests covering success, duplicate, retryable failure, terminal failure, timeout, cancellation, stale version, privacy redaction, and dead-letter recovery. Use fake clocks and provider fakes; never hit production services in tests.
