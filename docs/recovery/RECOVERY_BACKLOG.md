# Founder Acceptance Recovery Backlog

> Status: **ACTIVE GOVERNANCE QUEUE**
>
> Repository status is NO-GO. Items 1 and 2 are complete through the approved Phase 0 archive and
> this Prompt B governance activation. Item 3 and every later item require a new explicit Owner
> approval. One Codex run may execute exactly one approved item and must then STOP.

## Operating rules

- Sequence is mandatory; no legacy `BACKLOG.md` Ready state can start recovery work.
- Before-state reproduction is always first and must be attached before edits.
- Items 3–12 update the same protected staging and provide a clickable Owner URL plus exact desktop
  and mobile test steps.
- Protected staging is allowlisted, noindex, isolated, reversible, source-SHA-visible, safe-off for
  production Providers, and prohibited from real funds.
- AGPL-3.0-only remains unchanged; commercial-license selection is outside this backlog.
- A STOP condition ends the run. Do not repair unrelated findings or start the next item.

## Item 1 — Immutable archive and baseline manifest

- **Status:** Complete — Owner-approved Phase 0 archive and active baseline manifest.
- **Founder Journey IDs:** FJ-00; provenance support for FJ-01–FJ-20.
- **Exact user-visible outcome:** Owner can identify and independently restore the original HEAD,
  243-file staged snapshot, archival commit, bundle, patches, checksums, and recovery baseline.
- **First before-state reproduction:** Recompute original ref/index/patch identities and prove the
  source worktree still has 243 staged files with no unstaged/untracked loss.
- **One objective acceptance test:** A fresh bundle restore has commit `582f76f9...`, tree
  `d0d0bc53...`, clean status, and parent-diff SHA-256 `987bad7b...`.
- **Required automated checks:** `git bundle verify`; SHA-256 validation; ref/tree/parent checks;
  original index/status invariance.
- **Desktop/mobile browser acceptance:** Owner can read and copy the rendered manifest on desktop
  and mobile without clipped SHAs or tables.
- **Staging acceptance:** Not applicable before Item 3; record `staging: not created`.
- **Explicit exclusions:** No original-worktree checkout/reset, history rewrite, product code,
  merge, deployment, or implementation.
- **STOP condition:** Any checksum mismatch, missing ref, dirty restore, or original-index change.

## Item 2 — Scope authority and recovery override

- **Status:** Complete — explicit Owner approval and active recovery override.
- **Founder Journey IDs:** FJ-00; governance boundary for FJ-01–FJ-20.
- **Exact user-visible outcome:** Owner sees one active recovery authority, f79 baseline, preserved
  D-097 gates, and exactly one later item selectable only by explicit instruction.
- **First before-state reproduction:** Show the legacy Ready queue, missing recovery files on f79,
  and draft-only archival-snapshot governance branch.
- **One objective acceptance test:** The active recovery branch descends directly from f79, adds
  exactly four governance files, freezes legacy auto-dispatch, and leaves Item 3 unstarted.
- **Required automated checks:** file-count/field-count checks; Markdown/diff checks; branch ancestry;
  archive/index invariance; license-diff check.
- **Desktop/mobile browser acceptance:** Owner can read the override, FAR specification, manifest,
  and backlog without ambiguous authorization language.
- **Staging acceptance:** Not applicable; no staging environment is created or changed.
- **Explicit exclusions:** No product implementation, Node upgrade, Provider setup, deployment,
  DNS, real funds, unrestricted AI, or automatic Item 3 start.
- **STOP condition:** Baseline ancestry mismatch, more than four changed files, missing Owner gate,
  archive mutation, or any product/license diff.

## Item 3 — Protected staging foundation

- **Status:** Complete — the Owner-approved Vercel Pro custom environment is standing at the
  protected URL recorded in `ITEM_3_PROTECTED_STAGING_EVIDENCE.md`. The accepted deployment is
  `READY`, `target=null`, OIDC/custom-environment `staging`, `live=false`, and has zero project
  domains; automatic Git deployment is disabled.
- **Founder Journey IDs:** FJ-00.
- **Exact user-visible outcome:** Owner receives one clickable allowlisted noindex staging URL that
  identifies environment/source SHA and initially exposes only a safe acceptance shell.
- **First before-state reproduction:** Prove no approved staging currently satisfies allowlist,
  noindex, source identity, isolation, restore, and rollback.
- **One objective acceptance test:** An unallowlisted client is denied; an allowlisted Owner opens
  the URL, sees the exact SHA, and indexing headers fail closed.
