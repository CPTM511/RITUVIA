# RITUVIA Project Status

**Last reconciled:** 2026-07-31

RIT-004 and OWN-008 are complete through D-091. The AGPL repository is public, `main` is protected,
and hosted run `30509381762` passes all three mandatory jobs. RIT-008 and RIT-123 are complete.
RIT-063 through RIT-070 and RIT-073 are complete. The Stripe Test subscription slice now covers recurring
Checkout, verified lifecycle ingestion, Plus entitlements, monthly Credit allocation, cancellation,
invoice-scoped refund reversal, durable review, and a safe-off owner commerce administration
kernel with an immutable event timeline. RIT-074 is the sole Ready task.

## Product checkpoint: M6 payment integrity

Checkpoint revision `f1633b6` closes the bounded one-time Stripe Test Mode Credit-pack payment
slice. It does not activate Stripe Live or declare the complete paid product launch-ready.

- The tracked repository contains 1,112 files and 31,493,492 bytes; 690 TypeScript/JavaScript/CSS/
  SQL source files contain 198,130 lines and 7,155,963 bytes.
- The production Web build is 21,056 KiB. Static assets are 1,256 KiB and static chunks are
  1,240 KiB. The verified maximum gzip payloads are 8,170 B HTML, 12,232 B CSS, and 219,813 B JS.
- `node_modules` is an 874,556 KiB renewable local dependency cache and `.turbo` is 8,292 KiB;
  neither is a shipped browser payload.
- The one-time payment slice now covers server pricing, hosted checkout, signed Test Mode
  webhooks, pending/failure/expiry, exact duplicate and replay handling, deterministic out-of-order
  reduction, verified fulfillment, owner restoration, full-unused-pack refund, dispute holds,
  reconciliation, and privacy export.
- The milestone workspace run passes 2,241 unit tests with five skips, 96 fixed AI evaluation
  cases, configuration boundaries, the database foundation, all 16 package typechecks, and a
  production build. The payment matrix separately passes 18 payment files plus nine isolated
  PostgreSQL gates against all 36 migrations.
- Technical paid-launch work remains: customer commerce UI (`RIT-072`), dispute/support workflow
  (`RIT-074`),
  payment kill switches (`RIT-075`), launch threat/abuse/operations gates (`RIT-121`-`RIT-128`),
  beta remediation, and staging/launch rehearsal. External provider, entity, tax, country, budget,
  and owner production approval remain separate blockers.

**Stage:** RIT-159 Phase 0 production-pack reconciliation, RIT-037 exact-version interpretation
reporting, RIT-028 deterministic Tarot browser acceptance, RIT-040 private intention domain and
composer, RIT-041 ritual template/object domain, RIT-042 accessible free Sanctuary, and RIT-043
transactional ritual lifecycle/private journal, and RIT-044 private Revisit lifecycle are
complete. RIT-046 privacy-safe core-loop analytics and RIT-047 continuous anonymous full-loop
browser acceptance are complete. RIT-050 secure account-session hardening is complete over the
existing local-only account foundation, RIT-051 idempotent anonymous-to-account merge is complete,
RIT-052 account history/settings/session management, RIT-053 encrypted privacy export, RIT-054
selective/account deletion, RIT-056 admin roles/MFA/audit foundation, and RIT-057 integrated
identity/privacy/authorization security closure are complete. RIT-060 immutable Country Policy
Engine, RIT-061 immutable catalog/product/price registry, and RIT-062 provider-neutral commercial
transaction/Credits foundation and RIT-055 account-owned consent controls are complete. OWN-002
still blocks production payment activation, but D-091 and OWN-017 approve the narrower Stripe Test
Mode sandbox scope. RIT-063 completes that bounded checkout slice. RIT-064 now adds Test Mode
raw-signature verification, stable Stripe-account-bound v2 attempts, immutable signed-event
evidence, exact duplicate/conflict handling, deterministic out-of-order timeline replay,
account/order/attempt mismatch isolation, composite foreign keys, and a transactional state-change
outbox with monotonic order versions and final-lease dead lettering. The route uses a dedicated
database role whose DSN is bound to the application database but uses distinct credentials; the
runtime attests that exact least-privilege role and rejects Credit or entitlement access. Node
startup proves the configured account against the current Stripe Test Mode key before Stripe
webhooks become available, while checkout repeats the same cached proof defensively. RIT-065 now
consumes the outbox through a separate exact-role DSN, grants purchased packs exactly once, holds
only unspent source Credits on dispute, converts holds and available value on refund, and records
consumed/reserved shortfalls for review without a negative balance. Authenticated Credit
restoration is owner-scoped and excludes held Credits from spendable total. RIT-066 adds the
noindex Credit-pack detail page, safe hosted-checkout retry, and owner-scoped fulfillment status.
RIT-067 adds bounded daily Stripe Test reconciliation and append-only discrepancy cases. RIT-068
adds the full-unused-pack Stripe Test refund path. RIT-069 closes the one-time Stripe Test payment
integrity matrix. RIT-070 closes the recurring Stripe Test subscription lifecycle, RIT-073 closes
the safe-off commerce administration kernel, and RIT-074 is the sole Ready task. RIT-045
consented transactional Revisit
reminders are complete. OWN-011
option A is approved through D-064, and RIT-080 is complete with an engine-ready English
date-numerology catalog, source records, worked vectors, exact Life Path/Birthday/Personal Year
rules, explicit target year, 11/22/33 preservation, and name/locale exclusions. RIT-081 is complete
with a pure version-bound engine, strict ASCII ISO date and four-digit target-year request,
manual proleptic-Gregorian validation, immutable visible formula evidence, exact OWN-011 approval
pinning, all approved vectors, 11/22/33 and century/leap/zero boundaries, unsupported-script
rejection, serialized-facts recomputation, hostile-object rejection, all 146,097 valid dates in a
complete 400-year Gregorian parser cycle, and a 2,923-date full-calculation traversal. RIT-082 is
complete as an anonymous English calculator at `/en/readings/numerology`, with an independently
gated approved catalog, same-origin bounded private API, explicit target year, visible formula and
version evidence, no name input or persistence, and focused mobile/keyboard/offline/axe browser
acceptance. OWN-012 is approved through D-065. RIT-083 is complete with a safe-off English package
boundary, fixed synthetic evaluation gate, and checksummed approved thirty-six-entry corpus:
exact RIT-081 facts are recomputed and minimized, every reachable calculation/result pair is
required, artifact integrity and authority are independent, digits and number words cannot appear
in model prose, candidates are single-use and digest-bound, deterministic safety runs before an
independent strict semantic reviewer, and trust failure produces no output. The exact
`year_reflection`/`deep_reading.year_reflection` six-Credit mapping is approved only as optional
verified context and remains safe-off. RIT-084 is complete with `/en/numerology` plus four
substantive static method guides, exact production-only index allowlists, canonical/hreflang,
Open Graph, JSON-LD, sitemap timestamps, source/review notes, deterministic examples, and focused
mobile accessibility browser evidence. All twelve number profiles remain non-indexed source
records rather than doorway pages. Production AI, Credits consumption, deployment, DNS, and public
launch remain inactive. OWN-003, OWN-013, and RIT-090 are complete through D-069: Swiss Ephemeris
`2.10.03` and the separate `v2.10.3final` source/data snapshot now use the owner-approved
whole-project `AGPL-3.0-only` path with exact deployed Corresponding Source. D-069 supersedes the
planned CHF 700 Professional License purchase without rewriting historical Selection V1.
Selection V2, the root license/notice, exact 23-file source/data manifest, registered server-only
native package, checksum-attested offline C bridge, hardened compiler/flags, native SBOM,
byte-reproducible macOS arm64 build, `SEFLG_SWIEPH` rejection policy, and J2000 wrapper fixtures now
exist. The local security profile now passes macOS UBSan, 151 deterministic mutation/boundary
cases, manifest/SBOM/license closure, and sanitized native integration tests. D-070 now approves
OWN-015 Option A: tropical zodiac, eleven bodies including True Node,
exact-time Placidus houses, fixed major-aspect orbs, strict approximate/unknown-time suppression,
and no polar/house fallback or partial facts. RIT-093 is Done under D-072 with the approved checksummed
method catalog, strict facts parser, official upstream `setest` regression corpus, default-off
`experience.astrology` kill switch, owner/profile-revision-bound server service, and encrypted
append-only PostgreSQL persistence. Privacy export is intentionally versioned
`privacy-export-package.v2` to include verified decrypted natal calculations, while privacy
deletion cryptographically shreds retained calculation payloads. The server runtime now composes
live flag evaluation, encrypted persistence, a production-only metadata loader, checksum-attested
native execution, and the pure adapter while proving disabled-before-native ordering. RIT-094 now
adds a query-free, owner-scoped read-only latest-result API and private English natal-facts viewer
without adding birth-profile input, location search, calculation mutation, production migration,
deployment, public source endpoint, or activation. An
isolated 28-migration PostgreSQL drill passes default off, approved on,
emergency off, historical-key rejection, append-only/least-privilege enforcement, and logical
restore. The root production build now passes all 16 packages, 121 workspace artifact/runtime
checks, 45 public pages, five private experience pages, and the final production-artifact policy.
The largest modern JavaScript delivery is 219,789 bytes gzip under the unchanged 232-KiB budget;
legacy `nomodule` compatibility code remains independently asset-validated rather than being
misclassified as modern first-load JavaScript. RIT-091 is complete
through D-067, OWN-014 is complete through D-068, and RIT-092 is complete with encrypted
session-authorized birth profiles, exact/approximate/unknown-time semantics, full replay
provenance, privacy export, and cryptographic deletion evidence. OWN-015 is complete. A live bounded
OSV commit query now returns zero vulnerability records for the pinned Swiss Ephemeris commit, and
the CI contract locks that fail-closed query. An ignored 120-file native-component Corresponding
Source archive now includes patched-dependency/test/source-dependency closure, suppresses host
xattrs, verifies its complete extracted inventory, replaces curl with a rejecting shim, reproduces
the baseline engine metadata from archived source/data, and supports a frozen-lockfile install in
a fresh Linux environment. Exact-clean revision
`1fded12559b4e2986a317f2a6fee4008a2c22b8a` produced a 120-file component archive with SHA-256
`2040f941a674fe45c80ed317139e99bb24f1bb955ad2909399bfd6c82bc80a7c`. The
normal and sanitizer-native gates now additionally compare forty locked geocentric vectors for ten
celestial bodies against independently maintained MIT Astronomy Engine `2.1.19`. The maximum
observed differences remain below `0.02°` angular and `0.001` relative-distance limits; True Node
and Placidus houses are explicitly excluded from this independent claim. An ephemeral Ubuntu
24.04.4 arm64 environment now passes Linux ASan+UBSan, 151 deterministic mutation cases, 5,000
libFuzzer runs, and sanitized integration from that archive. A root complete release-source gate
now requires an exact clean Git revision and clean checksum-attested component archive; rejects
unexpected ignored inputs, symlinks/submodules, case collisions, unresolved Git LFS pointers,
environment redirection, component/source drift, unsafe archive entries, and output replacement;
archives all tracked source plus pinned native source/data; independently verifies the extracted
inventory; and repeats the offline native rebuild. Eight focused tests pass, the CI contract locks
the Linux rehearsal, and the clean implementation revision produced a 914-file complete archive
with SHA-256 `68cc39041511e1de29fa9355efc512d065c32612e88d396d6dbfe9aebafb4ae6`.
D-072 closes RIT-093 without claiming a deployment: RIT-142 must repeat the gate for the exact
deployment SHA, upload and re-download the archive, verify its digest, expose a prominent public
source link, and bind that link to the deployed revision before RIT-143 owner go/no-go. RIT-094 is
Done with a table-authoritative presentation-only SVG, strict client response parser, exact,
approximate, unknown, empty, offline, unauthorized, and unavailable states, and no raw birth input
surface. `experience.astrology` remains disabled. The
repository remains
a local production-capable foundation, not a public production service. The new golden UI,
bilingual route inventory, wallet/SIWE, Credits
provider-backed Credit fulfillment, subscriptions, Coinbase checkout, provider-backed Deep Readings, production privacy
delivery/retention operations, outbox/reconciliation, and operational beta gates are not
implemented or activated. The pinned
production-artifact accessibility and full PostgreSQL foundation suites passed in the owner's
unrestricted shell before the later numerology/dynamic-home changes. The configuration-boundary
rerun now passes typed configuration, isolated production compilation, and the current nine-page
sitemap inventory, then stops on legacy direct-RSC expectations for the dynamic `/en` route. The
owner-approved obsolete source duplicate has been removed, and Web type checking now safely
removes only byte-identical number-suffixed copies from Next.js generated type directories.

RIT-091 adds a pure strict location/historical-time-zone V1 contract and server-only Web runtime
composition. Search is normalized and bounded; no dedicated query echo or raw-query HMAC cache key
exists. Provider facts carry exact adapter/provider/data versions, source/license/attribution, and
snapshot SHA-256. Resolution rereads the opaque location ID and stores local input, coordinates,
IANA zone, UTC instant, offset, confidence, and exact Node `24.18.0` / ICU `78.3` / tzdata `2026b`
provenance. New York fold/gap, Kathmandu non-hour offset, Samoa skipped date, pre-1970 confidence,
zero/multiple result, hostile provider, failure, timeout, single-flight, TTL, and privacy fixtures
pass. A self-hosted GeoNames snapshot is the intended production source, but no real dataset,
external request, route, UI, retained birth data, deployment, or public activation is added.

