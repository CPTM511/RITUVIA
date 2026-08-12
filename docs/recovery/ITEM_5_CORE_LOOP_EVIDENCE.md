# Recovery Item 5 — Core Reflection Loop Evidence

> Date: 2026-08-05
>
> Status: **COMPLETE — HOSTED DESKTOP/MOBILE ACCEPTANCE PASSED**

## Scope and authority

The Owner explicitly approved Recovery Item 5. This slice enables only the protected-Staging,
anonymous adult journey: intake → one-card reflection → intention → small action → free ritual →
private reflection → Revisit. It does not enable account identity, paid ritual, payment, Provider
AI, unrestricted AI, production, DNS, public indexing, or Recovery Item 6.

## First before-state reproduction

Before Item 5 edits, exact Node `24.18.0` and pnpm `11.13.1` reran the Item 4 proxy test. All nine
deny-all assertions passed and proved that the then-current protected Staging rejected every
non-Item-4 product route. The accepted Item 4 evidence separately preserves real desktop/mobile
ritual-completion `404` responses. No failing route was repaired before this reproduction.

## Implemented protected slice

- The Staging proxy allowlists only `/en/intake`, `/en/tarot/one-card`, `/en/sanctuary`,
  `/en/revisit`, their exact framework representations, static product images, and the minimum
  owner-scoped APIs required by the journey.
- Account, reminder, catalog purchase, entitlement, order, checkout, payment, Provider, three-card,
  numerology, astrology, additional locale, and unrelated query-bearing requests remain `404`.
- Staging uses a dedicated Neon Free PostgreSQL resource and the least-privilege `rituvia_app`
  runtime role. The application role cannot bypass forced RLS or perform account, payment, catalog,
  Provider, or unrestricted lifecycle writes.
- The browser stores only random UUID resume identifiers in tab-scoped `sessionStorage`. Intention,
  small action, journal, and Revisit prose are encrypted before persistence and restore only for the
  same anonymous owner.
- The free linear ritual supports keyboard use, reduced motion, offline completion failure, retry,
  private journal reload, Revisit scheduling/completion, and mobile reload.

## Source and deployment identity

- Recovery baseline: `f79fee6713670fdc12b33dd3182569a942782636`.
- Item 5 deployed source: `36936caed5b193a64747fbfb6b5787d451721b5b`.
- Git Preview closure: `bb5b54477eab2757fd780aa6c7086a046ab68d8f`.
- Deployment: `dpl_D8xgNqiqV8SQjotYcH8NT5zmdqs8`.
- Unique protected URL:
  `https://rituvia-founder-acceptance-recovery-acwag9d0k.vercel.app/recovery`.
- Stable protected Owner URL:
  `https://rituvia-founder-acceptance-recov-git-d9b7e8-cptm-111-s-projects.vercel.app/recovery`.
- Vercel project: `prj_UzHHiLzjdPcf8DsJuCHYiDBVWs63`; team:
  `team_f6TQU7mloG5OnQGNmtXwFkOi`.
- Custom environment: `env_IpAngjZlPXtMM1A5GGuYDCAGZF66`, slug `staging`.
- Vercel API evidence: `READY`, `target=null`, OIDC environment `staging`, OIDC custom environment
  `env_IpAngjZlPXtMM1A5GGuYDCAGZF66`, `live=false`, `private=true`, and runtime region `iad1`.
- The stable branch alias points to the Item 5 deployment. No custom/external domain or DNS was
  added; the Vercel-managed project domain remains platform-owned.
- Automatic Git deployment is back to `deploymentEnabled=false`; the closure push created no
  deployment. SSO protects all previews and the temporary automation bypass count is zero.

## Automated verification

All applicable local checks used exact Node `24.18.0` and pnpm `11.13.1`.

| Gate                                            | Result                                                                                                                                                                                                                                         |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Before-state deny-all proxy reproduction        | PASS; nine assertions, with 139 unrelated tests skipped.                                                                                                                                                                                       |
| Focused Item 5 tests                            | PASS; 199 tests across five files.                                                                                                                                                                                                             |
| Formatting, affected-file ESLint, Web typecheck | PASS.                                                                                                                                                                                                                                          |
| Secret scan and diff check                      | PASS; 1,097 tracked/unignored files.                                                                                                                                                                                                           |
| Production Web build                            | PASS; Next.js `16.2.11`, 60 static pages generated, dynamic Item 5 routes built.                                                                                                                                                               |
| Local real core-loop browser                    | PASS; zero route interception/fulfillment mocks, desktop/mobile, keyboard, reduced motion, offline/retry, same-owner reload, private journal, and Revisit.                                                                                     |
| Accessibility                                   | PASS for zero serious/critical axe violations; color-contrast items remain recorded as incomplete manual checks.                                                                                                                               |
| Non-empty backup/restore                        | PASS; PostgreSQL `17.10`, 32 successful migrations, one preserved rolled-back attempt, and non-empty Item 5 tables.                                                                                                                            |
| Private plaintext scan                          | PASS; question, intention, action, journal, and Revisit canaries absent from restored data.                                                                                                                                                    |
| Hosted browser                                  | PASS; the same protected deployment completed runtime truth plus the anonymous core loop with zero route fulfillment mocks, desktop reload, `390×844` mobile reload, Revisit completion, no page console errors, and no application `4xx/5xx`. |

