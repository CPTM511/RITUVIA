# RITUVIA Codex Build System

> Working brand: **RITUVIA**
>
> Product category: a global platform for symbolic self-reflection, personal ritual, and a private digital sanctuary.
>
> Core loop: **Question → Interpretation → Intention → Ritual → Journal → Revisit**.

This repository pack is the operating system for building RITUVIA with Codex as a one-person company. It is not merely a one-shot prompt. It combines product doctrine, architecture, safety rules, a sequenced roadmap, a live backlog, specialized Codex roles, command rules, review prompts, and operating cadences.

## What Codex should build

An English-first, Web/PWA product for global users that offers:

1. Tarot, Western astrology, and numerology.
2. A private digital sanctuary with free and paid virtual ritual objects.
3. Intention setting, private journaling, reminders, and revisit loops.
4. Direct purchases and subscriptions in fiat, plus third-party hosted cryptocurrency checkout where lawfully supported.
5. Country-aware availability, pricing, disclaimers, payment routing, and data controls.
6. AI-generated interpretations grounded in deterministic calculations and curated cultural content.
7. SEO, generative-engine discoverability, localization, analytics, administration, support, and mostly automated operations.

## Start here

1. Read `AGENTS.md`.
2. Read `CODEX_MASTER_PROMPT.md` and submit it to Codex for the first implementation session.
3. Treat `PROJECT_STATUS.md`, `BACKLOG.md`, `ROADMAP.md`, and `DECISIONS.md` as persistent operational memory.
4. Read `ENGINEERING_BASELINE.md` for the observed repository state and exact M0 execution plan.
5. Follow `CONTRIBUTING.md` and the typed durable-record policy in `records/README.md`.
6. Use the documents under `docs/` as canonical specifications.
7. Keep the legacy strategy and visual prototype under `reference/` as evidence and inspiration, not as production code.
8. Use `automation/prompts/continue-next-task.md` for subsequent runs and the `.github/codex/workflow-examples/*.yml` files only after security review and an intentional move into `.github/workflows`.

## Local development

The repository contract is Node.js `24.18.0` (see `.node-version`) and pnpm `11.13.1`. Corepack is not required; from the repository root, use npm's package runner to invoke the exact package-manager version:

```bash
npm exec --yes --package=pnpm@11.13.1 -- pnpm install --frozen-lockfile
npm exec --yes --package=pnpm@11.13.1 -- pnpm check
```

The root quality gate first verifies the active CI contract, architecture, durable records, immutable migration manifest, generated evidence, and current-tree secret policy, then checks formatting, ESLint, strict TypeScript, non-empty Vitest tests, configuration-boundary integration, a real isolated PostgreSQL migration/seed/reset/restore suite, and production builds. The active workspaces are `apps/web`, `apps/worker`, `packages/config`, `packages/db`, `packages/domain`, `packages/observability`, and `packages/ui`; other planned directories remain instruction-only until their backlog task begins.

### Continuous integration

`.github/workflows/ci.yml` is active and contains separate quality, PostgreSQL integration, and
security jobs. It uses only read access, GitHub-hosted Ubuntu 24.04 runners, immutable action SHAs, a
digest-pinned PostgreSQL 17 service, synthetic data, and no repository secrets or deployment
environment. See `.github/workflows/README.md` for the enforced workflow contract and owner-side
required-check setup. Codex workflow examples live outside the Actions workflow directory and remain
inert.

### Local environment configuration

The repository root is the shared environment-file location for both Web and Worker processes. Start with the optional baseline file:

```bash
cp .env.example .env
```

Every example assignment is intentionally empty. Local development uses typed working-brand defaults when brand overrides are omitted. The database lifecycle commands derive the attested local URL themselves; application processes still receive `DATABASE_URL` explicitly through the process environment or an ignored environment file. Web and Worker both use the pinned `@next/env` loader against the repository root with the same development/production mode and standard Next.js file precedence. Process or secret-manager values take precedence, and every `.env` variant must remain uncommitted.

The client receives only an explicit validated brand projection. `NEXT_PUBLIC_*` variables are rejected so a new public variable cannot silently enter a browser bundle. `APP_ENV=production` requires all nine brand settings and an HTTPS canonical origin; production secrets must be supplied by the environment or a secret manager rather than a file in Git.

### Local Web shell

Build the English-first shell without a database:

```bash
npm exec --yes --package=pnpm@11.13.1 -- pnpm --filter @rituvia/web build
```

The running route is deliberately safe-off. Starting the local server without a validated
read-only runtime database and an explicit active `experience.public_shell=on` version returns an
empty 404 for the shell HTML and RSC representations; it does not bypass the activation plane.
After those existing RIT-007 prerequisites are present, run:

```bash
npm exec --yes --package=pnpm@11.13.1 -- pnpm --filter @rituvia/web dev
```

When explicitly enabled, opening `http://localhost:3000` returns a permanent redirect to the only
active, reviewed locale at `/en`. Unsupported or non-canonical locale segments return 404 rather
than silently falling back or generating caches. The page is server rendered and remains readable
without JavaScript. Local, preview, and staging metadata is `noindex`; a production environment
must provide the approved HTTPS canonical origin before it may emit indexable metadata. The
configuration-boundary integration harness reproducibly verifies enabled and disabled behavior
without documenting an activation bypass or ad hoc SQL. The current shell is an honest foundation,
not a claim that accounts, readings, legal pages, purchases, or a public launch exist.