RIT-092 adds one account-owned encrypted birth-profile payload whose AAD binds the active account
and profile ID. PostgreSQL stores only coarse certainty, versions, keyed digests, revision,
timestamps, and ciphertext; original date/time, approximation window, place, coordinates, IANA
zone, UTC, fold, provider/data/license digest, and Node/ICU/tzdata provenance remain encrypted.
Unknown time never invokes resolution or fabricates a UTC instant. Database transactions derive
the owner from the active account session, enforce owner predicates and optimistic revisions, and
keep an idempotency operation ledger. Individual and account privacy deletion overwrite profile
ciphertext, while privacy export decrypts active profiles and verifies their keyed payload digest.
All three isolated PostgreSQL birth-profile gates pass with 26 migrations. RIT-093 adds the
twenty-seventh migration for encrypted append-only natal calculations, exact profile-snapshot
binding, privacy export V2, and crypto-shred deletion. No real GeoNames snapshot, UI, external
provider call, production migration, deployment, or public activation is added. Native
security/release evidence and release-safe runtime composition remain open.

RIT-050 provides a closed production-replaceable authentication-provider capability boundary,
uniform `202` magic-link starts, a constant local-only preview route with `HttpOnly` state,
privacy-minimal database-atomic global and bounded keyed identifier-bucket rate controls,
short-lived one-time hashed challenges, same-account previous-session rotation, fixed-expiry
host-only secure account cookies, session-bound CSRF, durable logout/revoke failure behavior, and
passkey-ready credential constraints. Focused provider/service/route/proxy tests, all 15
PostgreSQL migrations with concurrency/privilege/restore evidence, a 115-artifact production
build, and the dedicated real-browser authentication gate pass. Production email, OAuth, WebAuthn
ceremony, wallet identity, deployment, and public launch remain inactive.

RIT-051 preserves immutable anonymous ownership through one append-only account link instead of
copying private rows. Authentication completion now consumes the challenge, creates the
account/session, links optional anonymous history, and revokes anonymous sessions in one
transaction. Explicit post-login merge binds both source sessions and the exact keyed request,
derives one recoverable successor session, rotates CSRF/cookies, and returns that same successor
for concurrent or dropped-response retries. Composite PostgreSQL foreign keys, hash-only evidence,
runtime update/delete denial, focused 65-test coverage, an isolated 16-migration merge gate, the
115-artifact build, and the real-browser merge/retry flow pass. Reflection mutations no longer
perform hidden credential rotation.

RIT-052 adds one responsive private account surface for strict profile preferences, bounded
account-linked reflection history, and timestamp-only active-session controls. History is a
read-time projection over currently retained linked readings, intentions, legacy/v2 rituals,
legacy/v2 journals, and Revisits; it accepts no client owner identifier and returns no private
prose. Exact linked readings can be restored through account authorization using UUID-only
tab-scoped handoff. Profile changes retain optimistic conflict protection. Targeted revocation
cannot revoke the current session or cross accounts, and all logout actions report success only
after durable storage. Focused parser/route/service/proxy/UI and cross-resource IDOR tests, the
isolated PostgreSQL account-control gate, affected package builds, and the 320px
keyboard/accessibility/privacy Chromium gate pass without repeating the unrelated full unit
matrix. No migration, retention change, device fingerprinting, export/deletion, production
provider, deployment, or golden screenshot update is introduced.

RIT-055 adds independent exact-version `optional_product_analytics`, `ai_personalization`, and
`model_improvement` account controls backed by one append-only per-purpose sequence rather than
profile booleans or linked anonymous grants. Exact replay, same-key conflict, account serialization,
bounded fail-closed evaluation, cross-account denial, and select/insert-only runtime privileges are
enforced in PostgreSQL. The private account UI reports success only after commit, and every AI
selected-excerpt gate rereads current account state so a withdrawal is visible across sessions
immediately. Privacy exports now distinguish account and anonymous consent evidence. Focused
domain/Web tests, all 24 migrations, the isolated consent database gate, and the account-control
mobile/accessibility browser gate pass. Production analytics, provider private-content AI,
real-user model improvement, marketing, notification delivery, final legal text, deployment, and
launch remain safe-off owner gates.

RIT-045 adds one account-owned, once-only English email reminder preference without changing the
RIT-044 Revisit v1 contract. A strict private API records committed subscribe/unsubscribe state and
append-only idempotency evidence; anonymous discovery returns an explicit safe empty state. The
database-backed queue claims one due row with `SKIP LOCKED`, rereads account, ownership, Revisit,
time-zone, quiet-hours, locale, contract-version, and lease authority immediately before delivery,
then completes once or applies bounded retry/dead-letter handling. Jobs contain identifiers and
versions only, and fixed lock-screen-safe copy excludes question, intention, ritual, journal,
relationship, and health details. Privacy export includes reminder state/history; privacy deletion
cancels pending or leased work atomically. Focused 177-test coverage, all 25 migrations, isolated
reminder/export/deletion PostgreSQL gates, affected builds, architecture, Revisit and continuous
core-loop Chromium, and the 39-scan accessibility boundary pass. The only configured provider is
hard safe-off; production email provider/domain, reviewed legal copy, other locales, operations
alerts, deployment, and public sending remain owner-gated.

RIT-053 adds recent-authenticated, same-origin/session-CSRF account export request, metadata, and
download routes. One consistent allowlisted snapshot covers all currently retained implemented
account-linked categories, decrypts private fields only inside the authorized Web builder, and
emits matching JSON and Markdown. A dedicated AES-256-GCM key binds account/export/schema/key/
creation/expiry, while immutable request, one-per-request artifact, and private-content-free audit
rows keep lifecycle evidence append-only under runtime select/insert-only privileges. Existing
sessions with no authentication instant must reauthenticate; merge rotation preserves the
original instant. Focused 48-test coverage, the isolated 17-migration PostgreSQL gate, migration/
architecture/CI/secret checks, and affected DB/Web production builds pass. Production worker/
object storage, KMS activation, final retention/legal text, deployment, and public launch remain
owner-gated.

RIT-054 adds strict recent-authenticated selective-private-content and account deletion. It
serializes by account, binds replay to exact scope/idempotency/session evidence, revokes linked
anonymous authority, privacy-marks every account-subject link, replaces implemented encrypted
private prose and fallback interpretation output with non-decryptable tombstones, destroys export
artifacts, and prevents stale export completion. Account scope also suppresses future provider
identity recreation, tombstones authentication/profile data, revokes all sessions/passkeys, and
retains only explicit pseudonymous consent/commerce/security/privacy evidence. A dedicated
`rituvia_privacy_deletion` database login and RLS policies keep destructive privileges out of the
ordinary application/interpretation role. Focused 50-test unit evidence, isolated PostgreSQL
deletion/export gates, configuration isolation, migration, architecture, CI, secret, lint, type,
and affected DB/Web production builds pass; the full identity/privacy matrix remains reserved for
RIT-057.

RIT-056 adds a dependency-free, finite, default-deny admin role/action policy and an isolated
database authorization kernel. Owner-only role grants/revocations require an active recent account
session, same-user/session/auth-identity live passkey assertion, and exact typed confirmation.
Grants, revocations, and successful or denied privileged attempts are append-only. Audit rows store
only controlled identifiers, changed-field names, and before/after digests in a serialized
predecessor hash chain; audit failure rolls back the role mutation. A dedicated
`rituvia_admin_service` login cannot issue MFA assertions, mutate audit evidence, or read private
journals. Focused 11-test policy/config evidence and the isolated 19-migration PostgreSQL
grant/revoke/rollback/privilege/restore gate pass. Production WebAuthn ceremony, admin routes/UI,
role enrollment, support private-content grants, audit retention, deployment, and launch remain
safe-off owner gates.

RIT-057 composes authentication, anonymous merge, account controls, encrypted export,
crypto-shredding deletion, admin authorization, metadata, analytics, redaction, PostgreSQL
recovery, and production-artifact browser behavior into one independently runnable security gate.
The Web proxy now admits privacy routes by exact method/path, export metadata rejects cross-site
reads, and the deletion login is bound by a transaction-local request-token hash plus
security-barrier view and RLS to one account. Direct cross-user deletion-role reads and mutations
are denied. Focused `472/472` tests, specialized database/browser gates, the one-time `1644/1644`
workspace unit suite, 34-case AI eval, all 20 migrations with restore, 115-artifact production
build, complete accessibility matrix, and high-severity dependency audit pass. PostCSS and
brace-expansion advisories are fixed through pinned overrides plus one reviewed minimatch
compatibility patch; two moderate advisories remain outside this task's critical/high threshold.
Admin production activation still requires a database-bound privileged procedure or equivalent
database-enforced step-up, approved WebAuthn/enrollment, and an owner-approved credential.

RIT-060 replaces the Web-only per-product payment tuple as the authorization source with one strict
`country-policy-version.v1` contract covering service status, age, modalities, products,
subscriptions, fiat/crypto capabilities, disclosures/legal versions, tax/refund configuration,
data/locale/support/marketing constraints, approval evidence, effective windows, and mandatory
review. Billing, declared, and reliable-geolocation conflicts fail closed; locale or weak
geolocation cannot authorize paid service. Fiat and crypto require independent owner references.
PostgreSQL stores immutable policy documents under dedicated reader/writer capabilities; disabled
and rollback behavior append one successor chain. Commerce loads and strictly parses the registry
and records the exact version on orders. The only seed is synthetic local policy; preview, staging,
and production remain empty and paid behavior therefore stays safe-off. Focused 114-test commerce,
policy, feature-flag, payment, and persistence coverage, the isolated 21-migration policy
PostgreSQL/seed/privilege/restore gate, configuration/architecture/migration/CI/secret/record
checks, and Country Policy/DB/Web builds pass. Per D-050, RIT-069 consumed the milestone complete
workspace matrix; the next complete local matrix remains reserved for a release candidate or a
new cross-cutting risk trigger.

RIT-061 adds one strict `catalog-version.v1` contract over the owner-approved 2026-07-23 product
set: 21 Credit packs, Plus plans, Deep Readings, permanent/free objects, and consumable rituals,
with exact English/Simplified Chinese contents and five positive integer USD prices only for packs
and Plus. The four obsolete direct-USD ritual-object prices no longer feed the public catalog;
their signed local checkout remains quarantined as a historical replay/test fixture. Four
immutable PostgreSQL registries store source evidence, products, localizations, and price scope
under dedicated append/read capabilities. Only the synthetic local/CI catalog is seeded;
preview/staging/production remain empty. The Web catalog endpoint performs live privilege
attestation, strict parsing, exact active-version selection, and finite `503` failure, while the
current Sanctuary keeps its tested free candle/incense fallback until RIT-066. Focused 67-test
commercial/Web evidence, isolated 22-migration catalog and Country Policy database gates,
configuration/architecture/migration/CI/secret/lint/type checks, and Domain/Payments/DB/Web
production builds pass without repeating the complete workspace matrix.

RIT-062 leaves the quarantined direct-object USD fixture untouched and adds a provider-neutral v2
transaction foundation. Canonical order states own refund/dispute projection, while payment
attempts terminate at succeeded/failed/expired/cancelled. Exact-request idempotency covers orders,
attempts, reservations, ledger operations, and entitlements. Positive-integer append-only Credit
facts record grant/reserve/release/consume/reverse/expire evidence; hard-expiry reservations and
exact allocations consume subscription, promotional, then purchased sources, while a nonnegative
projection remains rebuildable. Plus and permanent-object entitlements require different
authoritative sources. Focused state/property tests and an isolated 23-migration PostgreSQL gate
prove 20-way concurrency accepts exactly six reservations against six Credits, invalid
state/provider/source rows fail, ordinary runtime cannot update/delete ledger evidence, and
logical restore passes. No provider checkout, webhook, automatic fulfillment, subscription,
refund, reconciliation, production migration, deployment, or public launch is activated.

RIT-046 adds a strict nine-event `@rituvia/analytics` contract, bounded synthetic event ledger,
purpose-scoped keyed pseudonyms, deterministic funnel/late-event projection, and WMRS v1 as
distinct consented anonymous subjects with at least one qualifying reading-rooted session in a
rolling seven-day UTC window. Reading and linked reflection application services create only
non-replayed server-authoritative safe event intents. Exact optional-product-analytics consent is
required by the tested Web adapter; runtime composition remains a hard no-op because legal notice,
retention/deletion, browser viewed-event ingestion, durable storage/export, bot filtering, account
merge, vendor, and production activation are not approved.

RIT-037 is deliberately limited to a non-spending owner-scoped categorical report bound to one
exact displayable result through the existing reading report boundary. It does not add history,
lineage, or a generation/regeneration route. Paid Deep Reading creation, version history, and
regeneration remain deferred until a separate server-authoritative Credits
ledger/reservation/projection task is accepted.

RIT-037 reuses the existing report route: the browser interpretation operation UUID drives a strict
v2 request, the database resolves it to one exact owner/reading-scoped displayable interpretation,
and only immutable categorical evidence is persisted. Verified, safe-replacement, fallback,
hidden-target, idempotency, race, least-privilege, constraint, restore, configuration, build, and
Chromium gates pass. Dynamic validation also corrected a nullable CHECK weakness and a native
`fetch` receiver defect before closure.

RIT-028 closes the M2 browser-evidence gap with six deterministic production-artifact scenarios
covering exact one-card and ordered three-card results, zero-request reveal, whole-reading and
canonical-position categorical reports, offline recovery, same-key service retry, calm rate-limit
stop, UUID-only refresh resume, stale private-result clearing, desktop/mobile reflow, keyboard,
RTL, reduced motion, touch targets, axe, storage, and same-origin network boundaries. Supporting
screenshots use only reviewed synthetic fixtures and do not alter owner-gated golden baselines.
Dynamic validation corrected the resume transport's native `fetch` receiver and added a visible
focus ring for semantic `summary` controls.

