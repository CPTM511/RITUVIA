# Founder Acceptance Recovery Override

> Status: **ACTIVE**
>
> Authority: explicit Owner approvals on 2026-08-04 and 2026-08-12. D-098 controls the preserved
> recovery baseline and archive. D-099 controls production-capable implementation and activation.
> This override remains active until the Owner explicitly amends or retires it.

## Approved recovery authority

1. The Owner's 2026-08-12 instruction authorizes production-capable implementation, production
   deployment, DNS/public activation, Stripe Live Mode, and real-funds support. This removes the
   earlier internal Owner-approval prohibition; it does not make absent external facts true.
2. Production remains fail-closed until the exact deployed configuration proves the legal seller,
   launch policy, Stripe live account capability, live prices, webhook endpoint, descriptor,
   support contact, refund/terms/privacy versions, tax treatment, production database, secrets,
   source disclosure, monitoring, restore, and rollback inputs required by D-099.
3. `f79fee6713670fdc12b33dd3182569a942782636` is the recovery baseline.
4. The original 243-file staged snapshot is archival evidence only. Do not merge, reset, rewrite,
   delete, or selectively alter that preserved state without a later explicit recovery-item approval.
5. Keep AGPL-3.0-only unchanged. This does not settle the separate long-term commercial-license
   gate for unrestricted public service.
6. The Owner's 2026-08-10 amendment still excludes FJ-15 from Item 12. Non-custodial crypto remains
   a future product option, but D-099 deliberately rolls out one real-funds provider at a time:
   Stripe first, Coinbase/USDC off until a later bounded activation run.

## Queue override

`docs/recovery/RECOVERY_BACKLOG.md` is the sole recovery queue. Legacy `BACKLOG.md` Ready state,
RIT-169, commercial expansion, SEO/GEO expansion, additional localization, Node 26 adoption, and
speculative work do not authorize execution during recovery.

Recovery Items 1 through 11 are closed under their recorded evidence and the explicit FJ-15
exclusion. Item 12 remains the current mandatory recovery gate. On 2026-08-12 the Owner authorized
all remaining Item 12 repairs and reruns and separately authorized production-capable real-funds
support. Item 12 must close before any live deployment is treated as a production candidate.

D-099 permits the same run to prepare the smallest Stripe Live vertical slice after Item 12 passes.
It does not permit claiming GO, accepting traffic, or enabling purchases when a required external
fact or exact live configuration is absent. Coinbase/USDC and production AI remain disabled in
this first-provider rollout.

## Required operating loop

For every later recovery run:

1. Confirm the current branch descends from the approved recovery baseline and does not include the
   archived 243-file snapshot commit.
2. Execute Item 12 to closure, then only the D-099 Stripe Live production-enablement slice approved
   by the Owner on 2026-08-12; do not begin unrelated backlog work.
3. Reproduce the item's recorded before-state before editing.
4. Implement only the smallest complete vertical slice allowed by that item.
5. Run the item's required automated, desktop/mobile browser, staging, security, privacy, restore,
   and rollback checks.
6. For Items 3–12, update the same protected staging environment and provide a clickable Owner URL
   with exact direct test steps.
7. Stop on the first failed mandatory gate. Do not begin unrelated backlog work automatically.

## Preserved hard gates

Protected staging remains allowlisted, noindex, isolated, reversible, source-SHA-visible, and
separate from production. Staging evidence is never evidence of a live transaction.

The 2026-08-12 Owner instruction satisfies the internal approval gate for the D-099 Stripe-first
scope. Safety, privacy, payment correctness, provider terms, least privilege, source disclosure,
country policy, legal truthfulness, backup/restore, rollback, and no-secret-in-source rules remain
mandatory. Destructive or irreversible action is still forbidden when a reversible path exists.
Missing external credentials, provider capability, entity particulars, policy versions, or other
factual launch inputs must close checkout rather than be guessed or replaced with placeholders.

## STOP conditions

Stop immediately on archived-state mutation, license change, environment mixing, Critical/High
security finding, private-data leak, provider-mode mismatch, inability to prove idempotency,
reconciliation, restore or rollback, or any missing/failing factual production prerequisite. A
real-value path is permitted only after all D-099 gates pass and must use Stripe-hosted Checkout;
RITUVIA must never handle raw card data.

## Rollback

Rollback of this governance activation means reverting only the recovery-governance commit or
retiring this override through a later Owner decision. Never roll back by rewriting history or
deleting the archive, migrations, records, payment history, bundle, patches, or checksums.
