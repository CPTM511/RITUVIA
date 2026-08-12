# Recovery Item 10 — Credits, Stripe Test and Plus Evidence

> Date: 2026-08-08
>
> Status: **COMPLETE — PROTECTED STAGING READY FOR OWNER REVIEW**

## Scope and authority

The Owner explicitly approved Recovery Item 10 after Item 9 closed, then approved the bounded
Protected Staging database, Vercel, Stripe Test, replacement-webhook, corrective-commit, and exact
SHA deployment operations used below.

This item activates only account-bound Test Mode checkout, signed webhook fulfillment, Credits,
and Plus in the existing Vercel-authenticated custom Staging. It does not activate live Stripe,
real funds, payout, Production, DNS, public indexing, public release, production Provider AI,
USDC/Base sandbox, Recovery Item 11, or any unrestricted service.

Founder Journey coverage: FJ-10, FJ-11, FJ-12, FJ-13, FJ-14, and FJ-20.

## First before-state reproduction

Before Item 10 edits, exact committed source `c68fd6fe4846fde33749d47c85697f121b163463`
retained Items 1–9 but did not expose the Item 10 plans, billing, or order surfaces.

| Artifact            | Result                                                                                           | SHA-256                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `manifest.txt`      | `/en/plans`, `/en/account/billing`, and `/en/account/orders` were absent; checkout return existed. | `728da71adad66bc6a4c2e37fc9bc9a8d54eaf3dc40ec549f94d53fae73248df9` |
| `focused-tests.log` | Existing payment/country-policy/configuration contracts passed: 10 files and 57 tests.           | `3b6d21ce58b09786138f97522cc2b92b3efb4c4b1286cb4a6b7c511370b7c364` |
| `focused-tests.exit` | Before-state focused suite exited `0`.                                                           | `1e82769c65a0e5202ea7cb22dfb42512f577d83b676c9c60fe9068dac3565db0` |

The before-state capture remains private and outside Git at `/private/tmp/rituvia-item10-before/`.

## Implemented protected slice

### Test-only checkout and account surfaces

- `/en/plans` renders the server-owned protected-Staging catalog for the approved `pack_6` and
  `plus_monthly` acceptance paths and redirects only to `https://checkout.stripe.com/` Test Mode.
- `/en/checkout/return` never grants value. It reports pending until the server has persisted a
  signed provider event, then reports verified access.
- `/en/account/billing` shows purchased, Plus, reserved, and total Credits, the append-only ledger,
  Plus state and period, and a reconciliation result.
- `/en/account/orders` shows account-owned order state and whether verified fulfillment occurred.
- Signed-in users must save explicit 18+ paid eligibility before checkout. Anonymous, cross-owner,
  missing-CSRF, invalid-country, and non-Staging attempts fail closed.

### Signed fulfillment and exactly-once value

- Stripe raw request bytes are verified with the Staging webhook secret before parsing or
  persistence. JSON and the exact Stripe `application/json; charset=utf-8` media form are accepted;
  other content types remain denied.
- Checkout success redirects, client state, and unsigned or mismatched events grant nothing.
- Duplicate, conflicting, replayed, and out-of-order events retain immutable evidence and follow a
  deterministic timeline. Ledger and entitlement changes occur in the same Serializable database
  transaction as order processing.
- Credit-pack grants now also enforce an order-scoped existing-grant check while the order lock is
  held. This prevents distinct same-timestamp Stripe `payment_intent` and `checkout.session`
  success events from each granting the same Credit order when canonical event order changes.
- Stripe account attestation runs inside the serverless webhook function, so a cold function cannot
  rely on application-start instrumentation that Vercel may omit from the route bundle.

### Database and least privilege

Migration `202608070001_recovery_item_10_commerce` is additive and has SHA-256
`9121f53660a5d0a725e8819045aa70275c606506f20f2ac0d493c82c12770304`. It adds the bounded
order, payment-event, subscription, and fulfillment constraints required by this protected slice.

