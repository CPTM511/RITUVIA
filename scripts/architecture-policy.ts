import path from "node:path";

import * as ts from "typescript";

export type RepositoryArchitectureFile = Readonly<{
  kind?: "file" | "symlink";
  path: string;
  source: string;
}>;

export type ArchitectureFinding = Readonly<{
  dependency?: string;
  location: string;
  rule: string;
}>;

type ModuleDefinition = Readonly<{
  kind: "app" | "package";
  name: string;
  root: string;
}>;

type ParsedManifest = Readonly<{
  dependencies: ReadonlyMap<string, string>;
  developmentDependencies: ReadonlySet<string>;
  exports: ReadonlySet<string>;
  exportSources: ReadonlyMap<string, readonly string[]>;
  module: ModuleDefinition;
  runtimeDependencies: ReadonlySet<string>;
}>;

type ImportReference = Readonly<{
  line: number;
  specifier: string | null;
}>;

type ParsedSource = Readonly<{
  buildPathAlias: boolean;
  clientModule: boolean;
  consoleAccess: boolean;
  descriptorReflection: boolean;
  environmentAccess: boolean;
  frameworkConfigStatic: boolean;
  imports: readonly ImportReference[];
  networkAccess: boolean;
  rawOutputAccess: boolean;
  runtimeGlobalAccess: boolean;
  trustedJobContinuation: boolean;
  unsafeConsoleAccess: boolean;
  unsafeCodeLoading: boolean;
  unsafeUiComposition: boolean;
  unsafeUiJsxSurface: boolean;
  uiStorageAccess: boolean;
}>;

const moduleDefinitions = Object.freeze([
  { kind: "app", name: "@rituvia/web", root: "apps/web" },
  { kind: "app", name: "@rituvia/worker", root: "apps/worker" },
  { kind: "app", name: "@rituvia/admin", root: "apps/admin" },
  { kind: "package", name: "@rituvia/config", root: "packages/config" },
  { kind: "package", name: "@rituvia/domain", root: "packages/domain" },
  { kind: "package", name: "@rituvia/db", root: "packages/db" },
  { kind: "package", name: "@rituvia/ui", root: "packages/ui" },
  { kind: "package", name: "@rituvia/i18n", root: "packages/i18n" },
  { kind: "package", name: "@rituvia/divination", root: "packages/divination" },
  { kind: "package", name: "@rituvia/ai", root: "packages/ai" },
  { kind: "package", name: "@rituvia/payments", root: "packages/payments" },
  {
    kind: "package",
    name: "@rituvia/country-policy",
    root: "packages/country-policy",
  },
  { kind: "package", name: "@rituvia/analytics", root: "packages/analytics" },
  {
    kind: "package",
    name: "@rituvia/observability",
    root: "packages/observability",
  },
  { kind: "package", name: "@rituvia/security", root: "packages/security" },
  { kind: "package", name: "@rituvia/testing", root: "packages/testing" },
] satisfies readonly ModuleDefinition[]);

const moduleByRoot = new Map(moduleDefinitions.map((definition) => [definition.root, definition]));
const moduleByName = new Map(moduleDefinitions.map((definition) => [definition.name, definition]));
const allowedInternalDependencies = new Map<string, ReadonlySet<string>>([
  [
    "@rituvia/web",
    new Set([
      "@rituvia/ai",
      "@rituvia/analytics",
      "@rituvia/config",
      "@rituvia/country-policy",
      "@rituvia/db",
      "@rituvia/divination",
      "@rituvia/domain",
      "@rituvia/i18n",
      "@rituvia/observability",
      "@rituvia/payments",
      "@rituvia/security",
      "@rituvia/ui",
    ]),
  ],
  [
    "@rituvia/admin",
    new Set([
      "@rituvia/analytics",
      "@rituvia/config",
      "@rituvia/country-policy",
      "@rituvia/db",
      "@rituvia/domain",
      "@rituvia/i18n",
      "@rituvia/observability",
      "@rituvia/payments",
      "@rituvia/security",
      "@rituvia/ui",
    ]),
  ],
  [
    "@rituvia/worker",
    new Set([
      "@rituvia/ai",
      "@rituvia/analytics",
      "@rituvia/config",
      "@rituvia/country-policy",
      "@rituvia/db",
      "@rituvia/divination",
      "@rituvia/domain",
      "@rituvia/i18n",
      "@rituvia/observability",
      "@rituvia/payments",
      "@rituvia/security",
    ]),
  ],
  ["@rituvia/config", new Set()],
  ["@rituvia/domain", new Set()],
  ["@rituvia/db", new Set(["@rituvia/domain"])],
  ["@rituvia/ui", new Set(["@rituvia/i18n"])],
  ["@rituvia/i18n", new Set(["@rituvia/domain"])],
  ["@rituvia/divination", new Set(["@rituvia/domain"])],
  [
    "@rituvia/ai",
    new Set([
      "@rituvia/divination",
      "@rituvia/domain",
      "@rituvia/i18n",
      "@rituvia/observability",
      "@rituvia/security",
    ]),
  ],
  [
    "@rituvia/payments",
    new Set([
      "@rituvia/country-policy",
      "@rituvia/domain",
      "@rituvia/observability",
      "@rituvia/security",
    ]),
  ],
  ["@rituvia/country-policy", new Set(["@rituvia/domain"])],
  ["@rituvia/analytics", new Set(["@rituvia/observability"])],
  ["@rituvia/observability", new Set()],
  ["@rituvia/security", new Set()],
  [
    "@rituvia/testing",
    new Set(moduleDefinitions.filter(({ kind }) => kind === "package").map(({ name }) => name)),
  ],
]);
const allowedExternalRuntimeDependencies = new Map<string, ReadonlySet<string>>([
  ["@rituvia/web", new Set(["@next/env", "next", "react", "react-dom", "server-only"])],
  ["@rituvia/worker", new Set(["@next/env"])],
  ["@rituvia/admin", new Set()],
  ["@rituvia/config", new Set(["zod"])],
  ["@rituvia/domain", new Set()],
  ["@rituvia/db", new Set(["@prisma/adapter-pg", "@prisma/client", "pg"])],
  ["@rituvia/ui", new Set(["react", "react-dom"])],
  ["@rituvia/i18n", new Set()],
  ["@rituvia/divination", new Set()],
  ["@rituvia/ai", new Set()],
  ["@rituvia/payments", new Set()],
  ["@rituvia/country-policy", new Set()],
  ["@rituvia/analytics", new Set()],
  ["@rituvia/observability", new Set()],
  ["@rituvia/security", new Set()],
  ["@rituvia/testing", new Set()],
]);
const allowedRuntimeNodeBuiltins = new Map<string, ReadonlySet<string>>([
  ["@rituvia/web", new Set(["node:url"])],
  ["@rituvia/worker", new Set(["node:url"])],
]);
const dependencySections = Object.freeze([
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
]);
const runtimeDependencySections = Object.freeze([
  "dependencies",
  "optionalDependencies",
  "peerDependencies",
]);
const codeExtension = /\.(?:[cm]?[jt]sx?)$/u;
const testPath =
  /(?:^|\/)(?:__tests__|fixtures|test|tests)(?:\/|$)|\.(?:spec|test)\.[cm]?[jt]sx?$/u;
