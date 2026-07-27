# 06 — Security Threat Model

## 1. Security objective

Protect private reflections, identities, wallet authentication, payments, Credits and provider credentials against account takeover, unauthorized access, tampering, replay, fraud, data leakage, denial of service and supply-chain compromise. The system must fail closed for authority and fail gracefully for user experience.

This threat model aligns the implementation with OWASP API Security risks, OWASP GenAI/LLM risks and NIST secure-development practices. It is a release artifact, not a one-time document; update it whenever a trust boundary, provider or privileged workflow changes.

## 2. Critical assets

1. Private questions, relationship context, journal entries, intentions and birth data.
2. Account identities, sessions, email tokens, passkeys and wallet links.
3. Stripe/Coinbase/AI/email credentials and webhook secrets.
4. Orders, subscriptions, Credit ledger, reservations and entitlements.
5. Tarot/numerology/astrology deterministic facts and content versions.
6. Prompt templates, safety policies and output schemas.
7. Admin privileges, audit logs, backups and encryption keys.
8. Brand trust and safety boundaries.

## 3. Trust boundaries

- Untrusted browser and JavaScript environment.
- Wallet extensions and WalletConnect transport.
- Public API edge.
- Application services and job workers.
- PostgreSQL and object storage.
- Stripe and Coinbase webhooks.
- DeepSeek/Kimi model APIs.
- Email/OAuth/WebAuthn providers.
- Admin and support tooling.
- CI/CD, dependency registry and deployment platform.

## 4. Threat register