The existing Free Neon resource `rituvia-recovery-staging` was connected only to Vercel
`development` with isolated Item 10 prefixes. Administrator URLs stayed in mode `0600` temporary
files. Node `24.18.0` applied all 36 migration directories, seeded the approved Test catalog,
rotated `rituvia_payment_webhook`, and attested that the application and webhook roles are
non-superuser, cannot create databases or roles, cannot replicate, cannot bypass RLS, and do not
inherit administrator authority. The webhook role has only the exact commerce writes required for
verified state, Credits, subscriptions, and audit records.

Neon was disconnected after every bounded migration or read-only audit. All temporary administrator
environment files were deleted. No Production connection, Production data, destructive migration,
backup deletion, `GRANT ALL`, or payment-history rewrite occurred.

## Stripe Test and webhook lifecycle

- Only Test Mode credentials were accepted; configuration rejects `sk_live_` and rejects the
  commerce sandbox outside `APP_ENV=staging`.
- The replacement endpoint targets only the Vercel-login-protected stable Staging webhook route and
  subscribes to the nine approved payment, invoice, subscription, refund, and dispute events.
- Final post-acceptance audit shows exactly one endpoint: `we_1U1qKLA7fXKJimDaVSPJtI6b`,
  `livemode=false`, `status=enabled`, with the protected-Staging host and webhook path.
- The previous endpoint `we_1U1mZzA7fXKJimDaOaNcDnVG` was deleted only after the complete zero-mock
  desktop/mobile acceptance passed. A read-only endpoint listing then confirmed it was absent and
  the replacement remained enabled.
- The Stripe Marketplace resource was connected only to Vercel `development` for each bounded
  operation, immediately disconnected, and its temporary mode `0600` environment file deleted.

The final webhook audit is private at
`/private/tmp/rituvia-item10-stripe/post-disable-webhook-audit.json`, SHA-256
`500aebb1961c6df7ac1e2a80de370efed3009b1755abe80d7abb3c65497acefc`.

## Defects found and closed

The first real protected-Staging runs exposed fail-closed integration gaps. Each was reproduced,
fixed in the smallest bounded commit, and reverified without touching Production:

1. The browser harness did not save the existing 18+ eligibility state before paid checkout.
2. Staging lacked the exact catalog, country-policy, checkout, and least-privilege database grants.
3. Stripe rejected legal URLs that contained the Vercel protection query fragment; the shared
   adapter now preserves validated fragments.
4. Cross-origin response-body timing, checkout payment-method accordion, adaptive currency, and
   return-page semantics required current real-browser handling in the verifier.
5. A replaced webhook secret produced expected signature failures until custom Staging received the
   new secret and the exact source was redeployed.
6. Vercel serverless route bundling omitted startup instrumentation; webhook account attestation is
   now function-scoped.
7. Stripe's UTF-8 JSON media parameter was rejected by the stricter route parser; the parser now
   accepts only the exact JSON media forms required by Stripe.
8. Two distinct same-timestamp Test success events could reclassify canonical order and create two
   six-Credit grants. Commit `c2bbd107909f2ab06391a68f5e4377a7fe7e9c82` adds the order-scoped
   grant invariant and an exact regression test.
9. Vercel Toolbar CSP and `vercel.live` authentication noise is counted only by exact host/message;
   application errors remain fatal. Stripe-hosted `network-error` events are counted only while the
   page is on `checkout.stripe.com`. One expected anonymous `GET /api/v1/me` `401` is paired with
   its exact response before sign-in; any signed-in or other `401` remains fatal.

One pre-fix synthetic Staging account retains two historical six-Credit ledger rows from defect 8.
Those append-only rows, provider events, order, and payment history were deliberately not deleted,
overwritten, or corrected. Final post-fix accounts each contain one purchased six-Credit grant and
one monthly Plus eight-Credit grant. Any later compensating Staging entry requires a separate Owner
decision; this retained synthetic history does not authorize Production migration or mutation.

## Source and deployment identity

- Recovery baseline: `f79fee6713670fdc12b33dd3182569a942782636`.
- Item 10 foundation: `1d7463edff5a70ab7563f43e440b402d97bf4766`.
- Payment-role hardening: `bbd29650891074ec939acf317c28c5bd78551a2d`.
- Staging checkout completion: `8270a3e17acc285f9d78abc82ef92a758f7aa3c0`.
- Checkout-fragment fix: `5d76517ffc688d5900fe56d0fcd404e946058343`.
- Function-scoped webhook attestation: `aed8542a820ad28dac605c98b578a67a232fb3f4`.
- Stripe UTF-8 media fix: `cbac5ff16d5935300d551c72b7b1268672454f0e`.
- Accepted application source and exactly-once fix:
  `c2bbd107909f2ab06391a68f5e4377a7fe7e9c82`.
