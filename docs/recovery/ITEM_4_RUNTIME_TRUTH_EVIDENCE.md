# Recovery Item 4 — Real Non-Mocked E2E and Runtime Truth Evidence

> Date: 2026-08-05
>
> Status: **COMPLETE — OWNER REVIEW REQUIRED BEFORE ITEM 5**

## Scope and authority

The Owner explicitly approved Recovery Item 4 and a protected Vercel Staging update. This work
records the difference between a browser behavior test that fulfills mocked API responses and real
runtime requests. It does not fix the core loop, enable a product journey, connect a Staging
database, activate a Provider, configure DNS, use real funds, enable unrestricted AI, or authorize
Recovery Item 5.

## Source and deployment identity

- Recovery baseline: `f79fee6713670fdc12b33dd3182569a942782636`.
- Item 4 runtime implementation: `fba506498f9e8e8cffc93b3858bcb844f1aacfdf`.
- Final deployed source and verifier: `19210b28ed56390bfeb65cd614d7fcf97f68db9b`.
- Git Preview closure: `d6dbb96287fc3393584811e273425d7794d129e2`.
- Final deployment: `dpl_8seYr3Rf4SHk9Mm9GgLQdeD1JW5E`.
- Unique protected URL:
  `https://rituvia-founder-acceptance-recovery-lvbmmyhx1.vercel.app/recovery`.
- Stable protected Owner URL:
  `https://rituvia-founder-acceptance-recov-git-d9b7e8-cptm-111-s-projects.vercel.app/recovery`.
- Vercel project: `prj_UzHHiLzjdPcf8DsJuCHYiDBVWs63`; team:
  `team_f6TQU7mloG5OnQGNmtXwFkOi`.
- Custom environment: `env_IpAngjZlPXtMM1A5GGuYDCAGZF66`, slug `staging`.
- Deployment metadata: `READY`, `target=null`, OIDC environment `staging`, OIDC custom environment
  `env_IpAngjZlPXtMM1A5GGuYDCAGZF66`, one `iad1` runtime region.
- Project metadata after deployment: `live=false`, `domains=[]`.
- Automatic Git deployment returned to `deploymentEnabled=false`; the closure push created no new
  deployment.

## First before-state reproduction

Before any Item 4 edit, exact Node `24.18.0` and pnpm `11.13.1` ran
`pnpm test:full-loop-browser`. The command passed six browser stages while
`scripts/verify-full-loop-browser.mjs` intercepted `**/api/v1/**` and used `route.fulfill`, proving
that result is behavioral evidence with browser fulfillment mocks rather than backend runtime
evidence.

Separately, a real Chromium request with no route interception sent:

`POST /api/v1/ritual-sessions/33333333-3333-4333-8333-333333333333/complete`

to the then-current protected Staging. It returned `404`, empty body, environment `staging`, source
`cc3ebec5101802e8b5116bab29a6f8883d66bebc`, and server correlation ID
`req_82b10db5aee712045508a3bd3871fa1b`. No product code was changed to alter that failure.

## Implemented evidence surface

The existing `/recovery` shell now exposes a protected, source-bound runtime truth check. One
keyboard-accessible action sends exactly three same-origin requests and displays the method, path,
observed/expected status, and server correlation ID:

1. `GET /api/recovery/health` → expected `200`.
2. `GET /api/recovery/readiness` → expected `200`.
3. `POST /api/v1/ritual-sessions/33333333-3333-4333-8333-333333333333/complete` → expected `404`.

The check fails closed for a source mismatch, missing staging header, missing server correlation ID,
unexpected status/path/query, or active Service Worker. The independent browser verifier contains no
request interception or fulfillment API, listens to real Playwright response events, requires
`fromServiceWorker=false`, records the network server address and Vercel request ID, and checks
desktop/mobile layout, keyboard execution, retry visibility, page errors, and serious/critical axe
findings.

## Automated verification

All applicable checks used exact Node `24.18.0` and pnpm `11.13.1`.

| Gate | Result |
| --- | --- |
| Mocked before-state browser | PASS; six stages under explicit `/api/v1/**` fulfillment mocks. |
| Mock-detection guard and recovery proxy/runtime tests | PASS; 153 tests across three files. |
| Core transport/schema route tests | PASS; 178 tests across ten files. |
| Real PostgreSQL E2E | PASS on isolated port `55436`; 32 migrations, idempotent seed, least privilege, RLS, races, core persistence, and logical restore. |
| Non-empty backup/restore | PASS; PostgreSQL custom-format artifact, 65 tables, 105 rows, 32 migrations, snapshot equality, least privilege, cleanup. |
| Formatting, lint, and typecheck | PASS across the workspace. |
| Architecture, environment, migration, and secret gates | PASS; 546 source files, four environments, 33 migration files, and 1,094 tracked/unignored files. |
| Production build | PASS; 16 packages, 121 workspace artifacts/runtime exports, 45 public pages, five private pages. |
| Local desktop/mobile runtime truth | PASS; `200/200/404`, zero fulfillment mocks, no Service Worker, zero blocking axe findings, no page errors or horizontal overflow. |
| Hosted desktop/mobile runtime truth | PASS against final unique protected deployment; same `200/200/404`, exact final source, zero fulfillment mocks, no Service Worker, Vercel request IDs present, zero blocking axe findings, no page errors or horizontal overflow. |

