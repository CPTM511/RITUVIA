# Recovery Item 9 — Identity, Wallet and Privacy Evidence

> Date: 2026-08-07
>
> Status: **COMPLETE — PROTECTED STAGING READY FOR OWNER REVIEW**

## Scope and authority

The Owner explicitly approved Recovery Item 9 after Item 8 closed. This item activates only the
email sandbox, non-custodial Base Sepolia wallet identity, private account controls, export, and
deletion paths in the existing Vercel-authenticated custom Staging.

This item does not activate a production identity Provider, outbound email, custody, wallet
transactions, payment, Credits, Stripe, Provider AI, production, DNS, public indexing, real funds,
public release, or Recovery Item 10.

Founder Journey coverage: FJ-07, FJ-08, FJ-09, FJ-18, and FJ-19.

## First before-state reproduction

Before Item 9 edits, exact committed source `686c0e5474dce03ef5b00ab4d843510c33690ded`
kept the protected recovery shell available while denying the Item 9 entry points.

| Artifact       | Result                                                                | SHA-256                                                            |
| -------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `manifest.txt` | Sign-in, account, auth-start, and privacy-export each returned `404`. | `9abe7ee973474d5d5a60a42d6f7cad225ed13c5c1c238d3b69e5c4e3ab4402ed` |
| `SHA256SUMS`   | Checksums for the complete before-state capture.                      | `9cfae30867f3af8d8de6ef621cdb082caf2d98c0db9fb92a57bf52b0ea77dfb`  |

The before-state capture remains private and outside Git at `/private/tmp/rituvia-item9-before/`.

## Implemented protected slice

### Email sandbox and account authority

- The protected English sign-in flow uses an in-process sandbox callback and sends no outbound
  email. Email and provider subject material are encrypted or keyed with staging-only secrets.
- Authentication challenges are one-use, bounded by global and identifier rate limits, and tied to
  same-origin state. Cross-owner access and challenge replay are denied.
- The account surface lists private sessions, consent/history controls, and linked wallets without
  exposing session bearers or authority hashes.

### Non-custodial wallet identity

- The browser signs a deterministic SIWE-like challenge with a synthetic EOA on Base Sepolia chain
  ID `84532`. The server verifies the local signature and never asks an RPC or wallet Provider to
  submit a transaction.
- Wallet identities can be linked, listed, used for sign-in, and revoked. Challenges are one-use,
  owner-bound, chain-bound, and request-bound.
- RITUVIA holds no private key, seed phrase, customer crypto, stored-value balance, transferable
  token, NFT, or transaction authority.

### Export and deletion

- `/en/account/privacy` provides private export and account deletion with accessible confirmation,
  error, and retry states.
- Export includes the linked wallet record and retained account-owned records while excluding
  session bearers and internal authority hashes.
- Account deletion revokes every account session, tombstones identity and wallet authority,
  destroys or replaces private ciphertext-bearing fields, removes export artifacts, records an
  auditable completion, and denies subsequent wallet sign-in.
- A second synthetic account receives `404` for the first account's wallet and export resources.

## Database and least privilege

Three additive Item 9 migrations are present in the immutable migration manifest:

| Migration                                             | Purpose                                                                 | SHA-256                                                            |
| ----------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `202608060001_recovery_wallet_identity`               | Durable wallet identity, challenge, event, ownership, and deletion RLS. | `1e34d473473eaddb5d69cc271f24d72858f949489e7779b9c7f8c8666c9c4fa5` |
| `202608060002_recovery_wallet_challenge_deletion_rls` | Tightens challenge deletion visibility and write checks.                | `b8aa0f1bf9b7d5899ebc113f46b1f529aea0470b80e70fe0f626d855cded46c5` |
| `202608060003_recovery_privacy_deletion_dependencies` | Applies subject-scoped RLS to reminder cancellation during deletion.    | `49b8aae44af5e124c6ce6e2f2b7959e6bb9a61e8b448160b8a89bcc8de673b16` |

The existing Free Neon resource `rituvia-recovery-staging` was connected only to Vercel
`development` with prefix `RITUVIA_ITEM9_ADMIN_`. The administrator URL stayed in a mode `0600`
temporary file. The exact Node `24.18.0` configuration script applied all `35` migrations, rotated
`rituvia_privacy_deletion`, and attested that both application and deletion roles are non-superuser,
cannot create databases or roles, cannot replicate, cannot bypass RLS, and are not members of each
other. The resource was disconnected after each bounded operation and the administrator file was
deleted.

Real staging probes found and closed three fail-closed least-privilege gaps without reading customer
rows:

1. Identity writes were denied until the exact account, challenge, rate-limit, session, and wallet
   grants were applied to `rituvia_app`.
2. Export reads were denied until exact `SELECT` grants were applied to the ten relations used by
   the existing export snapshot: astrology calculation, birth profile, commerce order/line,
   interpretation verification, ledger entry, payment attempt/event, and reminder
   operation/subscription.