const generatedPath = /^packages\/db\/src\/generated\/prisma\/|(?:^|\/)next-env\.d\.ts$/u;
const assetExtension = /\.(?:avif|css|gif|ico|jpe?g|png|sass|scss|svg|webp|woff2?)(?:\?.*)?$/iu;
const allowedUiExternalPackages = new Set(["next", "react", "react-dom", "server-only"]);
const allowedClientInternalPackages = new Set(["@rituvia/domain", "@rituvia/i18n", "@rituvia/ui"]);
const databaseAdapterPackages = new Set(["@prisma/adapter-pg", "@prisma/client", "pg", "prisma"]);
const aiProviderPackages = new Set([
  "@anthropic-ai/sdk",
  "@google/generative-ai",
  "@google/genai",
  "ai",
  "openai",
]);
const paymentProviderPackages = new Set([
  "@paypal/paypal-server-sdk",
  "adyen-node-api-library",
  "braintree",
  "coinbase-commerce-node",
  "stripe",
]);
export const expectedWebFeatureFlagCompositionSource = `import "server-only";

import {
  createFeatureFlagEvaluator,
  featureFlagRegistryVersion,
  type FeatureFlagEvaluator,
} from "@rituvia/config/feature-flags";
import {
  assertFeatureFlagRuntimeDatabasePrivileges,
  createDatabaseClient,
  readFeatureFlagVersions,
} from "@rituvia/db";

import { getWebRuntimeConfiguration } from "../config/server";

export const loadWebFeatureFlagEvaluator = async (): Promise<FeatureFlagEvaluator> => {
  const databaseUrl = getWebRuntimeConfiguration().databaseUrl;
  if (databaseUrl === undefined) {
    throw new TypeError("Web database configuration is unavailable.");
  }
  const database = createDatabaseClient(databaseUrl);
  try {
    await assertFeatureFlagRuntimeDatabasePrivileges(database);
    const records = await readFeatureFlagVersions(database, featureFlagRegistryVersion);

    return createFeatureFlagEvaluator({
      records,
      registryVersion: featureFlagRegistryVersion,
    });
  } finally {
    await database.$disconnect();
  }
};
`;
const unsafeRuntimeIdentifiers = new Set([
  "AsyncFunctionConstructor",
  "Function",
  "FunctionConstructor",
  "GeneratorFunctionConstructor",
  "Reflect",
  "constructor",
  "createRequire",
  "defineProperty",
  "eval",
  "getOwnPropertyDescriptors",
  "getBuiltinModule",
  "getPrototypeOf",
  "require",
  "setPrototypeOf",
]);
const descriptorReflectionIdentifiers = new Set(["getOwnPropertyDescriptor"]);
const networkRuntimeIdentifiers = new Set([
  "Audio",
  "SharedWorker",
  "EventSource",
  "Image",
  "Worker",
  "WebSocket",
  "WebSocketStream",
  "WebTransport",
  "XMLHttpRequest",
  "RTCPeerConnection",
  "document",
  "fetch",
  "importScripts",
  "location",
  "navigator",
  "open",
  "fetchLater",
  "self",
  "window",
]);
const uiStorageIdentifiers = new Set(["caches", "indexedDB", "localStorage", "sessionStorage"]);
const unsafeUiJsxAttributes = new Set([
  "as",
  "aschild",
  "attributionsrc",
  "dangerouslysetinnerhtml",
  "formaction",
  "ping",
  "rel",
  "srcdoc",
  "style",
  "target",
]);
const unsafeUiNetworkAttributes = new Set([
  "action",
  "attributionsrc",
  "cite",
  "formaction",
  "href",
  "imagesrcset",
  "ping",
  "poster",
  "src",
  "srcdoc",
  "srcset",
  "xlinkhref",
]);
const allowedUiIntrinsicElements = new Set([
  "a",
  "button",
  "div",
  "fieldset",
  "input",
  "label",
  "legend",
  "option",
  "p",
  "select",
  "span",
  "textarea",
]);
const allowedUiComponentElements = new Set([
  "Field",
  "FieldDescription",
  "FieldErrorMessage",
  "FieldLabel",
  "FieldSupport",
  "Icon",
  "Spinner",
]);
const uiNetworkIntrinsicElements = new Set([
  "audio",
  "embed",
  "form",
  "iframe",
  "img",
  "link",
  "object",
  "picture",
  "script",
  "source",
  "track",
  "video",
]);
const unsafeNodeBuiltins = new Set([
  "child_process",
  "module",
  "node:child_process",
  "node:module",
  "node:repl",
  "node:vm",
  "node:worker_threads",
  "repl",
  "vm",
  "worker_threads",
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const normalizeRepositoryPath = (value: string): string =>
  path.posix.normalize(value.replaceAll("\\", "/")).replace(/^\.\//u, "");

const definitionForPath = (filePath: string): ModuleDefinition | undefined => {
  const [area, name] = normalizeRepositoryPath(filePath).split("/");
  return area && name ? moduleByRoot.get(`${area}/${name}`) : undefined;
};

const candidateRootForPath = (filePath: string): string | undefined => {
  const [area, name] = normalizeRepositoryPath(filePath).split("/");
  return (area === "apps" || area === "packages") && name ? `${area}/${name}` : undefined;
};

const add = (
  findings: ArchitectureFinding[],
  rule: string,
  location: string,
  dependency?: string,
): void => {
  findings.push(
    Object.freeze(dependency === undefined ? { location, rule } : { dependency, location, rule }),
  );
};

const packageNameFromSpecifier = (specifier: string): string => {
  if (!specifier.startsWith("@")) return specifier.split("/", 1)[0] ?? specifier;
  return specifier.split("/", 2).join("/");
};

const adapterOwner = (dependency: string): string | undefined => {
  if (databaseAdapterPackages.has(dependency)) return "packages/db";
  if (aiProviderPackages.has(dependency)) return "packages/ai";
  if (paymentProviderPackages.has(dependency)) return "packages/payments";
  return undefined;
};

const isProviderAdapterFile = (filePath: string, owner: string): boolean => {
  if (owner === "packages/db") return filePath.startsWith("packages/db/");
  return new RegExp(`^${owner}/(?:src/)?(?:adapters|providers)/`, "u").test(filePath);
};

const exportedSubpath = (specifier: string, packageName: string): string => {
  const suffix = specifier.slice(packageName.length);
  return suffix === "" ? "." : `.${suffix}`;
};

const exportTargetStrings = (value: unknown): readonly string[] => {
  const targets: string[] = [];
  const pending: unknown[] = [value];
  while (pending.length > 0) {
    const candidate = pending.pop();
    if (typeof candidate === "string") targets.push(candidate);
    else if (Array.isArray(candidate)) pending.push(...candidate);
    else if (isRecord(candidate)) pending.push(...Object.values(candidate));
  }
  return targets.sort();
};

const manifestExportEntries = (value: unknown): ReadonlyMap<string, readonly string[]> => {
  if (typeof value === "string" || Array.isArray(value)) {
    return new Map([[".", exportTargetStrings(value)]]);
  }
  if (!isRecord(value)) return new Map();
  const keys = Object.keys(value);
  if (!keys.some((key) => key.startsWith("."))) {
    return new Map([[".", exportTargetStrings(value)]]);
  }
  return new Map(keys.sort().map((key) => [key, exportTargetStrings(value[key])]));
};

const sourceCandidatesForExportTarget = (moduleRoot: string, target: string): readonly string[] => {
  if (!target.startsWith("./") || target.includes("*")) return [];
  const normalized = normalizeRepositoryPath(path.posix.join(moduleRoot, target.slice(2)));
  if (!normalized.startsWith(`${moduleRoot}/`)) return [];
  const candidates = new Set([normalized]);
  if (normalized.includes("/dist/")) {
    const sourceStem = normalized
      .replace("/dist/", "/src/")
      .replace(/\.d\.[cm]?ts$/u, "")
      .replace(/\.[cm]?js$/u, "");
    for (const extension of [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx"]) {
      candidates.add(`${sourceStem}${extension}`);
    }
  }
  return [...candidates];
};

const sourceKindForPath = (filePath: string): ts.ScriptKind => {
  if (/\.tsx$/u.test(filePath)) return ts.ScriptKind.TSX;
  if (/\.jsx$/u.test(filePath)) return ts.ScriptKind.JSX;
  if (/\.[cm]?js$/u.test(filePath)) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
};

const stringArgument = (node: ts.Expression | undefined): string | null => {
  if (!node) return null;
  if (ts.isStringLiteralLike(node)) return node.text;
  if (
    ts.isAsExpression(node) ||
    ts.isParenthesizedExpression(node) ||
    ts.isSatisfiesExpression(node) ||
    ts.isTypeAssertionExpression(node)
  ) {
    return stringArgument(node.expression);
  }
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = stringArgument(node.left);
    const right = stringArgument(node.right);
    return left === null || right === null ? null : `${left}${right}`;
  }
  return null;
};

const staticPropertyArgument = (node: ts.Expression | undefined): string | null => {
  const stringValue = stringArgument(node);
  if (stringValue !== null) return stringValue;
  return node && ts.isNumericLiteral(node) ? node.text : null;
};

const propertyChain = (node: ts.Expression): readonly string[] | null => {
  if (ts.isIdentifier(node)) return [node.text];
  if (ts.isPropertyAccessExpression(node)) {
    const parent = propertyChain(node.expression);
    return parent ? [...parent, node.name.text] : null;
  }
  if (ts.isElementAccessExpression(node)) {
    const parent = propertyChain(node.expression);
    const property = stringArgument(node.argumentExpression);
    return parent && property ? [...parent, property] : null;
  }
  return null;
};

const unwrapExpression = (expression: ts.Expression): ts.Expression => {
  let current = expression;
  while (
    ts.isAsExpression(current) ||
    ts.isParenthesizedExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isTypeAssertionExpression(current)
  ) {
    current = current.expression;
  }
  return current;
};

const staticNextConfiguration = (sourceFile: ts.SourceFile): boolean => {
  const exportAssignments = sourceFile.statements.filter(ts.isExportAssignment);
  const exportAssignment = exportAssignments[0];
  if (exportAssignments.length !== 1 || !exportAssignment || exportAssignment.isExportEquals) {
    return false;
  }
  const exported = unwrapExpression(exportAssignment.expression);
  let objectLiteral: ts.ObjectLiteralExpression | undefined;

  if (ts.isObjectLiteralExpression(exported)) {
    objectLiteral = exported;
  } else if (ts.isIdentifier(exported)) {
    const declarations: ts.VariableDeclaration[] = [];
    for (const statement of sourceFile.statements) {
      if (!ts.isVariableStatement(statement)) continue;
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && declaration.name.text === exported.text) {
          declarations.push(declaration);
        }
      }
    }
    if (declarations.length !== 1 || !declarations[0]?.initializer) return false;
    const initializer = unwrapExpression(declarations[0].initializer);
    if (!ts.isObjectLiteralExpression(initializer)) return false;
    objectLiteral = initializer;

    let referenceCount = 0;
    const countReferences = (node: ts.Node): void => {
      if (ts.isIdentifier(node) && node.text === exported.text) referenceCount += 1;
      ts.forEachChild(node, countReferences);
    };
    countReferences(sourceFile);
    if (referenceCount !== 2) return false;
  } else {
    return false;
  }

  const allowedBooleanKeys = new Set([
    "reactStrictMode",
    "skipProxyUrlNormalize",
    "skipTrailingSlashRedirect",
    "typedRoutes",
  ]);
  return objectLiteral.properties.every((property) => {
    if (!ts.isPropertyAssignment(property) || ts.isComputedPropertyName(property.name))
      return false;
    const name =
      ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name)
        ? property.name.text
        : null;
    if (name === "experimental") {
      const value = unwrapExpression(property.initializer);
      if (!ts.isObjectLiteralExpression(value) || value.properties.length !== 1) return false;
      const [caseSensitiveRoutes] = value.properties;
      if (
        !caseSensitiveRoutes ||
        !ts.isPropertyAssignment(caseSensitiveRoutes) ||
        ts.isComputedPropertyName(caseSensitiveRoutes.name)
      ) {
        return false;
      }
      const experimentalName =
        ts.isIdentifier(caseSensitiveRoutes.name) ||
        ts.isStringLiteralLike(caseSensitiveRoutes.name)
          ? caseSensitiveRoutes.name.text
          : null;
      const experimentalValue = unwrapExpression(caseSensitiveRoutes.initializer);
      return (
        experimentalName === "caseSensitiveRoutes" &&
        experimentalValue.kind === ts.SyntaxKind.TrueKeyword
      );
    }
    if (name === null || !allowedBooleanKeys.has(name)) return false;
    const value = unwrapExpression(property.initializer);
    return value.kind === ts.SyntaxKind.TrueKeyword;
  });
};

