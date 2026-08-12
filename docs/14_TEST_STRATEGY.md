# Test and Quality Strategy

## 1. Goal

Tests are executable product memory. They must prove deterministic correctness, user safety, money/entitlement integrity, privacy, accessibility, locale behavior, and recovery—not only component snapshots.

## 2. Test pyramid

### Layered execution cadence

- Inner loop: run the smallest test files or package commands that exercise the changed contract.
- Ordinary task closure: run affected-package format, lint, type, architecture/evidence checks and
  only the applicable integration, database, browser, accessibility, security, payment, or AI
  suites.
- Milestone integration and release: run the complete workspace matrix, including all unit tests,
  PostgreSQL foundation, production build, accessibility/browser, AI, configuration, migration,
  generated-evidence, and secret gates.
- Trigger a complete matrix earlier when a change touches shared toolchain/runtime infrastructure,
  cross-package public contracts, security-critical primitives used broadly, migration execution,
  or when focused tests expose unexplained cross-cutting behavior.
- Reuse prior passing evidence only when the tested source, dependencies, toolchain, configuration,
  and generated inputs are unchanged. Record reused evidence and the reason it remains valid.
- Keep command output bounded during iteration. Full logs belong in retained evidence artifacts,
  not repeated chat output.

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

RIT-047 keeps the intention, ritual, and Revisit browser scripts independently runnable for
diagnosis, then composes them with one continuous production-artifact Chromium journey in
`test:accessibility`. The continuous gate must use one anonymous context and same-tab navigation,
bind the exact displayed reading, inject stable-key manual recovery without automatic retry,
complete and delete private reflection resources, and audit private canaries across every document
transition. It is a deterministic first-party boundary acceptance test, not evidence that a
deployed backend or production provider is active.

RIT-050 adds `test:account-auth-browser` as a separate production-artifact gate using the real
local PostgreSQL identity boundary. It verifies uniform start shapes, absence of browser-visible
bearer material, exact local preview routing, cookie flags, one-time use, same-account rotation,
old-token rejection, session-bound CSRF, durable logout, `429` retry behavior, 320px layout,
keyboard completion, and serious/critical axe findings. It stays independently runnable and does
not force the complete browser matrix during an ordinary authentication task.

RIT-051 adds `test:account-merge-database` and extends the focused account-auth browser gate. The
database gate deploys migrations twice and proves same-source/same-key concurrency returns one
link and one deterministic successor; response-loss replay, different-key and cross-account
conflicts, preexisting-history visibility, failure rollback, composite source-session provenance,
hash-only audit evidence, and runtime update/delete denial. The browser gate proves successor
cookie/CSRF rotation, anonymous-cookie clearing, original-token rejection, and exact dropped-
response retry without running the unrelated complete workspace unit suite.

RIT-052 adds `test:account-control-database` and `test:account-control-browser`. The isolated
PostgreSQL gate proves stable multi-page history across linked subjects, all current reflection
resource types, expiry/deletion filtering, cross-account exclusion, absence of private prose,
optimistic profile conflicts, current-session protection, targeted revocation, logout-all, and
unrelated-account survival. The production-artifact browser gate proves mobile/keyboard account
settings, conflict feedback, current/other timestamp-only sessions, durable targeted/all-session
logout, empty/error-safe history behavior, privacy, layout, and serious/critical accessibility
checks. Focused route tests retain equal-shape cross-owner coverage for readings, intentions,
rituals, journals, Revisits, sessions, orders, and entitlements; the complete workspace suite
remains reserved for RIT-057.

RIT-053 adds focused configuration, artifact-cryptography, package-builder, and HTTP route tests
plus `test:privacy-export-database`. The isolated PostgreSQL gate deploys all migrations twice and
proves merge-preserved authentication time, stale-auth denial, one same-account concurrent request,
same-key replay, owner isolation, complete category shape, expiry, NULL artifact rejection,
one-per-request artifact uniqueness, append-only request/artifact/audit privilege boundaries, and
runtime update/delete denial. Builder tests prove
authorized email/intention/journal/Revisit decryption, matching JSON/Markdown views, resource AAD
binding, independent export keys, tamper failure, and ciphertext removal. The complete identity/
privacy/authorization matrix remains reserved for RIT-057.

