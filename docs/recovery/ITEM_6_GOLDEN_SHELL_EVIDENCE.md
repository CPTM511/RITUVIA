# Recovery Item 6 — Golden Shell and en/zh-Hans Evidence

> Date: 2026-08-05
>
> Status: **COMPLETE — PROTECTED STAGING READY FOR OWNER REVIEW**

## Scope and authority

The Owner explicitly approved Recovery Item 6. This slice applies the locked 2026-07-23 golden
shell to the bilingual Home shell only, with reviewed English and Simplified Chinese copy and an
explicit locale switch. It preserves the already accepted English Item 5 core loop but does not
translate or activate that journey in Simplified Chinese. That narrower boundary avoids presenting
unreviewed domain, safety, or API copy as approved localization.

This item does not start Tarot expansion, add another locale, mutate golden screenshots, expand
SEO/GEO, activate a Provider, enable a payment, use real funds, change DNS, deploy production, or
start Recovery Item 7.

## First before-state reproduction

Before Item 6 edits, the protected-Staging shell was captured at desktop and mobile sizes and
compared with the locked production-pack prototype. It lacked the approved golden Home hierarchy,
approved bilingual shell, locale switch, mobile navigation, free-path explanation, and six-step
reflection-loop presentation. The before screenshots were preserved outside Git because the
repository secret scanner intentionally rejects binary files.

Locked prototype:

- File: `docs/codex/rituvia-production-2026-07-23/13_golden_prototype.html`.
- SHA-256: `e9d75c9c118be64cc779d182f01ec332d150b520fa9f0eb497f58fbf5fea5740`.
- Golden screenshots were not changed.

## Implemented protected slice

- `/en` and `/zh-Hans` render the same approved shell structure with reviewed locale resources.
- The locale switch preserves the current shell destination and never leaks an English product
  journey into the Chinese route.
- Desktop and compact navigation are keyboard accessible; mobile navigation is collapsed by
  default and uses 44-pixel minimum enabled targets.
- The shell covers the approved hero, methods, always-free path, six-step core loop, disclosures,
  reduced-motion control, and footer.
- Item 7 and later methods remain visibly unavailable and have no active links.
- `/zh-Hans/intake` remains denied. The accepted Item 5 journey remains English-only.
- `zh-Hans` remains protected and `noindex`; it is not an approved public locale launch.

## Source and deployment identity

- Recovery baseline: `f79fee6713670fdc12b33dd3182569a942782636`.
- Item 6 shell commit: `84119ac12cdf51d993e3330c472086f0f999f104`.
- Item 6 deployable source: `0aa78cad52d2d8ffd92d91f7eb47994e34853302`.
- Git Preview closure: `2aa2dc45addfd5832b2e026f868242947b5fd36c`.
- Accepted deployment: `dpl_CSWoRBXuooyaGSuHZdthLn6VZca3`.
- Unique protected URL:
  `https://rituvia-founder-acceptance-recovery-3hc6end91.vercel.app/recovery`.
- Stable protected Owner URL:
  `https://rituvia-founder-acceptance-recov-git-d9b7e8-cptm-111-s-projects.vercel.app/recovery`.
- Vercel project: `prj_UzHHiLzjdPcf8DsJuCHYiDBVWs63`; team:
  `team_f6TQU7mloG5OnQGNmtXwFkOi`.
- Vercel reports `READY`, `target=null`, source `git`, branch
  `codex/founder-acceptance-recovery`, source SHA `0aa78cad...`, branch alias present, runtime region
  `iad1`, `live=false`, and zero project domains.
- Unauthenticated requests to `/recovery`, `/en`, `/zh-Hans`, `/zh-Hans/intake`, and `/robots.txt`
  returned `302` to Vercel SSO with `cache-control: no-store`, proving login protection remains in
  front of every tested route.
- Automatic Git deployment is back to `deploymentEnabled=false`. Pushing the closure commit created
  no new deployment; the accepted deployment remains the project latest deployment.

## Build incident and root-cause closure

The first deployment, `dpl_B7ZKzC3uEYewQnj64XYpbbBUYnva`, failed without serving traffic. Its
Turbo cache replay omitted `packages/db/src/generated/prisma/client.js`, which made the Web build
report a missing module. The build graph now declares `src/generated/prisma/**` as a package build
output. A forced 14-package build passed, the generated directory was moved aside, and a second
all-cache-hit build restored the generated client and passed. The accepted deployment then reached
`READY`. No product behavior, database schema, Provider, or payment path was changed by this build
infrastructure fix.

## Automated verification

All applicable local checks used exact Node `24.18.0` and pnpm `11.13.1`.

