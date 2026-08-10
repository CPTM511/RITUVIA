# Recovery Item 11 — USDC/Base Sandbox and Provider AI Evidence

> Date: 2026-08-10
>
> Status: **BLOCKED — PROVIDER AI ACCEPTED; COINBASE BUSINESS CHECKOUT ENTITLEMENT MISSING**

## Scope and authority

The Owner explicitly approved Recovery Item 11 and the bounded Protected Staging database,
Vercel, Stripe Test, Coinbase Sandbox webhook, Provider AI, temporary-credential, and credential
rotation operations used below.

This item remains limited to the existing Vercel-authenticated custom Staging. It does not
authorize Production, DNS, public release, real funds or assets, custody, unrestricted AI,
Coinbase Business onboarding, merchant activation, or Recovery Item 12.

Founder Journey coverage:

- FJ-16 and FJ-17: accepted in Protected Staging.
- FJ-15: blocked before hosted checkout because the Coinbase account lacks Coinbase Business
  Checkout entitlement.

## First before-state reproduction

Before Item 11 edits, exact committed source
`de1fff126c49956422191baf3f86e0fc969ba387` retained Items 1–10 but kept crypto and Provider AI
safe-off.

| Artifact               | Result                                                                             | SHA-256                                                            |
| ---------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `baseline.txt`         | Clean branch, exact Node `24.18.0`, pnpm `11.13.1`, and source identity captured.  | `85649c3ce04caef8f9a34c583d008d40e48145f13798bd73a1d41acd02c31f74` |
| `runtime-safe-off.txt` | Crypto catalog had no asset or route; interpretation runtime returned unavailable. | `69dd78dac204b76cfaf78c00967100778b9ca355817517eda0aa6275f23905b4` |
| `focused-tests.txt`    | Existing affected contracts passed: 9 files and 160 tests.                         | `e46cee3695abef76cd2ab5512b18b36ba855b7a2400143fff0db939b3e7cc92f` |

The before-state capture remains private and outside Git at
`/private/tmp/rituvia-item11-before/`.

## Implemented protected slice

### Hosted crypto boundary

- The provider adapter is fixed to Coinbase Business Sandbox at
  `https://business.coinbase.com/sandbox/api/v1/checkouts`.
- The server-owned settlement quote is fixed to asset `USDC` and network `base`; the client cannot
  select an asset, network, recipient, or wallet.
- Checkout is redirect-only and non-custodial. RITUVIA does not request, receive, store, or sign
  with a customer private key and does not create a customer crypto balance.
- Checkout creation, return, and signed webhook handling are isolated behind provider-neutral
  payment contracts. A return URL alone grants no value.
- Coinbase webhook subscriptions cover the five checkout success, failure, expiry, and refund
  event types. Signature verification uses the rotated Sandbox webhook secret.

The adapter and route contracts pass locally, but the real Coinbase Sandbox checkout request
returns `403` from Coinbase and the application correctly converts that unavailable provider state
to `503` without granting value. Coinbase's official Business documentation states that Checkout
APIs require a Coinbase Business account. API-key scope changes do not supply that account
entitlement.

### Bounded Provider AI

- Only the fixed synthetic `Lantern` fact and curated secular-reflection content are sent. No user
  question, journal, intention, birth data, or other private prose is accepted by this route.
- Vercel AI Gateway uses verified Vercel OIDC for the exact protected project/team and no static AI
  provider key.
- The model is fixed to `openai/gpt-5.4-nano`, model version `2026.3.17`, prompt version `1.0.2`,
  output schema version `1.0.4`, maximum 384 output tokens, 8-second timeout, maximum estimated cost
  25,000 micros, and three accepted generations per account per UTC day.
- Deterministic facts are server-calculated. The model may explain only supplied facts and must
  return strict JSON with exact boundary, reflection-question, symbol, certainty, and safety
  constants.
- Pre-generation and post-generation safety are fail-closed. Timeout, malformed, over-cost, or
  unsafe output returns a deterministic fallback and releases the reservation without consuming a
  Credit.
- Successful generation reserves one Credit, consumes it exactly once after schema and safety
  acceptance, and preserves idempotent replay. Reconciliation counts the reservation debit once;
  the later `consume` evidence row does not debit the balance again.

### Database and least privilege

No schema migration was required. Existing additive Item 10 tables support the Item 11 reservation
and append-only evidence records.

The existing Free Neon staging resource was temporarily connected only to Vercel `development`
with an isolated Item 11 prefix. Node `24.18.0` configured and rotated only the
`rituvia_ai_generation` login role. Runtime attestation requires that exact role and rejects
superuser, create-database, create-role, replication, bypass-RLS, inherited administrator, payment
webhook, and unrelated private-content privileges.