3. Deletion returned `503` because `rituvia_privacy_deletion` could not connect to database
   `neondb`; a direct non-executing permission probe returned SQLSTATE `42501`. The final script
   grants only `CONNECT` on that exact database and attests it before commit.

No `GRANT ALL`, role/database creation, production connection, production data, destructive
migration, backup deletion, or unrestricted database membership was used.

## Staging environment boundary

The 15 Item 9 settings were written only to Vercel custom environment `staging`
(`env_IpAngjZlPXtMM1A5GGuYDCAGZF66`):

`RITUVIA_ACCOUNT_SESSION_TTL_SECONDS`, `RITUVIA_AUTH_CHALLENGE_TTL_SECONDS`,
`RITUVIA_AUTH_DATA_KEY_V1`, `RITUVIA_AUTH_START_GLOBAL_LIMIT`,
`RITUVIA_AUTH_START_IDENTIFIER_LIMIT`, `RITUVIA_AUTH_START_WINDOW_SECONDS`,
`RITUVIA_AUTH_SUBJECT_HMAC_KEY_V1`, `RITUVIA_PRIVACY_DELETION_RECENT_AUTH_SECONDS`,
`RITUVIA_PRIVACY_DELETION_REQUEST_WINDOW_SECONDS`,
`RITUVIA_PRIVACY_DELETION_ROLE_PASSWORD`, `RITUVIA_PRIVACY_EXPORT_KEY_V1`,
`RITUVIA_PRIVACY_EXPORT_RECENT_AUTH_SECONDS`,
`RITUVIA_PRIVACY_EXPORT_REQUEST_WINDOW_SECONDS`, `RITUVIA_PRIVACY_EXPORT_TTL_SECONDS`, and
`RITUVIA_RECOVERY_IDENTITY_SANDBOX`.

Values are intentionally absent from Git and this evidence. Preview and Production were not
targeted. The identity sandbox, wallet verifier, export, and deletion all fail closed outside the
exact recovery Staging boundary.

## Source and deployment identity

- Recovery baseline: `f79fee6713670fdc12b33dd3182569a942782636`.
- Item 9 implementation commit: `b35e01dad69292de05b237241ec54c09e13ade44`.
- Initial staging-role configuration commit: `36e4ac49c660a3cf8a4d927595f4a5746ce4e7ac`.
- Accepted application deployment/source commit:
  `808342544c2f8ea8e9fb593f47937e51211482b1`.
- Final database-connect role configuration commit:
  `db4cd1bd5fdc26f8f85551deeaeb40470098cb9b`.
- Accepted deployment: `dpl_92w16KNvvZDfC7QhFNb45GLrHy6u`.
- Unique protected URL:
  `https://rituvia-founder-acceptance-recovery-2wz131lzr.vercel.app/recovery`.
- Stable protected Owner URL:
  `https://rituvia-founder-acceptance-recovery-cptm-111-s-projects.vercel.app/recovery`.
- Vercel project: `prj_UzHHiLzjdPcf8DsJuCHYiDBVWs63`.
- Vercel team: `team_f6TQU7mloG5OnQGNmtXwFkOi`.
- Vercel reports `READY`; CLI inspection reports target `staging`; the build used pnpm `11.13.1`,
  completed all `14` package tasks, generated `62` routes, and reused one `iad1` runtime region.
- The project remains Vercel-login protected with no production/custom domain. The stable alias is
  Vercel-managed and was not a DNS change.
- Deployment metadata SHA-256 values are
  `a6c40f58668fc217095b03f36c88891651d1a5e476e3e64f6b571ceb36a25393` and
  `51fedc75236438cf67e174510bde2e6cdd03d52c0612b69ad5152410a2d3f85e`.

A Vercel-generated 23-hour share URL was used only to bootstrap the zero-mock browser session. It
was never committed or recorded here. Immediately after the accepted run, the local share URL,
`_vercel_jwt` storage state, Vercel CLI temporary authorization, Item 9 secret source, Neon
administrator URL, debug cookies, and related temporary credential files were deleted. Login
protection remains enabled.

## Automated verification

All applicable local checks used exact Node `24.18.0` and pnpm `11.13.1`.

| Gate                         | Result                                                                                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Focused implementation tests | PASS; 12 focused files and 341 tests across wallet, identity, ownership, privacy, proxy, configuration, and runtime truth.           |
| Database suites              | PASS; migrations, wallet identity, export, deletion, backup/restore-compatible paths, replay, concurrency, RLS, and least privilege. |
| Migration policy             | PASS; 36 immutable migration files, including the three Item 9 migrations.                                                           |
| Format, lint, typecheck      | PASS for the affected database, Web, configuration, and browser-verifier slice.                                                      |
| Secret policy                | PASS across 1,133 tracked/unignored files.                                                                                           |
| Local production build       | PASS; all workspace packages and 62 Next.js routes.                                                                                  |
| Vercel custom Staging build  | PASS; 14/14 package tasks and 62 routes.                                                                                             |
| Local zero-mock Chromium     | PASS; desktop/mobile identity, wallet, export, deletion, ownership, and accessibility.                                               |
| Hosted zero-mock Chromium    | PASS; exact source SHA, desktop/mobile, real database, no mocked fulfillment, no Provider AI, and no external product request.       |