Backup/restore evidence:

- Backup artifact SHA-256: `8b30aabab2464360453e4a31ce32b6d84ed7abb0f67409e2b6ada744c3fe954b`.
- Snapshot SHA-256: `7642bdc3419bb57d94070acb4f3bea8b1f4289cdbba42aa50f87cc86fc054f2e`.
- Local report SHA-256: `adf4e01700da1adc4f7c236e4e16f3021b46cceb5072639f89ab6989dfb947b3`.
- Data classification: `synthetic-only`; source and target databases and backup artifact were
  cleaned up by the guarded test.

## Hosted request/status and trace linkage

Final hosted acceptance used the exact deployment source
`19210b28ed56390bfeb65cd614d7fcf97f68db9b`.

| Profile | Request | Status | Correlation ID | Vercel request evidence |
| --- | --- | ---: | --- | --- |
| Desktop | `GET /api/recovery/health` | 200 | `req_ee0b6c410516a285b324f8718a7ee74f` | `hkg1::iad1::hs8df-1785898411011-95ca0b4d73a7` |
| Desktop | `GET /api/recovery/readiness` | 200 | `req_a7157867795b523857b1d14972b183a3` | `hkg1::iad1::hs8df-1785898411527-d64b45d9c7e7` |
| Desktop | real ritual completion | 404 | `req_a1cf42c1f2cbeb091f027e024837f988` | `hkg1::hs8df-1785898412011-53b45106cbd1` |
| Mobile | `GET /api/recovery/health` | 200 | `req_ac1846a9473dc65d49b87a52303c93cc` | `hkg1::iad1::snxbt-1785898414182-5db039a457a4` |
| Mobile | `GET /api/recovery/readiness` | 200 | `req_c2e43d33f06a08901834b4a158a2a596` | `hkg1::iad1::snxbt-1785898414699-ab8f4b8df84a` |
| Mobile | real ritual completion | 404 | `req_27d3e142eec44369f975311b9941bbca` | `hkg1::z5lf2-1785898415245-9f7681dcd15d` |

The browser evidence links every application correlation ID to a Vercel request ID without sending
private question, journal, intention, or birth content. The browser traces started only after Vercel
Authentication completed, so temporary access query values were not recorded in the traces.

## Browser artifacts

| Artifact | SHA-256 |
| --- | --- |
| `/private/tmp/rituvia-item4-final-unique-browser/desktop.png` | `d5c9f33dca4a99b9e708b9f5fb5ba8b05b7287bc044376a8084166d69ccb3ed8` |
| `/private/tmp/rituvia-item4-final-unique-browser/desktop-trace.zip` | `24549227b0deba80e6be3414ebba70d1fc9bb70404f4ab12a1b1e905d4a9aae5` |
| `/private/tmp/rituvia-item4-final-unique-browser/mobile.png` | `757f77296300bd051c5c0179ab56e04bb1d59ab6447ecb7295b5a0050b5a70d6` |
| `/private/tmp/rituvia-item4-final-unique-browser/mobile-trace.zip` | `395aa5a05cf2956399d0595eec4677a91269c36e8828d0b828142f7d34ee8a78` |

An unauthenticated deployment request received a Vercel SSO redirect, confirming login protection.
The final unique deployment passed the complete hosted browser test. Immediately after stable-alias
reassignment, the automation network twice reset before reaching the application; Vercel's API then
confirmed that the stable alias resolves to the accepted final deployment. This non-application
transport event is retained as a limitation rather than hidden. The unique URL is the deterministic
fallback for Owner review.

## Cost and boundary confirmation

- Standard Vercel build and one `iad1` runtime region only.
- No Vercel database, object storage, paid observability add-on, Provider, or additional runtime
  service was added.
- Database and object storage remain `not-connected` in hosted Staging; PostgreSQL evidence is from
  isolated local synthetic test clusters and is not represented as a hosted database.
- Production Providers, real payments, unrestricted AI, indexing, DNS, and public release remain
  off.
- Repository license remains `AGPL-3.0-only`.
- The preserved original worktree still contains exactly 243 staged entries with no unstaged or
  untracked changes.

## Direct Owner test

1. Sign in to the authorized Vercel account.
2. Open the stable protected Owner URL above. If the alias transport is temporarily unavailable,
   open the unique protected URL.
3. Confirm environment `staging`, Recovery Item `4`, source `19210b28...`, and baseline
   `f79fee6...`.
4. Select **Run real runtime check**.
5. Confirm statuses `200`, `200`, and `404`; each row must show a different `req_...` server
   correlation ID and the page must offer **Retry real runtime check**.
6. Stop if Vercel Authentication is bypassed, the source differs, any status differs, a Service
   Worker controls the page, a product journey becomes reachable, or any Provider/data/payment
   connection appears.

## Remaining authority

Recovery Item 4 is complete. Item 5 is dependency-ready but remains unapproved and unstarted.
Production, DNS, real funds, public indexing, product journeys, Providers, unrestricted AI, and
public release remain separate Owner gates.

**STOP — NO RECOVERY ITEM 5 OR PRODUCT IMPLEMENTATION STARTED.**
