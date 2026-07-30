import { describe, expect, it } from "vitest";

import {
  auditArchitecture,
  expectedWebDatabaseCompositionSource,
  expectedWebFeatureFlagCompositionSource,
  type RepositoryArchitectureFile,
} from "../scripts/architecture-policy.js";

const manifest = (
  root: string,
  name: string,
  dependencies: Record<string, string> = {},
  exports: Record<string, string> | null = { ".": "./src/index.ts" },
): RepositoryArchitectureFile => ({
  path: `${root}/package.json`,
  source: JSON.stringify({ dependencies, exports, name, private: true }),
});

const moduleTsconfig = (root: string, pure = false): RepositoryArchitectureFile => ({
  path: `${root}/tsconfig.json`,
  source: JSON.stringify({
    compilerOptions: pure ? { lib: ["ES2022"], types: [] } : {},
    extends: "../../tsconfig.base.json",
  }),
});

const baseline = (): RepositoryArchitectureFile[] => [
  { path: "tsconfig.base.json", source: "{}" },
  manifest("packages/config", "@rituvia/config", {}, { "./server": "./src/server.ts" }),
  moduleTsconfig("packages/config"),
  { path: "packages/config/src/server.ts", source: "export const configured = true;" },
  manifest("packages/domain", "@rituvia/domain"),
  moduleTsconfig("packages/domain", true),
  { path: "packages/domain/src/index.ts", source: "export const domain = true;" },
  manifest("packages/db", "@rituvia/db", { "@rituvia/domain": "workspace:*" }),
  moduleTsconfig("packages/db"),
  {
    path: "packages/db/src/index.ts",
    source: 'import type { domain } from "@rituvia/domain"; export type Domain = typeof domain;',
  },
  manifest("packages/divination", "@rituvia/divination", { "@rituvia/domain": "workspace:*" }),
  moduleTsconfig("packages/divination", true),
  {
    path: "packages/divination/src/index.ts",
    source: 'export type { domain as Domain } from "@rituvia/domain";',
  },
  manifest("packages/ai", "@rituvia/ai", {
    "@rituvia/divination": "workspace:*",
    "@rituvia/observability": "workspace:*",
  }),
  moduleTsconfig("packages/ai", true),
  {
    path: "packages/ai/src/index.ts",
    source: 'import type { Domain } from "@rituvia/divination"; export type Input = Domain;',
  },
  manifest("packages/ui", "@rituvia/ui", { react: "19.2.7" }, { ".": "./src/index.tsx" }),
  moduleTsconfig("packages/ui"),
  {
    path: "packages/ui/src/index.tsx",
    source: 'import type { ReactNode } from "react"; export type Slot = ReactNode;',
  },
  manifest(
    "apps/web",
    "@rituvia/web",
    {
      "@rituvia/config": "workspace:*",
      react: "19.2.7",
    },
    null,
  ),
  moduleTsconfig("apps/web"),
  {
    path: "apps/web/app/page.tsx",
    source:
      'import type { ReactNode } from "react"; import type { configured } from "@rituvia/config/server"; export type Page = ReactNode | typeof configured;',
  },
];

const rules = (files: readonly RepositoryArchitectureFile[]): string[] =>
  auditArchitecture(files).map(({ rule }) => rule);

const replaceSource = (
  files: RepositoryArchitectureFile[],
  filePath: string,
  source: string,
): void => {
  const index = files.findIndex(({ path }) => path === filePath);
  if (index < 0) throw new Error(`fixture missing: ${filePath}`);
  files[index] = { path: filePath, source };
};

