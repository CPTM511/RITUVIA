# 03 — Production Architecture

## 1. Architecture principle

Preserve the current TypeScript/PostgreSQL architecture where it is sound. Do not create parallel duplicate services. If a required boundary is missing, add it behind an interface. If the repository does not yet have a production web/server foundation, use a supported, pinned TypeScript framework and PostgreSQL, but do not combine a framework upgrade with feature development.

## 2. Logical system

```text
Browser / PWA
  ├─ Web UI and reviewed locale copy
  ├─ Wallet discovery and provider bridge
  └─ No secrets, no authoritative balances, no payment authority
          │ HTTPS + cookie session + CSRF
          ▼
Application API
  ├─ Authentication and account linking
  ├─ Readings and deterministic engines
  ├─ Intentions / rituals / journal / revisit
  ├─ Catalog / order / subscription / entitlement
  ├─ Credit ledger and reservations
  ├─ AI orchestration and safety
  ├─ Privacy export / deletion
  └─ Admin APIs isolated by role and step-up auth
          │
          ├─ PostgreSQL + row ownership + encrypted fields
          ├─ Transactional outbox / job worker
          ├─ Object storage for approved assets only
          ├─ KMS / secrets manager
          ├─ Stripe API and webhooks
          ├─ Coinbase Business Checkout API and webhooks
          ├─ DeepSeek / Kimi provider adapters
          ├─ Email / OAuth / WebAuthn providers
          └─ Metrics, logs, traces, alerts
```

## 3. Required modules

| Module | Responsibility | Forbidden responsibility |
|---|---|---|
| `identity` | Email, OAuth, passkey, SIWE, sessions, link/unlink | Payment authorization |
| `readings` | Daily Tarot, Tarot facts, versioned reviewed meanings | LLM provider code |
| `numerology` | Deterministic calculations and formula evidence | AI-generated values |
| `astrology` | Licensed deterministic ephemeris and time-zone resolution | AI-generated placements |
| `reflection` | Intentions, journal, revisit | Analytics export of raw content |
| `sanctuary` | Ritual sessions, objects, passes, completion | Direct payment handling |
| `catalog` | Versioned products, prices, Credit cost and eligibility | Client-defined values |
| `orders` | Internal order state machine and reconciliation | Granting access from return URLs |
| `payments` | Provider adapters, events, refunds | User content or journal data |
| `credits` | Append-only ledger, reservations, allocations, reversals | Mutable client balance |
| `entitlements` | Permanent objects, Plus access, ritual passes | Payment-provider assumptions |
| `ai` | Model policy, prompts, provider adapters, safety and usage | Drawing cards or changing facts |
| `privacy` | Consent, export, deletion, retention | Silent secondary use |
| `admin` | Narrow audited operations | Reading private content by default |
| `observability` | Redacted telemetry and incident evidence | Raw private questions or prompts |

## 4. Consistency model

Use PostgreSQL transactions for local invariants and a transactional outbox for provider and worker side effects.

Examples:

- Payment event + order transition + Credit issuance + outbox record: one transaction.
- Credit reservation + available projection update: one transaction with row locks or serializable/constraint-based protection.
- AI completion + reading persistence + reservation consumption: one transaction.
- AI failure + reservation release: one transaction.
- Ritual pass consumption + ritual session creation: one transaction.

Never use distributed best-effort writes without reconciliation.

## 5. Environments

| Environment | Data | Payments | AI | Access |
|---|---|---|---|---|
| Local | Synthetic | Local/Test | Stub/Test | Developer |
| CI | Ephemeral synthetic | Provider mocks + CLI fixtures | Recorded/stub | CI only |
| Preview | Isolated | Stripe Test / Coinbase test or sandbox | disabled or test account | Protected |
| Staging | Isolated production-like | Test mode | approved test mode | Team/allowlist |
| Production | Real | Live only after Owner gate | Live only after Owner gate | Public |

Never reuse production secrets or databases in preview. Never copy private production content into lower environments.

## 6. Feature flags and kill switches

Required server-side flags:

- `wallet_auth_enabled`
- `wallet_linking_enabled`
- `stripe_checkout_enabled`
- `stripe_subscriptions_enabled`
- `crypto_checkout_enabled`
- `ai_deep_readings_enabled`
- `ai_fallback_enabled`
- `astrology_enabled`
- `new_purchases_enabled`
- `ritual_consumption_enabled`

Flags must be evaluated server-side. Critical provider flags need emergency disable without redeploy. A disabled provider must fail safely without losing Credits or orders.

## 7. Observability

Every request gets a correlation ID. Record structured metadata, not private content:

- route, status, duration, user pseudonymous ID, provider, model, product code, order ID, event ID, reservation ID, token counts and cost.
- no raw questions, birth data, journal text, intentions, wallet signature, full address in generic logs, card data or payment metadata.
- security/audit logs are append-only, access-controlled and separately retained.

Required SLO candidates for beta:

- Core page availability: 99.9% monthly.
- Auth verify p95: <1.5s excluding wallet UI.
- Order creation p95: <2s excluding hosted checkout.
- Webhook processing p95: <5s.
- Deep Reading success: ≥98% excluding policy refusals.
- No lost or duplicate Credit entries.

## 8. Background jobs

- payment reconciliation
- subscription monthly Credit allocation
- expired reservation release
- webhook retry/dead-letter review
- AI generation retry where policy allows
- privacy export
- deletion and retention enforcement
- backup verification
- provider health checks
- stale pending order cleanup

All jobs must be idempotent and observable.
