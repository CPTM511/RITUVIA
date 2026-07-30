import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { spawn } from "node:child_process";

import {
  auditPublicSeoDocument,
  publicStructuredDataTypeForContentShape,
  verifyWebShellBuild,
} from "./web-shell-build-policy.mjs";

const repositoryRoot = process.cwd();
const webRoot = path.join(repositoryRoot, "apps/web");
const nextCli = path.join(webRoot, "node_modules/next/dist/bin/next");
const turboCli = path.join(repositoryRoot, "node_modules/.bin/turbo");
const publicInventory = JSON.parse(
  await readFile(
    path.join(repositoryRoot, "content/editorial/public-page-inventory.v1.json"),
    "utf8",
  ),
);
if (
  publicInventory?.schemaVersion !== "rituvia-public-page-inventory.v1" ||
  !Array.isArray(publicInventory.records) ||
  publicInventory.records.length !== 45 ||
  publicInventory.records.some(
    (record) =>
      record?.qualityStatus !== "passed" ||
      typeof record.pathname !== "string" ||
      typeof record.contentFamily !== "string" ||
      typeof record.contentShape !== "string" ||
      !(
        record.structuredParentRouteId === null ||
        typeof record.structuredParentRouteId === "string"
      ),
  )
) {
  throw new TypeError("The configuration boundary requires a passing public-page inventory.");
}
const crawlPaths = Object.freeze(publicInventory.records.map(({ pathname }) => pathname));
const publicPaths = Object.freeze(
  publicInventory.records
    .filter(({ contentFamily }) => contentFamily === "pages")
    .map(({ pathname }) => pathname),
);
const deliveryRoots = ["static", "server/app"];
const knownEnvironmentVariables = [
  "APP_ENV",
  "BRAND_NAME",
  "BRAND_SHORT_NAME",
  "BRAND_LEGAL_ENTITY",
  "BRAND_TAGLINE",
  "BRAND_CANONICAL_ORIGIN",
  "BRAND_SUPPORT_EMAIL",
  "BRAND_TRANSACTIONAL_SENDER",
  "BRAND_SOCIAL_HANDLES",
  "BRAND_ASSET_MANIFEST",
  "DATABASE_URL",
  "PAYMENT_FULFILLMENT_DATABASE_URL",
  "PAYMENT_WEBHOOK_DATABASE_URL",
  "PRIVACY_DELETION_DATABASE_URL",
  "RITUVIA_ANONYMOUS_SESSION_ISSUANCE_LIMIT",
  "RITUVIA_ANONYMOUS_SESSION_ISSUANCE_WINDOW_SECONDS",
  "RITUVIA_ANONYMOUS_SESSION_POLICY_VERSION",
  "RITUVIA_ANONYMOUS_SESSION_TTL_SECONDS",
  "RITUVIA_ACCOUNT_SESSION_TTL_SECONDS",
  "RITUVIA_AUTH_CHALLENGE_TTL_SECONDS",
  "RITUVIA_AUTH_DATA_KEY_V1",
  "RITUVIA_AUTH_START_GLOBAL_LIMIT",
  "RITUVIA_AUTH_START_IDENTIFIER_LIMIT",
  "RITUVIA_AUTH_START_WINDOW_SECONDS",
  "RITUVIA_AUTH_SUBJECT_HMAC_KEY_V1",
  "RITUVIA_LOCAL_CHECKOUT_SIGNING_SECRET_V1",
  "RITUVIA_PAYMENT_PROVIDER",
  "RITUVIA_PRIVACY_DELETION_RECENT_AUTH_SECONDS",
  "RITUVIA_PRIVACY_DELETION_REQUEST_WINDOW_SECONDS",
  "RITUVIA_PRIVACY_EXPORT_KEY_V1",
  "RITUVIA_PRIVACY_EXPORT_RECENT_AUTH_SECONDS",
  "RITUVIA_PRIVACY_EXPORT_REQUEST_WINDOW_SECONDS",
  "RITUVIA_PRIVACY_EXPORT_TTL_SECONDS",
  "RITUVIA_PRIVATE_CONTENT_KEY_V1",
  "RITUVIA_QUESTION_INTAKE_ACTIVATION_REFERENCE",
  "RITUVIA_REFLECTION_POLICY_VERSION",
  "RITUVIA_REFLECTION_RETENTION_SECONDS",
  "RITUVIA_REFLECTION_REVISIT_DELAY_SECONDS",
  "RITUVIA_STRIPE_ACCOUNT_ID",
  "RITUVIA_STRIPE_PRICE_IDS",
  "RITUVIA_TAROT_INTEGRITY_KEY_V1",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
];