const parseSource = (
  file: RepositoryArchitectureFile,
  findings: ArchitectureFinding[],
): ParsedSource => {
  const sourceFile = ts.createSourceFile(
    file.path,
    file.source,
    ts.ScriptTarget.Latest,
    true,
    sourceKindForPath(file.path),
  );
  const diagnostics = (sourceFile as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] })
    .parseDiagnostics;
  if (diagnostics.length > 0) add(findings, "source-parse", file.path);

  const imports: ImportReference[] = [];
  const frameworkConfigStatic =
    !/^apps\/(?:admin|web)\/next\.config\.[cm]?[jt]s$/u.test(file.path) ||
    staticNextConfiguration(sourceFile);
  const clientModule = sourceFile.statements.some(
    (statement) =>
      ts.isExpressionStatement(statement) &&
      ts.isStringLiteral(statement.expression) &&
      statement.expression.text === "use client",
  );
  let environmentAccess = false;
  let consoleAccess = false;
  let descriptorReflection = false;
  let networkAccess = false;
  let rawOutputAccess = false;
  let runtimeGlobalAccess = false;
  let trustedJobContinuation = false;
  let unsafeConsoleAccess = false;
  let unsafeCodeLoading = false;
  let unsafeUiComposition = false;
  let unsafeUiJsxSurface = false;
  let uiStorageAccess = false;
  let buildPathAlias = false;
  const addImport = (node: ts.Node, specifier: string | null): void => {
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    imports.push(Object.freeze({ line: line + 1, specifier }));
    if (specifier !== null && unsafeNodeBuiltins.has(specifier)) unsafeCodeLoading = true;
  };

  for (const reference of sourceFile.referencedFiles) {
    const { line } = sourceFile.getLineAndCharacterOfPosition(reference.pos);
    imports.push(Object.freeze({ line: line + 1, specifier: reference.fileName }));
  }
  for (const reference of sourceFile.typeReferenceDirectives) {
    const { line } = sourceFile.getLineAndCharacterOfPosition(reference.pos);
    imports.push(Object.freeze({ line: line + 1, specifier: reference.fileName }));
  }
  for (const reference of sourceFile.libReferenceDirectives) {
    const { line } = sourceFile.getLineAndCharacterOfPosition(reference.pos);
    imports.push(Object.freeze({ line: line + 1, specifier: reference.fileName }));
  }

  const unsafeCallableBindings = new Set<string>();
  let discoveredUnsafeBinding = true;
  while (discoveredUnsafeBinding) {
    discoveredUnsafeBinding = false;
    const collectUnsafeBindings = (node: ts.Node): void => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
        const initializer = unwrapExpression(node.initializer);
        const unsafeInitializer =
          (ts.isIdentifier(initializer) && unsafeCallableBindings.has(initializer.text)) ||
          (ts.isElementAccessExpression(initializer) &&
            staticPropertyArgument(initializer.argumentExpression) === null);
        if (unsafeInitializer && !unsafeCallableBindings.has(node.name.text)) {
          unsafeCallableBindings.add(node.name.text);
          discoveredUnsafeBinding = true;
        }
      }
      ts.forEachChild(node, collectUnsafeBindings);
    };
    collectUnsafeBindings(sourceFile);
  }

  const unsafeUiHostBindings = new Set<string>();
  let discoveredUiBinding = true;
  while (discoveredUiBinding) {
    discoveredUiBinding = false;
    const collectUiBindings = (node: ts.Node): void => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
        const initializer = unwrapExpression(node.initializer);
        const unsafeHost =
          ts.isStringLiteralLike(initializer) ||
          (ts.isIdentifier(initializer) && unsafeUiHostBindings.has(initializer.text));
        if (unsafeHost && !unsafeUiHostBindings.has(node.name.text)) {
          unsafeUiHostBindings.add(node.name.text);
          discoveredUiBinding = true;
        }
      }
      ts.forEachChild(node, collectUiBindings);
    };
    collectUiBindings(sourceFile);
  }

  const trustedLocalHrefImport = sourceFile.statements.some(
    (statement) =>
      ts.isImportDeclaration(statement) &&
      stringArgument(statement.moduleSpecifier) === "./contracts.js" &&
      statement.importClause?.namedBindings !== undefined &&
      ts.isNamedImports(statement.importClause.namedBindings) &&
      statement.importClause.namedBindings.elements.some(
        (element) =>
          element.name.text === "createLocalActionHref" &&
          (element.propertyName?.text ?? element.name.text) === "createLocalActionHref",
      ),
  );
  const reactNamespaceBindings = new Set<string>();
  let unsafeReactFactoryImport = false;
  for (const statement of sourceFile.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      stringArgument(statement.moduleSpecifier) !== "react" ||
      !statement.importClause?.namedBindings
    ) {
      continue;
    }
    if (ts.isNamespaceImport(statement.importClause.namedBindings)) {
      reactNamespaceBindings.add(statement.importClause.namedBindings.name.text);
    } else {
      unsafeReactFactoryImport = statement.importClause.namedBindings.elements.some((element) =>
        ["cloneElement", "createElement"].includes(element.propertyName?.text ?? element.name.text),
      );
    }
  }
  if (unsafeReactFactoryImport) {
    networkAccess = true;
    unsafeUiComposition = true;
    unsafeUiJsxSurface = true;
  }

  const trustedUiComponentBindings = new Set<string>();
  const trustedComponentDeclaration = (node: ts.Node): boolean => {
    if (
      ts.isFunctionDeclaration(node) &&
      node.parent === sourceFile &&
      node.name &&
      allowedUiComponentElements.has(node.name.text)
    ) {
      return true;
    }
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      allowedUiComponentElements.has(node.name.text) &&
      node.initializer &&
      (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer)) &&
      ts.isVariableDeclarationList(node.parent) &&
      (node.parent.flags & ts.NodeFlags.Const) !== 0 &&
      ts.isVariableStatement(node.parent.parent) &&
      node.parent.parent.parent === sourceFile
    ) {
      return true;
    }
    return false;
  };
  for (const statement of sourceFile.statements) {
    if (trustedComponentDeclaration(statement) && ts.isFunctionDeclaration(statement)) {
      trustedUiComponentBindings.add(statement.name?.text ?? "");
    }
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (trustedComponentDeclaration(declaration) && ts.isIdentifier(declaration.name)) {
          trustedUiComponentBindings.add(declaration.name.text);
        }
      }
    }
  }
  const shadowedUiComponentBindings = new Set<string>();
  const collectBindingNames = (name: ts.BindingName): readonly string[] => {
    if (ts.isIdentifier(name)) return [name.text];
    return name.elements.flatMap((element) =>
      ts.isOmittedExpression(element) ? [] : collectBindingNames(element.name),
    );
  };
  const collectAssignedNames = (expression: ts.Expression): readonly string[] => {
    const target = unwrapExpression(expression);
    if (ts.isIdentifier(target)) return [target.text];
    if (ts.isArrayLiteralExpression(target)) {
      return target.elements.flatMap((element) => {
        if (ts.isOmittedExpression(element)) return [];
        return collectAssignedNames(ts.isSpreadElement(element) ? element.expression : element);
      });
    }
    if (ts.isObjectLiteralExpression(target)) {
      return target.properties.flatMap((property) => {
        if (ts.isShorthandPropertyAssignment(property)) return [property.name.text];
        if (ts.isPropertyAssignment(property)) return collectAssignedNames(property.initializer);
        if (ts.isSpreadAssignment(property)) return collectAssignedNames(property.expression);
        return [];
      });
    }
    return [];
  };
  const collectUiComponentShadows = (node: ts.Node): void => {
    let names: readonly string[] = [];
    let trusted = false;
    if (ts.isVariableDeclaration(node) || ts.isParameter(node) || ts.isBindingElement(node)) {
      names = collectBindingNames(node.name);
      trusted = ts.isVariableDeclaration(node) && trustedComponentDeclaration(node);
    } else if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) && node.name) {
      names = [node.name.text];
      trusted = trustedComponentDeclaration(node);
    } else if (ts.isImportSpecifier(node) || ts.isNamespaceImport(node)) {
      names = [node.name.text];
    }
    if (!trusted) {
      for (const name of names) {
        if (allowedUiComponentElements.has(name)) shadowedUiComponentBindings.add(name);
      }
    }
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
      node.operatorToken.kind <= ts.SyntaxKind.LastAssignment
    ) {
      for (const name of collectAssignedNames(node.left)) {
        if (allowedUiComponentElements.has(name)) shadowedUiComponentBindings.add(name);
      }
    }
    if (
      (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) &&
      ts.isIdentifier(node.operand) &&
      allowedUiComponentElements.has(node.operand.text)
    ) {
      shadowedUiComponentBindings.add(node.operand.text);
    }
    if (
      (ts.isForInStatement(node) || ts.isForOfStatement(node)) &&
      !ts.isVariableDeclarationList(node.initializer)
    ) {
      for (const name of collectAssignedNames(node.initializer)) {
        if (allowedUiComponentElements.has(name)) shadowedUiComponentBindings.add(name);
      }
    }
    ts.forEachChild(node, collectUiComponentShadows);
  };
  collectUiComponentShadows(sourceFile);

  const jsxTagName = (node: ts.JsxOpeningLikeElement): string | null =>
    ts.isIdentifier(node.tagName) ? node.tagName.text : null;

  const isSafeLocalHrefAttribute = (node: ts.JsxAttribute): boolean => {
    const opening = node.parent.parent;
    if (
      (!ts.isJsxOpeningElement(opening) && !ts.isJsxSelfClosingElement(opening)) ||
      jsxTagName(opening) !== "a" ||
      !node.initializer ||
      !ts.isJsxExpression(node.initializer) ||
      !node.initializer.expression
    ) {
      return false;
    }
    const expression = unwrapExpression(node.initializer.expression);
    if (
      file.path !== "packages/ui/src/primitives.tsx" ||
      !trustedLocalHrefImport ||
      !ts.isIdentifier(expression)
    ) {
      return false;
    }
    let nearestFunction: ts.Node | undefined = node;
    while (nearestFunction && !ts.isFunctionLike(nearestFunction)) {
      nearestFunction = nearestFunction.parent;
    }
    if (
      !nearestFunction ||
      !ts.isFunctionDeclaration(nearestFunction) ||
      nearestFunction.name?.text !== "ActionLink"
    ) {
      return false;
    }
    const owner = nearestFunction;
    const ownerBody = owner.body;
    if (!ownerBody) return false;
    const hrefParameterCount = owner.parameters.reduce(
      (count, parameter) =>
        count + collectBindingNames(parameter.name).filter((name) => name === "href").length,
      0,
    );
    if (hrefParameterCount !== 1) return false;

    let targetDeclarations = 0;
    let trustedTargetDeclaration = false;
    let targetReassigned = false;
    let constructorShadowed = false;
    let hrefShadowedOrReassigned = false;
    const targetName = expression.text;
    const inspectActionLink = (candidate: ts.Node): void => {
      if (ts.isVariableDeclaration(candidate) && ts.isIdentifier(candidate.name)) {
        if (candidate.name.text === targetName) {
          targetDeclarations += 1;
          const initializer = candidate.initializer
            ? unwrapExpression(candidate.initializer)
            : undefined;
          const hrefArgument =
            initializer && ts.isCallExpression(initializer) ? initializer.arguments[0] : undefined;
          trustedTargetDeclaration =
            trustedTargetDeclaration ||
            Boolean(
              initializer &&
              ts.isCallExpression(initializer) &&
              ts.isIdentifier(initializer.expression) &&
              initializer.expression.text === "createLocalActionHref" &&
              initializer.arguments.length === 1 &&
              hrefArgument !== undefined &&
              ts.isIdentifier(hrefArgument) &&
              hrefArgument.text === "href" &&
              ts.isVariableDeclarationList(candidate.parent) &&
              (candidate.parent.flags & ts.NodeFlags.Const) !== 0 &&
              candidate.parent.declarations.length === 1 &&
              ts.isVariableStatement(candidate.parent.parent) &&
              candidate.parent.parent.parent === ownerBody,
            );
        }
        if (candidate.name.text === "createLocalActionHref") constructorShadowed = true;
        if (candidate.name.text === "href") hrefShadowedOrReassigned = true;
      }
      if (
        ts.isParameter(candidate) &&
        collectBindingNames(candidate.name).includes("createLocalActionHref")
      ) {
        constructorShadowed = true;
      }
      if (ts.isParameter(candidate) && collectBindingNames(candidate.name).includes("href")) {
        hrefShadowedOrReassigned = true;
      }
      if (
        ts.isFunctionDeclaration(candidate) &&
        candidate !== owner &&
        candidate.name?.text === "createLocalActionHref"
      ) {
        constructorShadowed = true;
      }
      if (
        ts.isBinaryExpression(candidate) &&
        candidate.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
        candidate.operatorToken.kind <= ts.SyntaxKind.LastAssignment
      ) {
        const assignedNames = collectAssignedNames(candidate.left);
        if (assignedNames.includes(targetName)) targetReassigned = true;
        if (assignedNames.includes("createLocalActionHref")) constructorShadowed = true;
        if (assignedNames.includes("href")) hrefShadowedOrReassigned = true;
      }
      if (
        (ts.isPrefixUnaryExpression(candidate) || ts.isPostfixUnaryExpression(candidate)) &&
        ts.isIdentifier(candidate.operand) &&
        [targetName, "createLocalActionHref", "href"].includes(candidate.operand.text)
      ) {
        if (candidate.operand.text === targetName) targetReassigned = true;
        if (candidate.operand.text === "createLocalActionHref") constructorShadowed = true;
        if (candidate.operand.text === "href") hrefShadowedOrReassigned = true;
      }
      if (
        (ts.isForInStatement(candidate) || ts.isForOfStatement(candidate)) &&
        !ts.isVariableDeclarationList(candidate.initializer)
      ) {
        const assignedNames = collectAssignedNames(candidate.initializer);
        if (assignedNames.includes(targetName)) targetReassigned = true;
        if (assignedNames.includes("createLocalActionHref")) constructorShadowed = true;
        if (assignedNames.includes("href")) hrefShadowedOrReassigned = true;
      }
      ts.forEachChild(candidate, inspectActionLink);
    };
    inspectActionLink(ownerBody);
    return (
      targetDeclarations === 1 &&
      trustedTargetDeclaration &&
      !targetReassigned &&
      !constructorShadowed &&
      !hrefShadowedOrReassigned
    );
  };

  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      if (node.moduleSpecifier) addImport(node, stringArgument(node.moduleSpecifier));
    } else if (ts.isImportTypeNode(node)) {
      addImport(
        node,
        ts.isLiteralTypeNode(node.argument) ? stringArgument(node.argument.literal) : null,
      );
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      addImport(node, stringArgument(node.moduleReference.expression));
    } else if (ts.isCallExpression(node)) {
      const unwrappedCallee = unwrapExpression(node.expression);
      const callChain =
        ts.isIdentifier(node.expression) ||
        ts.isPropertyAccessExpression(node.expression) ||
        ts.isElementAccessExpression(node.expression)
          ? propertyChain(node.expression)
          : null;
      if (
        (ts.isIdentifier(unwrappedCallee) && unsafeCallableBindings.has(unwrappedCallee.text)) ||
        (ts.isElementAccessExpression(unwrappedCallee) &&
          staticPropertyArgument(unwrappedCallee.argumentExpression) === null)
      ) {
        unsafeCodeLoading = true;
      }
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        addImport(node, stringArgument(node.arguments[0]));
      } else if (callChain?.join(".") === "require") {
        addImport(node, stringArgument(node.arguments[0]));
      } else if (["module.require", "require.resolve"].includes(callChain?.join(".") ?? "")) {
        addImport(node, stringArgument(node.arguments[0]));
      } else if (
        ts.isPropertyAccessExpression(node.expression) &&
        ts.isMetaProperty(node.expression.expression) &&
        node.expression.name.text === "resolve"
      ) {
        addImport(node, stringArgument(node.arguments[0]));
      }
      if (
        callChain?.at(-1) === "fetch" ||
        callChain?.at(-1) === "fetchLater" ||
        (ts.isIdentifier(unwrappedCallee) && unwrappedCallee.text === "open")
      ) {
        networkAccess = true;
      }
      if (callChain?.at(-1) === "continueTrustedJob") {
        trustedJobContinuation = true;
      }
      if (
        [
          "globalThis.process._rawDebug",
          "globalThis.process.emitWarning",
          "globalThis.process.stderr.write",
          "globalThis.process.stdout.write",
          "process._rawDebug",
          "process.emitWarning",
          "process.stderr.write",
          "process.stdout.write",
        ].includes(callChain?.join(".") ?? "")
      ) {
        rawOutputAccess = true;
      }
      if (
        ["createRequire", "eval", "Function", "getBuiltinModule", "require"].includes(
          callChain?.at(-1) ?? "",
        ) ||
        callChain?.join(".") === "require.resolve"
      ) {
        unsafeCodeLoading = true;
      }
    } else if (
      ts.isNewExpression(node) &&
      ts.isIdentifier(node.expression) &&
      [
        "EventSource",
        "RTCPeerConnection",
        "WebSocket",
        "WebSocketStream",
        "XMLHttpRequest",
      ].includes(node.expression.text)
    ) {
      networkAccess = true;
    }
    if (
      ts.isNewExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "Function"
    ) {
      unsafeCodeLoading = true;
    }

    if (ts.isIdentifier(node)) {
      if (uiStorageIdentifiers.has(node.text)) uiStorageAccess = true;
      if (["cloneElement", "createElement"].includes(node.text)) unsafeUiComposition = true;
      if (node.text === "console") {
        consoleAccess = true;
        const property = node.parent;
        const call = ts.isPropertyAccessExpression(property) ? property.parent : undefined;
        const arrow = call && ts.isCallExpression(call) ? call.parent : undefined;
        const assignment = arrow && ts.isArrowFunction(arrow) ? arrow.parent : undefined;
        const parameter = arrow && ts.isArrowFunction(arrow) ? arrow.parameters[0] : undefined;
        const argument = call && ts.isCallExpression(call) ? call.arguments[0] : undefined;
        if (
          !ts.isPropertyAccessExpression(property) ||
          property.expression !== node ||
          property.name.text !== "info" ||
          !call ||
          !ts.isCallExpression(call) ||
          call.expression !== property ||
          call.arguments.length !== 1 ||
          !argument ||
          !ts.isIdentifier(argument) ||
          argument.text !== "line" ||
          !arrow ||
          !ts.isArrowFunction(arrow) ||
          arrow.body !== call ||
          arrow.parameters.length !== 1 ||
          !parameter ||
          !ts.isIdentifier(parameter.name) ||
          parameter.name.text !== "line" ||
          !assignment ||
          !ts.isPropertyAssignment(assignment) ||
          (ts.isIdentifier(assignment.name) && assignment.name.text !== "writeLine") ||
          (ts.isStringLiteralLike(assignment.name) && assignment.name.text !== "writeLine") ||
          (!ts.isIdentifier(assignment.name) && !ts.isStringLiteralLike(assignment.name))
        ) {
          unsafeConsoleAccess = true;
        }
      }
      if (["_rawDebug", "emitWarning", "stderr", "stdout"].includes(node.text)) {
        rawOutputAccess = true;
      }
      if (node.text === "continueTrustedJob" || node.text === "continuePersistedJobObservability") {
        trustedJobContinuation = true;
      }
      if (["Bun", "Deno", "globalThis", "process"].includes(node.text)) {
        runtimeGlobalAccess = true;
      }
      if (unsafeRuntimeIdentifiers.has(node.text)) unsafeCodeLoading = true;
      if (descriptorReflectionIdentifiers.has(node.text)) descriptorReflection = true;
      if (networkRuntimeIdentifiers.has(node.text)) networkAccess = true;
    }
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tagName = jsxTagName(node);
      if (tagName === null) {
        unsafeUiComposition = true;
        unsafeUiJsxSurface = true;
      } else if (tagName[0] === tagName[0]?.toLowerCase()) {
        if (!allowedUiIntrinsicElements.has(tagName)) unsafeUiJsxSurface = true;
        if (uiNetworkIntrinsicElements.has(tagName)) networkAccess = true;
      } else if (
        unsafeUiHostBindings.has(tagName) ||
        !trustedUiComponentBindings.has(tagName) ||
        shadowedUiComponentBindings.has(tagName)
      ) {
        networkAccess = true;
        unsafeUiComposition = true;
        unsafeUiJsxSurface = true;
      }
    }
    if (ts.isJsxSpreadAttribute(node)) unsafeUiJsxSurface = true;
    if (ts.isJsxAttribute(node)) {
      if (!ts.isIdentifier(node.name)) {
        unsafeUiJsxSurface = true;
      } else {
        const attributeName = node.name.text.toLowerCase();
        const safeLocalHref = attributeName === "href" && isSafeLocalHrefAttribute(node);
        if (unsafeUiJsxAttributes.has(attributeName) && !safeLocalHref) {
          unsafeUiJsxSurface = true;
          if (attributeName === "as" || attributeName === "aschild") {
            unsafeUiComposition = true;
          }
        }
        if (unsafeUiNetworkAttributes.has(attributeName) && !safeLocalHref) {
          networkAccess = true;
          unsafeUiJsxSurface = true;
        }
      }
    }

    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      const chain = propertyChain(node);
      if (
        ts.isElementAccessExpression(node) &&
        staticPropertyArgument(node.argumentExpression) === "console"
      ) {
        consoleAccess = true;
      }
      const staticProperty = ts.isElementAccessExpression(node)
        ? staticPropertyArgument(node.argumentExpression)
        : null;
      if (
        staticProperty === "cloneElement" ||
        staticProperty === "createElement" ||
        (ts.isElementAccessExpression(node) &&
          ts.isIdentifier(node.expression) &&
          reactNamespaceBindings.has(node.expression.text))
      ) {
        networkAccess = true;
        unsafeUiComposition = true;
        unsafeUiJsxSurface = true;
      }
      if (
        staticProperty !== null &&
        [
          "_rawDebug",
          "continuePersistedJobObservability",
          "continueTrustedJob",
          "emitWarning",
          "stderr",
          "stdout",
        ].includes(staticProperty)
      ) {
        if (
          staticProperty === "continuePersistedJobObservability" ||
          staticProperty === "continueTrustedJob"
        ) {
          trustedJobContinuation = true;
        } else {
          rawOutputAccess = true;
        }
      }
      if (
        ts.isElementAccessExpression(node) &&
        descriptorReflectionIdentifiers.has(staticPropertyArgument(node.argumentExpression) ?? "")
      ) {
        descriptorReflection = true;
      }
      if (
        chain &&
        ((chain[0] === "process" && chain[1] === "env") ||
          (chain[0] === "globalThis" && chain[1] === "process" && chain[2] === "env"))
      ) {
        environmentAccess = true;
      }
      if (chain?.join(".") === "process.getBuiltinModule") unsafeCodeLoading = true;
      if (
        chain?.at(-1) === "resolveAlias" ||
        (chain?.at(-2) === "resolve" && chain.at(-1) === "alias")
      ) {
        buildPathAlias = true;
      }
      if (
        ts.isElementAccessExpression(node) &&
        (staticPropertyArgument(node.argumentExpression) === null ||
          unsafeRuntimeIdentifiers.has(staticPropertyArgument(node.argumentExpression) ?? ""))
      ) {
        unsafeCodeLoading = true;
      }
    }
    if (
      (ts.isPropertyAssignment(node) ||
        ts.isMethodDeclaration(node) ||
        ts.isShorthandPropertyAssignment(node)) &&
      ((ts.isIdentifier(node.name) &&
        ["alias", "resolveAlias", "webpack"].includes(node.name.text)) ||
        (ts.isStringLiteralLike(node.name) &&
          ["alias", "resolveAlias", "webpack"].includes(node.name.text)))
    ) {
      buildPathAlias = true;
    }
    if (ts.isComputedPropertyName(node)) buildPathAlias = true;
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  const visitedJSDoc = new Set<ts.Node>();
  const visitAttachedJSDoc = (node: ts.Node): void => {
    const documents = (node as ts.Node & { jsDoc?: readonly ts.JSDoc[] }).jsDoc ?? [];
    for (const document of documents) {
      if (visitedJSDoc.has(document)) continue;
      visitedJSDoc.add(document);
      visit(document);
    }
    ts.forEachChild(node, visitAttachedJSDoc);
  };
  visitAttachedJSDoc(sourceFile);
  return Object.freeze({
    buildPathAlias,
    clientModule,
    consoleAccess,
    descriptorReflection,
    environmentAccess,
    frameworkConfigStatic,
    imports,
    networkAccess,
    rawOutputAccess,
    runtimeGlobalAccess,
    trustedJobContinuation,
    unsafeConsoleAccess,
    unsafeCodeLoading,
    unsafeUiComposition,
    unsafeUiJsxSurface,
    uiStorageAccess,
  });
};