RIT-040 adds a strict backward-compatible private intention contract with user-authored intention
text and one small action, deterministic non-echoing coercive-control reframing, optional revisit
date and time zone with reminders fixed off, owner/resource-bound authenticated encryption, and
optimistic edit/complete/archive/soft-delete lifecycle behavior. The current production artifact
passes the complete composer flow at 320px, dark mode, reduced motion, RTL, and offline recovery;
archive prevents a new ritual, deletion immediately hides the resource, and private prose never
enters browser storage, URLs, request digests, logs, analytics, or public metadata.

RIT-042 adds equally prominent free candle and incense experiences sourced from the canonical
ritual catalog. One ordered state model drives standard 2D and accessible linear modes with audio
absent, reduced-motion-safe static presentation, explicit exit and completion, focus
entry/restoration, and a complete no-JavaScript fallback.

RIT-043 replaces the temporary final-only write with a server-authoritative owner-scoped lifecycle.
The start transaction snapshots the exact approved catalog item, template, publication, and access
rule; permits anonymous/account free starts; checks active permanent entitlements; and locks and
consumes at most one matching pass atomically. Active, paused, completed, and abandoned states use
revisioned idempotent mutations, while visible Sanctuary exit durably pauses. Completed sessions
can create, edit, read, and soft-delete an encrypted owner/resource-bound private journal entry.
Historical v1 replay remains unchanged. Pass issuance/reversal/refund, production KMS activation,
deployment, and production payment/catalog activation remain separate tasks or owner gates.

RIT-044 adds one owner-scoped private Revisit per intention with next-day, seven-day, or custom
future local-calendar scheduling, separately stored IANA time zone, inert optional quiet hours,
and reminders fixed off. It snapshots the exact original intention/action under authenticated
encryption, permits early/on-time/late factual completion under independently versioned
ciphertext, and supports revisioned reschedule, archive, and terminal soft deletion through an
append-only idempotency ledger. Parent deletion hides the child immediately. The current production
artifact passes offline recovery, 320px, RTL, reduced motion, touch, axe, request, console,
storage/metadata privacy, and redacted screenshot evidence without enabling delivery or analytics.

**Release:** Phase 0 audit baseline over the local commercial MVP; no public production deployment.
By unweighted engineering-task count, 78 of 107 tasks through the closed-English-beta milestone are
Done (73%), and 78 of 113 tasks through limited paid launch are Done (69%). The remaining work is
risk-heavier than the completed count: payment underwriting/integrity, production operations,
threat/abuse controls, closed-beta evidence, legal/tax/brand/budget approvals, and launch rehearsal.

**Working brand:** RITUVIA, pending formal trademark/domain/language clearance.

## What exists

- Market and product strategy.
- Interactive concept prototype.
- Product charter and full PRD.
- UX/design doctrine.
- Technical architecture and data model.
- AI, payment, safety, security, localization, SEO/GEO, analytics, and operations specifications.
- Sequenced roadmap and executable backlog.
- Codex root/nested instructions, specialized roles, command rules, automation prompts, and review templates.
- Verified import baseline, deterministic compiled-manual generation, and whole-package checksum validation.
- Contribution policy plus typed task, decision, incident, and experiment records with a generated compact index, Git-index-only checksums, contextual task-result validation, and active CI record/generated-evidence gates.
- Private pnpm/Turborepo TypeScript workspace pinned to Node.js 24.18.0 and pnpm 11.13.1 with a frozen lockfile and strict dependency-build allowlist.
- A completed responsive English local MVP vertical slice: anonymous deterministic reading;
  account sign-in/sign-out; an exact persisted 18+ attestation before paid order creation;
  intention and small-action capture; free candle/incense and entitlement-gated owned ritual
  objects; encrypted private journal entries with revisit; a server-authoritative catalog; a
  Stripe hosted-checkout provider adapter plus an HMAC-signed local checkout simulator; and
  verified webhook, ledger, and entitlement fulfillment. This is local capability, not production
  payment approval or activation.
- A versioned local 22-card Major Arcana catalog derived from the owner-provided Lumora prototype,
  with 44 reviewed upright/reversed reflective entries, full ten-theme coverage, Strength VIII,
  Justice XI, and an exact-version registry that keeps the superseded Threshold/Mirror/Lantern
  catalog available only for historical replay.
- Accessible Next.js App Router public surface at exact `/en`, `/en/methodology`, `/en/safety`, and `/en/privacy` canonical routes with typed English messages, configured branding, semantic landmarks, keyboard skip/focus, responsive and long-text reflow, light/dark/reduced-motion/forced-color behavior, direction-aware CSS, local icon, and server-rendered no-JavaScript content.
- Private `@rituvia/ui` package with semantic color/type/spacing/radius/elevation/motion/control tokens; closed local-action and control-value contracts; native-first action, field, selection, alert, spinner, skeleton, and presentation-only empty/error/offline/provider-unavailable patterns; system/light/dark, reduced-motion, forced-color, RTL, long-content, and narrow-reflow fixtures; and byte-for-byte built stylesheet verification.
- Case-sensitive finite locale/page routing, explicit root redirect, per-page `en`/x-default
  canonical metadata, and non-production `noindex`; registry v3 removes the completed public-shell
  rollout key and Web adapter after a protected compatibility window. Crawl failure boundaries
  remain driven by production environment and reviewed inventory freshness.
- One typed four-page crawl inventory drives unique canonical/Open Graph metadata, production-only index polarity, exact end-anchored robots document allows, reviewed render-asset access, and a deterministic sitemap without fabricated `lastmod`; non-production, disabled, unavailable, private, query, spoofed/bare RSC, and unreviewed internal paths remain noindex, private/non-cacheable 404, disallow-all, or absent as appropriate.
- Fail-closed Web build policy for all four canonical route artifacts, bounded compressed HTML/CSS/JavaScript/icon output, and HTML/CSS fetch surfaces including remote, ambiguous, duplicated, escaped, entity-obfuscated, and unbudgeted resources.
- A production-artifact Chromium/axe gate for all four public routes plus the private intake,
  one-card, and three-card routes with exact WCAG 2.0/2.1/2.2 AA and best-practice tags, complete
  forward/reverse keyboard order, native radio behavior, 44px targets, 40% text expansion,
  test-only LTR/RTL pseudolocales, dark/reduced-motion/no-JavaScript states, mobile/desktop reflow,
  a persistent online/offline/online advisory announcement, and same-origin-only requests. Real
  interpretation acceptance additionally covers explicit start, failure/manual retry, held
  processing, verified output, offline zero-start/reconnect, reviewed fallback, exact v2
  categorical reports for both durable displayable outcomes, screenshots, and exact request
  ledgers; gradient/background contrast incompletes are compensated by token-level contrast tests.
- Cancellable Worker runtime and framework-independent domain package boundary.
- Shared typed configuration package with validated build/server/client separation, root environment loading, fail-closed Web/Worker startup, and configurable working-brand projection.
- Repository-owned PostgreSQL 17 local runtime with random SCRAM credentials, loopback-only networking, data checksums, cluster attestation, least-privilege application role, and guarded setup/reset/stop commands.
- Prisma 7.8 database adapter boundary, expand-only initial migration, database-enforced seed-provenance invariants, deterministic synthetic seed, and documented migration/recovery policy.
- Expand-only anonymous identity persistence with fixed-expiry subjects/sessions, SHA-256-only bearer-token storage, request-digest idempotency, append-only per-purpose consent and withdrawal history, a privacy-minimal database-atomic global issuance gate, restrictive foreign keys, exact runtime column privileges, and non-empty logical restore evidence.
- Exact same-origin `POST /api/v1/anonymous/session` with empty request/body response, safe Problem Details, server-side safe-off routing, high-entropy idempotency, and a host-only Secure/HttpOnly/SameSite=Strict fixed-expiry cookie; missing policy/database configuration refuses issuance.
- Deterministic English question-intake policy with ten fixed reflection themes, strict normalized input, ordered crisis/blocked/reframed/allowed classification, agency-preserving suggestions, and a public result DTO that excludes raw questions and internal risk categories.
- Separately gated private `/en/intake` and exact same-origin `POST /api/v1/intake/evaluate` surfaces with noindex/no-store isolation, in-memory-only optional text, explicit safer-question choice, cancellation and offline/error states, crisis stop behavior, and no intake persistence or analytics emitter. Production configuration accepts only an OWN-009-qualified activation reference.
- Pure `@rituvia/divination` contracts for strict immutable V1 tarot catalogs, sources, rights, decks, cards, spreads, orientation content, translation/editorial evidence, exact version references, tradition consistency, and explicit dated structural publication eligibility. The Git-authored three-card/six-content English fixture is original, internal-validation-only, art-free, non-publishable, non-indexable, and unavailable to AI retrieval.
- Pure versioned deterministic tarot draw contracts with canonical without-replacement partial Fisher–Yates selection, bounded unbiased uint8 sampling, exact orientation rules, immutable public facts separated from internal audit data, fixed compatibility vectors, and safe replay/projection that require a caller-injected execution verifier.
- Strict theme-only tarot reading creation with a server-selected exact catalog, operating-system CSPRNG, domain-separated HMAC execution binding, server-derived digests, owner-scoped transactional idempotency and limits, immutable `reading`/`tarot_draw` persistence, historical replay, and verified public-fact projection.
- Exact no-store/noindex `POST /api/v1/readings/tarot` and owner-scoped `GET /api/v1/readings/{uuid}` contracts with bounded input, safe Problem Details, indistinguishable unknown/cross-owner reads, verified V2 reviewed-content presentation, an approved local-only Major Arcana runtime, and a separately hard-gated production runtime.
- Private noindex/no-store `/en/tarot/one-card` with ten theme-only choices, separate session/reading idempotency, explicit reveal without redraw, strict fact/presentation parsing, reviewed limitation/question/action output, complete calm failure states, and no automatic or activated AI, raw-question, analytics, account, payment, share, or result-text storage surface.
- Private noindex/no-store `/en/tarot/three-card` with the same theme-only privacy boundary and calm state machine, one fixed server-authoritative draw, exact unique Situation/Action/Possibility order, strict fact/presentation parsing, explicit reveal without redraw, reviewed per-position limitations/questions/actions, and no automatic or activated AI, raw-question, analytics, account, payment, share, or result-text storage surface.
- One application/database-matched tarot quota authority with a three-per-hour local acceptance
  baseline, database-clock atomic enforcement, replay-before-quota behavior, bounded `Retry-After`,
  no immediate limit retry, explicit new-reflection transitions, and previous-result preservation.
- Exact owner-bound `POST /api/v1/readings/{uuid}/report` plus private categorical report controls
  with six approved categories, backward-compatible whole/position targets, and a strict v2 exact
  interpretation-operation target resolved only to a durable verified, safe-replacement, or
  authorized fallback result. Independent idempotency, empty `204` create/replay,
  indistinguishable private `404`, changed-reuse `409`, no free text, no analytics, no
  reading-quota use, inherited expiry, append-only persistence, immutable composite target
  constraints, and exact least-privilege runtime access are enforced.
- Strict backward-compatible private intention v2 creation plus owner-scoped PATCH/DELETE
  resources with normalized user-owned text, a small real-world action, deterministic
  coercive-control reframing, optional revisit date/time zone, explicit no-reminder state,
  independent resource-bound ciphertexts, optimistic revision conflicts, idempotent replay,
  active/completed/archived/soft-deleted lifecycle enforcement, and exact least-privilege runtime
  columns. The Sanctuary composer exposes reviewed templates, privacy/reminder disclosures,
  agency-safe replacement, edit/complete/archive/delete confirmations, offline/error states, and
  ritual prevention after archive/delete.
- A source-governed `ritual-catalog.v1` defines eight immutable accessible templates and 11
  canonical items: always-free candle/incense, four permanent objects, and five consumable
  rituals. Strict contracts fix symbolic-only/no-guarantee semantics, closed presentation
  enhancements, exact publication/template/access references, and explicit mappings for all six
  historical `reflection-ritual.v1` codes. `GET /api/v1/ritual-objects` exposes only the validated
  read-only catalog with no price, Credit, payment, ownership, or efficacy authority; historical
  session creation remains unchanged pending the transactional persistence slice.
- The private Sanctuary renders the canonical free candle and incense through a focused inline
  stage with equivalent standard 2D and accessible linear controls, audio off, pausable
  nonessential motion, reduced-motion defaulting, Escape/focus restoration, durable
  start/pause/resume/completion, offline same-step retry, responsive RTL-safe layout, and reviewed
  static fallback.
- Additive owner-scoped `ritual_session_v2`, `ritual_pass`, and `private_journal_entry` persistence
  keeps historical v1 rows immutable while enforcing exact catalog/access provenance, one open
  session per owner/intention, transactional pass consumption, optimistic lifecycle revisions,
  encrypted journal create/update/read/soft-delete, exact least privileges, and non-empty logical
  restore evidence. No pass issuance, refund/reversal, production KMS, or production activation is
  included.
- Tab-scoped one-card and three-card result resume using only per-type strict UUID V4 values,
  owner-scoped no-store GET, explicit no-redraw reveal, definitive stale-ID clearing, transient
  manual recovery, storage-denied degradation, previous-result preservation, and database-clock
  reading-expiry enforcement; no result/question text or analytics payload enters browser storage.