describe("package architecture policy", () => {
  it("accepts the canonical acyclic dependency direction", () => {
    expect(auditArchitecture(baseline())).toEqual([]);
  });

  it("allows the reviewed monotonic clock in Web server composition", () => {
    const files = baseline();
    files.push({
      path: "apps/web/server/deadline.ts",
      source:
        'import { performance } from "node:perf_hooks"; export const monotonicNow = () => performance.now();',
    });
    expect(auditArchitecture(files)).toEqual([]);

    const misplaced = baseline();
    misplaced.push({
      path: "packages/ai/src/deadline.ts",
      source:
        'import { performance } from "node:perf_hooks"; export const monotonicNow = () => performance.now();',
    });
    expect(rules(misplaced)).toContain("node-runtime-dependency");
  });

  it("allows sensitive Node primitives only in their reviewed configuration and identity files", () => {
    const accepted = baseline();
    replaceSource(
      accepted,
      "packages/config/src/server.ts",
      'import { Buffer } from "node:buffer"; export const decode = (value: string) => Buffer.from(value, "base64url");',
    );
    accepted.push({
      path: "packages/db/src/account-identity.ts",
      source:
        'import { webcrypto } from "node:crypto"; export const digest = (value: Uint8Array) => webcrypto.subtle.digest("SHA-256", value);',
    });
    expect(rules(accepted)).not.toContain("node-runtime-dependency");

    const misplaced = baseline();
    misplaced.push(
      {
        path: "packages/config/src/client-secret.ts",
        source: 'import { Buffer } from "node:buffer"; export const unsafe = Buffer;',
      },
      {
        path: "packages/db/src/general-crypto.ts",
        source: 'import { webcrypto } from "node:crypto"; export const unsafe = webcrypto;',
      },
    );
    expect(rules(misplaced).filter((rule) => rule === "node-runtime-dependency")).toHaveLength(2);
  });

  it("keeps domain free of runtime packages, environment access, and network access", () => {
    const files = baseline();
    replaceSource(
      files,
      "packages/domain/package.json",
      JSON.stringify({
        dependencies: { zod: "4.4.3" },
        exports: { ".": "./src/index.ts" },
        name: "@rituvia/domain",
        private: true,
      }),
    );
    files.push({
      path: "packages/domain/src/unsafe.ts",
      source:
        'import { request } from "node:https"; export const leaked = process["env"].TOKEN; export const result = fetch(String(request));',
    });
    files.push({
      path: "packages/domain/src/aliased.ts",
      source:
        "const runtime = process; const network = globalThis as { fetch(value: string): Promise<unknown> }; export const secret = runtime.env.TOKEN; export const response = network.fetch('https://example.invalid');",
    });
    expect(rules(files)).toEqual(
      expect.arrayContaining([
        "domain-environment-access",
        "domain-external-dependency",
        "domain-network-access",
        "domain-runtime-global",
        "domain-runtime-dependency",
      ]),
    );
  });

  it("keeps AI provider-neutral and free of ambient runtime capabilities", () => {
    const files = baseline();
    files.push({
      path: "packages/ai/src/unsafe.ts",
      source:
        'declare const fetch: (url: string) => Promise<unknown>; const runtime = globalThis as { fetch: typeof fetch }; export const unsafe = () => runtime.fetch(process.env.PROVIDER_URL ?? "https://example.invalid");',
    });

    expect(rules(files)).toEqual(
      expect.arrayContaining(["ai-environment-access", "ai-network-access", "ai-runtime-global"]),
    );

    replaceSource(files, "packages/ai/tsconfig.json", moduleTsconfig("packages/ai").source);
    expect(rules(files)).toContain("pure-module-types");
  });

  it("keeps interpretation generation in Web server composition without coupling DB to AI", () => {
    const accepted = baseline();
    replaceSource(
      accepted,
      "apps/web/package.json",
      JSON.stringify({
        dependencies: {
          "@rituvia/ai": "workspace:*",
          "@rituvia/config": "workspace:*",
          "@rituvia/db": "workspace:*",
          react: "19.2.7",
          "server-only": "0.0.1",
        },
        name: "@rituvia/web",
        private: true,
      }),
    );
    accepted.push({
      path: "apps/web/server/interpretation-generation.ts",
      source:
        'import "server-only"; import { generateTarotInterpretationV1 } from "@rituvia/ai"; import { createInterpretationGenerationPersistence } from "@rituvia/db"; export const compose = () => [generateTarotInterpretationV1, createInterpretationGenerationPersistence];',
    });
    expect(auditArchitecture(accepted)).toEqual([]);

    const databaseImportsAi = baseline();
    replaceSource(
      databaseImportsAi,
      "packages/db/package.json",
      JSON.stringify({
        dependencies: {
          "@rituvia/ai": "workspace:*",
          "@rituvia/domain": "workspace:*",
        },
        exports: { ".": "./src/index.ts" },
        name: "@rituvia/db",
        private: true,
      }),
    );
    databaseImportsAi.push({
      path: "packages/db/src/unsafe-generation.ts",
      source: 'export { generateTarotInterpretationV1 } from "@rituvia/ai";',
    });
    expect(rules(databaseImportsAi)).toContain("internal-dependency-direction");

    const aiUsesAmbientRuntime = baseline();
    aiUsesAmbientRuntime.push({
      path: "packages/ai/src/unsafe-generation.ts",
      source:
        "declare const fetch: (url: string) => Promise<unknown>; export const unsafe = () => fetch(process.env.PROVIDER_URL ?? window.location.href);",
    });
    expect(rules(aiUsesAmbientRuntime)).toEqual(
      expect.arrayContaining(["ai-environment-access", "ai-network-access", "ai-runtime-global"]),
    );

    replaceSource(
      aiUsesAmbientRuntime,
      "packages/ai/tsconfig.json",
      moduleTsconfig("packages/ai").source,
    );
    expect(rules(aiUsesAmbientRuntime)).toContain("pure-module-types");
  });

  it("keeps UI free of network, storage, runtime, polymorphic, and dangerous JSX capabilities", () => {
    const files = baseline();
    files.push({
      path: "packages/ui/src/unsafe.tsx",
      source:
        'import { cloneElement } from "react"; export const unsafe = (props: Record<string, unknown>) => { localStorage.setItem("theme", "dark"); fetch("https://example.invalid"); return <div {...props} style={{}} dangerouslySetInnerHTML={{ __html: String(process.env.VALUE) }}>{cloneElement(<span />)}</div>; };',
    });

    expect(rules(files)).toEqual(
      expect.arrayContaining([
        "ui-dangerous-jsx-surface",
        "ui-network-access",
        "ui-polymorphic-host",
        "ui-runtime-capability",
        "ui-storage-access",
      ]),
    );
  });

  it("permits the reviewed semantic state-pattern hosts without widening UI capabilities", () => {
    const files = baseline();
    files.push({
      path: "packages/ui/src/safe-state.tsx",
      source:
        "export const safeState = () => <section><h1>One</h1><h2>Two</h2><h3>Three</h3><h4>Four</h4><h5>Five</h5><h6>Six</h6><p>Message</p></section>;",
    });

    expect(auditArchitecture(files)).toEqual([]);
  });

  it.each([
    ['export const Unsafe = () => <img src="https://tracker.invalid/pixel" />;', false, true],
    [
      'const Host = "script"; export const Unsafe = () => <Host src="https://tracker.invalid/x.js" />;',
      true,
      true,
    ],
    [
      'export const Unsafe = () => <form action="https://tracker.invalid/collect"></form>;',
      false,
      true,
    ],
    [
      'export const Unsafe = () => <a href="https://tracker.invalid/collect">Leave</a>;',
      false,
      true,
    ],
    [
      'export const unsafe = () => { const pixel = new Image(); pixel.src = "https://tracker.invalid/pixel"; return pixel; };',
      false,
      false,
    ],
  ])("rejects a UI resource or host escape: %#", (source, polymorphic, dangerousJsx) => {
    const files = baseline();
    files.push({ path: "packages/ui/src/resource-escape.tsx", source });

    const result = rules(files);
    expect(result).toContain("ui-network-access");
    if (dangerousJsx) expect(result).toContain("ui-dangerous-jsx-surface");
    if (polymorphic) expect(result).toContain("ui-polymorphic-host");
  });

  it("rejects direct JSX-runtime factories that bypass source-level host inspection", () => {
    const files = baseline();
    files.push({
      path: "packages/ui/src/jsx-runtime-escape.ts",
      source:
        'import { jsx } from "react/jsx-runtime"; export const Unsafe = () => jsx("img", { src: "https://tracker.invalid/pixel" });',
    });

    expect(rules(files)).toEqual(
      expect.arrayContaining(["ui-dangerous-jsx-surface", "ui-polymorphic-host"]),
    );
  });

  it.each([
    {
      path: "packages/ui/src/fake-href.tsx",
      source:
        'const createLocalActionHref = (value: string) => value; const target = createLocalActionHref("https://tracker.invalid"); export const Unsafe = () => <a href={target}>Leave</a>;',
    },
    {
      path: "packages/ui/src/primitives.tsx",
      source:
        'import { createLocalActionHref } from "./contracts.js"; export function ActionLink({ href }: { href: string }) { let target = createLocalActionHref(href); target = "https://tracker.invalid"; return <a href={target}>Leave</a>; }',
    },
    {
      path: "packages/ui/src/primitives.tsx",
      source:
        'import { createLocalActionHref } from "./contracts.js"; export function ActionLink({ href }: { href: string }) { const target = createLocalActionHref(href); { const target = "https://tracker.invalid"; void target; } return <a href={target}>Leave</a>; }',
    },
    {
      path: "packages/ui/src/primitives.tsx",
      source:
        'import { createLocalActionHref } from "./contracts.js"; export function ActionLink({ href }: { href: string }) { const target = createLocalActionHref(href); const inner = (target: string) => <a href={target}>Leave</a>; return inner("https://tracker.invalid"); }',
    },
    {
      path: "packages/ui/src/primitives.tsx",
      source:
        'import { createLocalActionHref } from "./contracts.js"; export function ActionLink({ href }: { href: string }) { const target = createLocalActionHref(href); class Inner { render(target: string) { return <a href={target}>Leave</a>; } } return new Inner().render("https://tracker.invalid"); }',
    },
  ])("rejects an untrusted, reassigned, or shadowed local-href binding: %#", (fixture) => {
    const files = baseline();
    files.push({
      path: "packages/ui/src/contracts.ts",
      source: "export const createLocalActionHref = (value: string) => value;",
    });
    const existing = files.findIndex(({ path }) => path === fixture.path);
    if (existing >= 0) files[existing] = fixture;
    else files.push(fixture);

    expect(rules(files)).toEqual(
      expect.arrayContaining(["ui-dangerous-jsx-surface", "ui-network-access"]),
    );
  });

  it.each([
    'export const Unsafe = ({ Field }: { Field: "form" }) => <Field><button type="submit">Submit</button></Field>;',
    'const condition = true; const Field = condition ? "form" : "div"; export const Unsafe = () => <Field><button type="submit">Submit</button></Field>;',
    'const Field = ["form"][0]; export const Unsafe = () => <Field><button type="submit">Submit</button></Field>;',
    'export function Field({ children }: { children: unknown }) { return <div>{children}</div>; } Field = "form" as never; export const Unsafe = () => <Field><button type="submit">Submit</button></Field>;',
    'export function Field({ children }: { children: unknown }) { return <div>{children}</div>; } ({ Field } = { Field: "form" as never }); export const Unsafe = () => <Field><button type="submit">Submit</button></Field>;',
    'export function Field({ children }: { children: unknown }) { return <div>{children}</div>; } [Field] = ["form" as never]; export const Unsafe = () => <Field><button type="submit">Submit</button></Field>;',
  ])("rejects a component-name host binding escape: %#", (source) => {
    const files = baseline();
    files.push({ path: "packages/ui/src/host-binding-escape.tsx", source });

    expect(rules(files)).toEqual(
      expect.arrayContaining(["ui-dangerous-jsx-surface", "ui-polymorphic-host"]),
    );
  });

  it("rejects React namespace element factories", () => {
    const files = baseline();
    files.push({
      path: "packages/ui/src/react-factory-escape.tsx",
      source:
        'import * as React from "react"; export const Unsafe = () => React["createElement"]("img", { src: "https://tracker.invalid/pixel" });',
    });

    expect(rules(files)).toEqual(
      expect.arrayContaining([
        "ui-dangerous-jsx-surface",
        "ui-network-access",
        "ui-polymorphic-host",
      ]),
    );
  });

  it.each([
    'export const unsafe = () => open("https://tracker.invalid");',
    'const launch = open; export const unsafe = () => launch("https://tracker.invalid");',
    'export const unsafe = () => fetchLater("https://tracker.invalid");',
    'export const unsafe = () => new RTCPeerConnection({ iceServers: [{ urls: "stun:tracker.invalid" }] });',
    'export const unsafe = () => new WebSocketStream("https://tracker.invalid");',
  ])("rejects a direct browser-network runtime escape: %#", (source) => {
    const files = baseline();
    files.push({ path: "packages/ui/src/network-runtime-escape.ts", source });

    expect(rules(files)).toContain("ui-network-access");
  });

  it("blocks UI access to the database and every unreviewed external adapter", () => {
    const files = baseline();
    replaceSource(
      files,
      "apps/web/package.json",
      JSON.stringify({
        dependencies: {
          "@rituvia/config": "workspace:*",
          "@rituvia/db": "workspace:*",
          react: "19.2.7",
          stripe: "20.4.0",
        },
        name: "@rituvia/web",
        private: true,
      }),
    );
    files.push({
      path: "apps/web/app/unsafe.tsx",
      source:
        'import { domain } from "@rituvia/db"; import Stripe from "stripe"; export { domain, Stripe };',
    });
    expect(rules(files)).toEqual(
      expect.arrayContaining(["ui-data-adapter", "ui-external-adapter"]),
    );
  });

  it("keeps client modules away from server configuration, Node, and database composition", () => {
    const files = baseline();
    replaceSource(
      files,
      "apps/web/package.json",
      JSON.stringify({
        dependencies: {
          "@rituvia/config": "workspace:*",
          "@rituvia/db": "workspace:*",
          react: "19.2.7",
        },
        name: "@rituvia/web",
        private: true,
      }),
    );
    files.push({
      path: "apps/web/app/client.tsx",
      source:
        '"use client"; import { readFile } from "node:fs"; import { configured } from "@rituvia/config/server"; import { domain } from "@rituvia/db"; export { configured, domain, readFile };',
    });
    expect(rules(files)).toEqual(
      expect.arrayContaining([
        "client-server-import",
        "ui-data-adapter",
        "web-db-outside-composition",
      ]),
    );
  });

  it("allows DB-backed Web service tests without widening production composition", () => {
    const accepted = baseline();
    replaceSource(
      accepted,
      "apps/web/package.json",
      JSON.stringify({
        dependencies: {
          "@rituvia/config": "workspace:*",
          "@rituvia/db": "workspace:*",
          react: "19.2.7",
        },
        name: "@rituvia/web",
        private: true,
      }),
    );
    accepted.push(
      {
        path: "apps/web/test/commerce-server.test.ts",
        source: 'import type { Domain } from "@rituvia/db"; export type Fixture = Domain;',
      },
      {
        path: "apps/web/test/reflection-loop.test.ts",
        source: 'import { Domain } from "@rituvia/db"; export const fixture = Domain;',
      },
    );
    expect(rules(accepted)).not.toContain("web-db-outside-composition");

    const unreviewed = [...accepted];
    unreviewed.push({
      path: "apps/web/test/database-bypass.test.ts",
      source: 'import { Domain } from "@rituvia/db"; export const bypass = Domain;',
    });
    expect(rules(unreviewed)).toContain("web-db-outside-composition");
  });

  it("propagates server taint through local bridges and rejects client capability imports", () => {
    const files = baseline();
    files.push(
      manifest("packages/payments", "@rituvia/payments"),
      moduleTsconfig("packages/payments"),
      { path: "packages/payments/src/index.ts", source: "export const checkout = true;" },
      manifest("packages/i18n", "@rituvia/i18n", { "@rituvia/domain": "workspace:*" }),
      moduleTsconfig("packages/i18n"),
      {
        path: "packages/i18n/src/index.ts",
        source: 'import { readFileSync } from "node:fs"; export const messages = readFileSync;',
      },
      {
        path: "apps/web/config/bridge.ts",
        source: 'export { configured } from "@rituvia/config/server";',
      },
      {
        path: "apps/web/lib/payment-bridge.ts",
        source: 'export { checkout } from "@rituvia/payments";',
      },
      {
        path: "apps/web/app/bridged-client.tsx",
        source:
          '"use client"; export { configured } from "../config/bridge.js"; export { checkout } from "../lib/payment-bridge.js";',
      },
      {
        path: "apps/web/app/i18n-client.tsx",
        source: '"use client"; export { messages } from "@rituvia/i18n";',
      },
    );
    replaceSource(
      files,
      "apps/web/package.json",
      JSON.stringify({
        dependencies: {
          "@rituvia/config": "workspace:*",
          "@rituvia/i18n": "workspace:*",
          "@rituvia/payments": "workspace:*",
          react: "19.2.7",
        },
        name: "@rituvia/web",
        private: true,
      }),
    );
    expect(rules(files)).toEqual(expect.arrayContaining(["client-server-transitive-import"]));
  });

  it("confines raw feature-flag construction to the reviewed Web composition adapter", () => {
    const files = baseline();
    replaceSource(
      files,
      "apps/web/package.json",
      JSON.stringify({
        dependencies: {
          "@rituvia/config": "workspace:*",
          "@rituvia/db": "workspace:*",
          react: "19.2.7",
          "server-only": "0.0.1",
        },
        name: "@rituvia/web",
        private: true,
      }),
    );
    replaceSource(
      files,
      "packages/config/package.json",
      JSON.stringify({
        exports: {
          "./feature-flags": "./src/feature-flags.ts",
          "./server": "./src/server.ts",
        },
        name: "@rituvia/config",
        private: true,
      }),
    );
    files.push(
      {
        path: "packages/config/src/feature-flags.ts",
        source: "export const createFeatureFlagEvaluator = () => true;",
      },
      {
        path: "apps/web/config/server.ts",
        source: "export const getWebRuntimeConfiguration = () => ({ databaseUrl: 'db' });",
      },
      {
        path: "apps/web/server/database.ts",
        source: expectedWebDatabaseCompositionSource,
      },
      {
        path: "apps/web/server/feature-flags.ts",
        source: expectedWebFeatureFlagCompositionSource,
      },
      {
        path: "apps/web/server/unsafe-feature-flags.ts",
        source:
          'export { createFeatureFlagEvaluator as bypass } from "@rituvia/config/feature-flags";',
      },
      {
        path: "apps/web/app/unsafe-feature-client.tsx",
        source:
          '"use client"; import { createFeatureFlagEvaluator as alias } from "@rituvia/config/feature-flags"; export const bypass = alias;',
      },
    );

    const findings = auditArchitecture(files);
    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          location: expect.stringContaining("apps/web/server/unsafe-feature-flags.ts"),
          rule: "feature-flag-capability-import",
        }),
        expect.objectContaining({
          location: expect.stringContaining("apps/web/app/unsafe-feature-client.tsx"),
          rule: "client-server-import",
        }),
      ]),
    );
    expect(
      findings.some(
        ({ location, rule }) =>
          rule === "feature-flag-capability-import" &&
          location.startsWith("apps/web/server/feature-flags.ts"),
      ),
    ).toBe(false);
    expect(findings.some(({ rule }) => rule === "feature-flag-composition-boundary")).toBe(false);
    expect(findings.some(({ rule }) => rule === "web-database-composition-boundary")).toBe(false);

    replaceSource(
      files,
      "apps/web/server/feature-flags.ts",
      'import "server-only"; import { createFeatureFlagEvaluator as create } from "@rituvia/config/feature-flags"; export const loadWebFeatureFlagEvaluator = async (database: unknown) => create(database);',
    );
    expect(rules(files)).toContain("feature-flag-composition-boundary");

    replaceSource(
      files,
      "apps/web/server/database.ts",
      `${expectedWebDatabaseCompositionSource}\nexport const callerSupplied = (database: unknown) => database;\n`,
    );
    expect(rules(files)).toContain("web-database-composition-boundary");

    replaceSource(
      files,
      "apps/web/server/feature-flags.ts",
      `${expectedWebFeatureFlagCompositionSource}\nconst fakeDatabase = { featureFlagVersion: true };\n`,
    );
    expect(rules(files)).toContain("feature-flag-composition-boundary");
  });

  it("blocks divination from importing AI through package or relative paths", () => {
    const direct = baseline();
    replaceSource(
      direct,
      "packages/divination/package.json",
      JSON.stringify({
        dependencies: { "@rituvia/ai": "workspace:*", "@rituvia/domain": "workspace:*" },
        name: "@rituvia/divination",
        private: true,
      }),
    );
    direct.push({
      path: "packages/divination/src/unsafe.ts",
      source: 'export { Input } from "@rituvia/ai";',
    });
    expect(rules(direct)).toContain("divination-imports-ai");

    const relative = baseline();
    relative.push({
      path: "packages/divination/src/relative.ts",
      source: 'export { Input } from "../../ai/src/index.js";',
    });
    expect(rules(relative)).toEqual(
      expect.arrayContaining(["divination-imports-ai", "relative-cross-module-import"]),
    );

    const globals = baseline();
    globals.push({
      path: "packages/divination/src/globals.ts",
      source:
        'declare const fetch: (url: string) => Promise<unknown>; declare const self: Record<string, (url: string) => Promise<unknown>>; const request = fetch; const method = "fe" + "tch"; export const unsafe = () => Promise.all([request(process.env.PROVIDER_URL), self[method](process.env.PROVIDER_URL)]);',
    });
    expect(rules(globals)).toEqual(
      expect.arrayContaining([
        "divination-environment-access",
        "divination-network-access",
        "divination-runtime-global",
      ]),
    );
  });

  it("rejects undeclared, non-workspace, and unexported internal package imports", () => {
    const files = baseline();
    replaceSource(
      files,
      "apps/web/package.json",
      JSON.stringify({
        dependencies: { "@rituvia/config": "^0.0.0", react: "19.2.7" },
        name: "@rituvia/web",
        private: true,
      }),
    );
    files.push({
      path: "apps/web/config/unsafe.ts",
      source:
        'export { domain } from "@rituvia/domain"; export { configured } from "@rituvia/config/src/server";',
    });
    expect(rules(files)).toEqual(
      expect.arrayContaining([
        "undeclared-dependency",
        "unexported-internal-import",
        "workspace-protocol",
      ]),
    );

    files.push({
      path: "packages/domain/src/package-json.ts",
      source: 'export { name } from "../../db/package.json";',
    });
    expect(rules(files)).toContain("unresolved-relative-import");
  });

  it("resolves committed canonical content JSON and rejects missing JSON", () => {
    const files = baseline();
    files.push(
      { path: "content/traditions/tarot/catalog.json", source: "{}" },
      {
        path: "apps/web/server/catalog.ts",
        source:
          'import catalog from "../../../content/traditions/tarot/catalog.json"; export { catalog };',
      },
    );
    expect(rules(files)).not.toContain("unresolved-relative-import");
    replaceSource(
      files,
      "apps/web/server/catalog.ts",
      'import catalog from "../../../content/traditions/tarot/missing.json"; export { catalog };',
    );
    expect(rules(files)).toContain("unresolved-relative-import");
  });

  it("detects manifest-level and production-file cycles", () => {
    const moduleCycle = baseline();
    replaceSource(
      moduleCycle,
      "packages/domain/package.json",
      JSON.stringify({
        dependencies: { "@rituvia/db": "workspace:*" },
        exports: { ".": "./src/index.ts" },
        name: "@rituvia/domain",
        private: true,
      }),
    );
    expect(rules(moduleCycle)).toContain("module-cycle");

    const fileCycle = baseline();
    fileCycle.push(
      {
        path: "packages/domain/src/a.ts",
        source: 'export { b } from "./b.js"; export const a = 1;',
      },
      {
        path: "packages/domain/src/b.ts",
        source: 'export { a } from "./a.js"; export const b = 1;',
      },
    );
    expect(rules(fileCycle)).toContain("file-cycle");
  });

  it("counts triple-slash and import-type edges and rejects self-cycles", () => {
    const files = baseline();
    files.push(
      {
        path: "packages/domain/src/a.ts",
        source: '/// <reference path="./b.ts" />\nexport const a = 1;',
      },
      {
        path: "packages/domain/src/b.ts",
        source: 'export type A = typeof import("./a.js").a; export const b = 1;',
      },
    );
    expect(rules(files)).toContain("file-cycle");

    replaceSource(
      files,
      "packages/domain/package.json",
      JSON.stringify({
        dependencies: { "@rituvia/domain": "workspace:*" },
        exports: { ".": "./src/index.ts" },
        name: "@rituvia/domain",
        private: true,
      }),
    );
    expect(rules(files)).toContain("module-cycle");

    files.push({
      path: "packages/domain/src/self.ts",
      source: 'export { domain } from "@rituvia/domain";',
    });
    expect(rules(files)).toContain("self-package-import");
  });

  it("counts triple-slash type package references in direction and module cycles", () => {
    const files = baseline();
    replaceSource(
      files,
      "packages/domain/package.json",
      JSON.stringify({
        devDependencies: { "@rituvia/db": "workspace:*" },
        exports: { ".": "./src/index.ts" },
        name: "@rituvia/domain",
        private: true,
      }),
    );
    files.push({
      path: "packages/domain/src/js-edge.js",
      source: '/** @type {import("@rituvia/db").Domain} */\nexport const edge = {};',
    });
    expect(rules(files)).toEqual(
      expect.arrayContaining([
        "domain-internal-dependency",
        "module-cycle",
        "production-dev-dependency",
      ]),
    );
  });

  it("rejects dev-only production imports, path aliases, package aliases, and exotic protocols", () => {
    const files = baseline();
    replaceSource(
      files,
      "apps/web/package.json",
      JSON.stringify({
        dependencies: { "@rituvia/config": "workspace:*", react: "19.2.7" },
        devDependencies: { zod: "4.4.3" },
        name: "@rituvia/web",
        private: true,
      }),
    );
    files.push(
      { path: "apps/web/src/schema.config.ts", source: 'export { z } from "zod";' },
      {
        path: "tsconfig.json",
        source: JSON.stringify({ compilerOptions: { paths: { "@unsafe/*": ["packages/db/*"] } } }),
      },
    );
    replaceSource(
      files,
      "packages/config/package.json",
      JSON.stringify({
        dependencies: { validator: "npm:zod@4.4.3" },
        exports: { "./*": "./src/*.ts" },
        imports: { "#unsafe": "../db/src/index.ts" },
        name: "@rituvia/config",
        private: true,
      }),
    );
    expect(rules(files)).toEqual(
      expect.arrayContaining([
        "dependency-protocol",
        "manifest-path-alias",
        "production-dev-dependency",
        "tsconfig-path-alias",
        "wildcard-export",
      ]),
    );
  });

  it("validates every public export target and rejects test or symlink promotion", () => {
    const files = baseline();
    replaceSource(
      files,
      "packages/domain/package.json",
      JSON.stringify({
        exports: {
          ".": "./src/index.ts",
          "./config": "./build.config.ts",
          "./escape": "./test/escape.ts",
          "./seed": "./prisma/seed.ts",
          "./symlink-escape": "./src/escape.ts",
          "./tool": "./tools/generate.ts",
        },
        name: "@rituvia/domain",
        private: true,
      }),
    );
    files.push(
      {
        path: "packages/domain/build.config.ts",
        source: "export const build = true;",
      },
      {
        path: "packages/domain/prisma/seed.ts",
        source: "export const seed = true;",
      },
      {
        path: "packages/domain/test/escape.ts",
        source: "export const escape = () => fetch('https://example.invalid');",
      },
      {
        path: "packages/domain/tools/generate.ts",
        source: "export const generate = true;",
      },
      { kind: "symlink", path: "packages/domain/src", source: "" },
    );
    expect(rules(files)).toEqual(expect.arrayContaining(["export-target", "source-symlink"]));
  });

  it("rejects aliases hidden behind an unapproved tsconfig extends chain", () => {
    const files = baseline();
    files.push({
      path: "apps/web/tsconfig.json",
      source: JSON.stringify({ extends: "./aliases.json" }),
    });
    files.push({
      path: "apps/web/next.config.ts",
      source:
        'export default { turbopack: { resolveAlias: { "next/server": "../../packages/db/src/index.ts" } }, webpack(config: { resolve: { alias: object } }) { config.resolve.alias = {}; return config; } };',
    });
    expect(rules(files)).toEqual(
      expect.arrayContaining(["framework-path-alias", "tsconfig-extends"]),
    );
  });

  it("requires a statically auditable Next configuration export", () => {
    const files = baseline();
    files.push({
      path: "apps/web/next.config.ts",
      source:
        'const hook = "web" + "pack"; const configure = (config: object) => { const resolve = Reflect.get(config, "resolve") as object; Reflect.set(resolve, "alias", {}); return config; }; export default Object.fromEntries([[hook, configure]]);',
    });
    expect(rules(files)).toContain("framework-config-dynamic");
  });

  it("allows only the reviewed static finite-route configuration", () => {
    const accepted = baseline();
    accepted.push({
      path: "apps/web/next.config.ts",
      source:
        "const nextConfig = { experimental: { caseSensitiveRoutes: true, serverSourceMaps: false }, poweredByHeader: false, reactStrictMode: true, skipProxyUrlNormalize: true, skipTrailingSlashRedirect: true, typedRoutes: true }; export default nextConfig;",
    });
    expect(rules(accepted)).not.toContain("framework-config-dynamic");

    const unreviewed = baseline();
    unreviewed.push({
      path: "apps/web/next.config.ts",
      source:
        "const nextConfig = { experimental: { caseSensitiveRoutes: true, typedEnv: true }, reactStrictMode: true, skipTrailingSlashRedirect: true }; export default nextConfig;",
    });
    expect(rules(unreviewed)).toContain("framework-config-dynamic");

    const serverSourceMapsEnabled = baseline();
    serverSourceMapsEnabled.push({
      path: "apps/web/next.config.ts",
      source:
        "const nextConfig = { experimental: { caseSensitiveRoutes: true, serverSourceMaps: true }, reactStrictMode: true, skipTrailingSlashRedirect: true }; export default nextConfig;",
    });
    expect(rules(serverSourceMapsEnabled)).toContain("framework-config-dynamic");

    const caseInsensitive = baseline();
    caseInsensitive.push({
      path: "apps/web/next.config.ts",
      source:
        "const nextConfig = { experimental: { caseSensitiveRoutes: false }, reactStrictMode: true, skipTrailingSlashRedirect: true }; export default nextConfig;",
    });
    expect(rules(caseInsensitive)).toContain("framework-config-dynamic");

    const normalizedProxyUrl = baseline();
    normalizedProxyUrl.push({
      path: "apps/web/next.config.ts",
      source:
        "const nextConfig = { experimental: { caseSensitiveRoutes: true }, reactStrictMode: true, skipProxyUrlNormalize: false, skipTrailingSlashRedirect: true, typedRoutes: true }; export default nextConfig;",
    });
    expect(rules(normalizedProxyUrl)).toContain("framework-config-dynamic");

    const frameworkHeaderEnabled = baseline();
    frameworkHeaderEnabled.push({
      path: "apps/web/next.config.ts",
      source:
        "const nextConfig = { experimental: { caseSensitiveRoutes: true }, poweredByHeader: true, reactStrictMode: true, skipProxyUrlNormalize: true, skipTrailingSlashRedirect: true, typedRoutes: true }; export default nextConfig;",
    });
    expect(rules(frameworkHeaderEnabled)).toContain("framework-config-dynamic");
  });

  it("rejects private test traversal and runtime code-loading escape hatches", () => {
    const files = baseline();
    files.push(
      manifest("apps/worker", "@rituvia/worker", { "@rituvia/db": "workspace:*" }, null),
      moduleTsconfig("apps/worker"),
      {
        path: "packages/divination/test/escape.test.ts",
        source: 'export { Input } from "../../ai/src/index.js";',
      },
      {
        path: "apps/worker/src/loader.ts",
        source:
          'import { createRequire as cr } from "node:module"; const execute = eval; const load = cr(new URL("../../../packages/db/package.json", import.meta.url)); export const database = execute(\'import("@rituvia/db")\'); export const client = load("@prisma/client"); export const resolve = (name: string) => require["resolve"](name);',
      },
      {
        path: "apps/worker/src/commonjs.cts",
        source:
          'declare const require: (name: string) => unknown; const load = require; export const client = load("@prisma/client");',
      },
      {
        path: "apps/worker/src/reflection.ts",
        source:
          'const builtin = Reflect.get(process, "get" + "BuiltinModule"); const key = "con" + "structor"; const make = ((() => undefined) as unknown as Record<string, () => unknown>)[key]; const alias = make; export const value = [builtin, alias()];',
      },
      {
        path: "apps/worker/src/vm.ts",
        source:
          'import { compileFunction as compile } from "node:vm"; export const value = compile("return 1")();',
      },
    );
    expect(rules(files)).toEqual(
      expect.arrayContaining([
        "commonjs-runtime-source",
        "dynamic-module-specifier",
        "node-runtime-dependency",
        "relative-cross-module-import",
        "unsafe-code-loading",
      ]),
    );
  });

  it("permits only reviewed computed data reads while preserving code-loading defenses", () => {
    const accepted = baseline();
    replaceSource(
      accepted,
      "packages/config/src/server.ts",
      "export const read = (record: Record<string, string>, key: string) => record[key];",
    );
    accepted.push(
      {
        path: "apps/web/app/_components/sanctuary-flow.tsx",
        source:
          '"use client"; export const label = (messages: { intention: { themes: Record<string, string> } }, selectedTheme: string) => messages.intention.themes[selectedTheme];',
      },
      {
        path: "apps/web/server/payment-provider.ts",
        source:
          "export const price = (input: { priceIds: Record<string, string> }, request: { metadata: { productCode: string } }) => input.priceIds[request.metadata.productCode];",
      },
      {
        path: "packages/db/src/account-identity.ts",
        source:
          "export class AccountError { constructor(readonly code: string) {} } export const byte = (left: Uint8Array, right: Uint8Array, index: number) => (left[index] ?? 0) ^ (right[index] ?? 0);",
      },
      {
        path: "packages/db/src/commerce-persistence.ts",
        source:
          "export class CommerceError { constructor(readonly code: string) {} } export const byte = (left: Uint8Array, right: Uint8Array, index: number) => (left[index] ?? 0) ^ (right[index] ?? 0);",
      },
    );
    expect(rules(accepted)).not.toContain("unsafe-code-loading");

    const mutatedKey = baseline();
    replaceSource(
      mutatedKey,
      "packages/config/src/server.ts",
      "export const read = (record: Record<string, string>, unreviewed: string) => record[unreviewed];",
    );
    expect(rules(mutatedKey)).toContain("unsafe-code-loading");

    const mutatedWrite = baseline();
    replaceSource(
      mutatedWrite,
      "packages/config/src/server.ts",
      'export const write = (record: Record<string, string>, key: string) => { record[key] = "changed"; };',
    );
    expect(rules(mutatedWrite)).toContain("unsafe-code-loading");

    const misplaced = baseline();
    misplaced.push({
      path: "packages/config/src/unreviewed.ts",
      source: "export const read = (record: Record<string, string>, key: string) => record[key];",
    });
    expect(rules(misplaced)).toContain("unsafe-code-loading");

    const constructorEscape = baseline();
    constructorEscape.push({
      path: "packages/db/src/constructor-escape.ts",
      source:
        'export const direct = (value: object) => value.constructor; export const indexed = (value: Record<string, unknown>) => value["constructor"];',
    });
    expect(rules(constructorEscape)).toContain("unsafe-code-loading");
  });

  it("confines descriptor reflection to the observability redaction boundary", () => {
    const accepted = baseline();
    accepted.push(
      manifest("packages/observability", "@rituvia/observability"),
      moduleTsconfig("packages/observability", true),
      {
        path: "packages/observability/src/redaction.ts",
        source:
          "export const descriptor = (value: object) => Object.getOwnPropertyDescriptor(value, 'safe');",
      },
      {
        path: "packages/observability/src/index.ts",
        source: 'export { descriptor } from "./redaction.js";',
      },
    );
    expect(auditArchitecture(accepted)).toEqual([]);

    const misplaced = baseline();
    misplaced.push({
      path: "packages/domain/src/reflection.ts",
      source:
        "export const descriptor = (value: object) => Object['getOwnPropertyDescriptor'](value, 'value');",
    });
    expect(rules(misplaced)).toContain("descriptor-reflection-outside-redaction");

    const unsafeInsideException = baseline();
    unsafeInsideException.push(
      manifest("packages/observability", "@rituvia/observability"),
      moduleTsconfig("packages/observability", true),
      {
        path: "packages/observability/src/redaction.ts",
        source: "export const unsafe = (value: object) => Reflect.get(value, 'secret');",
      },
      {
        path: "packages/observability/src/index.ts",
        source: 'export { unsafe } from "./redaction.js";',
      },
    );
    expect(rules(unsafeInsideException)).toContain("unsafe-code-loading");
  });

  it("keeps observability a server-only leaf package", () => {
    const reverseDependency = baseline();
    reverseDependency.push(
      manifest("packages/observability", "@rituvia/observability", {
        "@rituvia/config": "workspace:*",
      }),
      moduleTsconfig("packages/observability"),
      {
        path: "packages/observability/src/index.ts",
        source: 'export { configured } from "@rituvia/config/server";',
      },
    );
    expect(rules(reverseDependency)).toContain("internal-dependency-direction");

    const clientImport = baseline();
    replaceSource(
      clientImport,
      "apps/web/package.json",
      JSON.stringify({
        dependencies: {
          "@rituvia/config": "workspace:*",
          "@rituvia/observability": "workspace:*",
          react: "19.2.7",
        },
        name: "@rituvia/web",
        private: true,
      }),
    );
    clientImport.push(
      manifest("packages/observability", "@rituvia/observability"),
      moduleTsconfig("packages/observability"),
      {
        path: "packages/observability/src/index.ts",
        source: "export const telemetry = true;",
      },
      {
        path: "apps/web/app/telemetry.tsx",
        source:
          '\"use client\"; import { telemetry } from "@rituvia/observability"; export { telemetry };',
      },
    );
    expect(rules(clientImport)).toEqual(
      expect.arrayContaining(["client-server-import", "client-server-transitive-import"]),
    );
  });

  it("confines console output to the two structured observability adapters", () => {
    const files = baseline();
    files.push(
      {
        path: "apps/web/server/debug.ts",
        source:
          "export const debug = (value: unknown) => { const write = process.stdout.write; write(String(value)); };",
      },
      {
        path: "apps/web/server/observability.ts",
        source: "export const leak = (value: unknown) => console.warn(value);",
      },
      {
        path: "apps/web/server/job.ts",
        source:
          "declare const telemetry: { continueTrustedJob(carrier: unknown, input: unknown): unknown }; export const continueJob = (carrier: unknown) => telemetry.continueTrustedJob(carrier, {});",
      },
      {
        path: "apps/worker/src/bypass.ts",
        source:
          'import { continueTrustedJob as alias } from "@rituvia/observability/worker"; export const bypass = (telemetry: never, carrier: unknown) => alias(telemetry, carrier, {} as never);',
      },
    );

    expect(rules(files)).toEqual(
      expect.arrayContaining([
        "console-outside-observability-adapter",
        "raw-output-outside-observability-sink",
        "trusted-job-continuation-outside-worker-boundary",
        "worker-observability-capability-import",
      ]),
    );
  });

  it("keeps payment provider SDKs inside explicit adapter zones", () => {
    const accepted = baseline();
    replaceSource(
      accepted,
      "apps/web/package.json",
      JSON.stringify({
        dependencies: {
          "@rituvia/config": "workspace:*",
          react: "19.2.7",
          stripe: "20.4.0",
        },
        name: "@rituvia/web",
        private: true,
      }),
    );
    accepted.push({
      path: "apps/web/server/payment-provider.ts",
      source: 'import Stripe from "stripe"; export type Client = Stripe;',
    });
    expect(rules(accepted)).not.toContain("adapter-ownership");
    expect(rules(accepted)).not.toContain("external-runtime-dependency");

    const misplacedWeb = [...accepted];
    misplacedWeb.push({
      path: "apps/web/server/commerce-provider-bypass.ts",
      source: 'import Stripe from "stripe"; export type Client = Stripe;',
    });
    expect(rules(misplacedWeb)).toContain("adapter-ownership");

    const misplacedPackage = baseline();
    misplacedPackage.push(
      manifest("packages/payments", "@rituvia/payments", { stripe: "20.4.0" }),
      {
        path: "packages/payments/src/core/order.ts",
        source: 'import Stripe from "stripe"; export type Client = Stripe;',
      },
    );
    expect(rules(misplacedPackage)).toContain("provider-outside-adapter");
  });

  it("fails closed on computed imports, syntax errors, symlinks, and unknown modules", () => {
    const files = baseline();
    files.push(
      {
        path: "packages/domain/src/computed.ts",
        source: "export const load = (name: string) => import(name);",
      },
      { path: "packages/domain/src/invalid.ts", source: "export const = ;" },
      { kind: "symlink", path: "packages/domain/src/link.ts", source: "" },
      { path: "packages/unknown/package.json", source: "{}" },
      { path: "packages/unknown/src/index.ts", source: "export {};" },
    );
    expect(rules(files)).toEqual(
      expect.arrayContaining([
        "dynamic-module-specifier",
        "source-parse",
        "source-symlink",
        "unregistered-module",
      ]),
    );
  });
});