const isProductionFile = (filePath: string): boolean =>
  !testPath.test(filePath) && !generatedPath.test(filePath);

const isRuntimeDependencyFile = (filePath: string): boolean =>
  isProductionFile(filePath) &&
  (/^packages\/[^/]+\/src\//u.test(filePath) ||
    /^apps\/[^/]+\/(?:app|composition|config|server|src)\//u.test(filePath) ||
    /^apps\/[^/]+\/(?:instrumentation(?:-client)?|middleware|proxy|start)\.[cm]?[jt]sx?$/u.test(
      filePath,
    ));

const isCommonJsRuntimeFile = (filePath: string): boolean =>
  isRuntimeDependencyFile(filePath) && /\.(?:cjs|cts)$/u.test(filePath);

const expectedTsconfigExtends = (filePath: string): string | null | undefined => {
  if (filePath === "tsconfig.base.json") return null;
  if (filePath === "tsconfig.json") return "./tsconfig.base.json";
  if (/^(?:apps|packages)\/[^/]+\/tsconfig\.json$/u.test(filePath)) {
    return "../../tsconfig.base.json";
  }
  if (/^(?:apps|packages)\/[^/]+\/tsconfig\.build\.json$/u.test(filePath)) {
    return "./tsconfig.json";
  }
  return undefined;
};