RIT-054 adds focused configuration and strict HTTP route tests plus
`test:privacy-deletion-database`. The isolated PostgreSQL gate deploys migrations twice and proves
same-account dual-session serialization without deadlock, exact private/account replay including a
dropped account response, scope conflict/rate control, link-denied history, anonymous/account
session revocation, ciphertext canary destruction, export artifact destruction and finalize
fencing, provider suppression and reauthentication denial, append-only completion, and runtime
least privilege. A custom-format dump/restore then proves the deleted account remains disabled,
exact terminal replay survives recovery, and no private canary reappears. The complete
identity/privacy adversarial matrix remains reserved for RIT-057.

RIT-045 adds focused Domain, Worker, Web route/server/proxy/message tests plus
`test:revisit-reminder-database`. The isolated PostgreSQL gate deploys all migrations and proves
account ownership, exact replay and changed-key conflict, old-key stable replay after withdrawal,
quiet-hours suppression, one-winner concurrent claims, public mapping of leased state, live
pre-provider authorization, stale lease rejection, bounded retry, terminal dead letter, immediate
unsubscribe, once-only completion, privacy canary absence, append-only operations, and runtime
update/delete denial. Existing privacy export/deletion gates prove the new table does not break
least privilege. The focused Revisit browser verifies committed-only opt-in/out, no delivery
request, offline/RTL/320px/touch/axe/privacy behavior; the continuous anonymous loop verifies the
safe empty account state without console errors. The full unit matrix remains reserved for the
next milestone/release trigger.

RIT-104 extends that focused boundary with lifecycle source/runtime checksum and parity tests,
strict safe-header/control/link validation, exact locale/date/time-zone/quiet-hours formatting,
HTML/plain-text equivalence, delivery suppression, preview-only fallback telemetry, support-receipt
preview, template-version rejection, and a real-PostgreSQL claim/authorization race where the
Revisit date or time zone changes after claim. `test:lifecycle-message-preview` renders three
messages in Chromium at 320 pixels, runs Axe, and denies external requests, storage writes, layout
overflow, or locale activation. `test:revisit-browser` proves the GET-safe preference deep link
focuses settings without changing consent.

RIT-057 adds `test:identity-privacy-authorization`, which composes focused authentication, merge,
account-control, export, deletion, admin-policy, observability, analytics, metadata, PostgreSQL
recovery, and production-artifact browser gates without hiding their stage labels. Its
`test:privacy-control-browser` flow signs in, exports, reads metadata, downloads, deletes the
account, proves old-session and export denial, replays the dropped deletion response, and checks
browser/server privacy canaries. The deletion database gate also connects as the dedicated role
and proves another account is invisible and immutable under the presented account's request token.
At Milestone 5 closure the complete workspace unit/integration/accessibility/security matrix runs
once; later documentation-only changes reuse that evidence under D-050.

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

- Historical Selection V1 preserves the superseded Professional contract model. Active Selection
  V2 separates library release from source/data snapshot and checks owner AGPL approval,
  whole-project license, exact Corresponding Source policy, source/data checksums, privacy,
  attribution, fallback, and exit path.
- Selection V1 is structurally production-safe-off. Integration readiness requires immutable
  evidence records and a caller-supplied independent evidence authority; catalog JSON cannot
  authorize its own license. Authority requests bind the exact selection-manifest digest and each
  code-specific subject digest, enforce reviewer-role/independence rules, and reject future-dated
  review evidence.
- Local Swiss Ephemeris source/build integration requires independently verified D-069 approval,
  the root AGPL license, and a pinned manifest. Missing Corresponding Source, incompatible license
  material, runtime download, or unpinned native artifacts fail the architecture/SCA gate.
- `@rituvia/divination` remains pure; native code must use a registered server-only adapter zone.
- Reproducible hardened native build, compiler/flags, ABI, SBOM, archived source/data, and read-only
  vendored DE441 data with exact SHA-256 inventory.
- macOS local security evidence uses UBSan plus 151 deterministic mutation/boundary cases because
  the bundled Apple clang ASan runtime is incompatible with the current host. Linux is the release
  gate for ASan+UBSan and 5,000 bounded libFuzzer runs. A fresh Ubuntu 24.04.4 arm64 environment
  passed that exact gate on 2026-07-27; release CI must repeat it for the immutable release
  revision.
