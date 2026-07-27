# 07 — Security Engineering Requirements

## 1. Secure SDLC

- Track security requirements and threats as versioned backlog items.
- Require code review and passing CI for every change.
- Protect the main branch; no direct production commits.
- Pin dependencies and package-manager version; commit lockfiles.
- Generate an SBOM and release provenance for each production build.
- Run secret scanning, SAST, SCA and license checks on every pull request.
- Run DAST and authorization tests against staging.
- Keep development and build environments hardened and access-controlled.
- Maintain vulnerability disclosure and incident response procedures.

## 2. Browser and edge security

Required production headers, adjusted only with documented reason:

```text
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(self)
X-Frame-Options: DENY
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-site
Content-Security-Policy: default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self' https://checkout.stripe.com https://payments.coinbase.com; script-src 'self' <nonces/hashes and approved provider origins>; connect-src 'self' <exact provider origins>; img-src 'self' data: <approved wallet asset origins>; style-src 'self' 'unsafe-inline'; upgrade-insecure-requests
```

Do not copy this CSP blindly. Build an exact origin inventory, remove unused origins and use nonces/hashes. Wallet/provider icons must be local, sanitized assets where possible.

## 3. Session security

- Cookie name: `__Host-rituvia_session` or equivalent.
- `Secure`, `HttpOnly`, `Path=/`, no `Domain`, SameSite Lax/Strict based on verified OAuth flow.
- Rotate after every authentication, step-up and account merge.
- Idle and absolute expiry; revoke on logout, passwordless token reuse signal, identity unlink and account deletion.
- Store only a hash of bearer/session tokens.
- CSRF protection for all cookie-authenticated mutations.
- Exact origin/host validation; no wildcard credentialed CORS.
- Session management page with current and other devices.

## 4. Input and output handling

- Validate every boundary with an allowlist schema.
- Enforce body, field, array and nesting limits before parsing expensive content.
- Normalize Unicode where business rules require it without changing private text silently.
- Parameterize database queries.
- Never construct shell commands from user/provider input.
- Render AI and user content as escaped text or sanitized Markdown from a strict allowlist.
- Reject provider responses that do not match expected JSON schemas.
- Never use model output as SQL, code, URL, HTML, payment amount, permission or tool call.

## 5. Authorization

- Central policy functions for resource ownership and admin roles.
- Deny by default.
- Every list and object endpoint has cross-user denial tests.
- Use non-enumerable public IDs.
- Do not trust `userId` from the client.
- Admin/support actions require step-up, reason, ticket and immutable audit.
- Sensitive admin APIs live behind separate routes, roles and network/access controls.

## 6. Rate limits and anti-abuse

Separate limits for:

- email login requests and verification attempts
- wallet challenges and verification
- OAuth/passkey attempts
- Daily Tarot creation
- free Tarot draws/re-draw cooldown
- Deep Reading quote and generation
- checkout creation and refund request
- privacy export/deletion
- admin actions

Use user, session, IP-prefix and device-risk signals proportionately. Do not collect invasive fingerprinting without privacy review. Limits must fail safely and return `Retry-After`.

## 7. Secrets and keys

- All provider keys remain server-side in a managed secrets store.
- Separate keys per environment and least-privilege provider account.
- Webhook secrets are unique by environment and endpoint.
- KMS keys have versioning, access policies, rotation and break-glass procedures.
- No secrets in logs, source, screenshots, client bundles, CI artifacts or support tickets.
- Test key rotation before production launch.

## 8. Data protection

- TLS 1.2+ externally; encrypted service connections internally.
- Field-level envelope encryption for private content.
- Database and backup encryption.
- Data minimization and purpose-specific consent.
- Provider metadata excludes private questions, journals and birth details.
- Analytics events use product/action IDs only.
- Retention jobs are enforced and testable.
- Export/delete APIs require recent authentication and are rate-limited.

## 9. Webhook security

- Capture raw bytes before JSON parsing.
- Verify signature and timestamp with provider SDK/specification.
- Persist provider event ID/hash before processing.
- Acknowledge only after durable acceptance.
- Process asynchronously and idempotently.
- Retrieve provider object for ambiguous or high-value transitions.
- Allow out-of-order transitions through a defined state machine.
- Dead-letter failures and alert.
- Webhook endpoints bypass CSRF but require signature and strict body/size limits.

## 10. Availability and recovery

- Timeout and bounded retry on every provider call.
- Circuit breakers and provider kill switches.
- Queue backpressure and per-user concurrency limits.
- PostgreSQL PITR and tested restore.
- Encrypted backup isolation.
- RPO/RTO documented before beta.
- Runbooks for Stripe, Coinbase, wallet RPC, email and AI provider outages.
- No provider outage may create duplicate payments, lost Credits or permanent reservations.

## 11. CI security gates

Minimum pipeline:

```text
format → lint → typecheck → unit → contract → database integration
→ authorization/security-negative tests → build → SBOM/provenance
→ SCA/license → secret scan → SAST → browser E2E/a11y/visual
→ staging deploy → DAST → smoke/reconciliation tests
```

Critical/High findings block merge and deployment. Suppressions require written reason, scope, expiry and approver.