- **Required automated checks:** access control; noindex headers; secret scan; isolated DB/storage;
  health/readiness; backup/restore smoke; rollback drill; private-log redaction.
- **Desktop/mobile browser acceptance:** Verify deny/allow flows, keyboard/focus, responsive shell,
  offline/degraded state, and source identity on desktop and mobile.
- **Staging acceptance:** Create the single protected staging, attach URL and Owner steps, and prove
  production Providers, real payments, public indexing, and production data are off.
- **Explicit exclusions:** No product journeys, production DNS, real funds, production Provider,
  unrestricted AI, public release, or customer migration.
- **STOP condition:** Access bypass, indexing exposure, production secret/data reuse, absent Owner
  URL, failed restore/rollback, or a hosting platform that cannot create the environment without
  crossing the Production gate. None occurred in the accepted deployment. Stop after Item 3;
  Item 4 requires a separate explicit Owner approval.

## Item 4 — Real non-mocked E2E and runtime truth

- **Status:** Ready — Item 3 dependency is complete; explicit Owner approval is still required.
- **Founder Journey IDs:** FJ-00, FJ-01, FJ-06.
- **Exact user-visible outcome:** Owner can distinguish real backend behavior from mocked browser
  tests and inspect exact request/status runtime evidence.
- **First before-state reproduction:** Reproduce the mocked `/api/v1/**` browser pass and real
  ritual-completion 404 as separate evidence.
- **One objective acceptance test:** A staging browser test with zero API fulfillment mocks records
  exact statuses and fails if a core request is intercepted.
- **Required automated checks:** mock-detection guard; transport/schema tests; real Postgres E2E;
  migration/seed/restore; production build; request/status artifacts; trace linkage.
- **Desktop/mobile browser acceptance:** Run the same real core-loop attempt on desktop and mobile;
  errors must be accessible, recoverable, and evidence-bound.
- **Staging acceptance:** Update the Item 3 URL and attach direct Owner steps; local-only evidence
  cannot close the item.
- **Explicit exclusions:** Do not fix the core loop, add features, activate Providers, or replace
  failures with mocks.
- **STOP condition:** Any hidden mock, staging/local divergence, unavailable database evidence, or
  untraceable request.

## Item 5 — Core reflection loop

- **Status:** Planned; depends on Item 4.
- **Founder Journey IDs:** FJ-01, FJ-06.
- **Exact user-visible outcome:** An adult anonymously completes intake → one-card reading →
  intention → small action → free ritual → private reflection → revisit without payment.
- **First before-state reproduction:** Reproduce the first real broken staging step from Item 4,
  including request/status and visible error.
- **One objective acceptance test:** One non-mocked staging journey persists every step and reloads
  the private reflection/revisit under the same anonymous owner.
- **Required automated checks:** focused domain/API/DB tests; idempotency/races; privacy/log scans;
  core-loop E2E; non-empty restore; accessibility and offline/retry tests.
- **Desktop/mobile browser acceptance:** Complete the loop with keyboard/touch, loading, error,
  retry, offline, reduced-motion, and mobile touch-target evidence.
- **Staging acceptance:** Update the same URL with exact Owner steps and prove no account, payment,
  production AI, or private-text analytics dependency.
- **Explicit exclusions:** No Tarot expansion, paid ritual, identity requirement, Provider AI,
  SEO/GEO, additional locale, or production activation.
- **STOP condition:** Any happy-path 4xx/5xx, private prose leak, paid gate, accessibility failure,
  or restore failure.

## Item 6 — Golden shell and en/zh-Hans

- **Status:** Planned; depends on Item 5.
- **Founder Journey IDs:** FJ-00, FJ-01, FJ-06.
- **Exact user-visible outcome:** Approved golden shell and reviewed English/Simplified Chinese copy
  render consistently with an explicit locale switch.
- **First before-state reproduction:** Compare staging desktop/mobile screenshots and strings to the
  locked golden baselines and list every divergence.
- **One objective acceptance test:** Approved screenshot/copy comparison passes for defined routes,
  viewports, themes, and `en`/`zh-Hans`, with zero hardcoded production copy.
- **Required automated checks:** visual regression without baseline mutation; i18n extraction;
  missing-key/plural/format checks; accessibility; writing-system readiness; bundle budgets.
- **Desktop/mobile browser acceptance:** Verify navigation, focus, typography, expansion, touch,
  safe-area, loading/error/offline, and locale persistence in both languages.
- **Staging acceptance:** Update the same protected URL and provide direct bilingual test steps;
  source SHA and noindex remain proven.
- **Explicit exclusions:** No other locale, golden-baseline update, SEO/GEO expansion, unreviewed
  machine translation, or policy-copy change.