- Native SCA queries only the exact pinned upstream commit through a bounded OSV API contract,
  rejects malformed/duplicate records, and fails closed on any returned vulnerability. A
  zero-record result is recorded precisely and is not treated as proof of complete C/C++
  vulnerability coverage.
- The native-component Corresponding Source drill must archive all bridge/build/test/interfaces,
  notices, patched-dependency inputs, pure package source dependencies, lock/config inputs, and
  exact Swiss source/data; suppress host xattrs; verify every extracted hash; place a rejecting
  curl shim first in `PATH`; and reproduce the baseline engine metadata offline. A fresh Linux
  extraction must also support a frozen-lockfile install. This rehearsal does not replace a clean
  complete archive for the exact deployed project revision.
- The complete release-source gate must bind an explicit 40-character Git revision, require a
  clean worktree and a narrow ignored-input allowlist, reject non-regular Git/archive entries,
  case collisions, unresolved Git LFS pointers, environment redirection, component checksum or
  source drift, and existing output replacement. Its expected inventory is computed in process
  from the exact Git archive plus checksum-attested vendor source and must match the extracted
  payload before an offline native rebuild. Pull-request rehearsal does not replace final
  release-revision archive retention, upload/readback verification, or public source-link checks.
- Approved-method catalog digest and strict exact/approximate/unknown publication invariants.
- Official Swiss Ephemeris `setest` regression vectors with explicit per-field tolerances; these
  validate upstream/bridge consistency and do not replace independent astronomical comparison or
  qualified external review.
- A checksum-bound Astronomy Engine `2.1.19` corpus independently recomputes forty geocentric
  apparent true-ecliptic-of-date Sun/Moon/planet vectors across 1801, 1888, 2000, and 2050. Both
  normal and sanitizer-native gates enforce `0.02°` longitude/latitude and `0.001`
  relative-distance limits. True Node and Placidus houses are explicitly excluded from this
  independent claim and retain their separate Swiss flag/upstream regression evidence.
- Owner/profile-revision binding, encrypted append-only persistence, exact replay conflict,
  least-privilege grants, privacy export V2, and crypto-shred deletion.
- The canonical `experience.astrology` control drill must prove default off, `OWN-015` and empty
  scope enforcement for activation, emergency off without mutation, runtime read-only access, and
  logical restore of the latest-off immutable history.
- Web runtime composition must evaluate the live canonical flag before loading native metadata,
  reject security-profile metadata in the production loader, and keep API/UI activation separate
  from server-only composition.
- Historical time-zone fixtures include non-hour offsets, New York fold/gap, Samoa's skipped local
  date, explicit earlier/later disambiguation, and limited pre-1970 confidence.
- Location-provider contract fixtures cover normalized bounded search, zero/one/multiple results,
  duplicate/hostile/mismatched provider data, opaque location reread, exact provider/data digest,
  raw-query isolation, HMAC cache partitioning, single flight, TTL, timeout, and failure eviction.
- The Node/ICU/tzdata runtime is an exact calculation input. Version drift fails the focused gate
  until fixtures and provenance are intentionally reviewed.
- Unknown/approximate birth time.
- House-system and engine-version fixtures.
- AI fact verifier rejects altered placement.
- Returned engine flags must match the requested Swiss Ephemeris/data mode; implicit Moshier, JPL,
  alternate-data, or alternate-engine fallback returns unavailable rather than mixed facts.
- Replacement requires archived inputs and a dual-run comparison before a new adapter/calculation
  version takes over; historical facts are never silently rewritten.

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

The repository-fixed English/Tarot V1 gate is `pnpm test:ai-evals`. It binds the exact synthetic
suite bytes to a separately parsed metadata-only safe-off baseline, runs the real interpretation,
retrieval/prompt, pre-generation, generation/fallback, and post-generation verification boundaries,
and requires unique passing test evidence before generating each in-memory observation. Code-fixed
thresholds require all registered cases and safe controls, 100% applicable
fact/schema/source/fallback results, and zero critical failures, missing/unexpected cases, unsafe
continuations, privacy leaks, external requests, or paid calls. Fixtures cannot define thresholds,
executable behavior, self-reported pass fields, or observations. The non-English locale cases prove
only fail-closed scope; this local synthetic gate does not approve a production model or prove
multilingual output quality, human review, latency, cost, or canary quality, which remain
candidate/release evidence.