- Accepted deployment: `dpl_DDT5hLDHsxNPLLQVJjdNQUTxbkJA`.
- Unique protected URL:
  `https://rituvia-founder-acceptance-recovery-8y8if4wmk.vercel.app/recovery`.
- Stable protected Owner URL:
  `https://rituvia-founder-acceptance-recovery-cptm-111-s-projects.vercel.app/recovery`.
- Vercel custom environment: `staging` / `env_IpAngjZlPXtMM1A5GGuYDCAGZF66`.

Vercel reports `READY`, `readySubstate=STAGED`, `public=false`, no Production target, OIDC
environment `staging`, Node `24.x`, pnpm `11.13.1`, 14/14 successful build tasks, one `iad1`
runtime region, and exact Git SHA/ref metadata. Git automatic deployment remains disabled. Login
protection remains enabled, and no custom or Production domain was added.

Deployment evidence SHA-256 values are:

| Artifact                       | SHA-256                                                            |
| ------------------------------ | ------------------------------------------------------------------ |
| `c2bbd10-deployment-api.json`  | `69ae5815349a5acf65dc8961c9a68d103ebf25af2eb1762044796eaa8a96cb31` |
| `c2bbd10-readiness.json`       | `9affa67edaf68334f7855db9d146b61247e2e459a9404611261b8cb3e991a87a` |
| `c2bbd10-stable-alias-inspect.json` | `03284a3caae7ac3d5397aad24c9e0131c72ea12ab5b91ba9e8f4be4de43da7c3` |

## Automated verification

All applicable checks used exact Node `24.18.0` and pnpm `11.13.1`.

| Gate                              | Result                                                                                                               |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Focused unit and route tests      | PASS; checkout, webhook media/signature/account attestation, account projection, configuration, and adapters.        |
| Payment database suite            | PASS; all migrations/seed plus signed idempotency, same-timestamp replay, out-of-order, Plus, refund/dispute, outbox, and least privilege. |
| Same-timestamp regression          | PASS; distinct `pi`/`cs` success events produce exactly one six-Credit order grant.                                  |
| Format, lint, typecheck           | PASS for the affected Web, database, payment, configuration, and browser-verifier slice.                             |
| Vercel custom Staging build       | PASS; exact source, 14/14 tasks, Node 24, pnpm 11.13.1, one region.                                                   |
| Signed synthetic webhook probes   | PASS; JSON and UTF-8 JSON each returned `204`, used `livemode=false`, and granted no random unmatched order.          |
| Hosted zero-mock Chromium         | PASS; real Stripe Test Checkout, signed fulfillment, desktop/mobile, Axe, layout, touch targets, and safe-off checks. |
| Final read-only Neon audit        | PASS; final account has two paid orders, one purchased grant of 6, one Plus grant of 8, total 14, and four provider events. |
| Endpoint and credential cleanup   | PASS; old endpoint absent, one Test endpoint enabled, Stripe/Neon disconnected, temporary secrets and browser state deleted. |

No redirect, route mock, local payment simulation, or manual database write supplied fulfillment
in the accepted browser run. Provider AI request count was zero, no `sk_live_` appeared, and every
observed request used HTTPS.

## Browser evidence

The accepted private artifact remains outside Git at
`/private/tmp/rituvia-item10-browser-artifacts-c2bbd10-final/2026-08-08T02-17-18-247Z/`.

| Artifact              | SHA-256                                                            |
| --------------------- | ------------------------------------------------------------------ |
| `evidence.json`       | `5b68abfdadc69367fa656905ae04ed2ec30e94250b79ae1cedc6a2c017a29aac` |
| `plans-desktop.png`   | `8e2840ca2dd1e1c24db77815e8121c02d0f2d988d744d3d2a9aa848da4d31997` |
| `billing-desktop.png` | `f83840f2c5fc4ca46ff31f81667a6589bfda13f19eccafba96248e3c10285e9c` |
| `orders-mobile.png`   | `89f323d9668cd28772f37a762c5cd50e42549513228e38004e229ef6e2bd09c6` |
| `checksums.sha256`    | `81daf33cee4759e480b840fd48479f37a12956e92dd21fb4cb3ba3bdc528ccd1` |

