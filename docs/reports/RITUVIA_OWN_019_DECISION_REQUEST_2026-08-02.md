# OWN-019 protected-Beta abuse and ingress decision request

> Status: **Approved exactly as recommended on 2026-08-02; recorded by D-104**
>
> Scope: protected English, invited-adult, anonymous, free closed Beta only
>
> Excluded: public launch, payment, Credits, subscription, production AI, astrology activation,
> real email, crypto, public indexing, new country/language, or production legal-policy activation

## 1. Why this decision is required

RIT-122 proves a privacy-minimal per-session database budget locally, but it cannot prevent session
farming at the network edge and its local thresholds are not production authority. RIT-130 cannot
prepare a protected-Beta candidate until the Owner approves one exact policy reference, cohort,
invite/allowlist boundary, limits, observation window, and rollback rules.

## 2. Recommended approval profile

The following exact initial profile was approved by the Owner on 2026-08-02.

| Decision field | Recommended value | Reason |
| --- | --- | --- |
| Policy reference | `own-019.protected-beta-abuse.v1` | Exact fail-closed production reference |
| Cohort | Maximum 25 invited adults; English only | Small reversible comprehension/safety cohort |
| Admission | Deny by default; individually revocable single-use invite; no public signup | Prevent anonymous open access and bound session farming |
| Edge protection | Protected staging allowlist plus managed bot/rate protection; app stores no IP, User-Agent, device ID, or fingerprint | Layered ingress without creating an app profiling store |
| Anonymous issuance | Maximum 30 new sessions per 60 seconds across the protected deployment | Retains the tested global cap; allowlist is the primary cohort boundary |
| Question intake | 12 checks per active session per 60 seconds | Matches bounded local acceptance evidence |
| Protected mutations | 120 attempts per active session per 86,400 seconds | Matches bounded local acceptance evidence |
| Automatic retry | None after `429`; show calm pause and `Retry-After` | Avoid denial-of-wallet amplification |
| Observation window | 72-hour staff dry run, then seven days with daily Owner review | Detect configuration/legitimate-use failures before broader invitation |
| Immediate rollback | Any unauthorized access, private-data leak, safety-boundary bypass, data loss/corruption, open Critical/High finding, or inability to revoke admission | Higher-priority safety/privacy/correctness stop conditions |
| SLO rollback | Any critical Beta SLO breach that cannot be contained inside its runbook window | Uses D-101 fixed alert and containment contract |
| Abuse rollback | Repeated invite bypass/session farming, or legitimate-user rate-limit impact above 10% in a one-hour reviewed sample | Stops either ineffective or harmful admission policy |
| Rollback action | Stop invitations, switch Web to reviewed `read_only` containment where safe, revoke edge admission, preserve evidence, and require Owner re-approval before resume | Bounded reversible shutdown without deleting evidence |

## 3. Evidence required before activation

- Protected standing staging with isolated keys, data, providers, noindex, and deny-by-default ingress.
- Verified invite issue, single use, revocation, expiry, cohort cap, and audit behavior.
- Exact environment values match `own-019.protected-beta-abuse.v1`; missing or drifted values fail
  closed.
- Browser evidence for normal, `429`, reload recovery, offline/degraded, revocation, and no private
  canary leakage.
- External/independent DAST or penetration testing with no open Critical/High findings.
- Monitoring, alerts, runbooks, backup/restore, kill switch, outage game day, support ownership,
  and rollback rehearsal.
- Owner reviews the final RIT-130 evidence bundle and separately approves any deployment action.

## 4. What approval would and would not do

Approval would authorize RIT-130 to encode and verify this exact protected-Beta ingress profile in
standing staging. It would not authorize public access, production deployment, DNS, payment,
provider live mode, marketing, a larger cohort, a new country/language, or launch.

## 5. Owner response recorded

The Owner responded: `Approve OWN-019 exactly as recommended in the 2026-08-02 decision request.`

OWN-019 is therefore **Done** under D-104. Protected-Beta release remains **NO-GO** until RIT-127,
RIT-128, standing staging, invite controls, provider restore, external security evidence, Gate H,
RIT-130 release evidence, and a separate deployment approval are complete.
