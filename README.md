# RITUVIA

> A private, safety-led space for symbolic self-reflection, personal ritual, and meaningful return.

[![CI](https://github.com/CPTM511/RITUVIA/actions/workflows/ci.yml/badge.svg)](https://github.com/CPTM511/RITUVIA/actions/workflows/ci.yml)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](LICENSE)
[![Node.js 26.5.1](https://img.shields.io/badge/Node.js-26.5.1-339933?logo=nodedotjs&logoColor=white)](.node-version)
[![pnpm 11.13.1](https://img.shields.io/badge/pnpm-11.13.1-F69220?logo=pnpm&logoColor=white)](package.json)

RITUVIA turns a question or theme into a grounded reflection loop:

**Question or theme → safe intake → interpretation → intention → small action → free ritual → private reflection → revisit**

It is designed to help people pause, notice patterns, and choose their next small action. It does
not predict objective outcomes, replace professional care, or sell spiritual certainty.

> [!IMPORTANT]
> The repository contains a substantial local, test-mode product and production-readiness evidence.
> It is **not** a public production launch. Protected Beta, live payments, production AI with private
> content, public indexing, deployment, and DNS changes remain behind explicit Owner approval gates.

## Why RITUVIA exists

Most symbolic tools stop at an answer. RITUVIA is built around what happens next: making the
interpretation transparent, turning it into an intention, completing a calm ritual, recording a
private reflection, and returning later to learn from lived experience.

The product is guided by four commitments:

- **Autonomy over certainty.** Interpretations offer possibilities, context, limits, and reflective
  questions—never guaranteed predictions.
- **Private by default.** Journals, intentions, prayers, questions, and birth data are treated as
  sensitive; analytics never receives their raw text.
- **Deterministic facts, explainable AI.** Code calculates card draws and spiritual-system facts;
  AI may explain only typed, verified, curated inputs and must pass safety checks.
- **Free reflection remains real.** A meaningful anonymous reading and a free candle or incense
  ritual must remain available without account creation or payment.

## Product experience

The retained English-first experience supports:

- anonymous theme or question intake with calm high-stakes and crisis routing;
- deterministic one-card and three-card tarot flows;
- intention setting, one small real-world action, and an always-free virtual ritual;
- encrypted private journaling and a revisit loop;
- account, privacy export, and deletion foundations;
- accessibility, offline/degraded, retry, mobile, reduced-motion, and RTL test states;
- safe-off foundations for astrology, numerology, AI interpretation, lifecycle messaging,
  commerce, subscriptions, refunds, disputes, reconciliation, and Owner operations.

The nearest approved external milestone is an invite-only, adult, free protected Beta capped at 25
participants. Repository-local invite enforcement exists; no invitation, staging environment, or
deployment is implied by that implementation.

For the exact current capability and release truth, read [PROJECT_STATUS.md](PROJECT_STATUS.md).
For the executable queue, read [BACKLOG.md](BACKLOG.md).

## Architecture

RITUVIA is a strict TypeScript modular monolith. Domain facts stay framework-independent; external
providers sit behind adapters; asynchronous obligations run through a dedicated worker.

```text
apps/
├── web/        Next.js App Router Web/PWA and server-owned HTTP boundaries
└── worker/     Fulfillment, reconciliation, reminders, and operational jobs

packages/
├── domain/     Product invariants and framework-independent types
├── divination/ Deterministic tarot logic and versioned facts
├── ai/         Typed generation, safety verification, evals, and safe fallback
├── db/         Prisma/PostgreSQL persistence, migrations, RLS, and recovery checks
├── payments/   Provider-neutral payment and route-control contracts
├── i18n/       BCP 47, pluralization, formatting, pseudolocale, and RTL foundations
├── security/   Authorization and security primitives
├── analytics/  Privacy-safe metrics, operational evidence, and cost guardrails
├── observability/ Redacted operational and release evidence
└── ui/         Accessible semantic tokens and reusable React primitives
```

Key engineering properties:

- PostgreSQL is the system of record; migrations are immutable and manifest-checked.
- Payments use hosted provider surfaces, signed webhooks, idempotency, an internal ledger, and
  reconciliation. New purchases fail closed behind country, method, provider, and feature controls.
- AI providers are disabled by default. Structured output, prompt/content versioning, pre/post
  safety checks, regression evals, redacted traces, and rollback are mandatory.
- English is the only active locale, while routing and rendering are designed for BCP 47 locales,
  text expansion, local formatting, CJK typography, and RTL.
- CI enforces formatting, lint, strict types, architecture, evidence, migration policy, secret
  scanning, tests, and production builds with synthetic data and no deployment credentials.

See [docs/04_ARCHITECTURE.md](docs/04_ARCHITECTURE.md) for the full system design and
[docs/codex/rituvia-production-2026-07-23/00_START_HERE.md](docs/codex/rituvia-production-2026-07-23/00_START_HERE.md)
for the Owner-approved production source-of-truth pack.

## Safety and trust model

RITUVIA must never:

- claim guaranteed reunion, wealth, healing, curse removal, or stronger spiritual efficacy for
  higher payment;
- make medical, legal, financial, fertility, death-timing, criminal-guilt, or other high-stakes
  determinations;
- intensify delusion, paranoia, supernatural persecution, dependency, or self-harm ideation;
- expose private reflection content to analytics or log raw sensitive prompts by default;
- become a stored-value wallet, cash-out system, transferable-token product, NFT, gambling
  mechanic, loot box, or public prayer wall;
- use fear, shame, false scarcity, countdown pressure, or streak punishment to drive conversion.

Every production-affecting change is subordinate to the human approval gates in
[AGENTS.md](AGENTS.md). The security model, privacy controls, threat boundaries, and recovery
requirements live in [docs/10_SECURITY_PRIVACY_RELIABILITY.md](docs/10_SECURITY_PRIVACY_RELIABILITY.md).

## Current release state

| Surface | Repository evidence | External state |
| --- | --- | --- |
| Anonymous reflection loop | Implemented and locally verified | Not publicly deployed |
| Protected Beta admission | Exact invite enforcement and 25-seat cap implemented | **NO-GO** pending standing staging and Gate H evidence |
| Payments | Local/Test Mode integrity, fulfillment, refund, dispute, and reconciliation foundations | Live providers, offers, prices, and countries not approved |
| AI | Provider-neutral safe-off pipeline and eval foundations | Production model/provider with private content not approved |
| Localization | BCP 47/RTL architecture and test scaffolds | English only; no additional locale launched |
| Operations | Local dashboards, cases, incident, cost, and evidence contracts | External monitoring and production operations incomplete |

**Protected closed Beta: NO-GO. Public or paid production: NO-GO.**

This table is orientation, not mutable release authority. [PROJECT_STATUS.md](PROJECT_STATUS.md),
[BACKLOG.md](BACKLOG.md), and the linked task/decision records hold the current evidence.

## Quick start

### Prerequisites

- Node.js `26.5.1`
- pnpm `11.13.1` (invoked below through npm for exact versioning)
- PostgreSQL 17 or 18 command-line tools for database-backed verification

### Install and verify

```bash
git clone https://github.com/CPTM511/RITUVIA.git
cd RITUVIA
npm exec --yes --package=pnpm@11.13.1 -- pnpm install --frozen-lockfile
npm exec --yes --package=pnpm@11.13.1 -- pnpm check
```

`pnpm check` is the default root quality gate; release and risk-triggered work has a broader
specialized matrix. During implementation, use the narrowest affected package and task-specific
checks first, then close the slice with the applicable architecture,
evidence, formatting, lint, type, test, build, accessibility, security, database, payment, or AI
gates described in [AGENTS.md](AGENTS.md).

### Run the local product

```bash
npm exec --yes --package=pnpm@11.13.1 -- pnpm db:setup
npm exec --yes --package=pnpm@11.13.1 -- pnpm mvp:local:configure
npm exec --yes --package=pnpm@11.13.1 -- pnpm --filter @rituvia/web exec next dev --hostname 127.0.0.1 --port 4175
```

Open [http://127.0.0.1:4175/en](http://127.0.0.1:4175/en). The local configurator creates an
ignored mode-`0600` `.env.local`, refuses to overwrite it, and keeps private/provider capabilities
safe-off unless their validated local dependencies are present.

To stop the repository-owned local database:

```bash
npm exec --yes --package=pnpm@11.13.1 -- pnpm db:stop
```

> [!CAUTION]
> Do not use `prisma migrate reset`, `prisma db push`, remote database URLs, or local seed/reset
> commands against preview, staging, or production. See [packages/db/MIGRATIONS.md](packages/db/MIGRATIONS.md).

## Quality system

The active GitHub Actions workflow separates quality, PostgreSQL integration, and security jobs. It
uses pinned actions, synthetic data, read-only repository permissions, and no deployment environment
or repository secrets.

Useful focused commands include:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm check:architecture
pnpm check:records
pnpm check:migrations
pnpm scan:secrets
pnpm test:full-loop-browser
pnpm test:accessibility
```

Passing tests do not authorize deployment or provider activation. Release evidence must also cover
privacy, accessibility, observability, recovery, security-negative behavior, human approval, and
the applicable readiness gates.

## Documentation map

| Start here when you need… | Canonical source |
| --- | --- |
| Product mission and boundaries | [Project charter](docs/00_PROJECT_CHARTER.md) |
| Current capabilities, blockers, and release truth | [Project status](PROJECT_STATUS.md) |
| Next executable task and dependencies | [Backlog](BACKLOG.md) |
| Accepted Owner decisions | [Decisions](DECISIONS.md) and [durable records](records/README.md) |
| Product journeys and interaction behavior | [User experience](docs/02_USER_EXPERIENCE.md) |
| Architecture and data contracts | [Architecture](docs/04_ARCHITECTURE.md) and [data model](docs/05_DATA_MODEL.md) |
| AI boundaries and eval requirements | [AI interpretation and safety](docs/06_AI_INTERPRETATION_SAFETY.md) |
| Payment and country-policy boundaries | [Payments and compliance](docs/07_PAYMENTS_COMPLIANCE.md) |
| Security, privacy, reliability, and recovery | [Security/privacy/reliability](docs/10_SECURITY_PRIVACY_RELIABILITY.md) and [backup/recovery](docs/22_BACKUP_RECOVERY.md) |
| Test and release evidence | [Test strategy](docs/14_TEST_STRATEGY.md) and [launch runbook](docs/15_LAUNCH_RUNBOOK.md) |
| Detailed Chinese product operation guide | [产品详细使用手册](docs/27_DETAILED_PRODUCT_USER_MANUAL_ZH.md) |
| Evidence-gated pre-launch plan | [上线前执行计划](docs/26_PRE_LAUNCH_EXECUTION_PLAN_ZH.md) |

The complete index is in [docs/README.md](docs/README.md).

## Contributing

RITUVIA is developed evidence-first. Before changing code:

1. Read [AGENTS.md](AGENTS.md), [PROJECT_STATUS.md](PROJECT_STATUS.md),
   [BACKLOG.md](BACKLOG.md), and [DECISIONS.md](DECISIONS.md).
2. Select exactly one highest-priority `Ready` item whose dependencies are satisfied.
3. Read the relevant specification and production-pack sections.
4. Implement the smallest complete vertical slice and its failure/recovery states.
5. Verify the affected behavior, review the diff across every safety dimension, and update durable
   task, decision, status, and evidence records.

Detailed workflow, branch, review, security, localization, migration, and definition-of-done rules
are in [CONTRIBUTING.md](CONTRIBUTING.md).

## License

RITUVIA is licensed under the [GNU Affero General Public License v3.0](LICENSE).

Public source availability does not mean the service is deployed, publicly launched, legally
approved in any market, or authorized to process customer data or money.

---

RITUVIA may help people reflect, create meaning, and practice symbolic ritual. It must never claim
to know objective future events, replace professional care, exploit fear, induce dependency, or
sell certainty.