The same root command now runs the separate English/numerology safe-off gate after Tarot.
`pnpm test:numerology-ai-evals` remains independently runnable for focused diagnosis. Its exact
suite covers engine recomputation, all 11/22/33 controls, complete calculation/result content
inventory, artifact integrity and authority, number/target/source drift, digit and number-word
prose, strict locale, hostile text, prohibited safety categories, independent review,
single-use/digest trust, deterministic replacement, and privacy metadata. It requires zero
critical, metric, safe-control, missing, or unexpected failures and zero external or paid calls.
Passing this synthetic gate does not override the canonical catalog's AI-disabled policy or
approve production meanings.

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

RIT-102 adds a mutation-tested writing-system repository gate and a test-only hydrated Chromium
harness. The harness loads production UI and Web CSS, verifies four CJK line-break profiles,
actual platform-font glyph providers, Devanagari shaping, Japanese/Hindi controlled composition
through rerenders, native ISO dates, 320px/400%-equivalent reflow, Axe, touch targets, and
privacy-local requests/storage. Temporary screenshots are deleted after verification and do not
update golden baselines. Native-device IME, WebKit/Firefox, assistive-technology, and qualified
linguistic review remain release checks.

RIT-103 adds mutation-style route-registry fixtures for localized slugs, reciprocal same-content
alternates, explicit same-locale redirect history, approval evidence, missing default content,
duplicate paths, sitemap index/shard partitioning, query/RSC/private exclusion, SSR document
language/direction, and client-delivery isolation. Synthetic locale fixtures prove architecture
only and cannot activate a locale.

RIT-104 keeps synthetic non-English catalogs inside tests. They prove exact authorized rendering
without creating a production catalog, route, email capability, support operation, or locale
activation. The complete workspace suite remains deferred until a milestone integration,
release-candidate, shared-runtime change, or focused-risk trigger under D-050.

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

Per PR, CI runs the smallest affected matrix plus mandatory foundation:

- Format/lint/type/architecture boundaries.
- Unit/property.
- Integration with migrated PostgreSQL.
- Relevant E2E/a11y/i18n.
- Security/secret/dependency.
- Fixed synthetic AI release eval on every active Quality run; expanded candidate/model/content
  comparison when AI/content changes.
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

For RIT-084, `pnpm test:numerology-seo-browser` consumes the current Web production build and
visits the exact five English public numerology documents at 320px in dark and reduced-motion
modes. It verifies static content, headings, no private inputs, canonical/noindex behavior,
allowed JSON-LD types, internal calculator links, layout, touch targets, storage, request ledger,
console/page errors, and serious/critical axe results. Axe-incomplete contrast nodes must match the
reviewed selector inventory; the verifier never converts incomplete findings into automatic
passes. This focused gate supplements, rather than replaces, milestone/release accessibility and
SEO integration checks.

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

## 15. Public search representation gate

For RIT-114, the optimized-build policy reads the complete 45-record public-page inventory and
validates exact robots, canonical, hreflang, Open Graph, schema type, canonical entity, visible H1,
visible description, and visible reviewed parent-link parity for every generated public document.
The production configuration boundary requests the same 45 URLs rather than sampling only the
four core pages.

`pnpm test:public-search-browser` then exercises six representative routes at 320px in Chromium,
covering all four allowed schema types and multiple content families. It rejects private-canary
delivery, external or API requests, console/page errors, unsupported rich-result claims, and
script-breaking JSON-LD input. This bounded browser matrix complements rather than repeats the
complete static and HTTP crawl checks.

## 16. Redacted share-card gate

`pnpm test:tarot-share-browser` consumes the optimized production one-card document and exercises
one synthetic completed reading at 320px. It checks that preview is explicit, the rendered preview
is the exact 1200 by 630 SVG Blob, the bounded theme is present by default and removed everywhere
by one control, and local download and supported native file sharing use exact matching bytes.

Private canaries are placed in displayed question/action/invitation fields, the reading ID,
cookie, and local storage. The gate rejects any canary in alt text, SVG, download, or share
payload; canonical/Open Graph/Twitter output on the private page; an upload or external request;
unexpected storage; unreleased object URLs; sub-44px controls; horizontal overflow; and blocking
serious/critical Axe findings. Pure tests separately cover malformed URLs, unsafe text, XML
escaping, production pseudolocale rejection, and serializer-only expanded LTR/RTL structure.