const isUiFile = (filePath: string, module: ModuleDefinition): boolean => {
  if (!isProductionFile(filePath)) return false;
  if (module.root === "packages/ui") return true;
  if (module.root !== "apps/web" && module.root !== "apps/admin") return false;
  return /\.[jt]sx$/u.test(filePath) || /\/(?:app|components|ui)\//u.test(filePath);
};

const applyInternalDirectionPolicy = (
  findings: ArchitectureFinding[],
  source: ModuleDefinition,
  target: ModuleDefinition,
  location: string,
): void => {
  if (source.name === target.name) return;
  if (!(allowedInternalDependencies.get(source.name)?.has(target.name) ?? false)) {
    add(findings, "internal-dependency-direction", location, target.name);
  }
  if (source.kind === "package" && target.kind === "app") {
    add(findings, "package-imports-app", location, target.name);
  }
  if (source.kind === "app" && target.kind === "app") {
    add(findings, "app-imports-app", location, target.name);
  }
  if (source.root === "packages/domain") {
    add(findings, "domain-internal-dependency", location, target.name);
  }
  if (source.root === "packages/divination" && target.root === "packages/ai") {
    add(findings, "divination-imports-ai", location, target.name);
  }
  if (source.root === "packages/ui" && target.root === "packages/db") {
    add(findings, "ui-data-adapter", location, target.name);
  }
};

