# Recovery Item 5 — Core Reflection Loop Evidence

> Date: 2026-08-05
>
> Status: **BLOCKED AT HOSTED BROWSER ACCEPTANCE — DEPLOYED, NOT COMPLETE**

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

| Gate                                            | Result                                                                                                                                                                        |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Before-state deny-all proxy reproduction        | PASS; nine assertions, with 139 unrelated tests skipped.                                                                                                                      |
| Focused Item 5 tests                            | PASS; 199 tests across five files.                                                                                                                                            |
| Formatting, affected-file ESLint, Web typecheck | PASS.                                                                                                                                                                         |
| Secret scan and diff check                      | PASS; 1,097 tracked/unignored files.                                                                                                                                          |
| Production Web build                            | PASS; Next.js `16.2.11`, 60 static pages generated, dynamic Item 5 routes built.                                                                                              |
| Local real core-loop browser                    | PASS; zero route interception/fulfillment mocks, desktop/mobile, keyboard, reduced motion, offline/retry, same-owner reload, private journal, and Revisit.                    |
| Accessibility                                   | PASS for zero serious/critical axe violations; color-contrast items remain recorded as incomplete manual checks.                                                              |
| Non-empty backup/restore                        | PASS; PostgreSQL `17.10`, 32 successful migrations, one preserved rolled-back attempt, and non-empty Item 5 tables.                                                           |
| Private plaintext scan                          | PASS; question, intention, action, journal, and Revisit canaries absent from restored data.                                                                                   |
| Hosted browser                                  | BLOCKED before HTTP; current network resolves `*.vercel.app` to unrelated IPs and resets direct Vercel Edge TLS. No application request or happy-path `4xx/5xx` was observed. |

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

## Hosted acceptance blocker

Vercel control-plane APIs independently confirm the exact source, `READY` state, stable alias,
custom/OIDC Staging identity, SSO protection, and `live=false`. Automated Playwright, Vercel CLI
curl, the Codex in-app browser, and user Chrome all timed out or reset before HTTP from the current
network. Direct DNS queries returned unrelated addresses, while direct probes to Vercel Edge IPs
reached TCP `443` but reset during TLS. This is retained as an environmental blocker rather than
reported as a hosted product pass.

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

Item 5 is not complete until the same deployed SHA passes the hosted desktop/mobile browser journey
from a Vercel-reachable network or the Owner records equivalent direct acceptance. Item 6 remains
unapproved and unstarted. Production, DNS, real funds, Providers, unrestricted AI, public indexing,
and public release remain separate Owner gates.

**STOP — NO RECOVERY ITEM 6 STARTED.**
