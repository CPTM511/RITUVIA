# RIT-168 Protected-Beta Invite Admission

## 1. Purpose and authority

This runbook operates the repository-local invite contract approved by D-104 and D-112. It admits
at most 25 invited English-speaking adults before anonymous-session issuance. It does not create a
public signup, deliver invitations, provision staging, configure a provider, deploy, or authorize
Beta launch.

The exact policy is:

- cohort limit: 25 issued seats;
- policy: `own-019.protected-beta-invite.v1`;
- token: opaque 32-byte random value, stored only as a SHA-256 digest;
- use: single consumption with exact idempotent lost-response recovery;
- expiry: required and operator-bounded;
- revocation: idempotent and cascades to the bound anonymous session;
- admission page: `/en/beta`;
- user Button: `Enter protected Beta`.

## 2. User workflow and Button

1. Open the privately shared protected-Beta URL ending in `/en/beta`.
2. Paste the invite into the field labeled `Protected Beta invite`.
3. Select the Button `Enter protected Beta` at the bottom of the form.
4. On success, the browser receives an anonymous-session cookie and moves to `/en/intake`.
5. Complete safety intake before entering the free reflection loop.

The raw invite remains only in form memory and one same-origin JSON request. It is not put in the
URL, browser storage, referrer, logs, analytics, rendered error state, or session cookie. Invalid,
used, expired, and revoked invites return the same calm admission message. Temporary service
failure offers a deliberate retry and never loops automatically.

## 3. Operator entry point

There is no Web or Admin issuance Button. Use a database control-role connection and write the
one-time secret only to a new absolute file outside the repository:

```bash
DATABASE_URL='postgresql://CONTROL_ROLE@HOST/DB?sslmode=require' \
  pnpm beta:invite -- create \
  --idempotency-key 'beta-wave-1-seat-001' \
  --ttl-seconds 604800 \
  --output '/absolute/private/path/beta-wave-1-seat-001.json'
```

The command prints only bounded metadata. The output file is exclusive mode `0600`, is never
overwritten, and contains the only emitted raw invite. Do not commit, paste into a ticket, put in a
spreadsheet, or send through a public/shared channel.

Recommended execution is three reviewed waves: 5, then 10, then 10. Pause between waves for abuse,
safety, privacy, support, and SLO review. A seven-day TTL is the default operational recommendation;
shorten it when the recipient can accept immediately.

## 4. Revocation

Use the `inviteId` from the private creation result or a reviewed metadata-only operator record:

```bash
DATABASE_URL='postgresql://CONTROL_ROLE@HOST/DB?sslmode=require' \
  pnpm beta:invite -- revoke \
  --idempotency-key 'beta-wave-1-seat-001-revoke-1' \
  --invite-id 'INVITE_ID' \
  --output '/absolute/private/path/beta-wave-1-seat-001-revocation.json'
```

Revocation is idempotent. If the invite was consumed, the bound anonymous session is revoked in the
same transaction. Never reissue a raw token for an existing invite; create a new seat only when the
cohort policy permits it.

## 5. Failure and recovery

- Missing or malformed invite: verify the private message and paste again.
- Invalid, used, expired, or revoked invite: do not enumerate internal state; contact the private
  Beta coordinator for a reviewed replacement.
- Lost success response: retry the exact same invite and request; the database-bound recovery path
  returns the same session authority instead of creating another subject/session.
- Database unavailable: stop issuance/admission, preserve the private output file, and follow the
  dependency incident runbook. Never fall back to local storage or a shared password.
- Suspected disclosure: revoke immediately, record metadata-only incident evidence, and issue a new
  seat only after review.
- Cohort cap reached: stop. Increasing the cap requires a new Owner decision.

## 6. Privacy and privilege boundaries

The runtime role can read only cohort/admission columns and can update only invite consumption
binding. The control role can create/revoke invite state but cannot read the stored token digest.
Neither path receives private questions, journals, birth data, raw request headers, or device
fingerprints.

## 7. Verification

Run the affected gates under Node.js 26.5.1 and pnpm 11.13.1:

```bash
pnpm test:protected-beta-invites-database
pnpm test:protected-beta-invite-browser
pnpm --filter @rituvia/config typecheck
pnpm --filter @rituvia/db typecheck
pnpm --filter @rituvia/web typecheck
pnpm --filter @rituvia/web build
pnpm check:migrations
pnpm check:architecture
pnpm check:records
pnpm check:generated
pnpm scan:secrets
```

## 8. External release boundary

This runbook proves repository behavior only. Invite execution against an approved standing-staging
database, protected edge ingress, alert delivery, provider restore, DAST/independent penetration
test, Gate H, production migration, deployment, and launch remain separate evidence and Owner
gates.