const resolveRelativeImport = (
  importer: string,
  specifier: string,
  codePaths: ReadonlySet<string>,
): string | "asset" | "prisma-generated" | null => {
  if (assetExtension.test(specifier)) return "asset";
  const base = normalizeRepositoryPath(path.posix.join(path.posix.dirname(importer), specifier));
  if (importer.startsWith("packages/db/") && base.startsWith("packages/db/src/generated/prisma/")) {
    return "prisma-generated";
  }
  const candidates = new Set<string>([base]);
  const extension = path.posix.extname(base);
  if (extension === "") {
    for (const candidateExtension of [
      ".ts",
      ".tsx",
      ".mts",
      ".cts",
      ".js",
      ".jsx",
      ".mjs",
      ".cjs",
    ]) {
      candidates.add(`${base}${candidateExtension}`);
      candidates.add(`${base}/index${candidateExtension}`);
    }
  } else {
    const stem = base.slice(0, -extension.length);
    const replacements: Readonly<Record<string, readonly string[]>> = {
      ".cjs": [".cts", ".ts"],
      ".js": [".ts", ".tsx", ".mts", ".cts"],
      ".jsx": [".tsx", ".ts"],
      ".mjs": [".mts", ".ts"],
    };
    for (const replacement of replacements[extension] ?? [])
      candidates.add(`${stem}${replacement}`);
  }
  return [...candidates].find((candidate) => codePaths.has(candidate)) ?? null;
};

const cycleComponents = (
  graph: ReadonlyMap<string, ReadonlySet<string>>,
): readonly (readonly string[])[] => {
  let nextIndex = 0;
  const indexes = new Map<string, number>();
  const lowLinks = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const cycles: string[][] = [];

  const visit = (node: string): void => {
    indexes.set(node, nextIndex);
    lowLinks.set(node, nextIndex);
    nextIndex += 1;
    stack.push(node);
    onStack.add(node);

    for (const target of [...(graph.get(node) ?? [])].sort()) {
      if (!indexes.has(target)) {
        visit(target);
        lowLinks.set(node, Math.min(lowLinks.get(node) ?? 0, lowLinks.get(target) ?? 0));
      } else if (onStack.has(target)) {
        lowLinks.set(node, Math.min(lowLinks.get(node) ?? 0, indexes.get(target) ?? 0));
      }
    }

    if (lowLinks.get(node) !== indexes.get(node)) return;
    const component: string[] = [];
    let member: string | undefined;
    do {
      member = stack.pop();
      if (member === undefined) break;
      onStack.delete(member);
      component.push(member);
    } while (member !== node);
    component.sort();
    if (
      component.length > 1 ||
      (component.length === 1 && (graph.get(component[0] ?? "")?.has(component[0] ?? "") ?? false))
    ) {
      cycles.push(component);
    }
  };

  for (const node of [...graph.keys()].sort()) if (!indexes.has(node)) visit(node);
  return cycles.sort((left, right) => left.join("|").localeCompare(right.join("|")));
};

const dependencyEntries = (
  manifest: Record<string, unknown>,
  sections: readonly string[],
): readonly (readonly [string, string])[] => {
  const entries: Array<readonly [string, string]> = [];
  for (const section of sections) {
    const value = manifest[section];
    if (!isRecord(value)) continue;
    for (const [name, version] of Object.entries(value)) {
      if (typeof version === "string") entries.push([name, version]);
    }
  }
  return entries;
};

