# Recovery Item 7 — Tarot Evidence

> Date: 2026-08-06
>
> Status: **COMPLETE — PROTECTED STAGING READY FOR OWNER REVIEW**

## Scope and authority

The Owner explicitly approved Recovery Item 7 after Item 6 closed. This run activates only the
reviewed English one-card and three-card Tarot slices in the existing protected custom Staging.
The server fixes the draw before reveal, records exact spread/card/orientation facts, restores the
same reading after refresh, and hands only the reading identifier to the accepted Sanctuary
intention flow.

This item does not activate Provider AI, share private content, add a deck or tradition, translate
Tarot into `zh-Hans`, enable accounts or payment, expand public Tarot/SEO routes, change DNS, use
real funds, deploy production, or start Recovery Item 8.

## First before-state reproduction

Before Item 7 edits, committed source `c82a01b65980e6e7fd366209f456e5e89274759e`
served `/en/tarot/one-card` but denied `/en/tarot/three-card`. The protected local runtime returned:

- `/api/recovery/health`: `200`.
- `/en/tarot/one-card`: `200`.
- `/en/tarot/three-card`: `404`.

The exact before-state artifacts remain outside Git:

| Artifact                              | SHA-256                                                            |
| ------------------------------------- | ------------------------------------------------------------------ |
| `item7-before-health.headers`         | `7b39c973a6c86594044a4115748d8828eb9d8a02fe317bf9d44c6f54ebca52e1` |
| `item7-before-one-card.headers`       | `b3a02b853838a16888c8e4eca560b9dd1f928072310102471ca103a916ded627` |
| `item7-before-three-card.headers`     | `d4f49175f5c8504ac7122021e95d94e58e22efc57e065a10364c51be201d5950` |
| `item7-before-health.body`            | `dcb5f58598a01d9496d2471e29f99e807b7c0426983a9946b601e9102aef1c9a` |
| `item7-before-one-card.body`          | `3cca5b31a9e015330856325e55c16d15ff83819923f2fe65fb92a57d0cc100ff` |
| `item7-before-three-card.body`        | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |

The initial focused Tarot suite exposed one stale test that still expected the protected Staging
service boundary to fail closed after Item 5 had explicitly enabled that service. The test was
reconciled to keep Preview and Production fail-closed while allowing only the protected custom
Staging environment. No discovered product defect was hidden or repaired outside Item 7.

## Implemented protected slice

- `/en/tarot/one-card` and `/en/tarot/three-card` are allowlisted only in protected Staging.
- One-card uses the `Perspective` position. Three-card preserves exact ordered
  `Situation`/`Action`/`Possibility` positions.
- Draw facts are server-selected without replacement and include exact catalog, deck, spread,
  rules, algorithm, position, order, card, and orientation versions.
- Refresh reads the exact persisted response; a new reflection creates a separate server draw.
- Reviewed catalog prose states what the symbolic result cannot determine and offers a reversible
  reflection question and small action without prediction or instruction.
- Provider AI and enhanced interpretation UI/API remain disabled. One-card private sharing is
  hidden in Staging.
- The Sanctuary handoff stores only the UUID reading identifier in tab-scoped `sessionStorage`.
- The categorical report surface remains available without a free-text field. D-035 established
  this exact owner-scoped safety-reporting boundary; retaining it is narrower and safer than
  removing the report path or accepting private prose.
- `/en/methodology` is available. Account, payment, public Tarot hub/library, `zh-Hans` Tarot,
  sitemap, and Provider interpretation routes remain denied.

## Content authority and integrity

The active English Major Arcana catalog remains the reviewed owner-approved source referenced by
D-081 and `owner-directive:2026-07-18-major-arcana`. No general model memory supplies card facts or
cultural authority.

| Projection                         | SHA-256                                                            |
| ---------------------------------- | ------------------------------------------------------------------ |
| Raw catalog file                   | `412c8605631c0f8953b3b5864ac7428507c157a13a0f981c02684615ea6e39db` |
| Runtime normalized catalog         | `06666a86d228c64d620f98c6c2b65925e788fb474e0c73fa55255af16e013c51` |
| Public reviewed projection         | `15a1d9d5f5502ddf8c14543da06bc85813dc0b67cd7dae1cf9a0044ba72b8595` |

The catalog identity is `rituvia.major-arcana-catalog@1.0.0`; the deck identity is
`rituvia.major-arcana-deck@1.0.0`. Item 7 did not change the approved catalog or golden screenshots.

