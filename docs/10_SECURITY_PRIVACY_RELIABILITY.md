# Security, Privacy, and Reliability

## 1. Security goals

Protect private spiritual/reflection data, identity, money, entitlements, content integrity, and the ability to recover. Assume the product will attract account takeover, scraping, prompt injection, payment abuse, content attacks, and privacy scrutiny.

## 2. Threat model domains

- Account takeover, session theft, magic-link abuse, enumeration.
- Unauthorized access to journals, questions, birth profiles, or orders.
- IDOR/BOLA across all user resources.
- Injection: SQL, XSS, Markdown, template, command, prompt, CSV, email header.
- CSRF and cross-origin abuse.
- SSRF through URL/content/import/provider callbacks.
- Malicious uploads and stored content.
- Webhook forgery/replay and entitlement theft.
- Price/product/country manipulation.
- API scraping, bot abuse, redraw/AI cost exhaustion.
- Supply-chain and dependency compromise.
- Secret exposure in source, logs, preview deployments, or client bundles.
- Admin compromise and unsafe mass actions.
- AI prompt injection, data exfiltration, unsafe output, and model/provider leakage.
- Backup loss, corruption, migration failure, regional/vendor outage.

Maintain a versioned threat model and update it for every major feature/provider.

### Astrology location privacy

- Treat place queries, selected birth locations, local birth time, coordinates, and derived UTC
  instants as private birth-profile data.
- Never put a raw place query in a URL, browser history, access/error logs, analytics, traces,
  shared cache, or public metadata. The planned GET route remains unimplemented pending OWN-014.
- Normalize and bound search, require explicit selection when results are not unique, and reread an
  opaque provider location ID before resolution; never accept client-authored coordinates or zone.
- Use only bounded process-memory search caching with HMAC-only keys, exact provider/data-version
  partitioning, at most 64 entries and 15 minutes, timeout cancellation, failure eviction, and
  stable redacted errors.
- Fail unavailable on provider/runtime/version failure. Never substitute browser zone, current
  offset, first/nearest result, remote fallback, or UTC.

## 3. Identity and authorization

- Prefer phishing-resistant passkeys and magic links with secure expiration/one-time use; social auth is adapter-based.
- Rotate sessions on authentication/privilege change.
- Hash session/token material; secure, HttpOnly, SameSite cookies.
- Rate limit and avoid account enumeration.
- Central authorization policy checks resource ownership and roles server-side.
- Admin requires MFA/passkey, recent re-auth for sensitive actions, least privilege, and audit.
- Test every object endpoint for cross-user access.
- Provide session/device revocation.

### Account authentication baseline

- Accept valid magic-link starts uniformly with `202`; never vary the response by account
  existence or return email, token, state, or a tokenized local callback.
- Keep the development preview adapter hard-disabled outside local. It exposes one constant
  no-query preview route and consumes the one-time challenge through an `HttpOnly`,
  `SameSite=Lax`, host-only state cookie.
- Encrypt normalized email and store only versioned hashes for challenge token/state, previous
  session, and final session bearer. Challenge completion is short-lived, one-time, and replay
  safe.
- Enforce one database-atomic global start limit plus a bounded keyed identifier-bucket limit.
  Store no plaintext email, IP, user-agent, device fingerprint, or arbitrary abuse attributes.
- Create a fresh session after authentication and revoke only a matching active prior session for
  the same account. Account cookies are host-only `Secure`, `HttpOnly`, `SameSite=Strict`, and use
  fixed absolute expiry.
- Bootstrap a one-way session-bound CSRF token from `GET /api/v1/me`, retain it only in browser
  memory, and require it for account/profile mutations, merge, logout, logout-all, and targeted
  session revocation.
- Merge anonymous ownership only during authentication completion or the dedicated account-merge
  endpoint. Challenge consumption, account/session creation, link insertion, and anonymous-session
  revocation commit or roll back together. Explicit merge rotates the account session, returns a
  CSRF token bound to the successor cookie, and exact same-source/same-key retries recover the same
  successor after a dropped response.
- Bind append-only merge evidence to the target user, anonymous subject, source anonymous session,
  source account session, keyed idempotency digest, and canonical request digest. Reject a
  different account, source session, or key without revoking either caller.
- Do not clear the account cookie when durable logout/revocation storage is unavailable; report a
  retryable dependency failure so the browser does not claim a server session ended.