- Pure provider-neutral `@rituvia/ai` contracts for Tarot V1 public deterministic facts, exact
  versioned prompt/content/safety provenance, allowed-only generation eligibility, canonical
  bounded reflective output, normalized provider results/failures/usage, provisional streaming,
  and privacy-safe operational metadata; strict parsers and synthetic fixtures reject private draw
  audit, question/journal/identity/payment data, unsafe literals, hostile text, and schema drift.
- Pure published-only Tarot retrieval and prompt assembly with independent injected SHA-256 and
  server-owned allowlist authorization, exact catalog/deck/spread/card/orientation/position/reading
  type/locale/tradition/theme binding, bounded selected excerpts, checksummed mandatory safety and
  tone instructions, system-versus-JSON-data separation, runtime-issued trust artifacts, and
  immutable provenance ready for later persistence; no permissive catalog, prompt, provider, or
  network default exists.
- Pure English/Tarot pre-generation safety with canonical intake re-evaluation, malformed-Unicode
  rejection, exact externally authorized classifier evidence, non-downgradable
  crisis/blocked/reframed/allowed routing, transient question and risk data, zero unsafe
  continuation, independent safety-policy authority, and opaque authorization bound to the exact
  request, modality, reading type, locale, theme, intake/safety policies, and approval reference;
  no classifier, provider, network, credential, API, UI, or production policy is activated.
- Provider-neutral structured generation orchestration that accepts only exact runtime-issued
  input, prompt, authorization, provider/model registration, and fallback authority; constructs one
  immutable bounded request; enforces strict normalized-result and output validation, monotonic
  host deadlines, cancellation and consumed late settlement, at most one allowlisted retry,
  deterministic authorized fallback, and closed privacy-safe operational metadata. Provider prose
  remains an in-memory non-displayable candidate until post-generation verification succeeds, and
  no provider, SDK, key, network adapter, paid inference, API, UI, or production activation is
  included.
- Pure provider-neutral post-generation verification that accepts only exact runtime-issued,
  single-use candidates and exact generation context; checks all displayable text leaves for
  deterministic fact/source/orientation drift and fixed safety/dependency/injection categories;
  requires an independently authorized bounded semantic verdict; and returns only a recursively
  immutable verified result, exact authorized safe replacement, or no-output trust failure.
- Owner-scoped interpretation persistence with canonical request and idempotency hashes, inherited
  reading expiry, database-clock leases with a 30-second execution buffer, exact replay/conflict
  behavior, fallback-only reclaim, secret claim material, lease-version compare-and-set fencing,
  immutable terminal rows, durable no-output `failed` states for trust/configuration failures,
  forced RLS, and exact least-privilege runtime columns. A one-to-one append-only verification child
  is inserted atomically with parent finalization; keyed-HMAC replay validation and pending-output
  non-disclosure fail closed, and a historical pending row without a child remains non-displayable
  with no recovery API.
- Exact private owner-bound `POST/GET /api/v1/readings/{uuid}/interpretation` with explicit
  UUID-idempotent start, side-effect-free status polling, strict 128 KiB four-arm response,
  final-only redacted projection, and indistinguishable private failures. The shared lazy-loaded
  one-/three-card panel provides an explicit CTA, cancellation, foreground-only eight-poll bound,
  stale-response rejection, same-operation manual retry, localized accessible states, verified-AI
  versus reviewed-fallback labels, and the exact safety boundary; production composition remains
  hard safe-off with no provider/model/reviewer/key/network/paid-inference capability.
- Strict English/Tarot V1 release-evaluation contracts with a 34-case ordered synthetic suite,
  exact-byte SHA-256 baseline binding, compiled zero-tolerance thresholds, complete
  pre-generation risk and deterministic post-generation check coverage, safe controls that block
  all-fallback behavior, and privacy-minimal categorical evidence. The explicit Quality gate runs
  the production pre-generation, generation/fallback, and verification boundaries with zero
  provider, reviewer, network, secret, or paid-call capability.
- One active least-privilege GitHub Actions workflow with immutable action references, an ephemeral
  digest-pinned PostgreSQL 17 service, dependency/current-tree/history secret scans, a fixed AI
  release-evaluation step, and separate quality/database/security jobs.
- Repository-enforced CI structure/toolchain contract, historical migration immutability/destructive-SQL policy, idempotent generated-client check, and fail-closed secret scanning.
- Central fail-closed architecture policy for registered modules, manifests, TypeScript inheritance, public exports, runtime roots, internal/external/Node dependency allowlists, browser/server closure taint, adapter ownership, dynamic loading, and source/module cycles.
- Zero-dependency server-only observability package with fixed structured events, bounded JSON-line output, server-generated correlation IDs, strict W3C trace context, default redaction, Web proxy handoff tracing, Worker lifecycle tracing, and a serialization-safe internal job-carrier protocol.
- Immutable versioned feature-flag metadata and evaluator with literal safe-off defaults, approval/scope/lifecycle enforcement, emergency-off precedence, rolling registry-version isolation, and dedicated cleanup tasks.
- Exact zero-argument Web feature-flag composition with internal database sourcing, live read-only-role attestation, forced-RLS append-only control plane, separated migrator/runtime/control identities, and non-empty logical restore evidence.
- Root formatting, ESLint, TypeScript, Vitest, real local and CI-shaped PostgreSQL integration,
  dependency audit, and production-build gates with behavioral, HTTP, shell/private-browser, and
  artifact verification.

## What does not exist yet

- A production-available reading, account, payment, legal, or ritual flow. RIT-158 is deliberately
  local-only: its signed checkout simulator cannot charge money, and the Stripe adapter has no live
  key, provider account/session, underwriting approval, or production activation.
- An approved production anonymous-session retention duration, legal consent notice,
  consent/privacy-control UI, per-client abuse strategy, anonymous export/deletion workflow, or
  complete production private-resource authorization surface; the current session policy is
  required configuration and safe-off when absent.
- A country-specific crisis-resource program, an approved real classifier, intake persistence, or
  question-bearing analytics; the owner-approved English lexical baseline and the RIT-032 safety
  contract remain safe-off. The local anonymous intake can continue to Tarot without transferring
  the private question.
- A production-approved payment-provider route, real provider-unavailable classifier, offline
  cache/synchronization layer, or generic partial/degraded network state machine. The local Stripe
  adapter and signed simulator are implementation evidence only; the connection notice remains a
  `navigator.onLine` advisory.
- Production infrastructure.
- Production metrics, alerts, retention/sampling policy, vendor exporters, durable analytics
  storage/outbox, viewed-event ingestion, or a real persisted queue consumer; the RIT-046 analytics
  package and Web adapter are synthetic safe-off evidence. RIT-045 has one narrow PostgreSQL-backed
  Revisit reminder queue and sealed safe-off adapter, but no production provider, generic queue
  runtime, scheduler process, delivery metrics/alerts, or deployed asynchronous service.
- Approved legal entity, legal terms, privacy notices, or tax configuration.
- Formal trademark clearance or secured canonical domain.
- Payment-provider written underwriting approval.
- Public-release AGPL compatibility review, clean complete Corresponding Source for the exact
  deployed revision, release-revision CI evidence, and a deployed source-code link. The live
  zero-record OSV commit query, forty-vector independent comparison, observed ephemeral Linux
  sanitizer/fuzzer pass, and local native-component offline archive/rebuild rehearsal do not
  activate production or satisfy the complete public release offer.
- A production content corpus, a real rights-cleared tarot deck or artwork set, an authorized publishing/import workflow, and expert-reviewed localized traditions; the synthetic RIT-022 fixture is contract evidence only.
- An approved production tarot catalog, production-composed/activated interpretation runtime, AI
  provider/model/reviewer activation, production intention/ritual/journal activation, report
  triage/admin workflow, or separate creation-versus-history operational kill switches; the
  synthetic RIT-022 fixture remains publication-ineligible and cannot activate the production
  RIT-024/RIT-027 runtime.
- Production credentials or vendor accounts.
- A production AI provider/model candidate evaluation, representative human output review,
  latency/cost comparison, canary evidence, or approved model rollback rehearsal; RIT-036 is local
  synthetic safe-off evidence only and does not activate or approve a provider, model, reviewer,
  prompt, content corpus, safety policy, or another locale.
- Manual assistive-technology coverage with current screen readers, Firefox/WebKit coverage, and real 200%/400% browser zoom remain release-level work; Chromium/axe does not substitute for those checks.

## Current blockers and owner decisions

| ID      | Decision needed                                | Blocks                                | Owner action                                                                                  |
| ------- | ---------------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------- |
| OWN-001 | Formal brand/domain clearance                  | Public branding and trademark filing  | Commission trademark and linguistic search; secure domains/accounts                           |
| OWN-002 | Payment underwriting path                      | Production checkout                   | Obtain written pre-approval from primary and backup providers                                 |
| OWN-004 | Launch legal markets and entity                | Public launch                         | Select entity, tax setup, legal counsel, and first launch countries                           |
| OWN-005 | Initial operating budget                       | Paid vendors and traffic              | Set monthly infrastructure, AI, payment-loss, and marketing limits                            |
| OWN-006 | Crypto checkout decision and provider approval | Production crypto checkout            | Decide whether to pilot; obtain legal/provider approval and define supported countries/assets |
| OWN-007 | Regional-tradition expert/content approval     | Any regional spiritual tradition pack | Select named tradition, qualified reviewers, sources, rights, language, and boundaries        |

These owner decisions do not block independent local engineering foundation work.

## Current verification status

- `pnpm test:configuration-boundary` passes typed environment parsing, fail-closed startup,
  server-only imports, client-delivery secret isolation, isolated production compilation, and the
  current nine-page sitemap inventory; its final finite-route phase remains red on legacy direct
  RSC expectations for dynamic `/en`.
- `pnpm test:accessibility` passes four public and three private routes with 39 shared axe scans,
  460 reviewed contrast nodes, six deterministic Tarot scenarios, two Tarot screenshots, and three
  free-ritual axe scans plus one supporting candle screenshot,
  forward/reverse keyboard focus, expanded text, desktop/mobile RTL, connectivity, create/reveal,
  retry/limit/resume/report, interpretation, both free rituals and modes, pause/exit/completion,
  stable-key offline/error retry, 44px targets, theme, no-JavaScript, storage, and local-request
  checks.
- `pnpm test:database-foundation` passes local PostgreSQL attestation, all MVP migrations, seed,
  least privilege, RLS, constraints, transaction/race/reset/restore behavior, anonymous identity,
  tarot reporting, interpretation claim/replay/fencing/fallback behavior, and intention
  ownership/encryption/idempotency/concurrency/lifecycle/negative-constraint behavior.
- Codex reran all three environment-dependent commands in the unrestricted local environment after
  the prior approval infrastructure blocker was removed. They use loopback-only test services and
  do not access production, deploy, or call paid providers.
- GitHub Actions run `30492438707` passes `Quality`, `PostgreSQL integration`, and `Security scans`
  together on private PR `1`; the hosted quality requirement is satisfied without weakening or
  skipping any required job.
- The focused RIT-093 supply-chain run queried the exact Swiss Ephemeris commit through OSV and
  received zero vulnerability records. Its 120-file native-component Corresponding Source archive
  passed cross-platform extraction, complete inventory verification, rejecting-curl enforcement,
  an offline metadata-identical rebuild, and a frozen-lockfile install. No full workspace suite
  was repeated.
- The focused native double-build and macOS UBSan gates now include forty fixed Astronomy Engine
  vectors for ten bodies across 1801, 1888, 2000, and 2050. All pass the fixed `0.02°` angular and
  `0.001` relative-distance limits alongside the existing five native integration cases and 151
  mutation/boundary cases.
- The same archived component passed Ubuntu 24.04.4 arm64 ASan+UBSan, all 151 deterministic
  mutation/boundary cases, 5,000 libFuzzer runs, and both sanitized native integration files under
  Node 24.18.0, pnpm 11.13.1, and Clang 18.1.3.
- The complete release-source boundary passes eight focused synthetic Git/archive cases plus the
  locked CI contract. Clean revision `1fded12559b4e2986a317f2a6fee4008a2c22b8a` produced and
  independently verified the 914-file complete archive with SHA-256
  `68cc39041511e1de29fa9355efc512d065c32612e88d396d6dbfe9aebafb4ae6`; no upload, deployment, or
  public-source claim is made.
- The obsolete owner-untracked `apps/web/server/tarot-reading-state 2.ts` safe-off stub was removed
  after comparison proved that the canonical implementation fully supersedes it. The two
  D-030-excluded QA report copies remain untouched.

## Queue authority

`BACKLOG.md` alone determines the executable next task from priority, status, dependencies, and
owner gates. This dated capability snapshot intentionally does not copy a task ID; blocked context
remains above and task history stays in Git and durable records.

## Current quality state

On 2026-07-24, the production-pack ZIP, golden prototype, machine-readable contracts, 18
screenshots, and manifest verifier retain their declared integrity checks. The current tree passes
CI structure, the architecture policy, durable-record validation, 15 immutable migration
policy files, generated evidence, instruction validation, exact-static-asset secret policy,
formatting, lint, 12-package type checking, 1,587 unit/contract tests in 115 files, and 145 fixed AI
release assertions. With `BRAND_CANONICAL_ORIGIN=http://127.0.0.1:4175`, all 12 production build
tasks pass and the verifier checks 103 artifacts/exports, four public pages, and five private
experience pages. Production-artifact accessibility and the full PostgreSQL foundation suite passed
in the unrestricted local environment; historical RIT-158 runs remain separately identified rather
than substituted for this evidence. The 2026-07-26 configuration-boundary rerun reaches the
finite-route phase but does not pass the legacy direct-RSC assertions after `/en` became dynamic.
No new full workspace, full accessibility matrix, or full PostgreSQL foundation run is claimed for
RIT-093 or RIT-094.

