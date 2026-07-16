# Test and Quality Strategy

## 1. Goal

Tests are executable product memory. They must prove deterministic correctness, user safety, money/entitlement integrity, privacy, accessibility, locale behavior, and recovery—not only component snapshots.

## 2. Test pyramid

### Unit and property tests

- Domain value objects, policies, state machines, calculators, formatters.
- Tarot uniqueness/order/orientation and limit rules.
- Numerology reduction/master-number/alphabet rules.
- Country eligibility and entitlement decisions.
- Money minor units, rounding, order/ledger transitions.
- Safety policy and structured-output validators.
- Locale formatting and message contracts.

### Integration tests

- Real PostgreSQL schema/repositories/transactions.
- Outbox/worker/idempotency.
- Auth/account merge and authorization.
- Provider adapters with signed fixtures.
- Webhooks, duplicate/out-of-order/refund/dispute.
- Privacy export/deletion.
- Content/prompt/translation publication.

### Browser E2E

- Anonymous first loop.
- Safe-question boundary.
- Tarot result → intention → free ritual → journal/revisit.
- Signup and anonymous merge.
- Checkout return + delayed webhook + entitlement.
- Subscription cancellation/refund request.
- Privacy export/deletion.
- Admin critical flow.
- Mobile, keyboard, RTL, reduced motion, provider/AI failure.

### Non-functional

- Accessibility automation plus manual checks.
- Performance budgets and load smoke.
- Security static/dynamic tests.
- Visual regression for stable components/core pages.
- AI eval/regression and red-team.
- Backup restore and disaster rehearsal.

### Observability and redaction baseline

- Exact W3C `traceparent` length/version/lowercase/nonzero validation and span rotation.
- Server-authoritative request IDs; client `x-request-id`, trace, baggage, and tracestate never become trusted context.
- JSON-serialized Web → persisted carrier → Worker → provider protocol continuity, with the production continuation capability confined to the Worker persistence boundary.
- Fixed service/environment/release/event/result taxonomies; no free-text, arbitrary attributes, raw errors, stack, cause, URL, headers, body, prompt, journal, prayer, birth data, or provider payload.
- Getter, `toJSON`, Proxy width, cycle, `BigInt`, symbol, function, control-character, UTF-8 byte-limit, clock, duplicate-end, invalid-carrier, sink-failure, and canary regressions.
- Real built-Web request proves `x-request-id`, correlated `http.proxy_handoff` JSON output, client-state override, and absence of secret canaries. This handoff test does not assert downstream response status/duration.

### Feature-flag and typed-registry baseline

- Registry metadata is deeply immutable, versioned, safe-off, and includes lifecycle plus a real
  cleanup reference; the client and general server entries expose no raw feature-flag factory.
- Snapshot tests cover wrong registry version, unknown/extra fields, duplicate versions,
  non-monotonic creation time, invalid UTC instants, unsorted scope, non-canonical locale,
  missing/wrong approval, missing gated scope, and redacted diagnostics.
- Evaluator tests use an injected server clock and prove default off, explicit off, approved on,
  country/locale mismatch, scheduled changeover, emergency off over a future activation, expired
  newest-version behavior without fallback, and automatic safe-off after the removal date.
- The database reader filters one exact registry version, uses deterministic ordering, an explicit
  projection, a 10,001-row fail-closed sentinel, ISO serialization, immutable output, and no
  mutation API; v1/v2 coexistence and rollback reads are isolated.
- Runtime privilege-attestation unit and composition tests reject owners, DDL/mutation privileges,
  privileged role attributes, table/column mutation including MAINTAIN, missing SELECT, ambiguous
  results, authenticated/current role mismatch, transitive membership escalation, and any
  caller-injected database source.
- Real PostgreSQL tests deploy both migrations twice; prove migrator/runtime/control ownership and
  grants, exact approval/scope RLS, approved-on control insertion, runtime/DDL/TRUNCATE denial,
  append-only history, registry coexistence, reset, and a row-security-aware non-empty logical
  dump/restore with exact row comparison.
- CI-shaped PostgreSQL repeats migration inventory/drift, empty default state, separated role
  ownership, controlled activation, registry coexistence, DDL denial, append-only behavior, and
  transaction rollback under non-superuser identities.

## 3. Deterministic test vectors

### Tarot

- Fixed mock entropy produces known ordered draws.
- No duplicate card in a spread.
- Orientation distribution rule.
- Server ignores client card selection.
- Idempotent request returns same draw.
- Different key creates a new draw subject to limits.

Do not make production randomness predictable merely to support tests; inject an entropy interface.

### Numerology

- Published worked examples per rule set.
- Edge dates, leap days, zeroes, master numbers, whitespace/diacritics.
- Unsupported script behavior.
- Explainable calculation steps match result.

### Astrology

- Licensed engine reference charts with tolerated numeric precision.
- Historical time-zone/DST cases.
- Unknown/approximate birth time.
- House-system and engine-version fixtures.
- AI fact verifier rejects altered placement.

## 4. Payment test matrix

For each provider adapter:

- Successful hosted checkout.
- User cancel/expiry/failure.
- Redirect before webhook.
- Webhook before redirect.
- Duplicate webhook.
- Out-of-order events.
- Invalid signature/replay.
- Amount/currency/product mismatch.
- Partial/full refund.
- Dispute and chargeback win/loss.
- Subscription start/renew/fail/grace/cancel/change.
- Provider timeout and reconciliation recovery.
- Entitlement grant/revoke exactly once.
- Country policy changes between order and fulfillment.
- Crypto quote expiry/confirmation/refund states where applicable.