| ID | Threat | Primary controls | Required negative test |
|---|---|---|---|
| AUTH-01 | Email/account enumeration | uniform responses, rate limits, hashed identifiers | existing and unknown email responses indistinguishable |
| AUTH-02 | Magic-link replay/theft | single-use hash, short TTL, device/session binding, rotation | second verification fails; expired link fails |
| AUTH-03 | OAuth login CSRF | state, nonce, PKCE, exact redirect allowlist | altered state or redirect rejected |
| AUTH-04 | Session fixation/hijack | rotate session after auth, `__Host-` Secure HttpOnly cookie, revoke | pre-auth session cannot retain privilege |
| AUTH-05 | Passkey cloning/replay | WebAuthn challenge, RP ID/origin validation, sign counter policy | wrong origin/challenge rejected |
| WALLET-01 | SIWE replay | server nonce, request ID, expiry, atomic consume | reused signature and nonce rejected |
| WALLET-02 | SIWE phishing/domain mismatch | exact domain, URI, scheme and origin checks | signature for another domain rejected |
| WALLET-03 | Wallet provider impersonation | EIP-6963 metadata treated as untrusted, icon sanitization | malicious SVG/provider metadata cannot execute script |
| WALLET-04 | Smart wallet signature misuse | ERC-1271 resolved on message chain; session revalidation policy | wrong chain/state or invalid magic value rejected |
| WALLET-05 | Account takeover through linking | recent step-up, explicit confirmation, uniqueness, audit | attacker cannot link wallet with stale session |
| WALLET-06 | Payment wallet silently becomes identity | separate data model and endpoint | checkout wallet absent from auth identities |
| API-01 | BOLA/IDOR | owner scope in every query, random IDs, negative tests, optional RLS | user A receives 404/403 for user B resource |
| API-02 | Broken function authorization | role policy, admin isolation, step-up | normal user cannot call admin/refund override |
| API-03 | Mass assignment | schema allowlists, server-owned fields | client price/status/user ID ignored or rejected |
| API-04 | Resource exhaustion | endpoint quotas, body/token limits, queues, timeouts | oversized/repeated requests throttled |
| API-05 | CSRF | SameSite cookie + CSRF token + origin checks | cross-site mutation rejected |
| API-06 | XSS/insecure output | escape by default, sanitize Markdown, CSP, no raw provider HTML | script payload rendered inert |
| API-07 | SQL/command injection | parameterized queries, no shell interpolation | payload cannot change query or execute command |
| API-08 | SSRF | no user-controlled fetch, provider allowlist, egress policy | internal/metadata URLs rejected |
| DATA-01 | Private content in logs/analytics | structured allowlist logging, redaction, telemetry tests | canary private text absent from logs/events |
| DATA-02 | Database compromise exposes plaintext | field-level envelope encryption, KMS, key rotation | sensitive columns are ciphertext and decrypt only in authorized service |
| DATA-03 | Backup leakage | encrypted backups, access control, restore audit | restore access restricted and logged |
| DATA-04 | Incomplete deletion | deletion workflow and evidence | deleted user cannot authenticate or retrieve content |
| PAY-01 | Client price/Credit tampering | server catalogue and product code only | modified amount ignored/rejected |
| PAY-02 | Forged webhook | raw-body signature and timestamp validation | invalid signature produces no state change |
| PAY-03 | Webhook replay/duplicate | unique provider event ID and idempotent handler | same event processes once |
| PAY-04 | Out-of-order events | monotonic state transition policy + provider retrieval | refund before success handled safely |
| PAY-05 | Return URL grants value | return reads server state only | crafted success query grants nothing |
| PAY-06 | Double issuance | transaction/outbox and unique constraints | concurrent success events issue Credits once |
| PAY-07 | Wrong crypto token/network/amount | USDC/Base allowlist, provider status and reconciliation | wrong chain/token/underpayment not marked paid |
| PAY-08 | Static address reuse/ambiguous attribution | single-use Coinbase checkout per order | payment to old/static address grants nothing |
| PAY-09 | Refund abuse | policy engine, unused Credit check, reversal linkage | double refund and spent-credit refund rejected |
| CREDIT-01 | Double spending | row lock/serializable/atomic reservation and constraints | concurrent reservations cannot exceed availability |
| CREDIT-02 | Negative/mutable balance | append-only ledger, integer constraints, projection verification | direct client balance update impossible |
| CREDIT-03 | Expiry/order violation | deterministic bucket allocation and expiry worker | consumed bucket order matches policy |
| RITUAL-01 | Consumable reused | atomic pass consume with session creation | two concurrent starts yield one session |
| AI-01 | Prompt injection | user content treated as data, no tools, fixed system prompt, input classifier | malicious instruction cannot reveal prompt or change policy |
| AI-02 | Insecure output handling | strict JSON schema, plain-text renderer, URL/HTML rejection | generated script/HTML does not execute |
| AI-03 | Sensitive disclosure | minimized context, provider retention settings, output scan | secrets/canary data not returned or logged |
| AI-04 | Model cost DoS | max chars/tokens, per-user quota, timeout, circuit breaker | high-rate/long requests limited and Credits released |
| AI-05 | Unsupported claims | pre/post safety validators and product-specific evals | prediction/diagnosis/other-person-mind claims blocked |
| AI-06 | Provider compromise/unsafe API | TLS, allowlist, schema validation, fallback rules | malformed/hostile provider response rejected |
| AI-07 | Credit lost on failure | reservation state machine and finally/reaper | timeout/error releases reservation exactly once |
| ADMIN-01 | Excessive support access | least privilege, step-up, purpose/ticket, expiry, audit | support role cannot read content without approved grant |
| SUPPLY-01 | Malicious dependency | lockfile, SCA, provenance, SBOM, review | critical advisory blocks release |
| SUPPLY-02 | Secret committed or exposed | secret scan, no browser secrets, rotation playbook | seeded fake secret detected in CI |
| DEPLOY-01 | Misconfiguration | IaC/config review, secure headers, environment separation | production build fails if sandbox/live flags conflict |
| AVAIL-01 | Provider outage | timeout, retry limits, queues, circuit breaker, graceful UI | outage does not duplicate charges or leak data |

## 5. Abuse cases specific to product

- Repeatedly requesting readings to seek certainty or reinforce harmful compulsion.
- Attempting to use relationship prompts to stalk, manipulate or infer another person's private thoughts.
- Medical, legal, financial or crisis prompts framed as divination.
- Prompt injection hidden inside relationship context or copied text.
- Automated AI generation intended to exhaust free/promotional Credits or provider budget.
- Multiple accounts/wallets used to farm promotions.
- Refund after consuming AI content or ritual passes.

Controls include content policy, cooling-off/rate limits, promotion anti-abuse, account/device risk signals with privacy review, clear refusal/reframe copy and human support paths.

## 6. Release security criteria

- No open Critical or High security findings.
- Medium findings have Owner-approved remediation dates and compensating controls.
- Independent penetration test covers auth, wallet linking, payment, Credits, BOLA, webhooks and AI endpoints.
- Dependency, secret, SAST and DAST scans pass.
- Restore, key rotation, incident response and provider kill-switch exercises pass.
- Security sign-off is based on evidence, not absence of reported incidents.