const identifier = randomUUID().replaceAll("-", "");
const publicCanary = `public-brand-${identifier}`;
const senderCanary = `server-sender-${identifier}@invalid.example`;
const databaseCanary = `database-secret-${identifier}`;
const privacyDeletionDatabaseCanary = `privacy-deletion-database-secret-${identifier}`;
const invalidCanary = `invalid-database-${identifier}`;
const forgedRequestCanary = `forged-request-${identifier}`;
const forgedTraceCanary = `forged-trace-${identifier}`;
const privateQueryCanary = `private-query-${identifier}`;
const privateQuestionCanary = `private-question-${identifier}`;
const anonymousSessionTokenCanary = "a".repeat(43);
const databaseUrl = `postgresql://local:${databaseCanary}@127.0.0.1:5432/app`;
const privacyDeletionDatabaseUrl = `postgresql://privacy-delete:${privacyDeletionDatabaseCanary}@127.0.0.1:5432/app`;
const secretCanaries = [
  senderCanary,
  databaseCanary,
  privacyDeletionDatabaseCanary,
  invalidCanary,
  privateQueryCanary,
  privateQuestionCanary,
  databaseUrl,
  privacyDeletionDatabaseUrl,
];

const redact = (value) => {
  let redacted = String(value);
  for (const canary of [publicCanary, ...secretCanaries].sort(
    (left, right) => right.length - left.length,
  )) {
    redacted = redacted.replaceAll(canary, "[REDACTED]");
  }
  return redacted;
};

const fail = (message, output = "") => {
  const details = output.trim();
  throw new Error(redact(details === "" ? message : `${message}\n${details}`));
};

const isPrivateNoStore = (value) => {
  const directives = new Set((value ?? "").split(",").map((directive) => directive.trim()));
  return directives.has("private") && directives.has("no-store");
};

const hasNoStore = (value) =>
  new Set((value ?? "").split(",").map((directive) => directive.trim())).has("no-store");

const createEnvironment = (overrides = {}) => {
  const environment = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) => !knownEnvironmentVariables.includes(key) && !key.startsWith("NEXT_PUBLIC_"),
    ),
  );

  return {
    ...environment,
    APP_ENV: "local",
    BRAND_NAME: publicCanary,
    BRAND_TRANSACTIONAL_SENDER: senderCanary,
    DATABASE_URL: databaseUrl,
    PRIVACY_DELETION_DATABASE_URL: privacyDeletionDatabaseUrl,
    NEXT_TELEMETRY_DISABLED: "1",
    ...overrides,
  };
};

const runCommand = (command, arguments_, options = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, arguments_, {
      cwd: options.cwd ?? repositoryRoot,
      env: options.env ?? process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, options.timeoutMs ?? 120_000);

    const collect = (chunk) => {
      output += chunk.toString();
      if (output.length > 8_000_000) {
        child.kill("SIGKILL");
        reject(new Error("Command output exceeded the verification safety limit."));
      }
    };

    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("close", (code, signal) => {
      clearTimeout(timeout);
      resolve({ code, output, signal, timedOut });
    });
  });

const assertSuccessfulCommand = async (command, arguments_, options, label) => {
  const result = await runCommand(command, arguments_, options);
  if (result.timedOut || result.code !== 0) {
    fail(`${label} failed.`, result.output);
  }
  return result;
};

const listFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const absolutePath = path.join(directory, entry.name);
      return entry.isDirectory() ? listFiles(absolutePath) : [absolutePath];
    }),
  );
  return files.flat();
};

const containsCanary = async (files, canary) => {
  const needle = Buffer.from(canary);
  for (const file of files) {
    if ((await readFile(file)).includes(needle)) {
      return true;
    }
  }
  return false;
};

const assertDeliveryBoundary = async (nextRoot) => {
  const roots = deliveryRoots.map((relativePath) => path.join(nextRoot, relativePath));
  const files = (await Promise.all(roots.map((root) => listFiles(root)))).flat();
  const staticFiles = await listFiles(path.join(nextRoot, "static"));

  if (!(await containsCanary(files, publicCanary))) {
    fail("The public configuration canary was absent from browser-delivered artifacts.");
  }

  for (const canary of secretCanaries) {
    if (await containsCanary(files, canary)) {
      fail("A server-only configuration canary entered browser-delivered artifacts.");
    }
  }

  for (const forbiddenClientLiteral of [
    "BRAND_LEGAL_ENTITY",
    "BRAND_SUPPORT_EMAIL",
    "BRAND_TRANSACTIONAL_SENDER",
    "DATABASE_URL",
    "PAYMENT_FULFILLMENT_DATABASE_URL",
    "PAYMENT_WEBHOOK_DATABASE_URL",
    "PRIVACY_DELETION_DATABASE_URL",
    "RITUVIA",
  ]) {
    if (await containsCanary(staticFiles, forbiddenClientLiteral)) {
      fail("A server-only or fallback configuration literal entered a client-static asset.");
    }
  }
};

const findAvailablePort = () =>
  new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        server.close();
        reject(new Error("Could not allocate a local verification port."));
        return;
      }
      server.close((error) => (error ? reject(error) : resolve(address.port)));
    });
  });