RIT-094 passes Web production build and affected type checking, 181 focused route/contract/proxy/UI
tests, and a dedicated production-artifact Chromium gate. The browser evidence covers a 320px
viewport at 400% root zoom, keyboard focus, forced colors, reduced motion, pseudodirectional RTL
with LTR chart geometry, exact/approximate/unknown/empty/offline/unauthorized/unavailable states,
zero critical or serious Axe violations, zero browser-storage entries, zero private API query
parameters, and no document-level horizontal overflow. The browser's Axe run reports only its
allowed color-contrast incomplete classification; no color-contrast violation is claimed as
passing through suppression.

RIT-095 is complete with a provider-neutral safe-off natal interpretation boundary. It strictly
reparses RIT-093 facts, independently recomputes persisted aspects from authoritative longitudes,
stops unavailable states before artifact/model work, exposes only minimized placement/aspect
references and bounded provenance, preserves approximate-time suppression, and forbids model
degree, house, deterministic-label, fixed-personality, certainty, professional-advice, dependency,
paid-efficacy, persecution, self-harm, and injection drift. Exact content/prompt/fallback integrity
and authority, digest/input/single-use binding, deterministic replacement, and independent
semantic review are enforced. The fixed synthetic gate passes all 30 cases through 35 assertions
with zero external requests and zero paid calls. No production content, provider/model, live
reviewer, API, persistence, Credits, natal prose UI, activation, deployment, or public behavior is
introduced.

RIT-096 and OWN-016 are complete through D-073. The approved English publication at
`/en/astrology` plus four method guides binds D-067 through D-070, the pinned Swiss Ephemeris
technical reference, explicit source rights, exact body/house/aspect/uncertainty tables, owner
review dated 2026-07-27, and worldwide RITUVIA rights for public display, commercial use, SEO
publication, and translation. The pre-approval review bytes retain SHA-256
`6c142722f993590981552eae6aac653ffc038156497e5eb43e49ebc8ed51e90b`; the approved publication file
has SHA-256 `a27ca9b9a6fa6881353ff49c9acce0992bce094d3a53353013efaa2978a16504`.
Only the five exact routes enter the production index, robots, and sitemap inventories. Local,
preview, staging, RSC, private natal, sign/personality, and personalized routes remain
non-indexable. The pages contain no birth input, personalized output, prediction claim, FAQ/review
schema, or private API request. Production deployment, DNS,
public launch, and actual crawl activation remain separate owner gates. Five focused files pass
185 publication, metadata, routing, SEO, and proxy tests; the Node 24.18.0 production build
statically generates all five routes, and the 320px Chromium gate passes five Axe scans with zero
serious/critical violations, zero unexpected API requests, zero console/page errors, exact
production robots/sitemap admission, and 81 explicitly reviewed color-contrast incomplete nodes.

RIT-100 and RIT-101 are complete through D-075. `@rituvia/i18n` provides strict BCP 47 and IANA
time-zone parsing, exact ICU arguments, nested plural/select formatting, explicit locale
formatters, finite fallback telemetry, fail-closed translation publication, locale-derived text
direction, and test-only `en-XA`/`ar-XB` ICU pseudolocalization. Checksummed English source and
glossary records carry rights, context, risk, placeholder, markup, link, editorial, and reviewer
metadata. Publication blocks missing/unexpected keys, stale source drift, unsafe expansion,
glossary or forbidden-term violations, identical untranslated content, and insufficient review;
runtime admits only an exact process-authorized approved catalog.

Current shell, account, Sanctuary, Revisit, Tarot, commerce, numerology, and astrology surfaces use
explicit locale formatting and structural bidi isolation without activating another locale. The
RTL gate rejects physical directional CSS, invisible bidi controls, production pseudolocale
imports, and reviewed contract loss. Production-artifact Chromium passes 79 Axe scans over
fourteen public and three private routes with expanded text, desktop/mobile RTL, keyboard, touch,
dark, reduced-motion, no-JavaScript, offline advisory, and local-only request checks. Dedicated
numerology, Revisit, and astrology flows pass 320px RTL; astrology keeps the wheel LTR at 400% zoom
under forced colors. Actual Arabic routes, reviewed content, email, share cards, support, and
launch remain unimplemented and gated.

RIT-103 is complete through D-076. One stable-ID, approval-bound route matrix now drives all
fourteen approved English static paths, generic localized segment pages, SSR document
language/direction, canonical and reciprocal hreflang metadata, robots, substantive revisions,
and a production sitemap index with exact English pages/numerology/astrology shards. The redirect
engine permits only explicit queryless same-locale stale slugs targeting a current reviewed route;
Git history contains no superseded production public slug, so the production history is
intentionally empty rather than populated with invented aliases. Synthetic `es-419` tests prove
localized segment and redirect behavior without entering runtime.

The RIT-100 client boundary is also reconciled: browser bundles consume a checksummed source-bound
message-only projection and no longer include source rights, reviewer, server configuration, or
fallback-brand literals. Focused route/SEO tests, Web/i18n type checks, production build and shell
artifact policy, the real HTTP configuration boundary, and the fourteen-public/three-private
production-artifact accessibility run pass. English remains the only supported/published locale;
RIT-105 remains blocked on OWN-004.

RIT-102 is complete through D-077. The UI now has local-only Japanese, Korean, Simplified Chinese,
Traditional Chinese, and Devanagari UI/display fallback stacks, strict CJK line breaking, normal
grapheme-safe wrapping, script-appropriate shaping/line height, and no production `break-all`.
Private human text is preserved in NFC, permits legitimate ZWJ/ZWNJ, retains supplementary CJK
characters, and still rejects zero-width space, bidi overrides/isolates, unsafe controls, and
isolated surrogates. NFKC is limited to safety-classification copies rather than stored text.

The test-only writing-system harness loads both UI and Web CSS and hydrates a real controlled React
field. Chromium at 320 CSS pixels verifies four CJK punctuation/line-break profiles, five actual
platform-font providers without LastResort/tofu, measurable Devanagari shaping, Japanese and Hindi
composition across forced rerenders, canonical ISO dates, Axe, touch targets, and zero external
request, storage, console, page, or locale-activation failure. English remains the only runtime
and published locale.

RIT-104 is complete through D-078. A separate checksummed English lifecycle-message catalog now
renders a once-only Revisit reminder and support-receipt preview as semantic HTML plus equivalent
plain text. Reminder queue rows persist exact template ID, version, source checksum, resolved
locale, and fallback state; the Worker validates the retained registry entry after send-time
authorization rechecks the current date, time zone, due threshold, and quiet hours. Unknown
templates and unsupported delivery locales fail before provider use. Explicit fallback exists
only in local preview and emits one non-identifying event.

The GET-safe reminder preference deep link focuses settings without mutating consent. Focused
i18n, Domain, Worker, Web, migration, real-PostgreSQL, architecture, localization, Chromium
preview, and Revisit-browser evidence passes without running the complete 1,674-test matrix under
D-050. Production runtime remains safe-off before queue claims: no scheduler, email provider,
support mailbox, legal unsubscribe text, actual send, non-English message catalog, deployment, or
public launch is activated. At RIT-104 closure no backlog item was Ready; RIT-105 remains blocked
on OWN-004 and gates RIT-106.

RIT-047 adds one production-artifact Chromium context that navigates in the same tab from safe
intake through deterministic Tarot, exact-reading intention handoff, free reduced-motion ritual,
private journal, and Revisit completion/deletion. It proves mobile keyboard and focus behavior,
RTL reflow, touch targets, zero serious/critical Axe findings, stable-key manual recovery, no
automatic mutation retries, no account or payment request, and continuous private-canary isolation
across URL/history, storage, metadata, console, screenshots, and request boundaries.

RIT-158 passes the production-artifact Playwright flow from anonymous reading through intention,
free ritual, encrypted journal, account merge, fresh account, 18+ attestation, four exact prices,
signed local hosted checkout, entitlement, owned paid ritual, revisit, mobile layouts, and sign-out.
All 11 steps pass with zero serious/critical Axe findings, page errors, unexpected console errors,
unexpected HTTP/request failures, or desktop/mobile horizontal overflow.

The corrective Playwright run also passes a direct Sanctuary visit with no saved reading through
standalone intention, free candle, private journal, and completion. A fresh active-catalog draw
revealed `The Star`; the accepted set contains exactly the 22 Major Arcana identities. Both current
screens have zero serious/critical Axe findings, page errors, unexpected console errors, and
unexpected HTTP failures; four signed-out `401` responses from `/api/v1/me` and
`/api/v1/entitlements` were expected and classified.

The pinned Node.js 24 runtime passes formatting, lint with zero warnings, strict type checking
across all 12 workspace tasks, the prior milestone's 1,587 unit/contract tests in 115 files, 145
fixed AI release assertions, the architecture gate, all 17 immutable migration-policy files, the
tracked/unignored secret scan, and all 12 production build tasks. RIT-050 adds a current focused
213-test authentication/proxy result, while RIT-051 adds 65 focused tests and the isolated
16-migration merge gate instead of repeating the complete unit suite. The prior full PostgreSQL 17
matrix verifies MVP schema, least privileges, RLS, constraints, concurrency, guarded reset,
privacy canaries, and non-empty logical dump/restore without touching unrelated PostgreSQL
instances.

The build verifier checks 115 artifacts and narrowed exports, including exact UI stylesheet parity,
all four canonical pages, all five private experience pages, the intake/reading APIs, the
anonymous-session and account-authentication routes, identity and
question-intake domain/database exports, the divination parser, safe-off fixture assessment,
deterministic draw/replay/verified projection vector, the reading service/API/persistence boundary,
the compiled AI Tarot input/output fixture, provider/version exports, published-content retrieval,
prompt artifacts, placeholder rejection, pre-generation crisis zero-continuation, exact allowed
authorization binding, non-exported authorization issuers, provider-neutral generation and
authorized-fallback exports, the compiled safe/unsafe post-generation verification gate, and
atomic interpretation claim/finalization/verification persistence, the private interpretation route,
and the icon. Maximum Web output is 7,705 B gzip HTML, 8,931 B gzip CSS, 230,675 B gzip JavaScript,
and 356 B raw icon. The narrowed exports now also include the compiled strict ritual domain,
Git-authored catalog parse, and read-only ritual-object route.
Mutation tests reject remote, ambiguous, escaped, entity-obfuscated, unbudgeted, non-canonical, or
traversal-capable build resources before file access, plus poisoned canonical/robots/route behavior.
The architecture verifier audits 330 source files across 12 active modules and keeps module,
runtime, browser/server, provider, UI-host, storage, unsafe-HTML/style, and adapter boundaries closed.

RIT-024 focused evidence covers 147 domain, cryptographic, service, proxy, and HTTP tests. RIT-025
adds the first strict V2 one-card consumer. RIT-026 generalizes the flow and adds exact three-card
position-title/order/uniqueness parsing, real service create/replay projection, browser-state,
transport, proxy, metadata, build, and accessibility coverage. RIT-027 adds exact limit-policy
matching, explicit new-reflection and previous-result state, controlled empty radio behavior,
bounded wait handling, and owner-bound append-only categorical reports. Real
PostgreSQL integration proves clean/idempotent migration, exact owner/session authorization,
same-key replay and conflict, key rotation, winner-before-entropy concurrent creation, atomic
limits, immutable execution, least privilege, and non-empty logical restore. Independent review
found no remaining P0/P1 after the canonical GET route and catalog checksum/approval provenance were
included in the complete execution binding. The synthetic fixture remains intentionally ineligible
for publication and retrieval, and runtime composition remains hard unavailable rather than
silently substituting test content.

RIT-029 adds per-type UUID-only tab storage, hydration-safe one-shot owner retrieval, strict
response/ID/type binding, explicit restored reveal, definitive-clear versus transient-retain
recovery, and individual reading-expiry enforcement. Focused coverage passes 285 tests in 10 files.
Playwright production-artifact acceptance restores the same one-card and three-card results after
refresh, proves reveal produces no API request, clears a stale ID on private `404`, preserves exact
three-card order, rejects opener-cloned storage without an owner GET, and has no horizontal
overflow at 320px. A fresh database-script rerun remains
bounded by the unrelated `IPO.ONE` process occupying fixed port 55432; it was not stopped or
modified, and no RITUVIA assertion failed.

RIT-030 activates only the pure AI contract boundary: public Tarot facts and exact provenance enter
a strict input schema; canonical reflective output, normalized provider results, provisional
streaming, and operational metadata remain bounded and provider-neutral. Sixteen focused tests in
two files cover valid one-/three-card fixtures, every supported tone/time horizon, private and
internal-audit rejection, opaque allowed-only generation authorization, JSON-only input without
getter/proxy execution, exact fact/source/ritual binding, schema/provenance drift, hostile text,
unsafe claims, fake providers, categorical failures, and metadata isolation. No provider SDK,
network call, secret, raw question, production model/content, persistence, UI, or activation is
introduced. The database suite was not rerun because the unrelated `IPO.ONE` PostgreSQL process
still owns the repository-fixed port 55432; it was inspected only and not stopped or modified.