The staging role/configuration scripts have these SHA-256 values:

| Script                                       | SHA-256                                                            |
| -------------------------------------------- | ------------------------------------------------------------------ |
| `configure-recovery-item-11-staging.mjs`     | `a4f37dd2988bb792a043ff37a0d9e214eb9f47b86820fa83f9d0b44516a0a617` |
| `repair-recovery-item-11-country-policy.mjs` | `542c34ed47b4af834bbf2195d53857eb6bc047da0eb714820af7d4b312f58db8` |
| `verify-recovery-item-11-ai-credits.ts`      | `d4d2c326aa93c462336b66cdc1b9e99ee0675d88aedcf26bbf51e235ddad2ccc` |

Neon was disconnected after the bounded operations. No Production connection, destructive
migration, backup deletion, payment-history rewrite, or `GRANT ALL` occurred.

## Defects found and closed

The bounded staging run found and closed these Item 11 defects without expanding scope:

1. Coinbase Sandbox Ed25519 credentials required exact CDP JWT signing and strict sandbox URL
   binding.
2. The catalog and country-policy reader selected an older valid version instead of the
   superseding Item 11 head.
3. Policy ordering briefly allowed the generic disabled rule to shadow the approved staging rule.
4. Vercel AI Gateway structured-output compatibility required complete JSON Schema handling and
   exact request/response normalization.
5. The model could satisfy a broad schema while paraphrasing safety-critical text. Schema version
   `1.0.4` now uses exact constants and post-generation verification.
6. Credit reconciliation counted both `reserve` and `consume` as debits. The accepted projection
   counts only the reservation debit and treats `consume` as settlement evidence.
7. Vercel Turbo remote cache could replay the Web build without materializing native astrology
   metadata. The accepted deployment used one forced no-cache build; no runtime code was weakened.
8. Diagnostic output exposed two temporary Vercel bypass values. Both were rotated and revoked.
   Stripe Test and Coinbase Sandbox webhook URLs were moved to a third sealed token before the old
   tokens were revoked.

The remaining Coinbase Business entitlement blocker was not repaired or bypassed.

## Automated verification

All local product checks used exact Node `24.18.0` and pnpm `11.13.1`.

| Gate                        | Result                                                                                                                                                                                            |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Format and lint             | PASS for the affected Web, database, AI, payment, configuration, policy, and verifier slice.                                                                                                      |
| Type checking               | PASS for Web and database packages.                                                                                                                                                               |
| Focused tests               | PASS; 3 focused files and 18 tests for Provider AI, transport, and Coinbase boundaries.                                                                                                           |
| Real AI Gateway probe       | PASS; HTTP `200`, `finishReason=stop`, strict parser PASS, post-safety PASS, 532 prompt and 212 completion tokens.                                                                                |
| Vercel custom Staging build | PASS; 14/14 build tasks from exact application source.                                                                                                                                            |
| Readiness                   | PASS; HTTP `200`, `status=ready`, environment `staging`, Item `11`, Production providers disabled.                                                                                                |
| Hosted zero-mock browser    | PARTIAL PASS; real email sandbox, age gate, Stripe Test, signed six-Credit grant, real Provider AI, one-Credit consumption, reconciliation, desktop/mobile, Axe, layout, and touch checks passed. |
| Coinbase hosted checkout    | BLOCKED; Coinbase returned `403`, application returned expected `503`, and no value or entitlement was granted.                                                                                   |
| Local PostgreSQL rerun      | BLOCKED by local macOS System V shared-memory exhaustion; no shared-memory segment was removed. Real staging persistence and reconciliation passed.                                               |

No model response, raw private prompt, provider secret, API key, Cookie, share URL, or bypass token
is committed or retained in the evidence package.

## Browser evidence

The accepted partial browser artifact remains outside Git at
`/private/tmp/rituvia-item11-hosted-browser-5ffe98e/2026-08-10T14-02-39-752Z/`.

| Artifact                   | SHA-256                                                            |
| -------------------------- | ------------------------------------------------------------------ |
| `provider-ai-desktop.png`  | `a7636127364b5450506fec463e0521c9caa09d62060131da5060da97658a93ea` |
| `item11-mobile.png`        | `15f66dfa775882b5d58d4fc3aaa9cec66398624e79af9644a25abba46c4b5634` |
| `provider-ai-outcome.json` | `9ef89cb996761fdcd89ff7065153c19ec86307aa87c24912440ac6e955c290ca` |