## Local browser and restore evidence

- Browser evidence SHA-256:
  `56596fc97b222a127d0fd8224ef52e8e16928ff9fd8a1bc91148dd95923d2af3` (`5,039` bytes).
- Browser result: `mockedRoutes=0`, `desktop=passed`, `mobile=passed`, database connected, production
  Providers disabled, and core response statuses limited to `200`, `201`, and `204`.
- Backup SHA-256:
  `89e7c6ccaeda2723c91a21716ccb2c1186f97d7bbc2a68ed18b4e8de2f7202b6` (`439,601` bytes).
- Restore migration counts: 32 successful, one rolled back, zero incomplete.
- Restored row counts: 10 anonymous subjects, 10 anonymous sessions, nine readings, nine Tarot
  draws, nine intentions, nine v2 ritual sessions, nine private journal entries, and six Revisits.
- The first backup attempt through the application/migrator boundary was stopped by forced RLS on
  `catalog_price`. The complete backup used the Neon resource administrator only for backup, without
  changing runtime grants. Restore ran in an isolated local PostgreSQL cluster and the temporary
  database, dump, plaintext scan file, and credentials were removed after checksums were recorded.

## Hosted browser acceptance

On 2026-08-05 the network path became available to the Codex in-app browser, which retained Vercel
Authentication and did not install a Service Worker, route interception, fulfillment mock, or
automation bypass. The exact protected deployment and source passed:

- Runtime truth: `/api/recovery/health`, `/api/recovery/readiness`, and `/en/intake` each returned
  `200`, environment `staging`, source `36936caed5b193a64747fbfb6b5787d451721b5b`, and valid server
  correlation IDs `req_22bef5f99beadbf8b875c2456d5e8a3b`,
  `req_906a76f1a7f3577cbda163a29d6d71b8`, and
  `req_70b729c236356c913ef096cf6ab3538c`.
- The real browser completed intake → server-fixed one-card draw → intention → small action → free
  candle ritual → encrypted private reflection → scheduled and completed Revisit.
- Reloading Sanctuary restored the same owner's intention, action, and journal. Reloading Revisit
  restored the completed reflection.
- At `390×844`, Sanctuary restored all three private values and Revisit restored the completed
  reflection; document width remained `390`, horizontal overflow was absent, and no visible enabled
  main-content target measured below `44×44`.
- The acceptance interval recorded 38 `200`, five `201`, and five `204` runtime responses. Vercel
  returned no `4xx`, no `5xx`, and no failed application request in that interval. The page console
  returned zero warnings or errors.
- Account, payment, paid ritual, production AI, Provider, three-card, numerology, astrology,
  additional locale, DNS, and production paths were not invoked or enabled.

Machine-readable evidence is in `docs/recovery/ITEM_5_HOSTED_BROWSER_EVIDENCE.json`. The earlier
regional DNS/TLS failure remains preserved in Git history and the preceding evidence commit; it is
not rewritten as though the first attempt passed.

Vercel emitted one dependency warning that current `pg` SSL aliases are treated as `verify-full`
but will change semantics in a future major version. The current connection remains verified; the
warning is recorded for dependency-upgrade review and is not fixed in Item 5.

## Direct Owner test

1. Use a network that can reach `*.vercel.app`, sign in to the authorized Vercel account, and open
   the stable protected Owner URL above.
2. Confirm environment `staging`, Recovery Item `5`, source `36936caed5b1...`, baseline
   `f79fee6...`, database `connected`, and production Providers `disabled`.
3. Select **Run real runtime check** and require `200/200/200`, three server correlation IDs, no
   Service Worker, and no source mismatch.
4. Select **Start the anonymous core loop**. Enter a synthetic adult-safe question, draw and reveal
   one card, create an intention and one small action, complete **Begin free ritual**, save a private
   reflection, schedule a Revisit, complete it, and reload Sanctuary and Revisit.
5. Repeat the reload checks at a mobile viewport. Confirm no account, payment, paid ritual,
   Provider, three-card, numerology, astrology, or additional-locale dependency appears.
6. Stop on any login bypass, source mismatch, happy-path `4xx/5xx`, lost private state, cross-owner
   access, paid gate, Provider request, accessibility blocker, or missing mobile restore.

## Remaining authority

Item 5 is complete for protected Staging. Item 6 remains unapproved and unstarted. Production,
DNS, real funds, Providers, unrestricted AI, public indexing, and public release remain separate
Owner gates.

**STOP — NO RECOVERY ITEM 6 STARTED.**
