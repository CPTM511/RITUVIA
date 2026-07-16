# RITUVIA Codex Build System — QA Report

**Validated:** 2026-07-16

**Result:** PASS for the imported instruction pack, repository consistency, and the RIT-001/RIT-002 engineering foundation.

## Checks passed

- All 85 files from the source ZIP were inventoried and read or mechanically compared in full before baseline changes.
- Before mutation, all 84 archive checksum entries passed; this proved the imported ZIP was intact.
- All required root, specification, Codex, automation, template, generated-evidence, and retained-reference files exist.
- All project TOML and JSON files parse successfully. Repository YAML parses with the host Ruby YAML parser, and pnpm accepts the workspace policy; the Python validator emits an explicit warning when PyYAML is unavailable instead of claiming that check ran.
- Backlog contains 122 unique items: 115 product/engineering tasks and seven explicit owner gates. Dependency references are valid, the graph is acyclic, `RIT-000` through `RIT-002` are Done, and exactly one executable item is Ready: `RIT-003`.
- Ten custom Codex agents contain required name, description, and developer instructions.
- Root plus every nested `AGENTS.md` remains below the configured 65,536-byte project instruction limit.
- The installed Codex CLI loads the project configuration and command rules. Thirty-five representative exec-policy cases cover normal push approval; common force-push variants; destructive Git; recursive deletion; Prisma reset/deploy variants; Terraform/Kubernetes changes; production deploy CLIs; remote PR/release creation; and package publishing.
- Local Markdown links do not escape the package or point to missing local targets.
- Historical `LUMORA` text is contained to retained references, migration/name-clearance/baseline notes, manifest/compiled manual, QA, and the validator allowlist.
- Both retained HTML artifacts exist, pass an integrity-size check, and were reviewed as non-canonical research rather than production code.
- `RITUVIA_CODEX_BUILD_MANUAL.md` is deterministically generated from 85 current text sources; the two HTML artifacts remain external references.
- `checksums.sha256` covers every tracked or non-ignored current package file except itself, with no missing, extra, duplicate, or mismatched entry.
- The task-result schema now includes the documented assumptions/blockers fields and supports review cadences that have no single backlog task; the task template uses the backlog status/priority vocabulary.
- Node.js 24.18.0, pnpm 11.13.1, and every direct JavaScript dependency are pinned; the frozen lockfile passes strict peer, engine, release-age, exotic-subdependency, and exact install-script allowlist policies.
- A clean temporary repository copy completed `pnpm install --frozen-lockfile` without changing the lockfile or leaving ignored/pending build scripts.
- Root format, ESLint, strict TypeScript, Vitest, configuration-boundary, and build gates pass. Turbo executes Web, Worker, config, and domain tasks; 29 behavioral/contract tests run across four test files; the build verifier checks ten emitted artifacts and imports built ESM exports.
- `.env.example` contains exactly the typed server inventory as empty assignments. Production source limits environment reads to reviewed adapters, rejects every `NEXT_PUBLIC_*` variable, keeps the working-brand display literal out of application code, and sends only a strict client allowlist.
- An isolated normal Next.js production build and HTTP start deliver a randomized public canary while excluding randomized sender/database canaries from browser artifacts and the response. Invalid Web and Worker configuration exits nonzero with key-only diagnostics, and a deliberately illegal Client Component import fails specifically at the `server-only` boundary.

## Validation commands

```bash
python3 scripts/build_compiled_manual.py --check
python3 scripts/build_checksums.py --check
python3 scripts/validate_instruction_pack.py
shasum -a 256 -c checksums.sha256
codex execpolicy check --pretty --rules .codex/rules/default.rules -- <command...>
npm exec --yes --package=pnpm@11.13.1 -- pnpm install --frozen-lockfile
npm exec --yes --package=pnpm@11.13.1 -- pnpm check
npm exec --yes --package=pnpm@11.13.1 -- pnpm test:configuration-boundary
```

## Limitations

- This validates the specification/instruction package and the RIT-001/RIT-002 application foundation, including built client-delivery and local production-start boundaries. It does not validate a user-facing product flow, interactive browser behavior, payment, database, AI, accessibility, general security scanning, deployment, or a hosted production runtime.
- PyYAML and a JSON Schema meta-validator are not installed in the host environment. YAML is independently parsed with the available host Ruby parser; JSON is parsed and critical task-result schema invariants are checked locally. RIT-004 must add portable CI validation.
- Command rules are exact positional prefixes and are an additional guard, not a substitute for the binding owner-approval rules in `AGENTS.md`. Reordered flags, aliases, and opaque shell wrappers still require human review.
- The current CLI accepted the configuration, but model availability and configuration enums can change by CLI release/account. Re-check the official Codex configuration before enabling automation or upgrading Codex integration settings.
- Example GitHub workflows are intentionally named `.example.yml` and remain inactive. Official action versions/inputs, pinned dependencies, fork-secret behavior, permissions, branch protection, and budget controls require review before activation.
- `RITUVIA` has only a preliminary public-web exact-name screen. This report does not establish trademark registrability, confusing-similarity clearance, domain/handle availability, company-name availability, or legal right to use.
- Payment, crypto, tax, legal, country, astrology-license, content-rights, and vendor decisions remain blocked until written current evidence and owner/qualified approval exist.

## Import acceptance result

The imported build system now has a reproducible strict TypeScript monorepo, typed environment/configurable-brand boundaries, and a deterministic consistency workflow. The next task is `RIT-003`; it must add the reproducible local PostgreSQL and Prisma foundation. CI and production readiness remain gated by later M0 tasks.