## Source and deployment identity

- Recovery baseline: `f79fee6713670fdc12b33dd3182569a942782636`.
- Item 7 implementation commit: `23ab9b97e34c4240d0e23ea4d782a37ef4a157c5`.
- Accepted deployment: `dpl_9W3Lc17ZGcQZMtAaremRTzJvutiu`.
- Unique protected URL:
  `https://rituvia-founder-acceptance-recovery-m3d6ddpq8.vercel.app/recovery`.
- Stable protected Owner URL:
  `https://rituvia-founder-acceptance-recovery-cptm-111-s-projects.vercel.app/recovery`.
- Vercel project: `prj_UzHHiLzjdPcf8DsJuCHYiDBVWs63`.
- Vercel team: `team_f6TQU7mloG5OnQGNmtXwFkOi`.
- Vercel reports `READY`, target/custom environment/OIDC `staging`, source `cli`, exact Git commit
  ref/SHA metadata, one `iad1` region, `live=null`, no project domains, and one Vercel-managed
  custom-Staging alias.
- Unauthenticated `/recovery` returned `302` to Vercel authentication. A temporary 23-hour Vercel
  share credential was used only for automated acceptance and did not disable login protection.
- `apps/web/vercel.json` remains `deploymentEnabled=false`; no automatic Git deployment was
  enabled.

Two earlier READY deployments remain as audit evidence but are not accepted Item 7 endpoints:

- `dpl_2gPqtkZixifa2cdhBcJQnRR3MNz5` had exact Git metadata but inherited the prior
  `RITUVIA_BUILD_SOURCE_SHA`; runtime truth correctly exposed the mismatch.
- `dpl_AJRWV3gheqCtzfci5FPg6Qr5oNK5` corrected the source SHA but exposed a stale
  `BRAND_CANONICAL_ORIGIN`; strict same-origin anonymous-session issuance returned `403`.
- The custom Staging values were minimally corrected to the Item 7 source SHA and stable protected
  Vercel alias. The accepted deployment then returned `204` for anonymous-session issuance and
  passed the real Tarot journeys. Production variables were not changed.

## Automated verification

All applicable local checks used exact Node `24.18.0` and pnpm `11.13.1`.

| Gate                                        | Result                                                                                                              |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Focused modified tests                      | PASS; 194 tests across six files.                                                                                   |
| Tarot/recovery tests                        | PASS; 30 files and 623 tests; final selected rerun 22 files and 506 tests.                                         |
| Workspace typecheck                         | PASS; 16/16 packages.                                                                                               |
| ESLint, format, generated evidence, diff    | PASS for the Item 7 source; final evidence-only checks are repeated before closure commit.                         |
| Database migration/seed/repeat              | PASS; all 32 migrations, repeat migration, seed, Tarot ownership/idempotency/tamper/least-privilege, and restore.   |
| Staging Web build                           | PASS; 14-package Vercel build and Next.js 61-page output.                                                           |
| Local zero-mock Tarot browser               | PASS; desktop/mobile one-card and three-card, restore, idempotency, touch/keyboard, handoff, privacy, and axe.      |
| Hosted runtime health/readiness             | PASS; Item 7, exact SHA, database connected, catalog enabled, indexing/providers disabled.                         |
| Hosted zero-mock Tarot browser              | PASS; real `204`, `201`, `200` API statuses, desktop/mobile flows, restore, handoff, safety, privacy, and denylist. |
| Hosted runtime errors                       | No functional error; one existing PostgreSQL `sslmode` future-semantics warning was recorded and not repaired.     |

The complete workspace staging build compiled successfully but the production-only workspace
post-build policy correctly rejected Staging `noindex` output for public canonical/SEO/CSS/GEO
expectations. The direct Staging Web build is the applicable build gate and passed.

The architecture gate still reports the pre-existing unsafe-code-loading finding in
`apps/web/app/_components/site-shell.tsx`. The RTL gate still reports the pre-existing physical
direction rule in `apps/web/app/(recovery)/recovery/recovery.css`. Item 7 changed neither file and
did not repair unrelated findings.

## Browser evidence

The hosted acceptance artifact is private and remains outside Git at
`/private/tmp/rituvia-item7-hosted-browser/2026-08-06T04-46-30-031Z/`.