The evidence binds source `c2bbd107909f2ab06391a68f5e4377a7fe7e9c82`, Test Mode, desktop
width `1440`, mobile width `390`, two paid orders, six purchased Credits, eight Plus Credits,
fourteen total Credits, zero mocked fulfillment, and zero Provider AI requests. Axe, layout, touch,
page-error, console-error, HTTP, live-key, and source-SHA assertions pass.

The final read-only database audit is private at
`/private/tmp/rituvia-item10-stripe/final-db-audit.json`, SHA-256
`141a7d64558ed51f5e3b54b133942e042e2dc08806813f928cb1ae853f3ef5d5`. It contains no raw
user ID, email, Stripe object ID, secret, card data, Cookie, or private reflection text.

## Cost, rollback, preservation, and cleanup

- The existing Vercel Pro project, custom Staging, Free Neon resource, login protection, Stripe Test
  resource, and one `iad1` region were reused. No extra database, region, domain, object storage,
  always-on worker, real email, live payment, payout, or paid Provider AI was added.
- The migration is additive. The safe rollback is to disable the Item 10 Staging activation and
  return the protected alias to a prior accepted deployment; do not drop schema or rewrite payment
  history. Any destructive schema rollback requires separate Owner approval.
- The replacement Stripe Test endpoint must be retained while this deployment is testable. Disabling
  it is a reversible Staging rollback but requires Owner coordination because fulfillment will stop.
- The original worktree still must preserve committed HEAD
  `6c0698b88dffce3535bac1e9f1cd9d6b3528062c` and exactly 243 staged files. No archive,
  original history, migration, record, payment history, Production resource, DNS, or license was
  deleted or rewritten. The repository remains `AGPL-3.0-only`.
- The local replacement webhook secret, Vercel bypass secret, browser Cookie jar, browser storage
  state, and all temporary Item 10 development/staging environment files were overwritten where
  supported and deleted after acceptance. Stripe and Neon Marketplace resources are disconnected.

## Direct Owner test

1. Sign in to the authorized Vercel team and open the stable protected Owner URL above.
2. On `/recovery`, confirm Item `10`, environment `staging`, source `c2bbd107909f...`, commerce
   sandbox enabled, database connected, identity/privacy enabled, and Providers disabled.
3. Open `/en/sign-in`, use a fresh `@example.test` sandbox email, complete the local sandbox sign-in,
   then save the explicit 18+ confirmation on `/en/account`.
4. Open `/en/plans`, choose **6 Credits**, and continue only to Stripe Test Checkout. Use Stripe's
   Test card `4242 4242 4242 4242`, future expiry `12/34`, CVC `123`, and postal code `94107`.
5. On return, confirm the page states that redirect alone grants nothing and waits for a signed
   event. When verified, open `/en/account/billing`; confirm Purchased `6`, Plus `0`, total `6`, and
   “Ledger and balance projection reconcile.”
6. Return to `/en/plans`, choose **Plus Monthly**, and repeat Test checkout. Confirm billing shows
   Purchased `6`, Plus `8`, total `14`, Plus Monthly `Active`, and eight Credits per verified month.
7. Open `/en/account/orders`; confirm exactly two paid orders and two “Verified fulfillment
   recorded” messages. Do not retry checkout merely because the return page is briefly pending.
8. Repeat `/en/plans`, `/en/account/billing`, and `/en/account/orders` at approximately 390-pixel
   width with keyboard and touch. Stop on real-card UI, live mode, value before signed fulfillment,
   double grant, imbalance, source mismatch, missing login protection, or accessibility failure.

## Remaining authority

Item 10 is complete for protected Staging. Item 11 remains unapproved and unstarted. Production,
DNS, real funds, public release, live Stripe, final price/tax/refund/legal decisions, USDC/Base
sandbox, Provider AI, and unrestricted public service remain separate Owner gates.

**STOP — NO RECOVERY ITEM 11 STARTED.**
