# Recovery Item 8 — Numerology and Astrology Evidence

> Date: 2026-08-06
>
> Status: **COMPLETE — PROTECTED STAGING READY FOR OWNER REVIEW**

## Scope and authority

The Owner explicitly approved Recovery Item 8 after Item 7 closed. This run activates only the
reviewed English numerology calculator and a bounded synthetic-data astrology calculator in the
existing protected custom Staging. Deterministic engines calculate every displayed value. Provider
AI does not create, change, or interpret the result.

This item does not activate accounts, wallet sign-in, payment, Credits, Provider AI, production,
DNS, public indexing, a new locale, a new astrological tradition, real funds, public release, or
Recovery Item 9.

## First before-state reproduction

Before Item 8 edits, committed source `3ece2afe95c17935b12b7cb59b11b094d04719c9`
kept the protected recovery shell available while denying the Item 8 pages and APIs. The exact
before-state evidence remains outside Git:

| Artifact                              | Result                                                                 | SHA-256                                                            |
| ------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `fixed-vectors-and-before-routes.txt` | 9 files and 260 fixed-vector/property/runtime tests passed.            | `6d11ca13c3b448d233254e0f66a8e0798a08f0e0ad2b826f8e9ef8672ed0ad40` |
| `protected-route-status.txt`          | Recovery `200`; both Item 8 pages and both Item 8 APIs returned `404`. | `941c8016da7df1c486b83ab9110e5026239e7aaa8d55ec5180428a9fc6782a85` |

The protected browser later exposed one in-scope staging dependency: each calculator page probed
`GET /api/v1/me`. The proxy denied every probe with `404`, but Item 8 requires no account
dependency. The two pages now disable the existing account navigation in Staging, and the final
browser request inventory contains no account, wallet, privacy, payment, or Provider request.

## Implemented protected slice

### Numerology

- `/en/readings/numerology` and `POST /api/v1/numerology/calculate` are allowlisted only in the
  protected recovery environment.
- The existing deterministic engine calculates Life Path, Birthday Number, and Personal Year from
  strict Gregorian date and four-digit target-year input.
- The result exposes source digits, initial value, every reduction step, result, engine/rule
  versions, and the approved `11`/`22`/`33` preservation rule.
- Birth date and target year are sent only in a private same-origin request. They are not placed in
  the URL, browser storage, database, logs, analytics, or a model request.

### Astrology

- `/en/readings/astrology` and `POST /api/recovery/item-8/astrology` are allowlisted only in the
  protected recovery environment.
- The form accepts synthetic birth data only and offers three fixed GeoNames-backed location
  fixtures under `CC-BY-4.0`; it provides no public location search and no account-profile write.
- Exact time returns eleven placements, Placidus houses, angles, and bounded major aspects.
- Approximate time returns placements while suppressing houses, angles, and aspects and displays
  the selected uncertainty window.
- Unknown time creates no UTC instant and returns no placement, house, angle, aspect, or invented
  noon chart. The focused service test proves the native executor is not invoked for this path.
- Strict historical civil-time resolution requires explicit overlap disambiguation and rejects
  nonexistent local times instead of guessing.
- Every mutation requires an anonymous session, same-origin request, CSRF token, strict request
  schema, and no persistence. Clear removes the current synthetic inputs and result.

## Calculation source, runtime, and license

- Recovery baseline: `f79fee6713670fdc12b33dd3182569a942782636`.
- Swiss Ephemeris: `2.10.03`, reviewed source commit
  `af9823fe7b06ffefe3d3968fdc5680be8b5eec5f`.
- Native source inventory SHA-256:
  `9bc28fc7380b3b8fdfbad0ce481c0007890f401c9f9fde0e56246304b3c03cf2`.
- Ephemeris data inventory SHA-256:
  `8f3e2a81b3b36e0754bc8f11658f429fa41026a8afef204bbdab8bcd506bb66b`.
- Civil-time runtime: Node `24.18.0`, ICU `78.3`, tzdata `2026b`.
- Repository and Swiss Ephemeris integration remain `AGPL-3.0-only`. Item 8 did not modify the
  repository license or decide the separate unrestricted-public-service commercial-license gate.
- The Web production build traces the native binary, build metadata, and the required
  `semo_18.se1` and `sepl_18.se1` data files into the astrology function. Local macOS native caches
  are excluded from Vercel uploads so the protected Linux build reproduces them from the fixed
  checksummed source.

## Source and deployment identity