- **STOP condition:** Unapproved golden mismatch, unreviewed translation, locale leakage,
  accessibility regression, or missing mobile evidence.

## Item 7 — Tarot

- **Status:** Planned; depends on Item 6.
- **Founder Journey IDs:** FJ-01, FJ-02, FJ-06.
- **Exact user-visible outcome:** One-card and three-card Tarot produce server-fixed transparent
  non-deterministic draws, bounded interpretations, and safe core-loop handoff.
- **First before-state reproduction:** Run both spreads and capture the first draw-integrity,
  refresh/replay, content-source, safety-copy, or handoff divergence.
- **One objective acceptance test:** Fixed-seed/property evidence plus staging browser proves card
  count/position/orientation integrity, refresh stability, and idempotent new draws.
- **Required automated checks:** draw invariants; content checksums; API/DB ownership/idempotency;
  safety evals; non-mocked E2E; accessibility; restore and privacy scans.
- **Desktop/mobile browser acceptance:** Complete both spreads by keyboard and touch, refresh safely,
  read disclosures, and continue to intention.
- **Staging acceptance:** Update the same URL with direct FJ-01/FJ-02 steps and expected invariants,
  never a predicted card outcome.
- **Explicit exclusions:** No prediction claim, paid efficacy, general-model cultural authority,
  Provider AI, new deck/tradition, private-content sharing, or production release.
- **STOP condition:** Client-invented draw, changed refresh result, unsafe claim, source ambiguity,
  privacy leak, or failed handoff.

## Item 8 — Numerology and Astrology

- **Status:** Planned; depends on Item 7.
- **Founder Journey IDs:** FJ-03, FJ-04, FJ-05, FJ-06.
- **Exact user-visible outcome:** Numerology and exact/uncertain-time astrology show transparent
  deterministic inputs, calculations, source limits, and uncertainty.
- **First before-state reproduction:** Execute fixed vectors and both astrology precision paths;
  record the first calculation, source, uncertainty, or UX divergence.
- **One objective acceptance test:** Fixed vectors/property tests match displayed staging values,
  and unknown birth time never presents time-dependent houses/angles as exact.
- **Required automated checks:** vectors/property tests; timezone/date boundaries; engine parity;
  source/license disclosure; birth-data encryption; safety evals; E2E; restore/deletion.
- **Desktop/mobile browser acceptance:** Enter exact and approximate inputs, correct errors, read
  charts/tables, and verify uncertainty/privacy controls on desktop and mobile.
- **Staging acceptance:** Update the same URL with synthetic birth data, FJ-03/FJ-04/FJ-05 steps,
  source SHA, and current license disclosure.
- **Explicit exclusions:** No medical/fertility/death/legal/financial claims, biometric reading,
  new tradition, public indexing expansion, production activation, or license conclusion.
- **STOP condition:** Vector mismatch, hidden time assumption, birth-data leak, missing source/license
  disclosure, or inaccessible mobile chart.

## Item 9 — Identity, wallet and privacy

- **Status:** Planned; depends on Item 8.
- **Founder Journey IDs:** FJ-07, FJ-08, FJ-09, FJ-18, FJ-19.
- **Exact user-visible outcome:** Owner can test email-sandbox and wallet sign-in, account merge,
  sessions, consent, history, export, and deletion without custody.
- **First before-state reproduction:** Exercise anonymous-to-account transfer, wallet signature,
  export, deletion, and multi-session revocation; capture the first ownership/privacy failure.
- **One objective acceptance test:** Cross-principal reads fail; export contains only owned data;
  deletion revokes sessions and hides deleted private records per policy.
- **Required automated checks:** auth/session/CSRF/replay; wallet nonce/domain/chain binding;
  ownership/RLS; encryption; export/deletion/restore; threat model; privacy scans; E2E/accessibility.
- **Desktop/mobile browser acceptance:** Sign in/out, merge, manage sessions/consent, export, and
  request deletion with accessible confirmation/error/retry states.
- **Staging acceptance:** Update the same URL using sandbox identities/wallets; no production email,
  custody, production keys, or production data.
- **Explicit exclusions:** No stored-value wallet, token/NFT, cash-out, biometric auth, minors' paid
  flow, production identity Provider, or irreversible production deletion.
- **STOP condition:** Cross-user access, replayable signature, secret/private-data leak, deletion
  ambiguity, audit loss, or custody behavior.

## Item 10 — Credits, Stripe Test and Plus

