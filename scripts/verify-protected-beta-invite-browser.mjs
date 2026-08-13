import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import net from "node:net";

import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";

const host = "127.0.0.1";
const port = await new Promise((resolve, reject) => {
  const listener = net.createServer();
  listener.once("error", reject);
  listener.listen(0, host, () => {
    const address = listener.address();
    if (address === null || typeof address === "string") {
      listener.close();
      reject(new Error("Could not allocate a protected-Beta browser verification port."));
      return;
    }
    listener.close((error) => (error ? reject(error) : resolve(address.port)));
  });
});
const origin = `http://${host}:${port}`;
const invalidCanary = "private invalid invite canary";
const deniedToken = "d".repeat(43);
const admittedToken = "e".repeat(43);
const unavailableToken = "f".repeat(43);
const offlineToken = "g".repeat(43);
const server = spawn(process.execPath, ["start.mjs", "-H", host, "-p", String(port)], {
  cwd: `${process.cwd()}/apps/web`,
  env: { ...process.env, BRAND_CANONICAL_ORIGIN: origin },
  stdio: ["ignore", "pipe", "pipe"],
});
let serverOutput = "";
server.stdout?.on("data", (chunk) => {
  serverOutput += String(chunk);
});
server.stderr?.on("data", (chunk) => {
  serverOutput += String(chunk);
});

const stopServer = async () => {
  if (server.exitCode !== null) return;
  server.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => server.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ]);
  if (server.exitCode === null) server.kill("SIGKILL");
};

let browser = null;
try {
  const deadline = Date.now() + (process.env.CI === "true" ? 60_000 : 30_000);
  let ready = false;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error("Protected-Beta browser server exited early.");
    try {
      const response = await fetch(`${origin}/en/beta`, { signal: AbortSignal.timeout(2_000) });
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {
      // Keep waiting for the production artifact.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!ready) throw new Error("Protected-Beta browser server did not become ready.");

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { height: 844, width: 390 } });
  const page = await context.newPage();
  const consoleMessages = [];
  const admissionBodies = [];
  let intakeReferrer = "";
  page.on("console", (message) => consoleMessages.push(message.text()));
  await page.route(`${origin}/api/v1/anonymous/session`, async (route) => {
    const body = route.request().postData() ?? "";
    admissionBodies.push(body);
    const parsed = JSON.parse(body);
    if (parsed.inviteToken === offlineToken) {
      await route.abort("internetdisconnected");
      return;
    }
    const admitted = parsed.inviteToken === admittedToken;
    await route.fulfill({
      body: admitted
        ? ""
        : JSON.stringify({
            code:
              parsed.inviteToken === unavailableToken
                ? "ANONYMOUS_SESSION_UNAVAILABLE"
                : "BETA_ADMISSION_REQUIRED",
            status: parsed.inviteToken === unavailableToken ? 503 : 403,
          }),
      ...(admitted ? {} : { contentType: "application/json" }),
      headers: { "cache-control": "private, no-store, max-age=0" },
      status: admitted ? 204 : parsed.inviteToken === unavailableToken ? 503 : 403,
    });
  });
  await page.route(`${origin}/en/intake`, async (route) => {
    intakeReferrer = route.request().headers().referer ?? "";
    await route.fulfill({
      body: '<!doctype html><html lang="en"><title>Admitted</title><main>Admitted</main></html>',
      contentType: "text/html",
      status: 200,
    });
  });

  await page.goto(`${origin}/en/beta`, { waitUntil: "networkidle" });
  await page.getByLabel("Protected-Beta invitation").fill(invalidCanary);
  await page.getByRole("button", { name: "Enter protected Beta" }).click();
  assert.equal(admissionBodies.length, 0);
  assert.equal(
    await page.locator("aside").evaluate((node) => document.activeElement === node),
    true,
  );

  await page.getByLabel("Protected-Beta invitation").fill(deniedToken);
  await page.getByRole("button", { name: "Enter protected Beta" }).click();
  await page
    .locator("aside")
    .getByText("Check the invitation and try again", { exact: false })
    .waitFor();
  assert.equal(admissionBodies.length, 1);

  const axe = await new AxeBuilder({ page }).analyze();
  assert.deepEqual(
    axe.violations
      .filter(({ impact }) => impact === "critical" || impact === "serious")
      .map(({ id, impact }) => `${impact}:${id}`),
    [],
  );
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
    ),
    true,
  );
  assert.deepEqual(
    await page.locator("main button:visible, main a:visible").evaluateAll((nodes) =>
      nodes
        .filter((node) => {
          const rectangle = node.getBoundingClientRect();
          return rectangle.width < 44 || rectangle.height < 44;
        })
        .map((node) => node.textContent?.trim()),
    ),
    [],
  );

  await page.getByLabel("Protected-Beta invitation").fill(unavailableToken);
  await page.getByRole("button", { name: "Enter protected Beta" }).click();
  await page
    .locator("aside")
    .getByText("Admission could not be checked", { exact: false })
    .waitFor();
  await page.waitForFunction(() => document.activeElement?.tagName === "ASIDE");

  await page.evaluate(() => {
    Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false });
  });
  await page.getByLabel("Protected-Beta invitation").fill(offlineToken);
  await page.getByRole("button", { name: "Enter protected Beta" }).click();
  await page.locator("aside").getByText("You appear to be offline", { exact: false }).waitFor();
  await page.waitForFunction(() => document.activeElement?.tagName === "ASIDE");
  await page.evaluate(() => {
    Object.defineProperty(navigator, "onLine", { configurable: true, get: () => true });
  });

  await page.getByLabel("Protected-Beta invitation").fill(admittedToken);
  await page.getByRole("button", { name: "Enter protected Beta" }).click();
  await page.waitForURL(`${origin}/en/intake`);
  assert.equal(admissionBodies.length, 4);
  assert.equal(new URL(page.url()).pathname, "/en/intake");
  assert.equal(page.url().includes(admittedToken), false);
  assert.equal(JSON.stringify(consoleMessages).includes(admittedToken), false);
  assert.equal(serverOutput.includes(admittedToken), false);
  assert.equal(serverOutput.includes(deniedToken), false);
  assert.equal(serverOutput.includes(invalidCanary), false);
  assert.equal(intakeReferrer.includes(admittedToken), false);
  assert.deepEqual(
    await page.evaluate(() => ({
      localStorage: Object.keys(localStorage),
      sessionStorage: Object.keys(sessionStorage),
    })),
    { localStorage: [], sessionStorage: [] },
  );
} finally {
  await browser?.close();
  await stopServer();
}

process.stdout.write(
  "Verified protected-Beta invite Button, calm recovery, no-URL token handling, mobile layout, and accessibility.\n",
);