| Artifact                   | SHA-256                                                            |
| -------------------------- | ------------------------------------------------------------------ |
| `browser-evidence.json`    | `2cc44a93f17474b79b54011d76ba237b7aaf43630fff6e35f5fa726208ddcfd6` |
| `one_card-desktop.png`     | `a6fe04733cb25e6157f3cac3a940f9ce8bc1c95eeafae9c66fd0610f30f99854` |
| `one_card-mobile.png`      | `4c7a8c86196fc8c232a956a75da3ef450f9bda987025d36c092b9d9de7c05da6` |
| `three_card-desktop.png`   | `f7bc57cb10954fb5cb786a8d8ace05fd24bdc5e0550e4df93edb84f8afdd1c9b` |
| `three_card-mobile.png`    | `a42635515b1f7cfe449a9231d388fc374352a14f781ecad662d80ab9403ae2f2` |

The artifact records zero mocked routes, exact source SHA, Providers disabled, Tarot catalog
enabled, first/replay statuses `201`/`200`, no duplicate cards, exact positions/orientations,
UUID-only browser storage, no Provider/interpretation request, and explicit `404` evidence for the
denied Item 8+/account/payment/public routes. Desktop width `1440` and mobile width `390` had no
horizontal overflow or enabled target below 44 pixels. Axe reported no critical or serious
violations. Color-contrast checks remained `incomplete` for manual review rather than violations.
The screenshots were visually inspected; the sticky navigation appears midway through full-page
captures because it remains fixed while the page is stitched.

The earlier final local artifact remains at
`/private/tmp/rituvia-item7-local-browser-final/2026-08-06T01-26-10-320Z/` and passed the same core
journeys before deployment. Its evidence JSON SHA-256 is
`2a00c98a7fb4d2794bbd6a6f65ea1c1b2e9924b51f048484da5f9b778279abdf`.

## Cost and preservation confirmation

- The existing Vercel Pro project, custom Staging environment, single `iad1` region, database, and
  login protection were reused. No domain, object storage, paid observability, Provider, payment
  service, or always-on runtime was added.
- The first upload used a compressed archive. Later configuration corrections reused the exact
  uploaded deployment source through `vercel redeploy`, minimizing transfer and avoiding a new
  source state.
- The original worktree remains at committed HEAD
  `6c0698b88dffce3535bac1e9f1cd9d6b3528062c` with exactly 243 staged files, zero unstaged files,
  and zero untracked files.
- Recovery still descends from `f79fee6713670fdc12b33dd3182569a942782636`. No original history,
  archival ref, migration, record, or payment history was deleted or overwritten.
- The repository remains `AGPL-3.0-only`; Item 7 did not change the license.

## Direct Owner test

1. Sign in to the authorized Vercel team and open the stable protected Owner URL above.
2. On `/recovery`, confirm Item `7`, environment `staging`, source `23ab9b97e34...`, baseline
   `f79fee671367...`, database `connected`, Tarot catalog `enabled`, and production Providers
   `disabled`.
3. Open `/en/tarot/one-card`, choose a theme, draw, reveal, and read the card disclosure,
   limitations, question, and small action. Refresh and confirm the same card/orientation returns.
4. Continue to the private intention and confirm Sanctuary opens without copying card prose into
   browser storage. Return and start a new reflection; it must create a separate reading rather
   than make the prior result more certain.
5. Open `/en/tarot/three-card`, draw and reveal exactly three unique ordered positions:
   `Situation`, `Action`, and `Possibility`. Refresh and confirm the same result returns, then test
   the Sanctuary handoff.
6. Repeat both spreads at desktop and approximately 390-pixel mobile width using keyboard and
   touch. Confirm no horizontal scrolling, clipped controls, inaccessible focus, or small targets.
7. Confirm Provider AI and one-card sharing are absent. Expand reporting and confirm it is
   categorical with no free-text field.
8. Confirm account, payment, `/en/tarot`, `zh-Hans` Tarot, sitemap, and interpretation Provider
   routes remain unavailable. Stop on any prediction claim, changed refresh result, duplicate
   card, source ambiguity, private prose leak, Provider request, payment/account dependency,
   accessibility failure, or source-SHA mismatch.

## Remaining authority

Item 7 is complete for protected Staging. Item 8 is dependency-ready but remains unapproved and
unstarted. Production, DNS, real funds, Providers, unrestricted AI, public indexing, and public
release remain separate Owner gates.

**STOP — NO RECOVERY ITEM 8 STARTED.**
