# RIT-125 operational case runbook

## Purpose and current truth

This runbook covers the repository-side support, privacy, safety, and content-report case kernel.
It is usable through the internal database service in local or separately approved environments.
There is currently **no ordinary user Support button, no Web admin dashboard button, no admin HTTP
route, no external pager, and no production contact/SLA**. RIT-120 now provides only a private
offline Owner summary; it does not add queue actions or broaden this service's access.

## Intake sources

| Queue          | New source                                   | User-visible entry                                                  | Stored case category                    |
| -------------- | -------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------- |
| Safety         | reading report category `safety`             | Reading result: `Report an issue with this reading` → `Send report` | `safety`                                |
| Content report | other reading report categories              | Same report form                                                    | Exact bounded report category           |
| Privacy        | export or deletion request                   | No ordinary button yet; privacy API/backend only                    | `privacy_export` / `privacy_deletion`   |
| Support        | categorical support ticket or refund request | No ordinary Support button; refund and paid UI are frozen/Test Mode | `support.<category>` / `refund_request` |

User/report/refund source writes and case inserts share one transaction. The case does not copy
source prose, private content, user email, attachments, provider payloads, amounts, provider IDs,
or arbitrary operator notes. Existing historical source rows are not automatically backfilled.

RIT-074 payment disputes remain existing immutable payment events and project into the separate,
immutable `commercial_dispute_support_projection_v1` work-item feed only after matching fulfillment
completes. That feed does not alter this constrained case kernel and does not expose
`triage`/`escalate`/`resolve`; its failure cannot roll back payment or Credit state. A future unified
operator transition path requires an additive schema version and separate review, not mutation of
the historical RIT-125 constraint.

## Role matrix

| Queue          | Allowed review roles               |
| -------------- | ---------------------------------- |
| Support        | `owner`, `support_refund_reviewer` |
| Privacy        | `owner`, `support_refund_reviewer` |
| Safety         | `owner`, `risk_safety_reviewer`    |
| Content report | `owner`, `content_editor`          |

Every list or transition requires an active account session, authentication within the configured
step-up window, a verified passkey assertion bound to that same session, a bounded reason code, and
an uppercase ticket reference. Authenticated denial is written to the immutable audit chain.

## Local policy and ordering

`protected-beta-operations.local.en.v1` is synthetic acceptance policy only:

| Source                   | Priority | First response | Resolution |
| ------------------------ | -------- | -------------: | ---------: |
| Safety report            | urgent   |     15 minutes |    4 hours |
| Rights report            | high     |        4 hours |   24 hours |
| Other content report     | normal   |       24 hours |   72 hours |
| Privacy deletion         | high     |        4 hours |   24 hours |
| Privacy export           | normal   |       24 hours |   72 hours |
| Refund request           | high     |        4 hours |   24 hours |
| General support category | normal   |       24 hours |   72 hours |

These values must not be shown as public commitments. Active lists sort urgent before high before
normal, then first-response due time, opened time, and case ID. Missing or stale production policy
must fail closed rather than silently inherit these local values.

## Operator workflow

1. Use an approved local or protected operator harness around `createOperationalCaseService`; do
   not connect with the migrator or inspect source tables.
2. Select exactly one queue and provide a reason and ticket reference.
3. Review only the returned case ID, category, priority, state, due/SLA status, and fixed draft.
4. If the first response or resolution is breached, treat `escalationRequired: true` as actionable.
5. Apply `triage` only to `open`, `escalate` only to `open`/`triaged`, and `resolve` only to
   `triaged`/`escalated`.
6. Give every transition a new 16–128 character idempotency key. Exact replay returns the same
   result; changed content with the same key fails as a conflict.
7. Treat every acknowledgement as `draft_only_not_sent`. Do not paste private content into it and
   do not send it until a separately approved delivery path exists.

## Incident and privacy handling

- Do not query or copy questions, readings, interpretations, journals, prayers, birth data, email,
  tokens, attachments, or payment-provider payloads into case handling.
- If context beyond categorical metadata appears necessary, stop and request a separately approved,
  resource-scoped private-content access design. There is no implicit support override.
- Safety queue metadata is not emergency response. Immediate danger must use local emergency or
  qualified support channels; this product queue must not imply real-time monitoring.
- Preserve case, event, and audit rows. Do not update, delete, truncate, repair hashes, or manually
  rewrite state.

## Verification

Run with the pinned Node.js 26.5.1 and pnpm 11.13.1 toolchain:

```sh
pnpm test:operational-cases-database
pnpm --filter @rituvia/security typecheck
pnpm --filter @rituvia/db typecheck
pnpm check:migrations
```

The database test must apply migrations twice, use synthetic sources only, prove all four queues,
role denial, step-up, SLA breach, transition replay/conflict, audit hashes, private-table denial,
append-only behavior, logical restore, and cleanup.

## Rollback and open gates

Application rollback stops source enqueue and internal service use; additive source-bound case and
audit records remain. Do not drop tables or delete rows as rollback. Production contact channel,
operating hours, response/resolution commitments, retention, escalation owner, historical backfill,
dashboard/API, automated delivery, external paging/status, deployment, and launch remain separate
Owner or release gates.