RIT-031 adds a second fail-closed trust boundary before generation: checksums prove exact canonical
bytes, separate server-owned authority callbacks prove allowlist approval, and only selected
published content with valid review, rights, locale, tradition, theme, draw, and spread evidence can
enter a runtime-issued prompt artifact. Every substantive system/tone instruction is inside the
approved prompt checksum; facts and excerpts stay in bounded JSON data, and exact content,
source/rights, deterministic-engine, prompt, schema, retrieval, assembly, and safety provenance is
serializable without retaining private questions or internal draw audit. The canonical placeholder
remains a negative fixture. No provider request, model call, persistence, production content,
network, credential, API, UI, or activation is introduced; RIT-033 must wire the approved mappings,
accept only the branded artifact, and persist its provenance.

RIT-032 adds the pre-generation trust boundary: every bounded raw intake is parsed and re-evaluated
server-side, lone-surrogate Unicode is rejected before classification, every non-empty non-crisis
question requires exact authorized classifier evidence, and routes can only stay equal or become
more restrictive. Questions and risk categories remain transient; non-allowed and invalid cases
cannot invoke continuation or mint authorization. Allowed continuation separately requires exact
safety-policy authority and receives an opaque authorization bound to the complete request and
intake/safety policy identity. Sixty-five focused safety tests plus independent reviews cover route
precedence, nuanced categories, uncertainty, confusables, authority/result failures, policy drift,
forgery/reuse, immutability, and privacy canaries with no remaining P0/P1. No real classifier,
provider/model, network, credential, API/UI, crisis-resource change, or activation is introduced.

RIT-033 composes the full safe-off generation boundary: exact runtime-issued artifacts are checked
before a durable claim and before any provider capability can execute; the provider-neutral request,
strict result/fact/source validation, monotonic timeout/cancellation, single bounded retry,
authorized deterministic fallback, and redacted fixed metadata fail closed. Idempotent replay and
in-progress responses execute zero provider work, reclaimed work is fallback-only, configuration,
invalid-request, and unknown failures become durable no-output terminal rows, and a provider
candidate remains transient and non-displayable until RIT-034 verifies or replaces it. Focused
AI/Web coverage passes 34 tests; the isolated real-PostgreSQL matrix proves the claim, fencing,
retention, privilege, and restore properties described above. No real provider/model, provider SDK,
API key, network call, paid inference, production prompt/content/template activation, API/UI,
payment, deployment, or public launch is added.

RIT-034 closes the post-generation boundary while remaining safe-off: exact runtime-issued
single-use candidates and context undergo deterministic whole-output fact, source, orientation,
safety, dependency, and injection checks before an independent bounded reviewer can approve.
Uncertainty uses only the already-authorized exact safe replacement; trust failure produces no
output. Atomic parent finalization and append-only verification persistence expose only a durable
verified/replacement child, authenticate replay with a keyed HMAC, hide pending provider prose, and
leave historical childless pending rows non-displayable. Focused coverage passes 149 AI assertions
and 27 Web-composition tests, with the PostgreSQL and full repository evidence described above. No
production provider, reviewer, model, SDK, key, network request, paid inference, API/UI, payment,
deployment, or public launch is added.

RIT-035 adds only the private durable-delivery boundary: an explicit owner-bound idempotent POST
starts or resumes work, a separate GET can only observe state, and the browser accepts no
provisional prose. A strict redacted DTO exposes processing/failed or durable verified/reviewed-
fallback output; the shared client panel enforces one in-flight request, abortable foreground
polling, an eight-poll ceiling, stale-response denial, cancellation, and same-operation manual
retry. Focused coverage passes 233 assertions and the full repository/build/accessibility gates
described above pass. Runtime adapters remain hard unavailable, so no provider, reviewer, model,
SDK, key, network request, paid inference, catalog/content/safety activation, payment, deployment,
or public launch is added.

RIT-036 adds the explicit local release decision above the RIT-032 through RIT-034 production
boundaries. Exact suite bytes bind a metadata-only baseline; code-fixed thresholds require
100% applicable fact/schema/source/fallback and safe-control outcomes with zero critical failures,
missing/unexpected cases, unsafe continuations, privacy leaks, network calls, or paid calls. The
dedicated executor binds 34 cases to 145 passing assertions in six files before generating
in-memory observations, and the CI-contract suite prevents removal, replacement, or reordering.
The runtime remains hard safe-off: no provider, reviewer, model, SDK,
key, network, paid inference, production content/safety activation, database, UI, payment,
deployment, or public launch is added or approved.

The production Web matrix proves restrictive browser headers, server correlation, independent route/intake safe-off behavior,
exact canonical/robots/sitemap polarity, private/query/internal/RSC rejection, and sensitive-canary
isolation. RIT-010 through RIT-013 browser evidence retains semantic, content, SEO, no-JavaScript,
mobile, and same-origin coverage. Fresh production-artifact acceptance passes all four public routes
plus the private intake, one-card, and three-card pages with 39 blocking Axe scans, exact
selector-level review for 459 gradient/background `color-contrast` incomplete nodes plus independent
token contrast tests, complete forward/reverse focus, skip-link transfer, 44px targets, 40%
expansion, desktop/mobile RTL, dark/reduced-motion/no-JS states, a persistent
online/offline/online advisory announcement, six exact deterministic create/reveal/retry/limit/
resume/report scenarios, exact interpretation retry/polling/verified/fallback/offline scenarios,
two supporting screenshots, and local-only requests. CLI Playwright also verifies all four
synthetic state variants at 320px, RTL, and dark mode with zero console errors.

The real local and CI-shaped PostgreSQL 17 suites prove clean/idempotent migrations and synthetic
seed, separated least-privilege roles, forced RLS, exact activation and append-only constraints,
guarded reset, non-empty dump/restore, transaction/race behavior, migration drift checks, and DDL
denial. The RIT-020 path additionally proves no plaintext token storage/logging, fixed
expiry/runtime revocation, bounded full-ledger consent validation and withdrawal, eight-way
idempotency races, privacy-minimal global capacity, injected privilege-drift denial, exact identity
column privileges, and exact restored-history behavior and attestation. Repository architecture,
CI/toolchain, historical migration, current-tree/full-history secret,
actionlint and dependency gates pass. The current dependency audit reports zero critical/high and
two moderate advisories in Prisma's transitive tooling path: `@hono/node-server` Windows
`serve-static` traversal and a Valibot issue-path flattening failure. RITUVIA does not expose the
Hono adapter as a product runtime or static-file server, and neither advisory is introduced by
the i18n dependencies.
Independent
accessibility, architecture, localization, and security review found no remaining local-slice P0/P1;
the intentionally global issuance gate and required pre-gate catalog attestation remain explicit
production-abuse/load P2 release risks and are not accepted as complete production admission
controls. Feature-flag and anonymous-identity access now share one bounded database pool per Web
process instead of either path creating one per request.
Playwright CLI against the local production artifact verifies 204 create/resume, redacted exact
cookie attributes, empty/no-store/noindex responses, query rejection, public navigation, 320px
reflow, and skip-link focus; its temporary local shell activation was appended safe-off afterward
and the token-bearing network trace was removed.
RIT-021 Playwright CLI evidence additionally verifies native theme selection, required-theme focus,
mismatched-origin rejection, the same-origin theme-only allowed flow, and private page semantics
against an isolated production build whose feature-flag reader is replaced only by a deterministic
test adapter. Reframed, blocked, crisis, offline/degraded, edit/stale-response, 320px, RTL, dark,
no-JavaScript, noindex/no-store, and raw-question non-retention behavior are covered by the
component, domain, API, production HTTP, and Chromium/axe gates rather than overstated as CLI flows.
RIT-027 Playwright CLI evidence verifies one-card create then presentation-only reveal, exact
category/position report submission with no free text, independent report idempotency, empty `204`
success, explicit manual retry, explicit new reflection, a truly cleared theme choice, old-result
preservation through a limit state, and no immediate limit retry. At 320px the one-card and
three-card results have no horizontal overflow; the latter exposes exactly three ordered cards and
all three canonical report positions. The success responses exist only in isolated browser routes;
the same latest production server returns an empty 404 without interception.
Production migration/deployment, canonical-domain/DNS changes, actual indexing, and Search Console
remain separate owner gates. `origin` now points to the private
`https://github.com/CPTM511/RITUVIA` repository, and committed `main` revision
`2ff7a1c6106f4e78e34dfe283680701860ecd9cf` produced the first hosted three-job Actions run
`30466750711`. The run truthfully failed: the historical revision used a non-existent actionlint
Linux asset name, did not build `@rituvia/security` before the PostgreSQL verifier, and predates the
current migration manifest. Private PR `1` then ran the cumulative source in hosted run
`30468813822` and exposed three additional clean-checkout assumptions: observability was not built
before the analytics verifier, the Prisma client was not generated before the database verifier,
and default Gitleaks classified 11 historical test constants as generic API keys. The current
worktree fixes all six root causes with self-contained commands and an exact 11-fingerprint
historical ignore list; focused CI-contract, fixed-tool, generated-client, and internal dependency
build checks pass locally. Hosted run `30469853925` subsequently scanned all 40 commits with
Gitleaks and found no leaks. It exposed one further clean-runner i18n build prerequisite and a
10-second native sanitizer compile bound that was too short for the hosted runner; both are fixed
with an explicit i18n build and 60-second bounded compiler stages. A cached-source native security
rerun also identified and fixed the sanitized compiler environment's missing trusted temporary
directory, then passed 151 mutation cases and the 23-component supply-chain validation. That run's
PostgreSQL job never reached database verification because repeated npm registry timeouts aborted
dependency installation, which remains external transient evidence rather than a database result.
Hosted run `30470928541` then passed the complete Security job, including native sanitizer,
SCA/CVE, and Corresponding Source checks. Quality reached the formatting gate and found two
existing format drifts, now corrected with a full repository format check. PostgreSQL generated the
pinned Prisma client and built security before revealing the remaining missing domain build output;
the self-contained database command now builds domain, security, and Prisma in dependency order.
Hosted run `30471374114` passed Security again. Quality then reached root TypeScript and exposed
three clean-runner type-boundary defects, now corrected with a root JSX setting, unshadowed browser
global, and complete build-policy declaration. PostgreSQL reached schema comparison after all
prerequisites and migrations; because Prisma cannot represent the committed custom SQL constraints,
explicit names, indexes, and defaults, the CI verifier now checks the complete normalized diff
against a strict Prisma-7.8.0 fingerprint. A fresh throwaway database and the existing local
migrated database produced the same 17,666-byte, 356-line SHA-256 fingerprint. Focused baseline
tests, affected lint/format, and all 16 package plus root typechecks pass; any schema, output,
normalization, or Prisma-version change fails closed.
Hosted run `30473143747` passed the complete Security job for a third consecutive current revision.
PostgreSQL accepted the strict drift baseline and reached migrated-database invariants before one
post-migration assertion failed under the prior generic stage label. Quality passed format, lint,
and typecheck, then ran 1,963 tests: 1,955 passed, five skipped, three configuration-contract
assertions failed, and 21 files could not import clean-checkout Config/Security build outputs. The
current worktree fixes the whole Quality set with exact source aliases, current native-script
environment-reader inventory, configuration-backed publication identity, and new planned
`RIT-160` astrology flag cleanup. The database verifier now identifies each non-sensitive
post-migration invariant stage without exposing credentials or data. Twenty-eight representative
tests, the complete 16-package plus root typecheck, and the milestone integration unit matrix of
2,144 passing tests across 183 files pass locally.
Hosted run `30474266506` passed Security again. Quality then passed format, lint, typecheck,
architecture/evidence checks, 1,963 hosted unit/contract tests, fixed AI evaluations, and the
configuration boundary before failing only because the artifact policy charged a validated legacy
`nomodule` compatibility chunk against the modern JavaScript budget. PostgreSQL reached the new
granular `tarot runtime privilege attestation` stage and revealed broader CI-only
`reading_report` insert privileges than production permits. The current worktree now grants the
exact 16 report columns, passes the same privilege attestation on a one-time loopback PostgreSQL
role, and locks that least-privilege shape in the CI contract. The artifact policy still validates
all referenced scripts but measures only modern-delivery scripts against the unchanged budget.
One hundred three focused CI/database/build-policy tests and the complete production build pass locally;
the resulting maximum modern JavaScript gzip size is 219,789 bytes.
Hosted run `30475576351` passed Security and confirmed the modern-budget fix by reaching the
accessibility stage. PostgreSQL passed the corrected Tarot privilege attestation, then exposed an
outdated policy-inventory assertion that omitted four current privacy-deletion policies. Quality
exposed a separate outdated exact-equality assumption between the complete 45-page reviewed build
inventory and its intentionally representative 14-route accessibility smoke subset. The database
verifier now attests the exact current nine-policy interpretation inventory, matched by a read-only
query against the one-time loopback migrated database. Accessibility now enforces smoke inventory
inclusion instead of equality and confines the GEO answer-context's Axe-incomplete contrast
selectors to its bounded component; the underlying text tokens remain independently proven at
4.5:1 or better against all reviewed gradients. The complete non-restricted accessibility command
passes 14 public and three private routes, 79 primary Axe scans, deterministic Tarot acceptance,
and the intention, ritual, Revisit, full-loop, and writing-system browser gates without
critical/serious violations, layout failures, private leaks, unexpected requests, or console/page
errors.
Hosted run `30477604316` passed Security again. Quality passed evidence, formatting, and linting,
then failed at Web typecheck because the new runtime accessibility-inventory audit lacked its
matching `.d.mts` declaration. PostgreSQL passed the current interpretation-policy inventory and
reached feature-flag append-only behavior, where the old fixed July 17 fixture timestamp violated
`effective_at >= created_at` before the intended RLS assertion. The declaration is now complete;
Web and root TypeScript checks pass. Feature-flag fixtures now derive bounded future timestamps
from the PostgreSQL service clock so policy tests cannot be preempted by runner-date drift. A
transactional one-time loopback check accepts the intended legacy safe-off row and rolls it back,
and 68 focused accessibility/contrast/CI/database tests pass.
Hosted run `30478476010` then passed PostgreSQL integration and Security in the same current
revision. Quality passed evidence, format, lint, typecheck, the hosted unit/contract matrix, fixed
AI evaluations, configuration boundary, and production build before reverse keyboard traversal
read the browser-native one-pixel outline of a transparent radio input instead of the designed
three-pixel focus ring rendered on its `.rvt-choice` parent. Keyboard acceptance now evaluates the
actual visible choice/switch parent focus indicator while preserving active-control order,
visibility, clipping, and `:focus-visible` checks. Twenty-seven focused accessibility tests and the
complete non-restricted accessibility/browser command pass after the correction.