- Resolve account history only from the active account session and immutable subject links; accept
  no client user/subject identifier. Select minimal metadata from currently visible source rows,
  keep private prose out of list responses, URLs, browser storage, logs, analytics, metadata, and
  screenshots, and preserve indistinguishable cross-owner/missing detail responses.
- List active sessions with timestamps only. Do not collect or infer device names, location, IP,
  user agent, fingerprint, or trust score for this control. Targeted revocation cannot revoke the
  current session, cannot cross accounts, and must commit before the UI reports success.
- Treat passkeys as schema-ready only until RP/origin, registration/assertion, recovery,
  attestation, UX, provider, and production activation are separately approved.

### Anonymous-session baseline

- Generate 256-bit random bearer tokens and store only a versioned SHA-256 digest. Send the raw
  token only in a `Secure`, `HttpOnly`, `SameSite=Strict`, host-only cookie with `Path=/`.
- Use a database-clock-derived absolute expiry. Activity may update bounded last-seen metadata but
  must not extend expiry. Missing expiry policy configuration disables issuance rather than
  inventing a legal retention period.
- Treat the cookie as strictly necessary for the user-requested anonymous flow, never as evidence
  of optional analytics, personalization, marketing, or model-improvement consent.
- Keep optional consent append-only per purpose and notice version. Absence, denial, withdrawal,
  malformed history, an expired subject/session, or a stale notice fails closed.
- Keep signed-in analytics, AI personalization, and model-improvement consent in independent
  account-owned append-only sequences. Recheck the exact current purpose and notice at each
  sensitive data-flow boundary; do not cache consent at login, page load, queue creation, or
  purchase. A committed withdrawal must stop later reads immediately.
- Require exact same-origin request evidence, an empty request body, and a high-entropy idempotency
  key at the only anonymous-session endpoint. Do not expose subject/session IDs or the token in the
  response body, URLs, logs, analytics, or public error details.
- Use one database-atomic global issuance-capacity gate as the privacy-minimal baseline. It stores
  no IP address, user-agent, device fingerprint, or free text and is not claimed to be a complete
  production abuse-control system.
- Before each identity operation, attest that runtime is a non-owner, non-privileged role with
  exact table reads, exact inserts, and only lifecycle-column updates; reject DDL, delete,
  consent mutation, expiry/hash/ownership mutation, role switching, and reachable privileged
  membership.

## 4. Application security

- Validate inputs/outputs at every boundary with shared schemas.
- Parameterized database access and safe ORM usage.
- Escape output; sanitize allowed rich text; no arbitrary HTML.
- Content Security Policy, frame protection, secure headers, HTTPS/HSTS in production.
- CSRF protection for state-changing cookie-authenticated requests.
- Bootstrap a session-bound one-way CSRF token from the anonymous-session response, keep it only in
  memory, and require it together with exact Origin/Sec-Fetch-Site checks on intention mutations.
- Strict CORS; no wildcard credentials.
- URL allowlists and egress controls for server fetches.
- Native SCA sends only the immutable upstream commit to a bounded OSV query, rejects malformed or
  duplicate findings, and fails on every returned vulnerability record. A zero-record response is
  evidence of that query, not a guarantee of complete C/C++ advisory coverage.
- Native Corresponding Source rehearsals include exact checksum-attested vendor source/data,
  verify the extracted inventory, block curl during the rebuild, and compare complete engine
  metadata. Component rehearsal artifacts stay ignored and cannot substitute for clean public
  deployed-version source.
- File upload type/size/content validation, malware scanning where needed, private storage, signed URLs.
- Do not expose stack traces or internal identifiers to clients.
- Secure error codes with correlation IDs.

## 5. Secrets and key management

- Secret manager per environment.
- No secrets in Git, build logs, issue text, screenshots, analytics, or client bundles.
- Separate provider keys and least privilege.
- Rotation runbook and key versioning for encrypted fields.
- Separate the active encryption key version from the retained digest-key version so encryption
  rotation cannot change idempotency or canonical-request hashes for live records.
- Webhook secret overlap during rotation.
- Detect committed secrets in CI and pre-commit.
- Production secret access is an owner approval gate.

## 6. Sensitive data controls

- Data inventory and purpose/legal basis per field.
- Encrypt in transit and at rest; application/field encryption for private free text and birth details where practical.
- Redact logs and traces by default.
- Separate access permissions for support/payment/content/private data.
- No sensitive data in URLs, referrers, page titles, OG metadata, email subject, lock-screen notifications, or analytics.
- Do not use private spiritual content for ad targeting or model training without separate explicit opt-in and review.
- Privacy-preserving deletion/export and backup expiry.