export const auditArchitecture = (
  repositoryFiles: readonly RepositoryArchitectureFile[],
): readonly ArchitectureFinding[] => {
  const findings: ArchitectureFinding[] = [];
  const files = repositoryFiles
    .map((file) => Object.freeze({ ...file, path: normalizeRepositoryPath(file.path) }))
    .sort((left, right) => left.path.localeCompare(right.path));
  const seenPaths = new Set<string>();
  const fileByPath = new Map(files.map((file) => [file.path, file]));
  for (const file of files) {
    if (seenPaths.has(file.path)) add(findings, "duplicate-path", file.path);
    seenPaths.add(file.path);
    if (file.kind === "symlink") add(findings, "source-symlink", file.path);
    const candidateRoot = candidateRootForPath(file.path);
    if (candidateRoot && !moduleByRoot.has(candidateRoot)) {
      add(findings, "unregistered-module", candidateRoot);
    }
  }

  for (const file of files.filter(({ path: filePath }) =>
    /(?:^|\/)tsconfig(?:\.[^/]+)?\.json$/u.test(filePath),
  )) {
    if (file.kind === "symlink") continue;
    const parsed = ts.parseConfigFileTextToJson(file.path, file.source);
    if (parsed.error || !isRecord(parsed.config)) {
      add(findings, "tsconfig-json", file.path);
      continue;
    }
    const compilerOptions = parsed.config.compilerOptions;
    if (
      isRecord(compilerOptions) &&
      ["baseUrl", "moduleSuffixes", "paths", "rootDirs"].some((key) => key in compilerOptions)
    ) {
      add(findings, "tsconfig-path-alias", file.path);
    }
    const sourceModule = definitionForPath(file.path);
    if (
      file.path.endsWith("/tsconfig.json") &&
      (sourceModule?.root === "packages/domain" || sourceModule?.root === "packages/divination") &&
      (!isRecord(compilerOptions) ||
        !Array.isArray(compilerOptions.types) ||
        compilerOptions.types.length !== 0 ||
        (Array.isArray(compilerOptions.lib) &&
          compilerOptions.lib.some(
            (entry) => typeof entry === "string" && /^(?:DOM|WebWorker)/iu.test(entry),
          )))
    ) {
      add(findings, "pure-module-types", file.path);
    }
    const expectedExtends = expectedTsconfigExtends(file.path);
    if (
      expectedExtends === undefined ||
      (expectedExtends === null
        ? parsed.config.extends !== undefined
        : parsed.config.extends !== expectedExtends)
    ) {
      add(findings, "tsconfig-extends", file.path);
    } else if (expectedExtends !== null) {
      const target = normalizeRepositoryPath(
        path.posix.join(path.posix.dirname(file.path), expectedExtends),
      );
      if (!fileByPath.has(target) || fileByPath.get(target)?.kind === "symlink") {
        add(findings, "tsconfig-extends-target", file.path);
      }
    }
  }

  const allCodeFiles = files.filter((file) => codeExtension.test(file.path));
  const codeFiles = allCodeFiles.filter((file) => !generatedPath.test(file.path));
  const codePaths = new Set(allCodeFiles.map((file) => file.path));

  const manifests = new Map<string, ParsedManifest>();
  for (const file of files.filter(({ path: filePath }) =>
    /^(?:apps|packages)\/[^/]+\/package\.json$/u.test(filePath),
  )) {
    const sourceModule = definitionForPath(file.path);
    if (!sourceModule || file.kind === "symlink") continue;
    let manifest: unknown;
    try {
      manifest = JSON.parse(file.source) as unknown;
    } catch {
      add(findings, "manifest-json", file.path);
      continue;
    }
    if (!isRecord(manifest)) {
      add(findings, "manifest-shape", file.path);
      continue;
    }
    if (manifest.name !== sourceModule.name || manifest.private !== true) {
      add(findings, "manifest-identity", file.path);
    }
    if (manifest.imports !== undefined || manifest.typesVersions !== undefined) {
      add(findings, "manifest-path-alias", file.path);
    }
    const dependencies = new Map(dependencyEntries(manifest, dependencySections));
    const developmentDependencies = new Set(
      dependencyEntries(manifest, ["devDependencies"]).map(([name]) => name),
    );
    const runtimeDependencies = new Set(
      dependencyEntries(manifest, runtimeDependencySections).map(([name]) => name),
    );
    for (const [dependency, version] of dependencies) {
      if (moduleByName.has(dependency) && version !== "workspace:*") {
        add(findings, "workspace-protocol", file.path, dependency);
      }
      if (version.startsWith("workspace:") && !moduleByName.has(dependency)) {
        add(findings, "workspace-alias", file.path, dependency);
      }
      if (dependency.toLowerCase().startsWith("@rituvia/") && !dependency.startsWith("@rituvia/")) {
        add(findings, "internal-package-case", file.path, dependency);
      }
      if (/^(?:file|link|npm|portal):/u.test(version)) {
        add(findings, "dependency-protocol", file.path, dependency);
      }
      const owner = adapterOwner(dependency);
      if (owner && sourceModule.root !== owner) {
        add(findings, "adapter-ownership", file.path, dependency);
      }
    }
    const exportEntries = manifestExportEntries(manifest.exports);
    const exports = new Set(exportEntries.keys());
    const exportSources = new Map<string, readonly string[]>();
    for (const [subpath, targets] of exportEntries) {
      if (subpath.includes("*")) add(findings, "wildcard-export", file.path, subpath);
      exportSources.set(
        subpath,
        Object.freeze(
          [
            ...new Set(
              targets.flatMap((target) =>
                sourceCandidatesForExportTarget(sourceModule.root, target).filter(
                  (candidate) => codePaths.has(candidate) && isRuntimeDependencyFile(candidate),
                ),
              ),
            ),
          ].sort(),
        ),
      );
      if (
        targets.length === 0 ||
        targets.some((target) => {
          const candidates = sourceCandidatesForExportTarget(sourceModule.root, target);
          return !candidates.some(
            (candidate) => codePaths.has(candidate) && isRuntimeDependencyFile(candidate),
          );
        })
      ) {
        add(findings, "export-target", file.path, subpath);
      }
    }
    if (sourceModule.root === "packages/domain") {
      for (const dependency of runtimeDependencies) {
        add(findings, "domain-runtime-dependency", file.path, dependency);
      }
    }
    for (const dependency of runtimeDependencies) {
      if (
        !moduleByName.has(dependency) &&
        !(allowedExternalRuntimeDependencies.get(sourceModule.name)?.has(dependency) ?? false)
      ) {
        add(findings, "external-runtime-dependency", file.path, dependency);
      }
    }
    if (sourceModule.root === "packages/divination") {
      for (const dependency of runtimeDependencies) {
        if (!moduleByName.has(dependency)) {
          add(findings, "divination-external-dependency", file.path, dependency);
        }
      }
    }
    if (sourceModule.root === "packages/ui") {
      for (const dependency of runtimeDependencies) {
        if (!moduleByName.has(dependency) && !allowedUiExternalPackages.has(dependency)) {
          add(findings, "ui-external-adapter", file.path, dependency);
        }
      }
    }
    manifests.set(
      sourceModule.root,
      Object.freeze({
        dependencies,
        developmentDependencies,
        exports,
        exportSources,
        module: sourceModule,
        runtimeDependencies,
      }),
    );
  }

  const activeRoots = new Set(
    codeFiles.map((file) => candidateRootForPath(file.path)).filter(Boolean),
  );
  for (const root of [...activeRoots].sort()) {
    if (root && moduleByRoot.has(root) && !manifests.has(root)) {
      add(findings, "module-manifest-missing", root);
    }
    if (root && moduleByRoot.has(root) && !fileByPath.has(`${root}/tsconfig.json`)) {
      add(findings, "module-tsconfig-missing", root);
    }
  }

  const moduleGraph = new Map<string, Set<string>>(
    moduleDefinitions.map(({ name }) => [name, new Set<string>()]),
  );
  for (const manifest of manifests.values()) {
    for (const dependency of manifest.runtimeDependencies) {
      const target = moduleByName.get(dependency);
      if (!target) continue;
      moduleGraph.get(manifest.module.name)?.add(target.name);
      applyInternalDirectionPolicy(
        findings,
        manifest.module,
        target,
        `${manifest.module.root}/package.json`,
      );
    }
  }

  const fileGraph = new Map<string, Set<string>>(
    codeFiles
      .filter(({ path: filePath }) => isProductionFile(filePath))
      .map(({ path: filePath }) => [filePath, new Set<string>()]),
  );
  const clientFiles = new Set<string>();
  const serverTaintedFiles = new Set<string>();
  for (const file of codeFiles) {
    const sourceModule = definitionForPath(file.path);
    if (!sourceModule || file.kind === "symlink") continue;
    const parsed = parseSource(file, findings);
    if (
      parsed.clientModule ||
      /^packages\/config\/src\/client(?:[./-]|$)/u.test(file.path) ||
      /^apps\/(?:admin|web)\/config\/client/u.test(file.path)
    ) {
      clientFiles.add(file.path);
    }
    if (isCommonJsRuntimeFile(file.path)) {
      add(findings, "commonjs-runtime-source", file.path);
    }
    if (
      parsed.buildPathAlias &&
      /^apps\/(?:admin|web)\/next\.config\.[cm]?[jt]s$/u.test(file.path)
    ) {
      add(findings, "framework-path-alias", file.path);
    }
    if (!parsed.frameworkConfigStatic) {
      add(findings, "framework-config-dynamic", file.path);
    }
    if (parsed.unsafeCodeLoading && isRuntimeDependencyFile(file.path)) {
      add(findings, "unsafe-code-loading", file.path);
      serverTaintedFiles.add(file.path);
    }
    if (
      parsed.descriptorReflection &&
      isRuntimeDependencyFile(file.path) &&
      file.path !== "packages/observability/src/redaction.ts"
    ) {
      add(findings, "descriptor-reflection-outside-redaction", file.path);
      serverTaintedFiles.add(file.path);
    }
    if (
      parsed.consoleAccess &&
      isRuntimeDependencyFile(file.path) &&
      (parsed.unsafeConsoleAccess ||
        (file.path !== "apps/web/server/observability.ts" &&
          file.path !== "apps/worker/src/observability.ts"))
    ) {
      add(findings, "console-outside-observability-adapter", file.path);
      serverTaintedFiles.add(file.path);
    }
    if (parsed.rawOutputAccess && isRuntimeDependencyFile(file.path)) {
      add(findings, "raw-output-outside-observability-sink", file.path);
      serverTaintedFiles.add(file.path);
    }
    if (
      parsed.trustedJobContinuation &&
      isRuntimeDependencyFile(file.path) &&
      file.path !== "apps/worker/src/job-observability.ts" &&
      file.path !== "packages/observability/src/contracts.ts" &&
      file.path !== "packages/observability/src/runtime.ts" &&
      file.path !== "packages/observability/src/worker.ts"
    ) {
      add(findings, "trusted-job-continuation-outside-worker-boundary", file.path);
      serverTaintedFiles.add(file.path);
    }
    if (
      file.path === "apps/web/server/feature-flags.ts" &&
      file.source !== expectedWebFeatureFlagCompositionSource
    ) {
      add(findings, "feature-flag-composition-boundary", file.path);
      serverTaintedFiles.add(file.path);
    }
    if (sourceModule.root === "packages/domain" && isProductionFile(file.path)) {
      if (parsed.environmentAccess) add(findings, "domain-environment-access", file.path);
      if (parsed.networkAccess) add(findings, "domain-network-access", file.path);
      if (parsed.runtimeGlobalAccess) add(findings, "domain-runtime-global", file.path);
    }
    if (sourceModule.root === "packages/divination" && isProductionFile(file.path)) {
      if (parsed.environmentAccess) add(findings, "divination-environment-access", file.path);
      if (parsed.networkAccess) add(findings, "divination-network-access", file.path);
      if (parsed.runtimeGlobalAccess) add(findings, "divination-runtime-global", file.path);
    }
    if (sourceModule.root === "packages/ui" && isRuntimeDependencyFile(file.path)) {
      if (parsed.networkAccess) add(findings, "ui-network-access", file.path);
      if (parsed.environmentAccess || parsed.runtimeGlobalAccess) {
        add(findings, "ui-runtime-capability", file.path);
      }
      if (parsed.uiStorageAccess) add(findings, "ui-storage-access", file.path);
      if (parsed.unsafeUiComposition) add(findings, "ui-polymorphic-host", file.path);
      if (parsed.unsafeUiJsxSurface) add(findings, "ui-dangerous-jsx-surface", file.path);
      if (
        parsed.imports.some(({ specifier }) =>
          ["react/jsx-dev-runtime", "react/jsx-runtime"].includes(specifier ?? ""),
        )
      ) {
        add(findings, "ui-dangerous-jsx-surface", file.path);
        add(findings, "ui-polymorphic-host", file.path);
      }
    }
    if (parsed.environmentAccess || parsed.runtimeGlobalAccess) serverTaintedFiles.add(file.path);

    for (const reference of parsed.imports) {
      const location = `${file.path}:${reference.line}`;
      const specifier = reference.specifier;
      if (specifier === null) {
        add(findings, "dynamic-module-specifier", location);
        continue;
      }
      if (specifier.startsWith("#")) {
        add(findings, "package-import-alias", location, specifier);
        continue;
      }
      if (specifier.startsWith("/") || /^[a-z][a-z+.-]*:/iu.test(specifier)) {
        if (!specifier.startsWith("node:"))
          add(findings, "remote-or-absolute-import", location, specifier);
      }
      if (specifier.startsWith(".") || specifier.startsWith("/")) {
        const nominalTarget = normalizeRepositoryPath(
          path.posix.join(path.posix.dirname(file.path), specifier),
        );
        const nominalTargetModule = definitionForPath(nominalTarget);
        const crossModuleRecorded =
          nominalTargetModule !== undefined && nominalTargetModule.name !== sourceModule.name;
        if (crossModuleRecorded) {
          add(findings, "relative-cross-module-import", location, nominalTargetModule.name);
          applyInternalDirectionPolicy(findings, sourceModule, nominalTargetModule, location);
          if (isProductionFile(file.path))
            moduleGraph.get(sourceModule.name)?.add(nominalTargetModule.name);
        }
        const targetPath = resolveRelativeImport(file.path, specifier, codePaths);
        if (targetPath === "asset" || targetPath === "prisma-generated") continue;
        if (targetPath === null) {
          add(findings, "unresolved-relative-import", location, specifier);
          continue;
        }
        const targetModule = definitionForPath(targetPath);
        if (targetModule && targetModule.name !== sourceModule.name && !crossModuleRecorded) {
          add(findings, "relative-cross-module-import", location, targetModule.name);
          applyInternalDirectionPolicy(findings, sourceModule, targetModule, location);
          if (isProductionFile(file.path))
            moduleGraph.get(sourceModule.name)?.add(targetModule.name);
        }
        if (isProductionFile(file.path) && isProductionFile(targetPath)) {
          fileGraph.get(file.path)?.add(targetPath);
        }
        if (isProductionFile(file.path) && !isProductionFile(targetPath)) {
          add(findings, "production-imports-test", location, targetPath);
        }
        if (isRuntimeDependencyFile(file.path) && !isRuntimeDependencyFile(targetPath)) {
          add(findings, "runtime-imports-tool", location, targetPath);
        }
        continue;
      }

      const dependency = packageNameFromSpecifier(specifier);
      const targetModule = moduleByName.get(dependency);
      if (targetModule) {
        if (
          specifier === "@rituvia/observability/worker" &&
          file.path !== "apps/worker/src/job-observability.ts"
        ) {
          add(findings, "worker-observability-capability-import", location, specifier);
        }
        if (
          specifier === "@rituvia/config/feature-flags" &&
          file.path !== "apps/web/server/feature-flags.ts"
        ) {
          add(findings, "feature-flag-capability-import", location, specifier);
        }
        if (targetModule.name === sourceModule.name) {
          add(findings, "self-package-import", location, specifier);
        }
        if (targetModule.name !== sourceModule.name) {
          if (isProductionFile(file.path))
            moduleGraph.get(sourceModule.name)?.add(targetModule.name);
          applyInternalDirectionPolicy(findings, sourceModule, targetModule, location);
          const sourceManifest = manifests.get(sourceModule.root);
          if (
            isRuntimeDependencyFile(file.path) &&
            !sourceManifest?.runtimeDependencies.has(dependency)
          ) {
            add(
              findings,
              sourceManifest?.developmentDependencies.has(dependency)
                ? "production-dev-dependency"
                : "undeclared-dependency",
              location,
              dependency,
            );
          } else if (
            isProductionFile(file.path) &&
            !isRuntimeDependencyFile(file.path) &&
            !sourceManifest?.dependencies.has(dependency)
          ) {
            add(findings, "undeclared-dependency", location, dependency);
          }
        }
        const targetManifest = manifests.get(targetModule.root);
        const subpath = exportedSubpath(specifier, dependency);
        if (!targetManifest || !targetManifest.exports.has(subpath)) {
          add(findings, "unexported-internal-import", location, specifier);
        }
        if (isProductionFile(file.path)) {
          for (const targetPath of targetManifest?.exportSources.get(subpath) ?? []) {
            fileGraph.get(file.path)?.add(targetPath);
          }
        }
        if (isUiFile(file.path, sourceModule) && targetModule.root === "packages/db") {
          add(findings, "ui-data-adapter", location, dependency);
        }
        if (
          (sourceModule.root === "apps/web" || sourceModule.root === "apps/admin") &&
          targetModule.root === "packages/db" &&
          !new RegExp(`^${sourceModule.root}/(?:composition|server)/`, "u").test(file.path)
        ) {
          add(findings, "web-db-outside-composition", location, dependency);
        }
        if (
          parsed.clientModule &&
          (targetModule.root === "packages/db" ||
            (targetModule.root === "packages/config" &&
              (specifier === "@rituvia/config/server" ||
                specifier === "@rituvia/config/feature-flags")))
        ) {
          add(findings, "client-server-import", location, specifier);
        }
        if (
          parsed.clientModule &&
          !allowedClientInternalPackages.has(targetModule.name) &&
          specifier !== "@rituvia/config/client"
        ) {
          add(findings, "client-server-import", location, specifier);
        }
        if (
          targetModule.root === "packages/db" ||
          (targetModule.root === "packages/config" &&
            (specifier === "@rituvia/config/server" ||
              specifier === "@rituvia/config/feature-flags")) ||
          (!allowedClientInternalPackages.has(targetModule.name) &&
            specifier !== "@rituvia/config/client")
        ) {
          serverTaintedFiles.add(file.path);
        }
        continue;
      }

      if (dependency.startsWith("@rituvia/")) {
        add(findings, "unknown-internal-package", location, dependency);
        continue;
      }
      if (dependency.toLowerCase().startsWith("@rituvia/")) {
        add(findings, "internal-package-case", location, dependency);
        continue;
      }
      if (sourceModule.root === "packages/domain" && isProductionFile(file.path)) {
        add(findings, "domain-external-dependency", location, dependency);
      }
      if (sourceModule.root === "packages/divination" && isProductionFile(file.path)) {
        add(findings, "divination-external-dependency", location, dependency);
      }
      if (
        isRuntimeDependencyFile(file.path) &&
        specifier.startsWith("node:") &&
        !(allowedRuntimeNodeBuiltins.get(sourceModule.name)?.has(specifier) ?? false)
      ) {
        add(findings, "node-runtime-dependency", location, specifier);
      }
      const owner = adapterOwner(dependency);
      if (owner && sourceModule.root !== owner) {
        add(findings, "adapter-ownership", location, dependency);
      }
      if (owner && sourceModule.root === owner && !isProviderAdapterFile(file.path, owner)) {
        add(findings, "provider-outside-adapter", location, dependency);
      }
      if (
        isRuntimeDependencyFile(file.path) &&
        !specifier.startsWith("node:") &&
        !manifests.get(sourceModule.root)?.runtimeDependencies.has(dependency)
      ) {
        add(
          findings,
          manifests.get(sourceModule.root)?.developmentDependencies.has(dependency)
            ? "production-dev-dependency"
            : "undeclared-dependency",
          location,
          dependency,
        );
      } else if (
        isProductionFile(file.path) &&
        !isRuntimeDependencyFile(file.path) &&
        !specifier.startsWith("node:") &&
        !manifests.get(sourceModule.root)?.dependencies.has(dependency)
      ) {
        add(findings, "undeclared-dependency", location, dependency);
      }
      if (isUiFile(file.path, sourceModule) && !allowedUiExternalPackages.has(dependency)) {
        add(findings, "ui-external-adapter", location, dependency);
      }
      if (parsed.clientModule && specifier.startsWith("node:")) {
        add(findings, "client-server-import", location, dependency);
      }
      if (specifier === "server-only" || specifier.startsWith("node:") || owner !== undefined) {
        serverTaintedFiles.add(file.path);
      }
    }
  }

  for (const clientFile of [...clientFiles].sort()) {
    if (serverTaintedFiles.has(clientFile)) {
      add(findings, "client-server-transitive-import", clientFile, clientFile);
      continue;
    }
    const pending = [...(fileGraph.get(clientFile) ?? [])];
    const visited = new Set<string>();
    while (pending.length > 0) {
      const candidate = pending.pop();
      if (!candidate || visited.has(candidate)) continue;
      visited.add(candidate);
      if (serverTaintedFiles.has(candidate)) {
        add(findings, "client-server-transitive-import", clientFile, candidate);
        break;
      }
      pending.push(...(fileGraph.get(candidate) ?? []));
    }
  }

  for (const component of cycleComponents(moduleGraph)) {
    add(findings, "module-cycle", component.join(" -> "));
  }
  for (const component of cycleComponents(fileGraph)) {
    add(findings, "file-cycle", component.join(" -> "));
  }

  return Object.freeze(
    findings.sort(
      (left, right) =>
        left.location.localeCompare(right.location) ||
        left.rule.localeCompare(right.rule) ||
        (left.dependency ?? "").localeCompare(right.dependency ?? ""),
    ),
  );
};

export const registeredArchitectureModules = moduleDefinitions;
