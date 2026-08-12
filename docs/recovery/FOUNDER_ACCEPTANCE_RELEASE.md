# Founder Acceptance Release Specification

> Status: **ACTIVE FOR RECOVERY GOVERNANCE**
>
> Release status: **NO-GO**. Owner approval authorizes this specification and recovery planning
> only. Product code, protected-staging deployment, Provider activation, production, DNS, real
> funds, and public release require later explicit approval.

## Approved scope

The 2026-08-03 Founder Acceptance Recovery decision supersedes D-097 only for the product scope
that may eventually be evaluated inside protected staging. It does not weaken or supersede D-097's
safety, privacy, Provider-safe-off, production, real-funds, DNS, legal, payment-activation, or Owner
approval gates.

Recovery uses `f79fee6713670fdc12b33dd3182569a942782636` as its baseline. The archived 243-file
snapshot is preserved intact as evidence and a possible source for later bounded reconstruction,
not as a branch to merge.

## Founder Journey IDs

| ID | Founder-visible journey |
| --- | --- |
| FJ-00 | Open the exact protected-staging build, verify source SHA/environment identity, and follow direct test steps. |
| FJ-01 | Anonymous one-card reflection. |
| FJ-02 | Anonymous three-card reflection. |
| FJ-03 | Numerology calculation and transparent result. |
| FJ-04 | Exact-time natal astrology calculation and interpretation. |
| FJ-05 | Approximate/unknown-time astrology with explicit uncertainty. |
| FJ-06 | Reading → intention → small action → free ritual → private reflection → revisit. |
| FJ-07 | Email-sandbox sign-in and retained history. |
| FJ-08 | Wallet sign-in without custody or stored value. |
| FJ-09 | Account, history, sessions, consent, settings, export, and deletion controls. |
| FJ-10 | Stripe Test purchase of an Owner-approved staging SKU. |
| FJ-11 | Signed, replay-safe Stripe Test webhook fulfillment. |
| FJ-12 | Checkout return cannot grant value before verified fulfillment. |
| FJ-13 | Credits/entitlement display and bounded staging consumption. |
| FJ-14 | Plus Test start, state display, cancellation, and renewal boundary. |
| FJ-15 | **Owner-excluded from this recovery acceptance on 2026-08-10.** Hosted non-custodial crypto checkout remains a future option behind new sandbox, Provider, legal, security, production, and real-value approvals. |
| FJ-16 | Provider AI staging interpretation with disclosure, safety, and bounded usage. |
| FJ-17 | Provider failure, timeout, safety block, and value rollback. |
| FJ-18 | Private data export. |
| FJ-19 | Private data deletion and session revocation. |
| FJ-20 | Refund, dispute, reconciliation, and audit evidence in test mode. |

## Evidence levels

1. **Designed:** specification or UX contract exists; no runtime claim.
2. **Locally verified:** exact-source deterministic checks and non-mocked local browser evidence pass.
3. **Protected-staging verified:** the same source SHA passes in the allowlisted staging system.
4. **Founder accepted:** the Owner executes direct steps and records acceptance or discrepancies.
5. **Production candidate:** separately nominated after all security, restore, source/license,
   legal, Provider, and Owner gates. No current SHA has this status.

No lower level implies a higher one.

## Protected-staging sequencing

Recovery Item 3, if separately approved, creates the single protected-staging foundation. Items
3–12 must update that same environment after their own gates pass. Every update must provide:

- one clickable Owner URL;
- immutable source commit and visible environment/build identity;
- adult allowlist, noindex, isolated data/storage, safe-off production Providers, no real funds,
  least-privilege secrets, private-log redaction, backup/restore evidence, and tested rollback;
- exact desktop and mobile test steps, expected results, exclusions, and STOP conditions;
- an evidence manifest linked to the Recovery Item and Founder Journey IDs.

Protected staging is evidence infrastructure, not production authorization. This Prompt B step
does not create or deploy it.

## Founder Acceptance gate

The release remains NO-GO until Recovery Item 12 proves all mandatory in-scope journeys, source
disclosure, dependency/license disclosure, security, privacy, payment-test integrity, AI safety,
database restore, rollback, accessibility, desktop/mobile behavior, and explicit Owner acceptance.
FJ-15 is the one explicit Owner-approved exclusion and must not be executed during Item 12. Its
exclusion does not authorize removing the safe-off adapter or claiming crypto checkout acceptance.

Even after Item 12, production deployment, DNS, unrestricted public service, live Stripe, real
crypto, production AI with private content, production email, legal activation, and irreversible
production migration require separate Owner approvals.

## Prompt B step-1 acceptance

This governance step is complete only when:

1. the recovery branch parent is exactly f79;
2. exactly these four files are added: recovery override, baseline manifest, FAR specification, and
   Recovery Backlog;
3. the backlog has no more than twelve items and no automatic next-item execution;
4. no product, deployment, Provider, DNS, payment, AI, migration, or license file changes;
5. the original 243-file staged state and all archive checksums remain unchanged.

## License boundary

AGPL-3.0-only remains active during recovery. The AGPL and Swiss Ephemeris Professional License
commercial route remains a separate Owner Gate before unrestricted public service.