The production build enforces compressed budgets for the localized HTML, initial CSS/JavaScript,
and SVG icon and rejects remote script/style/font/media resources on the home route. Browser QA
still remains required for keyboard, screen reader, zoom/reflow, reduced motion, RTL, contrast, and
Core Web Vitals behavior.

### Shared UI foundation

`@rituvia/ui` provides the private semantic-token stylesheet and native-first React primitives used
by Web and future applications. Import components from `@rituvia/ui` and import
`@rituvia/ui/styles` once at the application root before application-specific CSS. The package owns
focus, disabled/loading/invalid/selection state presentation, system/light/dark tokens, reduced
motion, forced colors, logical-direction behavior, and closed local-action/control-value contracts;
the consuming application still owns every localized label, route, validation rule, mutation, and
idempotency boundary. See `packages/ui/README.md` for the exact catalog and review matrix.

### Local PostgreSQL and Prisma

The verified local database path requires PostgreSQL 17 or 18 command-line tools from one installation. This host uses Homebrew PostgreSQL 17.10. Standard Homebrew versioned locations are detected automatically; otherwise set `RITUVIA_POSTGRES_BIN` to the absolute directory containing all required PostgreSQL tools. Docker is not installed, so no container-reproducibility claim is made; RIT-004 owns the separate CI runtime.

After the frozen install, create or reuse the repository-owned cluster, apply committed migrations, and load the deterministic synthetic seed:

```bash
APP_ENV=local npm exec --yes --package=pnpm@11.13.1 -- pnpm db:setup
```

The cluster lives under ignored `.local/postgres/`, generates random mode-0600 credentials, uses SCRAM authentication and data checksums, and binds only `127.0.0.1:55432`. The application role is not a superuser and cannot create roles or databases. Inspect its state or obtain the local application URL only while it is running:

```bash
npm exec --yes --package=pnpm@11.13.1 -- pnpm db:status
npm exec --yes --package=pnpm@11.13.1 -- pnpm db:url
```

`db:url` prints only the path to an ignored mode-0600 URL file. Use `pnpm db:url -- --reveal` only when explicit terminal disclosure is necessary to supply a local application process; do not paste the URL into committed files, logs, tickets, or remote environments.

Reset is local and destructive, requires `APP_ENV=local`, and accepts only the exact fixed development database after a live cluster/data-directory/system-identifier attestation:

```bash
APP_ENV=local npm exec --yes --package=pnpm@11.13.1 -- pnpm db:reset -- --confirm=reset:rituvia_local@127.0.0.1:55432
npm exec --yes --package=pnpm@11.13.1 -- pnpm db:stop
```

Do not use `prisma migrate reset`, `prisma db push`, a remote `DATABASE_URL`, or the local seed against preview, staging, or production. Migration compatibility, field classification, rollback, and recovery boundaries are recorded in `packages/db/MIGRATIONS.md`.

## Canonical document map

| Concern                                  | Canonical file                            |
| ---------------------------------------- | ----------------------------------------- |
| Product mission and boundaries           | `docs/00_PROJECT_CHARTER.md`              |
| Complete feature requirements            | `docs/01_PRODUCT_REQUIREMENTS.md`         |
| User journeys and UX behavior            | `docs/02_USER_EXPERIENCE.md`              |
| Visual system and component rules        | `docs/03_DESIGN_SYSTEM.md`                |
| Software architecture                    | `docs/04_ARCHITECTURE.md`                 |
| Data model and classification            | `docs/05_DATA_MODEL.md`                   |
| AI interpretation and safety             | `docs/06_AI_INTERPRETATION_SAFETY.md`     |
| Payments, country policy, and compliance | `docs/07_PAYMENTS_COMPLIANCE.md`          |
| Localization, SEO, GEO, and growth       | `docs/08_I18N_SEO_GEO_GROWTH.md`          |
| Metrics and experiments                  | `docs/09_ANALYTICS_EXPERIMENTS.md`        |
| Security, privacy, and reliability       | `docs/10_SECURITY_PRIVACY_RELIABILITY.md` |
| One-person autonomous operations         | `docs/11_AUTONOMOUS_OPERATIONS.md`        |
| Content and cultural governance          | `docs/12_CONTENT_GOVERNANCE.md`           |
| API and integration contracts            | `docs/13_API_CONTRACTS.md`                |
| Test strategy                            | `docs/14_TEST_STRATEGY.md`                |
| Launch and rollback                      | `docs/15_LAUNCH_RUNBOOK.md`               |
| Cost controls                            | `docs/16_COST_GUARDRAILS.md`              |
| Brand decision                           | `docs/17_BRAND_NAMING.md`                 |
| Sources and verification                 | `docs/18_REFERENCES.md`                   |
| Name-clearance execution worksheet       | `docs/19_NAME_CLEARANCE_WORKSHEET.md`     |
| AI-native marketing and distribution     | `docs/20_AI_GROWTH_ENGINE.md`             |

## Current status

Current task state, dependencies, and executable-next selection live only in `BACKLOG.md`; current
capabilities, blockers, environments, and quality totals live only in `PROJECT_STATUS.md`. This
orientation file intentionally does not copy their mutable snapshot.

## Non-negotiable product principle

RITUVIA may help users reflect, create meaning, and perform symbolic rituals. It must not claim to know objective future events, guarantee outcomes, exploit fear, induce dependency, replace professional medical/legal/financial care, or sell stronger spiritual efficacy to higher-paying users.
