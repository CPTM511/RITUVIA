import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { spawn } from "node:child_process";

const repositoryRoot = process.cwd();
const webRoot = path.join(repositoryRoot, "apps/web");
const nextCli = path.join(webRoot, "node_modules/next/dist/bin/next");
const turboCli = path.join(repositoryRoot, "node_modules/.bin/turbo");
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
];

const identifier = randomUUID().replaceAll("-", "");
const publicCanary = `public-brand-${identifier}`;
const senderCanary = `server-sender-${identifier}@invalid.example`;
const databaseCanary = `database-secret-${identifier}`;
const invalidCanary = `invalid-database-${identifier}`;
const databaseUrl = `postgresql://local:${databaseCanary}@127.0.0.1:5432/app`;
const secretCanaries = [senderCanary, databaseCanary, invalidCanary, databaseUrl];

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

const fetchRenderedPage = async (managed, port) => {
  const deadline = Date.now() + 15_000;
  let lastError;

  while (Date.now() < deadline) {
    if (managed.child.exitCode !== null || managed.child.signalCode !== null) {
      fail("The built Web application exited before serving HTTP.", managed.getOutput());
    }

    try {
      const response = await fetch(`http://127.0.0.1:${port}/`);
      if (response.ok) {
        return response.text();
      }
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  fail(
    `The built Web application did not become ready: ${lastError instanceof Error ? lastError.message : "unknown error"}.`,
    managed.getOutput(),
  );
};

const assertHttpBoundary = (html) => {
  if (!html.includes(publicCanary)) {
    fail("The public configuration canary was absent from the rendered HTTP response.");
  }
  for (const canary of secretCanaries) {
    if (html.includes(canary)) {
      fail("A server-only configuration canary entered the rendered HTTP response.");
    }
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
    ["run", "build", "--filter=@rituvia/worker", "--force"],
    { env: createEnvironment() },
    "Configuration and Worker prerequisite build",
  );

  await mkdir(path.dirname(temporaryWebRoot), { recursive: true });
  await cp(webRoot, temporaryWebRoot, {
    recursive: true,
    filter: (source) =>
      ![".next", ".turbo", "node_modules"].includes(path.basename(source)) &&
      !source.endsWith(".tsbuildinfo"),
  });
  await cp(
    path.join(repositoryRoot, "tsconfig.base.json"),
    path.join(temporaryRoot, "tsconfig.base.json"),
  );
  await symlink(path.join(webRoot, "node_modules"), path.join(temporaryWebRoot, "node_modules"));

  const validEnvironment = createEnvironment();
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
  const html = await fetchRenderedPage(webProcess, port);
  assertHttpBoundary(html);
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