## 7. AI security

- Treat user question, retrieved content, translations, and model output as untrusted.
- Delimit data from instructions and apply prompt-injection tests.
- Tool access is minimal and allowlisted; interpretation generation does not get database/payment/admin tools.
- Validate structured output and deterministic references.
- No secrets or broad user history in prompts.
- Provider retention/training settings are documented and configured.
- Cost/rate limits and model fallback prevent denial-of-wallet.

## 8. Payment security

- Hosted payment surfaces; no raw card data.
- Signed raw-body webhook verification and replay/idempotency controls.
- Server authoritative product/price/country/entitlement.
- Append-only event/ledger timeline.
- Reconciliation and alerting.
- Admin refunds require re-auth, reason, limits, and audit.
- Crypto remains hosted/non-custodial.

## 9. Abuse controls

- Layered rate limits by route, subject, account, and safe network signal.
- Bot protection on signup, expensive generation, checkout, support, and privacy endpoints.
- Usage quotas enforced server-side.
- Content report and account suspension flows.
- Scraping controls that do not block legitimate accessibility/search crawlers.
- Avoid invasive fingerprinting unless a documented risk/legal review approves it.
- Abuse signals never become spiritual/profile judgments.

## 10. Privacy rights

Implement workflows for:

- Access/export.
- Correction.
- Selective deletion.
- Account deletion.
- Consent withdrawal.
- Marketing unsubscribe.
- AI personalization/data-use choices.
- Objection/restriction where applicable.

Requests require identity verification, status/deadline tracking, audit, and clear handling of legally retained financial/security records.

RIT-053 records one immutable authentication instant per account session and preserves it across
anonymous-merge bearer rotation. Privacy export request, metadata, and download all require that
the requesting session itself remains within the configured recent-authentication window; another
device's sign-in cannot refresh it. Creation is same-account serialized and rate-limited,
idempotent, owner-scoped, and session-CSRF protected.

The export builder uses explicit category/field allowlists and decrypts private content only inside
the authorized Web server boundary. It emits matching machine-readable JSON and human-readable
Markdown, then stores only dedicated-key AES-256-GCM ciphertext bound to account, export, schema,
key version, creation, and expiry. Downloads are authenticated POST responses with private
no-store/noindex headers, never bearer URLs. Request, one-per-request artifact, and audit rows are
append-only; runtime has no update/delete privilege and audit remains private-content free.
Production worker/object storage, final retention, legal copy, and delivery remain owner-gated.

RIT-054 implements a recent-authenticated, same-origin/session-CSRF deletion boundary with exact
scope idempotency and account-level serialization. Selective deletion immediately revokes linked
anonymous authority, privacy-marks ownership links, destroys private ciphertext/generated prose
with non-decryptable tombstones, and deletes encrypted export artifacts while leaving the account
usable for new data. Account deletion additionally clears direct profile and temporary checkout
capability data, stores a one-way provider suppression record, tombstones identity material,
revokes all sessions/passkeys, and supports only exact completion replay through the revoked
request token. Export completion shares the account fence so a pre-deletion snapshot cannot
recreate an artifact.

Financial/ledger, consent, security, privacy request, suppression, and completion evidence remains
pseudonymous and append-only under existing source retention. Final retention periods,
provider-side erasure, backup expiry, production migration, legal copy, deployment, and launch
remain owner-gated.

RIT-045 keeps service-reminder authority separate from optional analytics, personalization, model
improvement, and marketing consent. Subscribe/unsubscribe writes are account-owned, exact-version,
same-origin/session-CSRF protected, and successful only after database commit. The queue stores
identifiers and versions only. Claim and pre-provider authorization both reread active account,
ownership link, Revisit/intention lifecycle, locale, local date/time zone, quiet hours, preference,
contract version, and lease. Unsubscribe clears a live lease; privacy deletion atomically
cancels all account reminder rows before identity tombstoning. Fixed subject/preview/body omit all
private reflection content. Provider rejection, timeout, lease expiry, retries, and dead letters
use finite codes and identifier-free observability events. Production provider credentials,
recipient resolution, domain reputation, legal copy, metrics/alerts, and sending remain disabled.