Use provider sandboxes plus recorded sanitized fixtures. Never test production capture casually.

## 5. AI evaluation suites

- Fact accuracy and reference validation.
- Schema validity and fallback.
- Certainty/guarantee language.
- Medical/legal/financial requests.
- Self-harm/crisis.
- Delusion/paranoia/supernatural persecution.
- Relationship mind reading/coercion.
- Paid efficacy/fear conversion.
- Prompt injection and retrieved-content injection.
- Cultural mixing and unsupported source.
- Multilingual/RTL output.
- Empty, long, adversarial, and malformed input.
- Dependency/compulsion patterns.

Critical failure blocks release. Store fixtures and expected rubric/version in the repository without sensitive real-user content.

## 6. Accessibility testing

Automated:

- Static linting and browser accessibility scan.
- Color/contrast where tool supports it.
- Keyboard smoke and focus assertions.

Manual/assisted release checks:

- Screen reader on core loop and checkout status.
- 200/400% zoom.
- Reduced motion and audio-off.
- Touch target and orientation.
- Tarot/astrology visual text equivalents.
- Arabic RTL and CJK behavior.

## 7. Security testing

- Dependency, secret, and static code scans.
- Authorization/IDOR test helpers for every resource.
- XSS/HTML/Markdown/CSV/email injection fixtures.
- CSRF/CORS/header/CSP tests.
- SSRF/URL allowlist tests.
- Rate/abuse/denial-of-wallet tests.
- Admin privilege and audit tests.
- Webhook and idempotency tests.
- File upload tests.
- Prompt injection/data exfiltration evals.
- External penetration test before material public scale.

## 8. Privacy testing

- Analytics payload allowlist snapshot/schema.
- No sensitive values in logs, URLs, metadata, emails, notifications, error reports, cache keys, or client bundles.
- Export completeness and readability.
- Selective and account deletion propagation.
- Backup/retention documented behavior.
- Consent withdrawal and marketing suppression.
- Anonymous merge and deletion.

## 9. Localization testing

- Missing/unused keys and ICU placeholder parity.
- Pseudolocale expansion.
- RTL mirroring/directional icons.
- Date/time/time-zone/currency/number.
- Slugs, canonical, hreflang, sitemap.
- Locale fallback and no mixed-language critical flow.
- Screenshots for representative long German, Arabic, CJK, and Devanagari.
- Glossary/forbidden term and translation-source version checks.

## 10. Performance testing

- Bundle budgets and route-level JavaScript.
- Public Core Web Vitals lab and field monitoring.
- Image/font/audio/animation budgets.
- API latency by deterministic vs AI phases.
- Database query count/index analysis.
- Queue throughput/age and retry storm.
- Checkout/webhook burst.
- AI concurrency/cost caps.
- Graceful low-end mobile/slow network.

## 11. Coverage expectations

Use coverage to find gaps, not as a game:

- Critical domain modules (money, entitlements, country policy, deterministic calculations, authorization, safety validators): branch coverage target ≥ 90% plus mutation/property testing where valuable.
- Overall application code: maintain meaningful coverage, initially ≥ 75% as a signal.
- Every production bug gets a regression test when reproducible.
- Generated code, trivial bindings, and visual art are evaluated by appropriate tests, not forced into artificial unit coverage.

## 12. CI gates

Per PR, run the smallest affected matrix plus mandatory foundation:

- Format/lint/type/architecture boundaries.
- Unit/property.
- Integration with migrated PostgreSQL.
- Relevant E2E/a11y/i18n.
- Security/secret/dependency.
- AI eval subset when AI/content changes.
- Payment contract suite when commerce changes.
- Migration drift and generated-client check.
- Build and preview smoke.

The architecture gate parses package manifests, TypeScript configuration/extends chains, package
exports, and source ASTs. Mutation tests exercise deep/type-only imports, source and module cycles,
client-to-server bridge taint, environment/network/global aliases, unsafe dynamic loading and
property access, Node built-ins, JSDoc/type edges, provider leakage, cross-module assets, unsafe
export targets, symlinks, computed specifiers, dynamic framework configuration, and malformed or
unregistered inputs. CI invokes the exact root `pnpm check:architecture` command as its own mandatory
quality step; architecture enforcement is not hidden inside lint.

Nightly/full release runs expanded browser, AI red-team, performance, link/SEO, provider fixture, and flaky detection.

The M0 active workflow separates mandatory checks into `Quality`, `PostgreSQL integration`, and
`Security scans` jobs on GitHub-hosted Ubuntu 24.04 runners. It has read-only repository permission,
no repository secrets, no deployment environment, immutable action references, and a digest-pinned
ephemeral PostgreSQL service. Repository contract tests enforce that boundary before later tasks add
affected-area suites. Required-check and workflow-file protection are repository-owner settings and
must be verified on the eventual remote before RIT-004 can be marked done.

## 13. Test data

- Synthetic only by default.
- Factories with explicit sensitive-data classification.
- Never copy production journals/questions/birth profiles/payment payloads to local/CI.
- Provider fixtures are sanitized and licensed/allowed.
- Fixed AI eval prompts are synthetic and reviewed.

## 14. Release evidence

A release candidate has a machine-readable evidence bundle:

- Commit/build/config versions.
- Test and scan results.
- Migration plan/result.
- AI prompt/model/content/eval versions.
- Country/payment/legal approvals.
- Accessibility/performance report.
- Backup/rollback readiness.
- Known risks and owner acceptance.