The outcome records a generated result, `creditConsumed=true`, and no fallback reason. The browser
run then stopped at the real Coinbase checkout `503`; it did not mock or bypass the provider.

## Source and deployment identity

- Recovery baseline: `f79fee6713670fdc12b33dd3182569a942782636`.
- Item 11 before-state: `de1fff126c49956422191baf3f86e0fc969ba387`.
- Item 11 foundation: `4e5a710fe69b66fcc44a5e1781ffd482af33a191`.
- Accepted application source: `5ffe98ef735d4031933873d4e443c8b74a34c677`.
- Accepted protected deployment: `dpl_GPxxRoDU6Hc5KFBXZh2Cb48dqJx2`.
- Unique protected URL:
  `https://rituvia-founder-acceptance-recovery-id2e8d2ul.vercel.app/recovery`.
- Stable protected Owner URL:
  `https://rituvia-founder-acceptance-recovery-cptm-111-s-projects.vercel.app/recovery`.
- Vercel custom environment: `staging` / `env_IpAngjZlPXtMM1A5GGuYDCAGZF66`.

Vercel reports `READY`, target `staging`, exact source SHA, no Production deployment or domain,
login protection, one `iad1` runtime region, and readiness HTTP `200`. Git automatic deployment
remains disabled.

## Webhook and credential closure

- Stripe endpoint `we_1U1qKLA7fXKJimDaVSPJtI6b` remains `livemode=false`, `status=enabled`, and
  points only to the protected Staging Stripe webhook path.
- Coinbase Sandbox subscription `506dcd61-e00e-4774-a153-3174b1c151b8` remains enabled with exactly
  five checkout event types and the protected Staging Coinbase webhook path.
- The two superseded Coinbase subscriptions were deleted after the replacement secret was live.
- Exactly one Vercel Automation Bypass remains, `isEnvVar=true`, with SHA-256
  `45cf54e7bb7877cab28e1a10836eeb465eb6a187ae4e2e9ac1d00954f287ea13`.
- Exposed bypass SHA-256 values
  `e8fe76cc2cced26d58d206c97f1fa1d6a3c0b05ebd7159457a32b8a9775aa9b4` and
  `ffa11fb8eab44a24f35f189103e1cde0cfb97808a5fa28504e8765b1f8d26ec8` were revoked.
- Stripe and Neon Marketplace resources are disconnected from every project.
- Temporary environment files, provider keys, webhook secrets, bypass values, share URLs, Cookie
  state, raw provider responses, and diagnostic files were securely overwritten and deleted.

The final sanitized evidence package remains private at
`/private/tmp/rituvia-item11-evidence/`. Its `SHA256SUMS` file covers deployment, readiness,
webhook, entitlement, bypass, resource-disconnection, and official-document summaries.

## Remaining blocker and owner decision

Item 11 is not complete because FJ-15 requires a real hosted Coinbase Sandbox checkout and the
current account has no Coinbase Business Checkout entitlement.

Recommended decision: keep Item 11 **Blocked** and retain the current safe protected staging until
the Owner separately decides whether to complete Coinbase Business onboarding/KYC and request
Checkout access. That future action is a payment-provider onboarding/activation Owner Gate and is
not implied by this Item 11 approval.

Alternative: explicitly remove FJ-15 from Item 11 through a new governance decision. Do not treat
the passing webhook API or Provider AI evidence as equivalent to hosted checkout acceptance.

## Direct Owner test

1. Sign in to the authorized Vercel team and open the stable protected Owner URL above.
2. Confirm Item `11`, environment `staging`, source `5ffe98ef735d...`, Coinbase Sandbox and Provider
   AI enabled, and Production providers disabled.
3. Use `/en/sign-in` with a fresh `@example.test` address and save the explicit 18+ paid
   eligibility on `/en/account`.
4. On `/en/plans`, complete **6 Credits** through Stripe Test using `4242 4242 4242 4242`, future
   expiry `12/34`, CVC `123`, and postal code `94107`. Confirm billing shows six Credits and a
   reconciled ledger.
5. On `/en/plans`, select **Use 1 Credit for synthetic Provider AI**. Confirm the disclosure says no
   private question or journal is sent, the structured Lantern reflection appears, one Credit is
   consumed only after safety acceptance, and billing reconciles to five available Credits.
6. Repeat the plans and AI result surfaces near 390-pixel width with keyboard and touch.
7. Select **Continue to Coinbase USDC/Base Sandbox** only to reproduce the known blocker. Confirm
   the product reports that Test Checkout could not be created and that nothing was charged or
   granted. Do not use real assets or attempt Coinbase Business onboarding under this approval.

**STOP — NO RECOVERY ITEM 12 STARTED.**