Existing unrelated root configuration-boundary, shell-policy, and RTL checks remain recorded
outside Item 9. They were not weakened or repaired in this run.

## Browser evidence

The accepted hosted artifact remains private and outside Git at
`/private/tmp/rituvia-item9-hosted-browser/2026-08-07T02-31-17-458Z/`.

| Artifact                       | SHA-256                                                            |
| ------------------------------ | ------------------------------------------------------------------ |
| `evidence.json`                | `426997b982957a6fa3ef6e1e62acd487d9b11b9911bfc6ef16befdcbd8aa3203` |
| `account-wallet-desktop.png`   | `af2b4a7227904c9d6d5c9159a286995cdadf4ead35e8ee3197f28f954830ecae` |
| `account-no-wallet-mobile.png` | `d57e8bd4400dcd0ba16dc4af305aec113c7b47f8316a7998cf99f1fce3ae4799` |
| Private export package         | `ecba10cd3582aa16680b24ac86eec62b3af58f7b47ef05c4345cfd18a03d191b` |

The evidence records source `808342544c2f8ea8e9fb593f47937e51211482b1`, protected Staging,
desktop width `1440`, mobile width `390`, `200` real browser requests, zero mocked fulfillment,
zero external product request, zero Provider AI request, cross-owner wallet/export `404`, wallet
chain `84532`, one deleted wallet, and two revoked account sessions. Axe, page-error, sensitive
browser-storage, and unexpected console assertions pass. A post-deletion wallet sign-in receives
the expected bounded `400` and grants no authority.

## Cost, rollback, and preservation

- The existing Vercel Pro project, custom Staging, Free Neon resource, login protection, and one
  `iad1` region were reused. No paid Provider, object storage, domain, extra region, always-on
  runtime, real email, chain transaction, or payment service was added.
- Migration `202608060003` is additive and rolling-compatible. A rollback would require explicit
  Owner review before dropping its two policies and disabling reminder-table RLS; the safer path is
  a forward fix. No rollback was executed.
- Database backup/restore must preserve the three Item 9 migrations, RLS policies, role grants, and
  deletion audit rows. Role passwords remain external secrets and must be re-injected after a
  credential-only restore.
- The accepted app deployment can be replaced by a prior protected Staging deployment without
  touching Production, but database schema/history must not be rewritten or deleted.
- The original worktree remains required to retain committed HEAD
  `6c0698b88dffce3535bac1e9f1cd9d6b3528062c` and exactly 243 staged files. Final invariance is
  repeated before the Item 9 evidence commit.
- Recovery still descends from `f79fee6713670fdc12b33dd3182569a942782636`. No original history,
  archive, payment record/history, production resource, DNS, or license was changed. The repository
  remains `AGPL-3.0-only`.

## Direct Owner test

1. Sign in to the authorized Vercel team and open the stable protected Owner URL above.
2. On `/recovery`, confirm Item `9`, environment `staging`, source `808342544c2f...`, baseline
   `f79fee671367...`, identity sandbox `enabled`, privacy controls `enabled`, and Providers
   `disabled`.
3. Open `/en/sign-in`, use a fresh `@example.test` sandbox email, and complete the displayed local
   sandbox link. Confirm no email is sent.
4. On `/en/account`, link a fresh Base Sepolia EOA. Confirm chain `84532`, visible address, no seed
   phrase/private-key request, no transaction prompt, and no balance/custody claim.
5. Sign out, use “Sign in with a linked wallet,” sign the one-use challenge, and confirm the same
   account opens. Reuse or alter the challenge and confirm authority is denied.
6. Open `/en/account/privacy`, request and download an export. Confirm account, session metadata,
   and wallet appear while session bearer and internal hashes do not.
7. In a second sandbox account, attempt the first account's wallet and export resource URLs and
   confirm `404`.
8. Return to the first account, choose “Delete account and data,” accept the confirmation, and
   confirm the completion message. Confirm every session is revoked and wallet sign-in now fails.
9. Repeat the account, wallet, export, and deletion surfaces at desktop and approximately
   390-pixel mobile width with keyboard and touch. Stop on cross-owner access, replay, private-data
   leak, custody behavior, outbound email, external Provider request, deletion ambiguity,
   accessibility failure, or source-SHA mismatch.

## Remaining authority

Item 9 is complete for protected Staging. Item 10 is dependency-ready but remains unapproved and
unstarted. Production, DNS, real funds, public release, live Stripe, Credits/Plus activation,
Provider AI, USDC/Base sandbox, and unrestricted public service remain separate Owner gates.

**STOP — NO RECOVERY ITEM 10 STARTED.**