const startManagedProcess = (command, arguments_, options) => {
  const child = spawn(command, arguments_, {
    cwd: options.cwd,
    env: options.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  const collect = (chunk) => {
    output += chunk.toString();
  };
  child.stdout.on("data", collect);
  child.stderr.on("data", collect);
  return { child, getOutput: () => output };
};

const stopManagedProcess = async (managed) => {
  if (managed.child.exitCode !== null || managed.child.signalCode !== null) {
    return;
  }

  managed.child.kill("SIGTERM");
  const exited = once(managed.child, "close");
  let timeoutId;
  const timeout = new Promise((resolve) => {
    timeoutId = setTimeout(() => {
      managed.child.kill("SIGKILL");
      resolve();
    }, 5_000);
  });
  await Promise.race([exited, timeout]);
  clearTimeout(timeoutId);
};

const fetchBuiltWeb = async (managed, port, pathname, options = {}) => {
  const deadline = Date.now() + 15_000;
  let lastError;

  while (Date.now() < deadline) {
    if (managed.child.exitCode !== null || managed.child.signalCode !== null) {
      fail("The built Web application exited before serving HTTP.", managed.getOutput());
    }

    try {
      const response = await fetch(`http://127.0.0.1:${port}${pathname}`, {
        body: options.body,
        method: options.method ?? "GET",
        redirect: options.redirect ?? "follow",
        headers: {
          baggage: forgedTraceCanary,
          traceparent: "00-11111111111111111111111111111111-1111111111111111-01",
          "x-request-id": forgedRequestCanary,
          "x-rituvia-correlation-id": forgedTraceCanary,
          ...options.headers,
        },
      });
      return {
        contentSecurityPolicy: response.headers.get("content-security-policy"),
        contentType: response.headers.get("content-type"),
        cacheControl: response.headers.get("cache-control"),
        html: await response.text(),
        location: response.headers.get("location"),
        requestId: response.headers.get("x-request-id"),
        setCookie: response.headers.get("set-cookie"),
        status: response.status,
        xRobotsTag: response.headers.get("x-robots-tag"),
      };
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  fail(
    `The built Web application did not become ready for ${pathname}: ${lastError instanceof Error ? lastError.message : "unknown error"}.`,
    managed.getOutput(),
  );
};

const assertHttpBoundary = ({ contentSecurityPolicy, html, requestId }, processOutput) => {
  if (!html.includes(publicCanary)) {
    fail("The public configuration canary was absent from the rendered HTTP response.");
  }
  for (const canary of secretCanaries) {
    if (html.includes(canary) || processOutput.includes(canary)) {
      fail("A server-only configuration canary entered HTTP or observability output.");
    }
  }
  if (!/^req_[0-9a-f]{32}$/.test(requestId ?? "")) {
    fail("The Web request boundary did not return a server-generated correlation ID.");
  }
  if (
    !contentSecurityPolicy?.includes("default-src 'self'") ||
    !contentSecurityPolicy.includes("connect-src 'self'") ||
    !contentSecurityPolicy.includes("object-src 'none'") ||
    !contentSecurityPolicy.includes("script-src-attr 'none'") ||
    !contentSecurityPolicy.includes(
      "style-src-attr 'unsafe-hashes' 'sha256-zlqnbDt84zf1iSefLU/ImC54isoprH/MRiVZGskwexk='",
    )
  ) {
    fail("The Web request boundary did not return its restrictive shell security policy.");
  }
  if (
    requestId === forgedRequestCanary ||
    processOutput.includes(forgedRequestCanary) ||
    processOutput.includes(forgedTraceCanary)
  ) {
    fail("The Web request boundary trusted or logged client-supplied correlation state.");
  }
  if (
    !processOutput.includes(`\"correlationId\":\"${requestId}\"`) ||
    !processOutput.includes('"event":"trace.span_started"') ||
    !processOutput.includes('"level":"info"') ||
    !processOutput.includes('"operation":"http.proxy_handoff"')
  ) {
    fail("The Web request boundary did not emit its structured correlated trace.");
  }
};

const assertInvalidStartup = async (command, arguments_, options, label) => {
  const result = await runCommand(command, arguments_, {
    ...options,
    timeoutMs: 15_000,
  });
  if (result.timedOut || result.code === 0) {
    fail(`${label} did not fail closed for invalid configuration.`, result.output);
  }
  if (
    !result.output.includes("DATABASE_URL") ||
    secretCanaries.some((canary) => result.output.includes(canary))
  ) {
    fail(`${label} did not emit a sanitized, key-addressable configuration error.`, result.output);
  }
};

const temporaryRoot = await mkdtemp(path.join(repositoryRoot, ".rituvia-config-boundary-"));
const temporaryWebRoot = path.join(temporaryRoot, "apps/web");
let webProcess;

try {
  await assertSuccessfulCommand(
    turboCli,
    ["run", "build", "--filter=!@rituvia/web", "--force"],
    { env: createEnvironment() },
    "Configuration and Web prerequisite build",
  );

  await mkdir(path.dirname(temporaryWebRoot), { recursive: true });
  await cp(webRoot, temporaryWebRoot, {
    recursive: true,
    filter: (source) =>
      ![".next", ".turbo", "node_modules"].includes(path.basename(source)) &&
      !path.basename(source).startsWith(".env") &&
      !source.endsWith(".tsbuildinfo"),
  });
  await cp(path.join(repositoryRoot, "content"), path.join(temporaryRoot, "content"), {
    recursive: true,
  });
  await cp(
    path.join(repositoryRoot, "tsconfig.base.json"),
    path.join(temporaryRoot, "tsconfig.base.json"),
  );
  await symlink(path.join(webRoot, "node_modules"), path.join(temporaryWebRoot, "node_modules"));
  await writeFile(
    path.join(temporaryWebRoot, "server/feature-flags.ts"),
    `import "server-only";

export const loadWebFeatureFlagEvaluator = async () => ({
  evaluate: (_flagKey: string, _context: unknown) => ({ enabled: false }),
});
`,
  );
  await writeFile(
    path.join(temporaryWebRoot, "server/anonymous-session.ts"),
    `import "server-only";

export class WebAnonymousSessionError extends Error {
  readonly code: "conflict" | "rate_limited" | "unavailable" = "unavailable";
  readonly retryAfterSeconds: number | undefined = undefined;
}

export const ensureWebAnonymousSession = async (_input: unknown) => ({
  context: {
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    sessionId: "synthetic-session-id",
    subjectId: "synthetic-subject-id",
  },
  kind: "created",
  token: "${anonymousSessionTokenCanary}",
});
`,
  );

  const validEnvironment = createEnvironment({
    APP_ENV: "production",
    BRAND_ASSET_MANIFEST: "/brand/manifest.json",
    BRAND_CANONICAL_ORIGIN: "https://example.test",
    BRAND_LEGAL_ENTITY: "Synthetic Test Entity",
    BRAND_SHORT_NAME: "Synthetic",
    BRAND_SOCIAL_HANDLES: "{}",
    BRAND_SUPPORT_EMAIL: "support@example.test",
    BRAND_TAGLINE: "Synthetic test tagline",
    RITUVIA_ANONYMOUS_SESSION_ISSUANCE_LIMIT: "100",
    RITUVIA_ANONYMOUS_SESSION_ISSUANCE_WINDOW_SECONDS: "60",
    RITUVIA_ANONYMOUS_SESSION_POLICY_VERSION: "own-004.synthetic-session-policy.v1",
    RITUVIA_ANONYMOUS_SESSION_TTL_SECONDS: "3600",
    RITUVIA_QUESTION_INTAKE_ACTIVATION_REFERENCE: "own-009.synthetic-question-intake.v1",
  });
  await assertSuccessfulCommand(
    process.execPath,
    [nextCli, "build"],
    { cwd: temporaryWebRoot, env: validEnvironment, timeoutMs: 180_000 },
    "Isolated Web production build",
  );

  await assertDeliveryBoundary(path.join(temporaryWebRoot, ".next"));

  const port = await findAvailablePort();
  webProcess = startManagedProcess(
    process.execPath,
    [path.join(temporaryWebRoot, "start.mjs"), "-H", "127.0.0.1", "-p", String(port)],
    {
      cwd: temporaryWebRoot,
      env: validEnvironment,
    },
  );
  const uppercaseCold = await fetchBuiltWeb(webProcess, port, "/EN", { redirect: "manual" });
  if (uppercaseCold.status !== 404) {
    fail(`Cold non-canonical locale request returned HTTP ${uppercaseCold.status}, expected 404.`);
  }
  const publicPages = await Promise.all(
    crawlPaths.map((pathname) =>
      fetchBuiltWeb(webProcess, port, pathname, {
        headers: { accept: "text/html" },
        redirect: "manual",
      }),
    ),
  );
  if (publicPages.some(({ status }) => status !== 200)) {
    fail(
      `Canonical public pages returned unexpected statuses: ${JSON.stringify(
        publicPages.map(({ status }, index) => ({ pathname: crawlPaths[index], status })),
      )}.`,
    );
  }
  for (const publicPage of publicPages) assertHttpBoundary(publicPage, webProcess.getOutput());
  if (publicPages.some(({ xRobotsTag }) => xRobotsTag !== null)) {
    fail("A production canonical HTML response was incorrectly blocked from indexing.");
  }
  const searchFindings = publicPages.flatMap((publicPage, index) => {
    const record = publicInventory.records[index];
    if (record === undefined) return ["missing-inventory-record"];
    return auditPublicSeoDocument(
      publicPage.html,
      record.pathname,
      validEnvironment.BRAND_CANONICAL_ORIGIN,
      "index, follow",
      {
        expectedOpenGraphType:
          record.pathname.split("/").filter(Boolean).length === 3 ? "article" : "website",
        expectedStructuredDataType: publicStructuredDataTypeForContentShape(record.contentShape),
      },
    ).map((finding) => `${record.pathname}:${finding}`);
  });
  if (searchFindings.length > 0) {
    fail(`The production HTTP crawl contract failed: ${searchFindings.join(", ")}.`);
  }
  const intakePage = await fetchBuiltWeb(webProcess, port, "/en/intake", {
    headers: { accept: "text/html" },
    redirect: "manual",
  });
  assertHttpBoundary(intakePage, webProcess.getOutput());
  if (
    intakePage.status !== 200 ||
    intakePage.xRobotsTag !== "noindex, nofollow, noarchive" ||
    intakePage.cacheControl !== "private, no-store, max-age=0" ||
    !intakePage.html.includes('action="/api/v1/intake/evaluate"') ||
    !intakePage.html.includes("What would you like to reflect on?") ||
    /rel="canonical"|property="og:/u.test(intakePage.html)
  ) {
    fail("The production private intake page violated its noindex/no-store contract.");
  }
  const disabledTarotPages = await Promise.all(
    ["/en/tarot/one-card", "/en/tarot/three-card"].map((pathname) =>
      fetchBuiltWeb(webProcess, port, pathname, {
        headers: { accept: "text/html" },
        redirect: "manual",
      }),
    ),
  );
  if (
    disabledTarotPages.some(
      (page) =>
        page.status !== 404 ||
        page.html !== "" ||
        page.xRobotsTag !== "noindex, nofollow, noarchive" ||
        !hasNoStore(page.cacheControl),
    )
  ) {
    fail("The production tarot page did not fail closed without an approved catalog.");
  }
  const intakeEvaluation = await fetchBuiltWeb(webProcess, port, "/api/v1/intake/evaluate", {
    body: JSON.stringify({
      locale: "en",
      question: `Will I definitely win? ${privateQuestionCanary}`,
      schemaVersion: "1",
      themeCode: "open_reflection",
    }),
    headers: {
      "content-type": "application/json",
      origin: "https://example.test",
      "sec-fetch-site": "same-origin",
    },
    method: "POST",
    redirect: "manual",
  });
  if (
    intakeEvaluation.status !== 200 ||
    intakeEvaluation.cacheControl !== "private, no-store, max-age=0" ||
    intakeEvaluation.xRobotsTag !== "noindex, nofollow, noarchive" ||
    !intakeEvaluation.html.includes('"state":"reframed"') ||
    intakeEvaluation.html.includes(privateQuestionCanary) ||
    intakeEvaluation.html.includes("riskCategories") ||
    webProcess.getOutput().includes(privateQuestionCanary)
  ) {
    fail("The production intake API exposed private text or internal policy categories.");
  }
  const rejectedIntakeRequests = await Promise.all([
    fetchBuiltWeb(webProcess, port, "/api/v1/intake/evaluate", {
      body: "{}",
      headers: { "content-type": "application/json", origin: "https://foreign.example" },
      method: "POST",
      redirect: "manual",
    }),
    fetchBuiltWeb(webProcess, port, "/api/v1/intake/evaluate?private=canary", {
      body: "{}",
      headers: { "content-type": "application/json", origin: "https://example.test" },
      method: "POST",
      redirect: "manual",
    }),
    fetchBuiltWeb(webProcess, port, "/api/v1/intake/evaluate", {
      method: "OPTIONS",
      redirect: "manual",
    }),
  ]);
  if (
    rejectedIntakeRequests[0]?.status !== 403 ||
    rejectedIntakeRequests.slice(1).some(({ html, status }) => status !== 404 || html !== "") ||
    rejectedIntakeRequests.some(
      ({ cacheControl, xRobotsTag }) =>
        !hasNoStore(cacheControl) || xRobotsTag !== "noindex, nofollow, noarchive",
    )
  ) {
    fail("The production intake boundary accepted an unreviewed request variant.");
  }
  const anonymousSession = await fetchBuiltWeb(webProcess, port, "/api/v1/anonymous/session", {
    headers: {
      "idempotency-key": "synthetic_browser_request_key_1234",
      origin: "https://example.test",
      "sec-fetch-site": "same-origin",
    },
    method: "POST",
    redirect: "manual",
  });
  if (
    anonymousSession.status !== 204 ||
    anonymousSession.html !== "" ||
    anonymousSession.cacheControl !== "private, no-store, max-age=0" ||
    anonymousSession.xRobotsTag !== "noindex, nofollow, noarchive" ||
    !anonymousSession.setCookie?.includes(
      `__Host-rituvia-anonymous-session=${anonymousSessionTokenCanary}`,
    ) ||
    !anonymousSession.setCookie.includes("Path=/") ||
    !anonymousSession.setCookie.includes("HttpOnly") ||
    !anonymousSession.setCookie.includes("Secure") ||
    !anonymousSession.setCookie.includes("SameSite=strict") ||
    anonymousSession.setCookie.includes("Domain=") ||
    webProcess.getOutput().includes(anonymousSessionTokenCanary)
  ) {
    fail("The production anonymous-session HTTP boundary violated its private cookie contract.");
  }
  const rejectedAnonymousSessionRequests = await Promise.all([
    fetchBuiltWeb(webProcess, port, "/api/v1/anonymous/session", {
      headers: {
        "idempotency-key": "synthetic_browser_request_key_5678",
        origin: "https://foreign.example",
      },
      method: "POST",
      redirect: "manual",
    }),
    fetchBuiltWeb(webProcess, port, "/api/v1/anonymous/session?private=canary", {
      headers: {
        "idempotency-key": "synthetic_browser_request_key_9012",
        origin: "https://example.test",
      },
      method: "POST",
      redirect: "manual",
    }),
    fetchBuiltWeb(webProcess, port, "/api/v1/anonymous/session", {
      method: "OPTIONS",
      redirect: "manual",
    }),
  ]);
  if (
    rejectedAnonymousSessionRequests[0]?.status !== 403 ||
    rejectedAnonymousSessionRequests
      .slice(1)
      .some(({ html, status }) => status !== 404 || html !== "") ||
    rejectedAnonymousSessionRequests.some(
      ({ cacheControl, xRobotsTag }) =>
        !hasNoStore(cacheControl) || xRobotsTag !== "noindex, nofollow, noarchive",
    )
  ) {
    fail("The production anonymous-session HTTP boundary accepted an unreviewed request variant.");
  }
  const robots = await fetchBuiltWeb(webProcess, port, "/robots.txt", { redirect: "manual" });
  const sitemap = await fetchBuiltWeb(webProcess, port, "/sitemap.xml", {
    redirect: "manual",
  });
  const sitemapPathnames = [
    "/sitemaps/en-pages.xml",
    "/sitemaps/en-numerology.xml",
    "/sitemaps/en-astrology.xml",
    "/sitemaps/en-tarot.xml",
    "/sitemaps/en-rituals.xml",
  ];
  const sitemapDocuments = await Promise.all(
    sitemapPathnames.map((pathname) =>
      fetchBuiltWeb(webProcess, port, pathname, { redirect: "manual" }),
    ),
  );
  const sitemapInventory = sitemapDocuments.map(({ html }) => html).join("\n");
  const expectedSitemapUrls = crawlPaths.map(
    (pathname) => `<loc>https://example.test${pathname}</loc>`,
  );
  if (
    robots.status !== 200 ||
    !robots.contentType?.startsWith("text/plain") ||
    robots.xRobotsTag !== "noindex, nofollow, noarchive" ||
    robots.cacheControl !== "no-store, max-age=0" ||
    !robots.html.includes("Allow: /en$") ||
    !robots.html.includes("Allow: /en/privacy$") ||
    !robots.html.includes("Allow: /_next/static/") ||
    !robots.html.includes("Allow: /icon.svg$") ||
    !robots.html.includes("Disallow: /") ||
    !robots.html.includes("Sitemap: https://example.test/sitemap.xml") ||
    sitemap.status !== 200 ||
    !sitemap.contentType?.startsWith("application/xml") ||
    sitemap.xRobotsTag !== "noindex, nofollow, noarchive" ||
    sitemap.cacheControl !== "no-store, max-age=0" ||
    !sitemapPathnames.every((pathname) =>
      sitemap.html.includes(`<loc>https://example.test${pathname}</loc>`),
    ) ||
    sitemap.html.match(/<loc>/gu)?.length !== sitemapPathnames.length ||
    sitemapDocuments.some(
      ({ cacheControl, contentType, status, xRobotsTag }) =>
        status !== 200 ||
        !contentType?.startsWith("application/xml") ||
        xRobotsTag !== "noindex, nofollow, noarchive" ||
        cacheControl !== "no-store, max-age=0",
    ) ||
    !expectedSitemapUrls.every((url) => sitemapInventory.includes(url)) ||
    sitemapInventory.match(/<loc>/gu)?.length !== expectedSitemapUrls.length ||
    sitemapInventory.match(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/gu)?.length !==
      expectedSitemapUrls.length ||
    /(?:\.rsc|\.segments|\/account|\/journal|\/checkout|\/intake)/u.test(sitemapInventory)
  ) {
    fail("Production robots or sitemap violated the finite crawl inventory.");
  }
  const uppercaseAfterCanonical = await fetchBuiltWeb(webProcess, port, "/EN", {
    redirect: "manual",
  });
  const canonicalAgain = await fetchBuiltWeb(webProcess, port, "/en", {
    headers: { accept: "text/html" },
    redirect: "manual",
  });
  const rootRedirect = await fetchBuiltWeb(webProcess, port, "/", { redirect: "manual" });
  const directRscResponses = await Promise.all(
    publicPaths
      .flatMap((pathname) => [`${pathname}.rsc`, `${pathname}.segments/_full.segment.rsc`])
      .map((pathname) => fetchBuiltWeb(webProcess, port, pathname, { redirect: "manual" })),
  );
  const rscRequestVariants = [
    { expectedStatus: 404, headers: { rsc: "1" } },
    { expectedStatus: 200, headers: { "next-router-prefetch": "1", rsc: "1" } },
    { expectedStatus: 404, headers: { accept: "text/html", rsc: "1" } },
    { expectedStatus: 404, headers: { accept: "text/html;q=0, */*", rsc: "1" } },
  ];
  const rscRepresentations = await Promise.all(
    publicPaths.flatMap((pathname) =>
      rscRequestVariants.map(async ({ expectedStatus, headers }) => ({
        expectedStatus,
        response: await fetchBuiltWeb(webProcess, port, pathname, {
          headers,
          redirect: "manual",
        }),
      })),
    ),
  );
  const internalRscQuery = await fetchBuiltWeb(webProcess, port, "/en?_rsc=reviewed_123", {
    headers: { rsc: "1" },
    redirect: "manual",
  });
  const genericCanonical = await fetchBuiltWeb(webProcess, port, "/en", {
    redirect: "manual",
  });
  const queryVariant = await fetchBuiltWeb(
    webProcess,
    port,
    `/en/privacy?birthTime=${privateQueryCanary}`,
    { redirect: "manual" },
  );
  const supportedPrivatePaths = ["/en/account", "/en/sanctuary", "/en/sign-in"];
  const supportedPrivateResponses = await Promise.all(
    supportedPrivatePaths.map((pathname) =>
      fetchBuiltWeb(webProcess, port, pathname, { redirect: "manual" }),
    ),
  );
  const unsupportedPrivatePaths = ["/en/journal", "/en/checkout", "/en/reading/private-id"];
  const unsupportedPrivateResponses = await Promise.all(
    unsupportedPrivatePaths.map((pathname) =>
      fetchBuiltWeb(webProcess, port, pathname, { redirect: "manual" }),
    ),
  );
  const unsupportedResponses = await Promise.all(
    [
      "/fr",
      "/en-US",
      "/en/other",
      "/en/privacy/",
      "/en/Privacy",
      "/en/unknown",
      "/_next/data/fake/en.json",
    ].map((pathname) => fetchBuiltWeb(webProcess, port, pathname, { redirect: "manual" })),
  );
  // Next normalizes direct `*.rsc` paths before Proxy and replaces their response headers with a
  // private, non-cacheable `text/x-component` 404 error stream. Every successful, segment, or
  // header/query-driven framework representation must retain explicit noindex.
  if (
    uppercaseAfterCanonical.status !== 404 ||
    canonicalAgain.status !== 200 ||
    rootRedirect.status !== 308 ||
    rootRedirect.location !== "/en" ||
    rootRedirect.xRobotsTag !== "noindex, nofollow, noarchive" ||
    directRscResponses.some(
      ({ cacheControl, contentType, status, xRobotsTag }, index) =>
        status !== (index % 2 === 1 ? 200 : 404) ||
        !contentType?.startsWith("text/x-component") ||
        !isPrivateNoStore(cacheControl) ||
        (status === 200 && xRobotsTag !== "noindex, nofollow, noarchive") ||
        (status === 404 &&
          (index % 2 === 0
            ? ![null, "noindex, nofollow, noarchive"].includes(xRobotsTag)
            : xRobotsTag !== "noindex, nofollow, noarchive")),
    ) ||
    rscRepresentations.some(
      ({ expectedStatus, response: { cacheControl, contentType, html, status, xRobotsTag } }) =>
        status !== expectedStatus ||
        xRobotsTag !== "noindex, nofollow, noarchive" ||
        !hasNoStore(cacheControl) ||
        (status === 200 &&
          (!contentType?.startsWith("text/x-component") || !isPrivateNoStore(cacheControl))) ||
        (status === 404 && html !== ""),
    ) ||
    internalRscQuery.status !== 200 ||
    !internalRscQuery.contentType?.startsWith("text/x-component") ||
    internalRscQuery.xRobotsTag !== "noindex, nofollow, noarchive" ||
    internalRscQuery.cacheControl !== "private, no-store, max-age=0" ||
    genericCanonical.status !== 200 ||
    genericCanonical.xRobotsTag !== null ||
    unsupportedResponses.some(
      ({ status, xRobotsTag }) => status !== 404 || xRobotsTag !== "noindex, nofollow, noarchive",
    ) ||
    queryVariant.status !== 404 ||
    queryVariant.html !== "" ||
    queryVariant.location !== null ||
    queryVariant.xRobotsTag !== "noindex, nofollow, noarchive" ||
    supportedPrivateResponses.some(
      ({ cacheControl, status, xRobotsTag }) =>
        status !== 200 ||
        !isPrivateNoStore(cacheControl) ||
        xRobotsTag !== "noindex, nofollow, noarchive",
    ) ||
    unsupportedPrivateResponses.some(
      ({ html, status, xRobotsTag }) =>
        status !== 404 || html !== "" || xRobotsTag !== "noindex, nofollow, noarchive",
    ) ||
    secretCanaries.some(
      (canary) =>
        directRscResponses.some(({ html }) => html.includes(canary)) ||
        internalRscQuery.html.includes(canary) ||
        rscRepresentations.some(({ response }) => response.html.includes(canary)),
    )
  ) {
    fail(
      `The built Web application violated its finite, case-sensitive locale route contract: ${JSON.stringify(
        {
          canonicalAgain: canonicalAgain.status,
          directRscResponses: directRscResponses.map(
            ({ cacheControl, contentType, html, status, xRobotsTag }) => ({
              bodyLength: html.length,
              cacheControl,
              contentType,
              status,
              xRobotsTag,
            }),
          ),
          genericCanonical: {
            status: genericCanonical.status,
            xRobotsTag: genericCanonical.xRobotsTag,
          },
          internalRscQuery: {
            cacheControl: internalRscQuery.cacheControl,
            contentType: internalRscQuery.contentType,
            status: internalRscQuery.status,
            xRobotsTag: internalRscQuery.xRobotsTag,
          },
          rootLocation: rootRedirect.location,
          rootStatus: rootRedirect.status,
          rscRepresentations: rscRepresentations.map(({ expectedStatus, response }) => ({
            cacheControl: response.cacheControl,
            contentType: response.contentType,
            expectedStatus,
            status: response.status,
            xRobotsTag: response.xRobotsTag,
          })),
          supportedPrivateStatuses: supportedPrivateResponses.map(
            ({ cacheControl, status, xRobotsTag }) => ({
              cacheControl,
              status,
              xRobotsTag,
            }),
          ),
          unsupportedPrivateStatuses: unsupportedPrivateResponses.map(({ status, xRobotsTag }) => ({
            status,
            xRobotsTag,
          })),
          query: {
            bodyLength: queryVariant.html.length,
            location: queryVariant.location,
            status: queryVariant.status,
            xRobotsTag: queryVariant.xRobotsTag,
          },
          unsupportedResponses: unsupportedResponses.map(({ status, xRobotsTag }) => ({
            status,
            xRobotsTag,
          })),
          uppercaseAfterCanonical: uppercaseAfterCanonical.status,
        },
      )}.`,
    );
  }
  await verifyWebShellBuild(
    temporaryRoot,
    validEnvironment.BRAND_CANONICAL_ORIGIN,
    "index, follow",
  );
  const postMatrixOutput = webProcess.getOutput();
  if (
    [...secretCanaries, forgedRequestCanary, forgedTraceCanary].some((canary) =>
      postMatrixOutput.includes(canary),
    )
  ) {
    fail("A private query or forged correlation canary entered post-request observability output.");
  }
  await stopManagedProcess(webProcess);
  webProcess = undefined;

  const {
    RITUVIA_QUESTION_INTAKE_ACTIVATION_REFERENCE: _unusedIntakeActivation,
    ...intakeDisabledEnvironment
  } = validEnvironment;
  void _unusedIntakeActivation;
  webProcess = startManagedProcess(
    process.execPath,
    [path.join(temporaryWebRoot, "start.mjs"), "-H", "127.0.0.1", "-p", String(port)],
    {
      cwd: temporaryWebRoot,
      env: intakeDisabledEnvironment,
    },
  );
  const publicWithIntakeDisabled = await fetchBuiltWeb(webProcess, port, "/en", {
    redirect: "manual",
  });
  const disabledIntakePage = await fetchBuiltWeb(webProcess, port, "/en/intake", {
    redirect: "manual",
  });
  const disabledIntakeApi = await fetchBuiltWeb(webProcess, port, "/api/v1/intake/evaluate", {
    body: "{}",
    headers: { "content-type": "application/json", origin: "https://example.test" },
    method: "POST",
    redirect: "manual",
  });
  if (
    publicWithIntakeDisabled.status !== 200 ||
    disabledIntakePage.status !== 404 ||
    disabledIntakePage.html !== "" ||
    disabledIntakeApi.status !== 404 ||
    disabledIntakeApi.html !== "" ||
    !hasNoStore(disabledIntakePage.cacheControl) ||
    !hasNoStore(disabledIntakeApi.cacheControl)
  ) {
    fail("The independent question-intake activation reference did not fail closed.");
  }
  await stopManagedProcess(webProcess);
  webProcess = undefined;

  const invalidEnvironment = createEnvironment({ DATABASE_URL: invalidCanary });
  await assertInvalidStartup(
    process.execPath,
    [
      path.join(temporaryWebRoot, "start.mjs"),
      "-H",
      "127.0.0.1",
      "-p",
      String(await findAvailablePort()),
    ],
    { cwd: temporaryWebRoot, env: invalidEnvironment },
    "Web startup",
  );
  await assertInvalidStartup(
    process.execPath,
    [path.join(repositoryRoot, "apps/worker/dist/main.js")],
    { cwd: path.join(repositoryRoot, "apps/worker"), env: invalidEnvironment },
    "Worker startup",
  );

  const violationDirectory = path.join(temporaryWebRoot, "app/configuration-boundary-violation");
  await mkdir(violationDirectory, { recursive: true });
  await writeFile(
    path.join(violationDirectory, "page.tsx"),
    '"use client";\n\nimport { getWebRuntimeConfiguration } from "../../config/server";\n\nexport default function BoundaryViolation() {\n  return <p>{getWebRuntimeConfiguration().brand.name}</p>;\n}\n',
  );
  const negativeBuild = await runCommand(process.execPath, [nextCli, "build"], {
    cwd: temporaryWebRoot,
    env: validEnvironment,
    timeoutMs: 180_000,
  });
  const diagnostic = negativeBuild.output.toLowerCase();
  if (
    negativeBuild.timedOut ||
    negativeBuild.code === 0 ||
    !diagnostic.includes("server-only") ||
    (!diagnostic.includes("config/server") && !diagnostic.includes("client component"))
  ) {
    fail(
      "The negative Web build did not fail specifically at the server-only boundary.",
      negativeBuild.output,
    );
  }

  console.log(
    "Verified typed environment parsing, fail-closed startup, server-only imports, and client-delivery secret isolation.",
  );
} finally {
  if (webProcess !== undefined) {
    await stopManagedProcess(webProcess);
  }
  await rm(temporaryRoot, { recursive: true, force: true });
}