D-090 records the owner's explicit public-source decision. GitHub now reports the AGPL repository
as public and protects `main` with strict, up-to-date `Quality`, `PostgreSQL integration`, and
`Security scans`; administrator enforcement; pull requests; linear history; resolved
conversations; and force-push/deletion denial. Hosted run `30494018585` passes all three jobs
together on the protected candidate tree. Public repository visibility is source disclosure, not a
production deployment, DNS change, indexing activation, or public product launch.

D-079 records the owner-approved development baseline: IPO.ONE's BVI entity direction, an 18+
product, United States and English as the first production-launch candidate, reviewed closed
testing for `es-419`, `pt-BR`, and `fr`, later Mexico/Brazil candidates, deferred France/EU launch,
a mandatory-law-preserving digital refund direction, active SEO/GEO engineering, and
preparation-only ASO. `OWN-004` and `RIT-105` remain blocked on exact entity particulars,
qualified legal review, final policy text, and tax/MoR evidence; no country, locale, policy,
payment, deployment, indexing, or native-app distribution is activated.

RIT-110 is Done with a Git-authored shared editorial registry and pure `@rituvia/content`
publication boundary. Two existing approved English numerology and Western natal education assets
bind exact checksums to stable identity, source/claim evidence, rights, review, version, risk,
locale, and lifecycle metadata. Private preview is exact-digest, private/no-store, and noindex;
publication additionally requires process-owned record/source authority fingerprints and locale
authority. The forward-only status graph, exact translation source binding, reciprocal acyclic
deprecation, canonical-path ownership, symlink/path denial, 108 focused tests, package build,
architecture, CI, record, formatting, lint, lockfile, and secret gates pass without a CMS,
database, public route, content-text change, locale/index activation, provider, deployment, or
public launch.

RIT-111 is Done through D-081: one Tarot library hub, 22 Major Arcana
card pages, and two spread guides bind the exact approved local source catalog and resulting
approval envelope. The shared editorial registry and active localized route registry now contain
exactly those 25 English educational routes, with production-only canonical metadata, robots, and
the English Tarot sitemap. Strict parsing, answer-first semantic components, source/rights
separation, structured data, bounded internal links, mobile/forced-colors styles, and focused
contract tests preserve no AI retrieval, personalized-result indexing, doorway expansion, new
locale, deployment, DNS change, or public launch. The production Next.js build, 39-route public
shell policy, 272 focused tests, strict typecheck, ESLint, shared editorial authority,
architecture, secret scan, and representative 320 px Chromium/Axe gate pass without increasing
asset budgets.

RIT-112 is Done through D-082. One ritual/reflection hub and five distinct English guides bind the
D-047 original-secular virtual ritual catalog and preserve the free virtual candle/incense flow,
user agency, private-by-default reflection, and voluntary revisit timing. The exact approved
artifact SHA-256 is
`f551a42c2e55847736539ff57a0a3fd46a987dfd388235412a8c7790c23409bf`; no reviewed body copy or
route slug changed during approval promotion. The shared editorial registry, localized public
route registry, production-only canonical metadata, robots allowlist, and English rituals sitemap
now contain exactly those six routes while physical fire/smoke, efficacy, cultural authority,
personalization, private input, AI retrieval, doorway expansion, another locale, and regional
traditions remain denied. The 60-page production Web build, 200 focused contract tests,
four-record/nine-source/nine-claim editorial authority, architecture, non-restricted production
configuration boundary, and representative 320 px Chromium/Axe gate pass; the browser gate found
and closed one 44 px touch-target issue. No deployment, DNS change, public launch, actual indexing,
AI activation, new locale, or regional tradition is approved. RIT-113 is now the sole In Progress
item.

RIT-113 is Done through D-083. One deterministic source-bound inventory now covers exactly 45
approved English pages across core, numerology, astrology, Tarot, and ritual/reflection families.
Every record binds stable route, locale, family, shape, intent, canonical, authority, source-set
digest, review freshness, content digest, substantive structure, internal links, and nearest-page
similarity. Exact and bounded near duplication, short-page containment, template substitution,
thin content, same-intent cannibalization, canonical collision, stale authority, missing links,
and private, personalized, query, framework, unknown, or unapproved exposure fail offline without
an external provider.

Canonical/hreflang metadata, robots, sitemap, configuration-boundary crawl checks, and the public
build policy consume the same complete inventory. A single missing, extra, malformed, expired, or
failing record omits canonical alternates, forces noindex, disallows all crawling, and suppresses
sitemap output rather than publishing a partial set. The quality verifier, 168 focused tests,
strict content/Web typechecks, focused lint/format, CI contract, architecture, records, generated
evidence, secret scan, 60-page optimized Next build, 45-route public artifact policy, and
non-restricted production configuration boundary pass. The full workspace verifier still reports
the separately existing private three-card JavaScript aggregate above its fixed budget; RIT-113
does not modify that private client slice or weaken the budget. No route, locale, country,
deployment, DNS, actual indexing, or public launch is added or approved.

RIT-114 is Done through D-084. Every one of the 45 approved English public pages now emits one
minimal source-authorized JSON-LD graph: one `WebSite`, three `WebPage`, four `CollectionPage`, and
37 `Article` documents. Exact canonical identity, English language, visible H1 and description,
and explicit inventory-authorized parent hierarchy are enforced. Parent links must be visible;
template, hidden, `aria-hidden`, script, and style content cannot satisfy search evidence.
Breadcrumbs, author, publisher, date, FAQ, HowTo, Product, Offer, rating, and review claims remain
denied without separate visible authority.

The optimized Next.js build generates 60 pages and the build policy validates all 45 public
artifacts within fixed budgets. The non-restricted production configuration boundary requests and
audits the complete 45-page HTTP crawl surface. Twelve focused test files pass 125 tests, strict
content/Web typechecks, focused lint/format, CI contract, architecture, and the six-page Chromium
schema/injection gate pass. The browser uses the immutable production static artifacts, permits
only the existing one-per-page local account-session probe with synthetic 401 isolation, excludes
private canaries, and makes no external request. No deployment, DNS, Search Console, actual
indexing, another locale, or public launch was added by RIT-114.

RIT-115 is Done through D-085. The private English one-card result now offers an explicit local
share-card preview only after reveal. One exact allowlisted `tarot-share-card.v1` projection drives
the displayed 1200 by 630 SVG, local download, and capability-checked native SVG file share. The
bounded selected theme is included by default and one control removes it from localized alt text,
artifact bytes, download, and share payload. Private question, reading ID, interpretation, birth
data, intention, journal, account data, uploads, persistence, tokens, and analytics never enter
the share component.

The governed core UI catalog is version 1.1.0 and adds the English ICU accessible-description
contract. Production projection rejects test pseudolocales; serializer-only `en-XA` and `ar-XB`
fixtures prove expanded LTR and RTL geometry without activating a route or locale. The private
result remains noindex with no canonical, Open Graph, or Twitter metadata, while the artifact uses
only the public `/en/tarot` canonical. Focused unit/localization checks, Web typecheck/build, and
the dedicated non-restricted 320px Chromium gate pass across exact Blob/download/share bytes,
private canaries, CSP, network, storage, object-URL revocation, touch targets, and Axe. No
deployment, DNS, country, locale, public share hosting, provider, or public launch is added or
approved.

RIT-116 is Done through D-086. Every exact 45-route English public inventory record now renders
one server-side, human-visible answer-authority section with one of five stable entity identities,
closed fact/method, tradition, interpretation, and product-policy classifications, approved
source titles and versions, and truthful owner-review dates. Internal paths, hashes, locators,
reviewer identities, fake expertise, hidden copy, private input, unsafe markup, unknown
classifications, duplicate authority, and expired review state fail closed.

The checksummed English GEO record participates in every route's source and visible-content
digest without owning a canonical URL or adding richer structured-data claims. Existing minimal
JSON-LD remains unchanged. Eleven focused test files pass 100 tests; focused lint, formatting, Web
typecheck, architecture, editorial, 45-page quality, optimized build, fixed asset budgets,
non-restricted configuration boundary, and seven-shape Chromium/Axe/no-JavaScript/mobile/network
checks pass. No route, locale, tradition, analytics provider, deployment, DNS, Search Console
action, actual indexing, or public launch is added or approved. RIT-117 is the sole Ready item.

RIT-117 is Done through D-087. One fail-closed `seo-geo-operations.v1` pipeline consumes only
bounded offline aggregate crawl, index, query, and consented-referral evidence for the exact
current 45-route inventory. It binds the input, public-page inventory, and five-record/ten-source
editorial authority with actual SHA-256 digests; reports source kind, approval, freshness, window,
denominators, route/content/source/rights review state, and explicit included,
other-or-unknown, excluded, and useful-action referral buckets; and writes new private mode-0600
JSON and Markdown only.

Stale, unavailable, and synthetic sources yield null performance values and blocked decision use.
Route query/referral detail is suppressed below 20 observations, 20–199 remains diagnostic, and
performance review prompts require at least 200. Crawl, index, snippet, referral-alignment, and
content-review recommendations are bounded human-review prompts and cannot connect a provider,
publish or rewrite content, request indexing, expand routes, activate a locale, or change
production. Sixteen focused analytics/CLI tests, 30 CI-contract tests, strict analytics typecheck,
focused lint/format, architecture, 137-record policy, dedicated offline operations verification,
analysis-package build/export checks, and the 60-page Web production build pass. The complete
workspace build verifier still reports the separately existing private three-card JavaScript
aggregate above its fixed budget; RIT-117 does not modify or weaken that private client slice.
No analytics provider, tracking runtime, database, user data, deployment, DNS, indexing action,
locale, or public launch is added or approved. RIT-120 remains Planned until every dependency is
complete.

RIT-038 is Done through D-088. One fail-closed `ai-operations.v1` projection consumes only bounded
offline daily aggregates and exposes source kind, approval, freshness, exact window, minimum
sample, model/provider/prompt/schema/safety/content versions, cost and token coverage, estimated
cost, latency, retries, failures, reviewed fallbacks, completion, and safe replacements. Unknown
or private fields, accessors, malformed aggregates, duplicate groups, stale evidence, synthetic
fixtures, unavailable sources, low samples, symlinks, oversized inputs, and existing output paths
fail closed or yield explicit null values rather than invented performance.

Review thresholds create human prompts only and cannot change providers, models, prompts, safety
policy, budgets, admin surfaces, or production. Forty-two focused tests, strict analytics
typecheck, focused lint/format, architecture, CI contract, 139-record policy, dedicated offline
verification, and analytics package build/export checks pass. No production reader, provider
call, raw trace, private prose, database change, admin route, deployment, or budget enforcement
is added. Monetary limits remain blocked by OWN-005. RIT-120 remains Planned behind the payment
chain that now begins with Ready task RIT-063; production payment activation remains blocked by
OWN-002.

RIT-016 is Done through D-089. An isolated, loopback-only protected staging environment used
PostgreSQL 17, production Web builds, random Basic authentication, private/no-store responses, and
disallow-all robots. Registry v2 completed forward, database-unavailable, v1 rollback, and v2
roll-forward probes; registry v3 then completed forward, v2 rollback, and v3 roll-forward probes.
No public hosting project, production environment, DNS, indexing action, customer data, or public
launch was used.

Registry v3 removes `experience.public_shell`, its server adapter, delivery branches, and obsolete
synthetic publication matrices. Web delivery now follows the completed rollout directly while SEO
inventory freshness independently controls crawl publication. PostgreSQL retains immutable v1/v2
history for audit and rollback, permits legacy versions to append only `off`, rejects the removed
key in v3, and allows only exact current v3 keys with their existing owner gates and scopes.

Two hundred five focused registry, composition, Web, and migration tests, strict Config and Web
typechecks, focused lint/format, migration policy, three production staging builds, the
31-migration PostgreSQL foundation with repeat migration/seed/reset/restore, the non-restricted
configuration boundary, architecture policy across 516 source files, record policy across 141
durable records, and all diff whitespace checks pass. The full workspace matrix is intentionally
not rerun. RIT-004 and OWN-008 are Done through D-090.

RIT-008 is Done. The canonical four-environment contract distinguishes implemented local
controls, the verified loopback staging rehearsal, and controls required before any preview,
standing staging, or production use. It requires isolated data stores, caches, object storage,
keys, providers, analytics, and email authority; forbids downward production secrets or private
production content; locks non-production indexing off; and binds promotion to exact revision,
immutable build/source evidence, required CI, environment-specific configuration, smoke/security
evidence, rollback readiness, and owner approval.

