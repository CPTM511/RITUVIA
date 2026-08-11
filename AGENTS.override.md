# Founder Acceptance Recovery Override

> Status: **ACTIVE**
>
> Authority: explicit Owner approval on 2026-08-04 of the 2026-08-03 Founder Acceptance Recovery
> decision. This override controls recovery work until the Owner explicitly amends or retires it.

## Approved recovery authority

1. The repository remains **NO-GO** for production, DNS changes, real funds, unrestricted public
   release, and production Provider activation.
2. Within protected staging only, the 2026-08-03 Founder Acceptance Recovery decision supersedes
   D-097's narrower product-scope restrictions. D-097's safety, privacy, Provider-safe-off,
   production, real-funds, DNS, legal, payment-activation, and Owner gates remain in force.
3. `f79fee6713670fdc12b33dd3182569a942782636` is the recovery baseline.
4. The original 243-file staged snapshot is archival evidence only. Do not merge, reset, rewrite,
   delete, or selectively alter that preserved state without a later explicit recovery-item approval.
5. Keep AGPL-3.0-only unchanged. This does not settle the separate long-term commercial-license
   gate for unrestricted public service.
6. The Owner's 2026-08-10 amendment excludes FJ-15 from the current recovery acceptance and
   directs Codex not to execute hosted crypto checkout during Item 12. This is not a permanent
   product removal: non-custodial crypto payment remains a future option behind separate Owner,
   Provider, legal, security, sandbox, production, and real-value approvals. Existing Coinbase
   Sandbox code and configuration remain safe-off evidence only.

## Queue override

`docs/recovery/RECOVERY_BACKLOG.md` is the sole recovery queue. Legacy `BACKLOG.md` Ready state,
RIT-169, commercial expansion, SEO/GEO expansion, additional localization, Node 26 adoption, and
speculative work do not authorize execution during recovery.

Recovery Items 1 through 11 are closed under their recorded evidence and the explicit FJ-15
exclusion. Item 12 was explicitly approved on 2026-08-10. On 2026-08-11 the Owner first approved
only three architecture remediations and then separately approved the single recorded RTL
remediation, each with a new before-state rerun. The architecture and RTL policies now pass. The
latest rerun stopped in the mandatory unit matrix because two unchanged contract test files report
five failures against the existing recovery configuration and Web shell. Item 12 remains Blocked
and requires a later explicit Owner instruction before those contract failures may be remediated or
Item 12 rerun. Nothing in this file authorizes a later product item, production, DNS, public
release, live payments, real crypto, or Provider activation.

## Required operating loop

For every later recovery run:

1. Confirm the current branch descends from the approved recovery baseline and does not include the
   archived 243-file snapshot commit.
2. Execute exactly one explicitly Owner-approved Recovery Item.
3. Reproduce the item's recorded before-state before editing.
4. Implement only the smallest complete vertical slice allowed by that item.
5. Run the item's required automated, desktop/mobile browser, staging, security, privacy, restore,
   and rollback checks.
6. For Items 3–12, update the same protected staging environment and provide a clickable Owner URL
   with exact direct test steps.
7. Stop after the selected item. Do not promote or begin the next item automatically.

## Preserved hard gates

Protected staging must be allowlisted, noindex, isolated, reversible, source-SHA-visible, and
safe-off for production Providers and real value. Staging evidence is never production approval.

Explicit Owner approval remains required for production deployment, DNS, public launch, live
payments, real crypto, production AI with private content, production email, legal/policy changes,
country or locale launch, price/tax/refund decisions, destructive migration, production data
mutation, secret rotation, and irreversible infrastructure actions.

## STOP conditions

Stop immediately on any scope ambiguity, archived-state mutation, unexpected product-code diff,
license change, staging/public boundary failure, missing Owner approval, Critical/High security
finding, private-data leak, real-value path, or inability to prove rollback.

## Rollback

Rollback of this governance activation means reverting only the recovery-governance commit or
retiring this override through a later Owner decision. Never roll back by rewriting history or
deleting the archive, migrations, records, payment history, bundle, patches, or checksums.