- Item 8 implementation commit: `46cd475d75d86aa89538069b7fe1b600607730ff`.
- Native-build isolation commit: `b1e6d126929708d9e2a7647d6f3b7fb0de08029a`.
- Accepted deployment/source commit: `8f4d5255f8625a8a74bfa78c0c861d85ab8d491a`.
- Accepted deployment: `dpl_GuAVFXenqS4g4By52Xcjuu52JrVH`.
- Unique protected URL:
  `https://rituvia-founder-acceptance-recovery-mnw03330i.vercel.app/recovery`.
- Stable protected Owner URL:
  `https://rituvia-founder-acceptance-recovery-cptm-111-s-projects.vercel.app/recovery`.
- Vercel project: `prj_UzHHiLzjdPcf8DsJuCHYiDBVWs63`.
- Vercel team: `team_f6TQU7mloG5OnQGNmtXwFkOi`.
- Vercel reports `READY`, `readySubstate=STAGED`, custom environment/OIDC `staging`, source `cli`,
  exact Git ref/SHA metadata, `public=false`, `live=null`, and one `iad1` region. CLI inspection of
  the custom-environment alias reports `target=staging`.
- The project has one Vercel-managed `.vercel.app` domain and no custom or production domain.
  Unauthenticated `/recovery` returns `302` to Vercel SSO. A temporary 23-hour share credential was
  used only for browser acceptance and did not disable login protection.
- `apps/web/vercel.json` remains `deploymentEnabled=false`; automatic Git deployment remains off.
- Private deployment metadata evidence SHA-256:
  `1ad5bfabd755002ac43b49e0a35ce68f3eb0c043794453f3905ce40f23490556`.

The first READY Item 8 deployment, `dpl_FHtpL7FBg2i4f6bwYNDJsW913P63`, remains audit evidence. Its
real browser run found the denied `/api/v1/me` probes described above. It was not accepted as the
Item 8 endpoint. No unrelated defect was repaired.

## Automated verification

All applicable local checks used exact Node `24.18.0` and pnpm `11.13.1`.

| Gate                                    | Result                                                                                                                   |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Format, lint, typecheck                 | PASS; root formatting/lint and all 16 workspace package typechecks.                                                      |
| Architecture/environment contracts      | PASS; architecture across 555 files/16 modules and the protected environment contract.                                   |
| Focused calculation and recovery tests  | PASS; 16 files and 300 tests, including numerology vectors/properties, astrology precision, timezone, route, and proxy.  |
| Final account-probe regression rerun    | PASS; 5 files and 274 tests plus Web typecheck.                                                                          |
| Native reproducibility/parity           | PASS; 2 files/6 tests, fixed source/data inventories, independent astronomy comparison, and exact native metadata.       |
| Native security and dependency fixture  | PASS; 151 mutation cases, UBSan, fixed commit, and zero fixture vulnerabilities.                                         |
| PostgreSQL migration/seed               | PASS; all 32 migrations, seed, and repeated isolated setup.                                                              |
| Birth-profile and astrology persistence | PASS; encryption, ownership, replay, concurrency, append-only facts, export, deletion crypto-shred, and least privilege. |
| Privacy deletion and backup/restore     | PASS; selective/account deletion, session revocation, ciphertext destruction, idempotency, and isolated logical restore. |
| Local and Vercel production builds      | PASS; all 14 build tasks and 61 Next.js routes; native Linux engine rebuilt from the fixed checksummed source.           |
| Hosted zero-mock Chromium               | PASS; real desktop/mobile numerology and exact/approximate/unknown astrology, denylist, privacy, layout, and axe.        |
| Hosted runtime errors                   | No application error cluster; only the existing PostgreSQL future-SSL-semantics warning appeared in the error channel.   |

The database persistence suites validate the existing reusable production architecture; the
protected Item 8 calculator itself intentionally remains stateless and does not write birth data
or calculation results.

## Browser evidence

The accepted hosted artifact remains private and outside Git at
`/private/tmp/rituvia-item8-hosted-browser-final/2026-08-06T10-07-03-755Z/`.