Deletion uses a separate `PRIVACY_DELETION_DATABASE_URL` whose login has exact destructive column
grants and deletion-only RLS policies. The ordinary application/interpretation runtime retains
only the read access needed for identity suppression and export-finalization fencing; it cannot
delete export artifacts or rewrite verification output.

RIT-057 hardens that role so the presented deletion bearer is hashed and installed only as a
transaction-local PostgreSQL setting. A security-barrier view resolves the hash to one account,
and row-level policies restrict every deletion query and mutation to that account. Direct
cross-user SELECT and UPDATE attempts with the dedicated credential are exercised by the isolated
database gate. Privacy API methods and paths are explicitly admitted by the Web proxy, while
export metadata reads reject cross-site request metadata and preserve private empty failures.

The composed identity/privacy/authorization gate covers account authentication, merge, account
controls, export, deletion, admin policy, redaction, analytics, metadata, PostgreSQL recovery, and
real-browser export-to-deletion behavior. The admin service remains safe-off with no production
credential, route, UI, enrollment, or WebAuthn assertion issuer. Before any admin activation,
role mutation and audit append require a reviewed database-bound privileged procedure or
equivalent database-enforced step-up capability; possession of a service credential alone is not
approved production authority.

## 11. Reliability objectives

Initial post-launch objectives:

- Core application availability: 99.9% monthly.
- Successful verified payment → entitlement p99 within 60 seconds, with reconciliation recovery.
- RPO: ≤ 15 minutes for primary transactional data after maturity; initial target documented by vendor capability.
- RTO: ≤ 4 hours for core service during initial launch, improving with evidence.
- No single AI/provider outage blocks deterministic free value or account/order access.

Finalize objectives before launch and align alerting/runbooks.

## 12. Resilience patterns

- Timeouts and bounded retries with jitter.
- Circuit breakers/fallbacks for AI, email, geo, astrology, and provider APIs.
- Outbox and idempotent workers.
- Dead-letter queue with replay tooling.
- Degraded deterministic interpretation template when AI fails.
- Read-only or maintenance mode for high-risk incidents.
- Feature/kill switches per provider/country/modality.
- Backpressure and concurrency limits.
- No unbounded queues or retry storms.

## 13. Backups and recovery

- Automated encrypted database backups and point-in-time recovery where available.
- Object-store versioning/lifecycle where appropriate.
- Separate backup access from production app credentials.
- Documented restore procedure into an isolated environment.
- Quarterly initially, then regular restore tests with evidence.
- Backup retention aligned with deletion/legal policy.
- Infrastructure and configuration reproducible from code/documented provider state.

The feature-flag version table uses forced row-level security and separate migrator, read-only
runtime, and append-only control identities. Logical dumps run as runtime with row security and
INSERT-form data; restore runs as the non-superuser migrator into an empty isolated database, then
reapplies least-privilege grants. The test backs up non-empty off and approved-on history, compares
restored fields exactly, and re-attests RLS, constraints, runtime DDL/TRUNCATE denial, and control
update denial. It never disables RLS or gives the runtime ownership/bypass privileges.

### Feature-flag failure boundary

- Missing, malformed, unknown-version, future-only, expired, out-of-scope, or stale-removal records
  resolve to disabled or reject snapshot construction; none become truthy through coercion.
- Owner-gated flags require the exact gate-prefix reference plus their required country/locale
  shape; the control credential is granted only after the referenced owner record exists.
- Evaluation time is supplied by a server-owned clock rather than a request field.
- Raw evaluator construction is restricted to one exact Web composition adapter; runtime scope is
  server policy context, not client-supplied authorization evidence.
- The exported Web loader is zero-argument and owns runtime configuration lookup plus database
  client lifecycle, so another server module cannot inject a fake persistence adapter.
- Each loader invocation attests the connected PostgreSQL identity before reading and rejects
  database/schema/table owners, DDL privileges, mutation privileges, superuser/bypass-RLS roles,
  CREATEDB/CREATEROLE/REPLICATION, table or column mutation including MAINTAIN, missing SELECT,
  ambiguous results, preselected startup roles where `session_user` differs from `current_user`, and
  any direct or transitive role-membership path to those capabilities, including membership that is
  currently marked non-settable.
- A later-created emergency-off version outranks future scheduled lower versions, and retired keys
  remain forced off until cleanup and a later registry-version removal.
- Snapshots and results contain bounded identifiers and categorical metadata only—never customer
  identifiers, private text, secrets, provider payloads, or arbitrary JSON.