| Gate                                           | Result                                                                                                                                                                                                   |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused Item 6 tests                           | PASS; 194 tests across six files.                                                                                                                                                                        |
| Formatting, changed-file ESLint, Web typecheck | PASS.                                                                                                                                                                                                    |
| Localization and writing-system checks         | PASS; five checksummed records, seven locale-aware files, and 172 writing-system files.                                                                                                                  |
| Secret scan                                    | PASS; 1,102 tracked/unignored files after binary evidence was moved outside Git.                                                                                                                         |
| Production Web build                           | PASS; Next.js generated 61 pages including `/en` and `/zh-Hans`.                                                                                                                                         |
| Turbo build and cache replay                   | PASS; 14/14 forced tasks, then 14/14 cache hits with Prisma output restored.                                                                                                                             |
| Writing-system browser                         | PASS; two axe scans, zero critical/serious findings, zero console/page errors, zero external requests, and 320-pixel coverage.                                                                           |
| Full-loop browser regression                   | PASS; six stages, four axe scans, zero critical/serious findings, zero console/page errors, zero unexpected or payment requests, and zero touch failures.                                                |
| Item 6 production browser                      | PASS; English and Chinese desktop/mobile layouts, locale persistence, compact navigation, reduced motion, no horizontal overflow, no active unsupported links, and zero fresh production console errors. |
| Vercel deployment/protection                   | PASS; exact source is `READY`, not live, has no domains, uses the stable branch alias, and requires SSO.                                                                                                 |

`pnpm check:rtl` still reports the pre-existing physical-directional rule at
`apps/web/app/(recovery)/recovery/recovery.css:39`. `git diff --exit-code` proves Item 6 did not
change that file. The unrelated existing finding was not repaired in this single-item run.

## Local visual evidence

The production browser used the exact deployable source. Binary evidence remains outside the Git
repository at `/private/tmp/rituvia-item6-visual-evidence/`.

| Artifact                           | SHA-256                                                            |
| ---------------------------------- | ------------------------------------------------------------------ |
| `item-6-before-en-desktop.png`     | `2b45b8202e56a966418f0fb1bcefab30cafe3b0915ba2c7fae8449536959464b` |
| `item-6-before-en-mobile.png`      | `5a6ebabbc32c06122823c680b6bc0f10cad9a0d6241c11bf745a793ec384c029` |
| `item-6-after-en-desktop.png`      | `8acd3674310574cffd33312290560c0a842910700c134ca101d48acd08fede07` |
| `item-6-after-en-mobile.png`       | `49f104476aac62f9ff95df7d1f016e4e0b570afe8e864730a4ec35526168b358` |
| `item-6-after-zh-Hans-desktop.png` | `e6b892c925f791feb505f7c6bb4472fac056007cc13047dee08f783f7eee8342` |
| `item-6-after-zh-Hans-mobile.png`  | `87d98bca85a21e9ab3bb2e3b3258f9ef40af9d68be77db88cd13e83cee324e5a` |

At 1440 pixels, both locales matched their shell hierarchy with no horizontal overflow and no
enabled target below 44 pixels. At 390 pixels, Chinese navigation collapsed and reopened without
overflow. At 320 pixels, English remained within the viewport with no enabled target below 44
pixels. The Chinese page contained no `/en/...` journey links.

## Hosted acceptance limitation

The Vercel API and deployment connector confirmed the exact source, branch alias, READY state,
non-live target, absent domains, and SSO boundary. Two in-app browser attempts timed out before the
application page became available, and authenticated connector fetches remained at the SSO
redirect. No authentication-bypass or temporary public share link was created. Therefore the
rendered hosted pixels were not represented as automation-verified; the exact deployable source is
instead bound to the passed local production-browser evidence above. The Owner test below is the
remaining direct visual confirmation, not authority to begin Item 7.

## Cost and preservation confirmation

- Item 6 reused the existing protected Vercel project, branch alias, single `iad1` runtime region,
  and Item 5 staging resources. It added no domain, database, object storage, paid observability,
  Provider, payment service, or additional always-on runtime.
- The original worktree remains on `codex/rit-070-subscription-lifecycle` at committed HEAD
  `6c0698b88dffce3535bac1e9f1cd9d6b3528062c`, with exactly 243 staged files, zero unstaged files,
  and zero untracked files.
- The recovery branch still descends from baseline `f79fee6713670fdc12b33dd3182569a942782636`.
  No original history, archival ref, migration, record, or payment history was deleted or
  overwritten.
- The repository remains `AGPL-3.0-only`; the license diff against the recovery baseline is empty.

## Direct Owner test

1. Sign in to the authorized Vercel team and open the stable protected Owner URL above.
2. Confirm Recovery Item `6`, environment `staging`, source `0aa78cad52d...`, baseline
   `f79fee671367...`, database state, and production Providers `disabled` on `/recovery`.
3. Open `/en` and `/zh-Hans`. Use the locale switch in both directions and confirm the shell stays
   on the Home destination.
4. At desktop width, inspect the hero, methods, always-free path, six-step loop, disclosures,
   reduced-motion control, and footer in both languages. Item 7 and later methods must not be
   active links.
5. At 390 pixels and 320 pixels, open and close the compact menu, use keyboard or touch, and confirm
   no clipped text, horizontal scrolling, focus loss, or enabled target below 44 pixels.
6. Confirm `/zh-Hans/intake` is denied and the English Item 5 core loop remains available only under
   its accepted `/en/...` routes.
7. Stop on missing SSO, source mismatch, indexable Chinese content, English-journey leakage into
   Chinese, active Item 7+ links, Provider/payment activity, inaccessible controls, or mobile
   overflow.

## Remaining authority

Item 6 is complete for protected Staging, subject to the direct Owner visual review above. Item 7
is dependency-ready but remains unapproved and unstarted. Production, DNS, real funds, Providers,
unrestricted AI, public indexing, and public release remain separate Owner gates.

**STOP — NO RECOVERY ITEM 7 STARTED.**