- **Status:** Planned; depends on Item 9.
- **Founder Journey IDs:** FJ-10, FJ-11, FJ-12, FJ-13, FJ-14, FJ-20.
- **Exact user-visible outcome:** In staging only, Owner can test an approved Test SKU, verified
  fulfillment, bounded Credits/entitlements, Plus lifecycle, and refund/dispute audit.
- **First before-state reproduction:** Run checkout, return-before-webhook, duplicate/out-of-order
  webhook, consumption, cancellation, refund, and dispute paths; record first ledger mismatch.
- **One objective acceptance test:** A signed Stripe Test event grants exactly once; return alone
  grants nothing; duplicate/out-of-order events preserve ledger invariants.
- **Required automated checks:** signature/idempotency/replay; ledger conservation/concurrency;
  entitlement/subscription/refund/dispute/reconciliation; fixtures; Stripe Test E2E; restore/audit.
- **Desktop/mobile browser acceptance:** Complete Test checkout/return, see pending then fulfilled
  state, Credits/Plus state, cancellation/refund status, and accessible errors.
- **Staging acceptance:** Update the same URL with Stripe Test only, exact test steps, safe-off live
  credentials, reconciliation evidence, and rollback.
- **Explicit exclusions:** No live Stripe, real funds, final pricing/tax/refund/legal policy,
  required-preload production decision, merchant-category claim, payout, or production activation.
- **STOP condition:** Value before verified webhook, double grant/charge, ledger imbalance, live key,
  real transaction, unaudited dispute, or mobile checkout blocker.

## Item 11 — USDC/Base sandbox and Provider AI

- **Status:** Planned; depends on Item 10.
- **Founder Journey IDs:** FJ-15, FJ-16, FJ-17.
- **Exact user-visible outcome:** Owner can test hosted non-custodial USDC/Base sandbox checkout and
  bounded Provider AI with disclosure, safety, fallback, and rollback.
- **First before-state reproduction:** Run sandbox success/cancel/expiry/network mismatch and AI
  success/timeout/malformed/unsafe/quota cases; capture first custody/value/safety gap.
- **One objective acceptance test:** No sandbox or AI failure grants/consumes value incorrectly; no
  raw private prompt is logged; deterministic facts remain server-calculated.
- **Required automated checks:** checkout origin/return/webhook verification; chain/asset allowlist;
  no-custody assertions; structured AI schema; prompt version; safety evals; cost caps; rollback;
  privacy scans; non-mocked sandbox E2E.
- **Desktop/mobile browser acceptance:** Complete/cancel hosted sandbox flow and trigger AI
  success/failure/fallback with disclosure and accessible recovery.
- **Staging acceptance:** Update the same URL using only Owner-approved sandbox credentials and
  synthetic content; production endpoints/keys and real assets remain impossible.
- **Explicit exclusions:** No real USDC, custody, user keys, crypto balance, production AI with
  private content, production model change, or unrestricted generation.
- **STOP condition:** Real-value path, custody/key handling, AI-invented deterministic fact, unsafe
  output, prompt leak, unbounded cost, or incorrect value rollback.

## Item 12 — Full Founder Acceptance, security, restore and source-disclosure gate

- **Status:** Planned; depends on Items 3–11.
- **Founder Journey IDs:** FJ-00–FJ-20.
- **Exact user-visible outcome:** Owner executes one source-disclosed desktop/mobile acceptance
  manual on protected staging and receives a factual GO/NO-GO recommendation.
- **First before-state reproduction:** Run the full matrix and list every unresolved defect,
  waiver, source/license gap, security finding, restore gap, and staging/commit mismatch.
- **One objective acceptance test:** All mandatory journeys pass or have explicit Owner-approved
  exclusions; zero Critical/High finding; restore/rollback objectives pass; disclosures match SHA.
- **Required automated checks:** complete workspace matrix; real E2E; desktop/mobile/accessibility;
  security/dependency/secret/license scans; payment/AI evals; migrations; backup/non-empty restore;
  disaster recovery; observability; privacy export/deletion; rollback.
- **Desktop/mobile browser acceptance:** Owner follows exact steps across all in-scope journeys,
  viewports, keyboard/touch, and offline/degraded/error/retry states.
- **Staging acceptance:** Final update to the same protected URL with immutable evidence manifest,
  SHA, checksums, test accounts/data, rollback point, disclosures, and sign-off field.
- **Explicit exclusions:** No production deployment, DNS, public indexing, real funds, live Stripe,
  real crypto, production AI/private content, legal activation, unrestricted public service, or
  irreversible migration.
- **STOP condition:** Any mandatory journey failure, Critical/High finding, restore/rollback failure,
  source/license mismatch, unresolved Owner gate, or staging drift. On PASS, still stop for a
  separate production-candidate decision.