| Artifact                 | SHA-256                                                            |
| ------------------------ | ------------------------------------------------------------------ |
| `browser-evidence.json`  | `08b20c5c23d9247aa90673a246c256c472668fcf89028f7dca8c3aecdf92e773` |
| `numerology-desktop.png` | `711abe4f697929885861704f61493f7a513a78a8ac21505c4ae4cace0a7055d1` |
| `numerology-mobile.png`  | `7c93bb869136e564064114cb577d9872de7b9c12f1d6757f3ff3d725b9901941` |
| `astrology-desktop.png`  | `37a2f80744bb9f1418a0d4ca267d807a5aa8bf2068c34f02d0f8efb97bb2a4d0` |
| `astrology-mobile.png`   | `7fe4f3cbcfefdf6d96fad1e702f6158c81d88dd70d9c38d325e6f1980699523c` |

The evidence records zero mocked routes, exact source SHA, Item `8`, Providers disabled, 77 real
browser requests, zero browser-storage keys, and no account/payment/privacy/Provider request. The
numerology vector displayed `4`, `1`, and `22`. Exact astrology returned 11 placements, houses,
and 12 aspects; approximate time returned 11 placements and no houses/aspects; unknown time
returned zero placements/houses/aspects. Account, persistent natal API, public numerology and
astrology hubs, `zh-Hans` calculators, and order creation each returned `404`.

Desktop width `1440` and mobile width `390` had no horizontal overflow or enabled target below 44
pixels. Axe reported zero critical or serious violations. The screenshots were visually inspected;
the sticky navigation appears midway through full-page captures because the browser stitches a
fixed header, matching the already recorded Item 7 capture behavior.

Vercel Preview Toolbar attempts to inject `vercel.live` feedback JavaScript. The product CSP
correctly blocks that script. The verifier excludes only that exact hosting-platform CSP message;
all other console errors remain fatal.

## Cost and preservation confirmation

- The existing Vercel Pro project, custom Staging environment, login protection, database, and one
  `iad1` region were reused. No paid observability, object storage, always-on runtime, Provider,
  payment service, domain, or additional region was added.
- Two bounded Item 8 builds were necessary: the first produced the real account-probe finding; the
  second deployed only the focused correction. No speculative rebuild or production promotion was
  performed.
- Per-deployment source/runtime overrides bind the exact source SHA and native metadata path; no
  production environment variable was changed.
- The original worktree remains required to retain committed HEAD
  `6c0698b88dffce3535bac1e9f1cd9d6b3528062c` and exactly 243 staged files. Final invariance is
  repeated before the Item 8 evidence commit.
- Recovery still descends from `f79fee6713670fdc12b33dd3182569a942782636`. No archive, original
  history, migration, record, payment history, or license was deleted or overwritten.

## Direct Owner test

1. Sign in to the authorized Vercel team and open the stable protected Owner URL above.
2. On `/recovery`, confirm Item `8`, environment `staging`, source `8f4d5255f862...`, baseline
   `f79fee671367...`, native astrology `enabled`, numerology `enabled`, time-zone runtime `pinned`,
   and production Providers `disabled`.
3. Open `/en/readings/numerology`, enter birth date `1990-11-28` and target year `2026`, then
   calculate. Confirm Life Path `4`, Birthday Number `1`, Personal Year `22`, visible steps,
   versions, source link, AGPL disclosure, and no Provider AI.
4. Open `/en/readings/astrology`, keep New York, enter `2000-01-01` and `07:00`, select exact time,
   and calculate. Confirm 11 placements plus houses, angles, and aspects with exact-time disclosure.
5. Select approximate time and a 90-minute window. Confirm placements remain while houses, angles,
   and aspects are suppressed.
6. Select unknown time and calculate. Confirm no time input is required and no placement, house,
   angle, aspect, wheel, or invented noon chart appears.
7. Enter `25:00` as a birth time and confirm the accessible correction state. Clear the synthetic
   data, refresh, and confirm no prior value/result is restored.
8. Repeat at desktop and approximately 390-pixel mobile width with keyboard and touch. Confirm no
   clipping, horizontal scroll, inaccessible focus, or small enabled target.
9. Confirm account, public numerology/astrology hubs, `zh-Hans` calculators, payment, and persistent
   account astrology routes remain unavailable. Stop on any value mismatch, hidden time assumption,
   private-data persistence, account/payment/Provider request, source/license ambiguity,
   accessibility failure, or source-SHA mismatch.

## Remaining authority

Item 8 is complete for protected Staging. Item 9 is dependency-ready but remains unapproved and
unstarted. Production, DNS, real funds, accounts, wallets, payments, Providers, unrestricted AI,
public indexing, and public release remain separate Owner gates.

**STOP — NO RECOVERY ITEM 9 STARTED.**