- The database reader is bounded one record beyond the parser maximum so oversized state fails
  closed instead of being silently truncated.
- Runtime access to `feature_flag_version` is read-only. The separate append-only control identity
  and policies are modeled and exercised locally/CI, but a production credential grant, approval-record system,
  change workflow, cache/invalidation strategy, and emergency operator UX do not yet exist and must
  not be claimed.

## 14. Observability

### Logs

Structured, redacted, environment/service/version/trace IDs; no sensitive content.

The M0 baseline uses fixed discriminated operational events only. It has no free-text log message, arbitrary attribute, raw `Error`, or public raw-sink API. Unknown fields are discarded through bounded own-data-descriptor reads; accessors, `toJSON`, control characters, invalid metadata, malformed IDs, and writer failures fail closed without echoing input. JSON-line output has a UTF-8 byte limit. Architecture policy reserves console output for the exact Web and Worker observability writers and rejects direct process output in production runtime modules.

### Metrics

Traffic, latency, errors, saturation, queue depth/age, job failures, database pool, provider latency/errors, AI schema/fallback/cost, payment/entitlement/reconciliation, email, storage, cache, security signals.

### Traces

Propagate correlation through Web → database/outbox → worker → provider. Strip sensitive attributes.

The M0 Web proxy ignores and overwrites client request/trace state, returns only a server-generated correlation ID as `x-request-id`, and injects server-generated correlation plus W3C `traceparent` for downstream server handling. Its current `http.proxy_handoff` span measures successful proxy handoff only; it does not claim downstream status or full request duration. The versioned job carrier survives JSON persistence and rotates span IDs, but production continuation is isolated behind a Worker-only capability and an unconstructible persisted-envelope type. RIT-045 adds one narrow database-backed Revisit reminder reader/lease state machine, but it is not wired to the generic trace carrier, a scheduler process, production metrics, or a provider. Other Web → Worker → provider chains remain protocol evidence rather than deployed asynchronous paths. Baggage and tracestate are not accepted or propagated.

Production metrics, alert routes, retention, sampling, external exporters, and error-monitoring vendors remain later owner-reviewed work.

### Alerts

Actionable, severity-based, with runbook and owner channel. Avoid alerting on normal user behavior or exposing content.

## 15. Incident severity

- **SEV-0:** active broad compromise, money/data integrity catastrophe, or unsafe public behavior requiring immediate shutdown.
- **SEV-1:** significant security/privacy/payment/data loss or core outage.
- **SEV-2:** degraded major feature/provider with workaround.
- **SEV-3:** limited issue without urgent harm.

Every SEV-0/1 gets containment, owner notification, evidence preservation, legal/provider assessment, user/regulator decision, recovery, and postmortem.

## 16. Secure development lifecycle

Per PR:

- Lint/type/unit/integration/E2E as applicable.
- Dependency and secret scan.
- Static security checks.
- Migration review.
- Authorization/privacy/payment/AI checklist.
- Codex independent review and human approval for gates.

Regularly:

- Dependency update PRs.
- Threat-model review.
- External penetration test before material public scale or after high-risk change.
- Backup restore.
- Incident tabletop.
- Permission/audit review.
- AI red-team suite.

## 17. Release blockers

No production launch with:

- Critical/high exploitable vulnerability.
- Unknown private-data paths or untested export/deletion.
- Missing payment webhook/reconciliation tests.
- Missing backups/restore evidence.
- Unbounded AI or expensive endpoint abuse.
- Missing admin MFA/audit.
- Critical accessibility blockers in the core loop.
- Unapproved country/payment/legal/model configuration.

## 18. Local share-artifact privacy boundary

RIT-115 does not screenshot, upload, persist, cache, or publish private result pages. Its one-card
projection has an exact public-field allowlist and cannot receive the reading identifier, private
question, interpretation, birth data, intention, journal text, account data, or arbitrary response
object. Canonical URLs reject credentials, queries, fragments, and private result paths; SVG text
is bounded, normalized, checked for control and bidi characters, and XML-escaped.

Preview and download object URLs are local and revoked after replacement or closure. Native
sharing is available only when the browser proves it can share the exact SVG file; there is no
silent link-only fallback, provider request, public token, or analytics event. The CSP expands
only `img-src` with `blob:` and retains the existing closed connect, script, object, frame, worker,
media, and external-image boundaries.