The focused contract verifier covers ten control sections and ten repository references. Seven
focused Vitest files pass 91 environment, CI, configuration, SEO, inventory, and secret-boundary
tests; formatting, lint, typecheck, architecture, CI-contract, and secret-scan gates pass. No
hosting project, cloud service, production secret, customer data, deployment, DNS, indexing,
provider activation, migration, or public product launch was added. RIT-123 subsequently completed
the repository-level backup and restore rehearsal.

RIT-123 is Done. One fail-closed `rituvia.backup-recovery.v1` rehearsal now creates a PostgreSQL
custom-format logical backup from an exact synthetic local or GitHub Actions source, restores it
into a distinct invocation-owned empty database, reapplies the local runtime grants or restores
the exact CI ACL, deploys migrations idempotently, and compares migration, table, row, ownership,
row-security, constraint, index, policy, privilege, role, and synthetic-sentinel state. The
runtime role can read the restored sentinel but cannot create or delete data.

The temporary artifact is generated only under an ignored mode-0700 repository directory, must
be a regular non-symlink mode-0600 custom-format file, and is rehashed immediately before restore.
Source, target, and artifact cleanup are mandatory even on failure. The ignored mode-0600 evidence
contains only bounded hashes, counts, versions, timings, and checks. Six focused backup, artifact,
cleanup, snapshot, and evidence tests join the existing database-safety and CI-contract coverage;
59 focused tests, database typecheck, CI/environment/migration contracts, and the complete local
31-migration isolated restore rehearsal pass. Protected hosted run `30507901986` passes Quality,
PostgreSQL integration, and Security scans, including the same rehearsal after database foundation
verification against the digest-pinned PostgreSQL 17 service.

This proves repository-level synthetic logical recovery only. It does not claim provider-managed
physical backup, encrypted isolated retention, WAL/PITR, production RPO/RTO, customer-data
recovery, or production restore authority. Those remain Gate H owner-approved production work.
No production service, credential, data, backup, retention rule, migration, deployment, DNS, or
public launch changed.

D-091 and OWN-017 approve Stripe Test Mode as the first fiat sandbox integration for RIT-063:
one-time USD checkout only, synthetic US policy only, server-authoritative catalog prices, hosted
Stripe pages, exact provider idempotency, no redirect-based fulfillment, and no live mode. The
owner's instruction to approve OWN-002 cannot substitute for the provider-written primary and
backup production underwriting evidence required by that existing gate, so OWN-002 remains
Blocked for RIT-140 while the narrower sandbox approval is recorded separately.

RIT-063 now exposes an authenticated, same-origin, CSRF-protected
`POST /api/v1/checkout/stripe` boundary with the canonical product/path request and
`orderId`/`checkoutUrl`/`expiresAt` response. The service accepts only non-production Stripe Test
Mode configuration, resolves active one-time `pack_6`, `pack_15`, or `pack_40` prices from the
immutable v1 catalog, evaluates the synthetic US/USD/card/Stripe Country Policy, requires exact
refund and terms versions, and never accepts client money or fulfillment authority.

The v2 persistence creates one server-owned order/item/attempt before provider invocation, derives
provider idempotency from the public order and attempt number, recovers concurrent exact replay,
rejects same-key changed requests, atomically attaches only one HTTPS Stripe checkout, and leaves
all orders at `created` or `checkout_created`. Twelve-way PostgreSQL concurrency, changed-request,
duplicate attachment, least-privilege, no-paid-state, no-Credit, and no-entitlement evidence pass.
Forty-one focused configuration, adapter, service, and route tests; affected package typechecks and
builds; configuration, architecture, environment, record, generated-evidence, and secret gates
pass. The canonical Web build includes `/api/v1/checkout/stripe`.

No Stripe credential, Price ID, provider account, external payment call, production policy,
deployment, DNS, or public product launch was added. Real Stripe Test Mode network proof remains
truthfully blocked until test credentials and exact test Price IDs are supplied through the secure
configuration path.

RIT-065 is Done through D-092. The webhook role no longer owns outbox delivery mutation; the
independent `rituvia_payment_fulfillment` role leases ordered versions, rereads current order
authority under serializable transactions, and can append only bounded grant/restriction/reversal
evidence plus update exact projection/fulfillment/outbox columns. Its startup attestation also
rejects any payment-event or journal read authority and any ledger mutation authority. Composite
owner/source foreign keys prevent new cross-account fulfillment and allocation; any pre-existing
unbound allocation fails fulfillment closed pending a separately approved audited backfill.
Disputes move only unspent purchased Credits into a
nonspendable held bucket; refunds convert active holds and reverse remaining available source
value; reserved or consumed source value becomes `review_required`.

The private `/api/v1/credits` restoration route returns only the authenticated owner's spendable
projection with private/no-store headers. Privacy export includes v2 order, Credit, restriction,
fulfillment, and entitlement evidence. Focused 51-test domain/configuration/worker/Web coverage,
the 34-migration webhook and fulfillment PostgreSQL gates, privacy-export PostgreSQL gate, affected
typechecks, and migration policy pass. The fulfillment gate now explicitly proves current-order
convergence, active-reservation and consumed shortfall, and cross-account allocation rejection.
It also proves startup denial after synthetic ledger-update or payment-event-read privilege drift.
No Live Mode, refund initiation, provider dispute/refund route activation, subscription,
reconciliation, production migration, deployment, DNS, or launch was added.

RIT-066 is Done. `/en/plans` now renders only active server-catalogue one-time US/USD Credit packs
with exact contents, calm price and refund disclosures, verified-account/18+ gating, and stable
per-pack retry idempotency. The existing Stripe Test Mode service remains the only checkout
authority; the client accepts only the reviewed hosted Stripe URL and never supplies money,
eligibility or fulfillment facts. The private checkout-return API reads only the authenticated
owner's order and matching current fulfillment version, so `paid` remains pending until active
fulfillment and missing/cross-account orders remain indistinguishable.

The focused 191-test Web subset, both affected package typechecks, the 34-migration commercial
checkout and fulfillment database gates, the affected Web production build, and desktop/375px
Chromium review pass. The focused mobile Axe run has zero violations, no horizontal overflow, and
no unexpected console errors. The local passwordless start remained safely unavailable in the
production-build browser environment, so no external Stripe Test Mode checkout was created; the
return path, failure state, route contracts, CSRF, idempotency and URL boundaries remain covered by
focused automated evidence.

RIT-067 is Done. The existing worker now performs one bounded, circular and observation-idempotent
daily Stripe Test scan for the configured account and compares provider Checkout/payment/settlement
evidence with the internal order, attempt, purchased-Credit grant and current fulfillment version.
Amount, currency, order, Checkout, PaymentIntent, state, missing/duplicate Credit issuance,
fulfillment drift, provider API failure and missing provider settlement-availability evidence
create digest-only append-only operations cases; no raw Stripe response or private user content is
stored.

The only automatic recovery is a missed successful webhook whose Test account, public order,
Checkout, PaymentIntent, amount and currency all match exactly. The operations case commits first,
then the existing payment-event reducer advances the order and writes the normal fulfillment
outbox; mismatches never change orders, Credits, entitlements or projections. A dedicated
least-privilege database role fails closed on privilege drift. The 97 focused
configuration/architecture/payments/worker/Web tests and the webhook, fulfillment and
reconciliation PostgreSQL gates pass against all 35 migrations. The database evidence includes a
concurrent signed-webhook/reconciliation race, one outbox and Credit grant, 12-way duplicate run
contention, observation-sensitive same-day cases and complete coverage of 101 candidates across
two circular 100-row windows. Affected package typechecks and worker/Web builds pass.

The requested footprint optimization disables unused production server source maps while keeping
browser source maps disabled. A clean Web build falls from 46 MB to 20 MB, its static browser
chunks remain 1.2 MB uncompressed in total, and the reviewed `/en/plans` route requires about
66 KB gzip JavaScript plus 12,249 bytes gzip CSS. No UI framework, service or runtime dependency
was added for this optimization.

RIT-068 is Done through D-093. The authenticated same-origin route accepts only an order identifier
and exact client idempotency; amount, reason, provider object, policy and Credit quantity remain
server-owned. Eligibility is limited to the exact synthetic US/USD Stripe Test one-time Credit
pack under `local.refund.v1`, and every source Credit must remain active, available, unreserved,
unheld and unreversed.

Before Stripe invocation, one serializable transaction creates the owner-scoped request and
source-linked hold and moves the pack from purchased availability into the nonspendable held
bucket. Stripe uses a deterministic provider idempotency key. Definitive rejection releases the
hold; ambiguous failure keeps the durable request and exact replay authority. API acceptance is
only `submitted`. The existing matched refund-event/outbox path records `confirmed`, links the
payment event, converts the hold and appends one source-linked reversal. Duplicate success events
cannot regress `refund_requested` to `paid`, and webhook-before-response order converges safely.

The focused 74-test payments/Web slice and refund, fulfillment, webhook and privacy-export
PostgreSQL gates pass against all 36 migrations. The refund gate proves twelve-way request
contention, changed-provider conflict, rejection release, signed confirmation, webhook-first
convergence, refund-versus-reservation serialization, composite owner constraints, append-only
evidence and least privilege. Affected typechecks and migration policy pass. No dependency,
microservice or runtime queue was added, and no Stripe Live call, production migration,
deployment, DNS change, legal-policy activation or launch occurred.

RIT-069 is Done at checkpoint revision `f1633b6`. The Stripe Test Mode adapter now accepts the
already-supported signed `charge.dispute.created` event and binds the retrieved Charge,
PaymentIntent and exact Checkout Session before normalization. Unpaid Checkout completion remains
pending, asynchronous failure remains failed, and expiry remains expired; none grants value.
Provider signature failures are normalized to one private invalid-webhook response.

The database gate now delivers the same verified success event concurrently twenty times, records
one transition and nineteen duplicates, and rejects a partial refund amount without changing the
paid order or creating fulfillment work. Existing refund-first/success-second replay, full refund,
dispute hold, consumed/reserved shortfall, exactly-once grant, reconciliation, owner return-status,
and forged redirect-query controls remain intact.

The focused payment matrix passes 18 files and nine PostgreSQL gates against all 36 migrations.
After final fixture additions, the affected four files pass 32 tests. The milestone workspace run
passes 2,241 unit tests with five skips, all 96 fixed AI eval cases, configuration and database
foundation gates, formatting, linting, all 16 package typechecks, and the production build with an
explicit local canonical origin. No Stripe network request, Live key, production payment,
deployment, DNS change, legal-policy activation or public launch occurred.

RIT-070 is complete. A local subscription root is reserved before any Stripe Test recurring
Checkout is created, so concurrent open subscriptions fail before an external session exists and
same-order retries recover safely. Signed subscription events enter through the exact webhook role,
whose runtime attestation rejects schema creation, subscription mutation, Credit access, entitlement
access, or privileged-role drift. Amount, currency, product, interval, order, account, invoice, and
subscription facts must match the immutable local snapshot before an event is queued.

The fulfillment worker reduces verified lifecycle events, maintains Plus access, and grants exactly
8 subscription Credits per available month. Annual plans create twelve monthly allocations but
release only the current one. Duplicate invoices/events/grants remain no-ops. Cancellation revokes
future subscription allocations without touching purchased Credits. Full refunds are limited to
the exact provider invoice; unconsumed linked Credits reverse without a negative projection, while
restricted or conflicting cases create durable review records and the exact poison event is
quarantined without blocking the queue. Subscription Checkout completion is signature-verified and
acknowledged without granting value. Full subscription dispute workflow remains explicitly assigned
to RIT-074.

The focused six-file unit slice passes 59 tests. Payments, DB, Web, and Worker typechecks; DB,
Payments, and Worker builds; formatting; lint; architecture; secret; migration; and diff checks pass.
The isolated PostgreSQL gate applies all 38 migrations and proves role denial, 20-way event/grant
idempotency, amount mismatch rejection, monthly/annual allocation, purchased-Credit preservation,
invoice-scoped refund reversal across two paid periods, and nonnegative projection. No Stripe Live
request, production recurring activation, deployment, DNS, or legal-policy activation occurred.

RIT-073 is complete through D-094. The safe-off commerce administration kernel exposes one bounded,
owner-only order timeline through reviewed security-barrier views. It requires recent account
authentication, a recent same-session passkey assertion, reason and ticket references, and typed
confirmation for reconciliation or refund commands. Raw commerce tables and private journals remain
unreadable by the admin service role.

Administrative commands are persisted before provider execution and use one durable operation
identifier for executor idempotency. Requested, execution-started, succeeded, and failed evidence
is append-only and digest-bound to operation, attempt, result, and database time. Exact retries
converge across concurrent calls and policy-version changes, while changed order, amount, or
currency fails closed. Reconciliation, refund, inspection, lease, and retry limits are
explicit and lock-serialized. Every authenticated denial remains in the immutable audit chain; the
kernel has no HTTP entrypoint, and a future route must add reviewed request-rate enforcement without
dropping audit evidence.

The focused security unit test, both affected package typechecks, DB build, architecture and
migration policy pass. The isolated PostgreSQL gate applies all 39 migrations and proves immutable
historical states, owner/passkey authorization, bounded access, concurrent idempotency, retry after
synthetic provider failure, policy-version replay, audit and operation-event verification,
automatic privilege-drift shutdown, raw-table denial, and append-only storage. The shared admin
security PostgreSQL gate also passes. No admin HTTP route, production passkey issuer, Stripe Live
executor, production migration, deployment, DNS change, legal-policy activation, or launch was
added.

## Update rules

Codex must update this file whenever release stage, blockers, completed capabilities, environments, or quality state changes. Do not turn it into a changelog; keep only the current truth and link historical decisions to `DECISIONS.md`.
