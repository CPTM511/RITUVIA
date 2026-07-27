import assert from "node:assert/strict";
import { spawn } from "node:child_process";

import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";

const host = "127.0.0.1";
const port = 4184;
const origin = `http://${host}:${port}`;
const numerologyPath = "/en/readings/numerology";

const waitForServer = async (server) => {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error("Numerology browser server exited before ready.");
    try {
      const response = await fetch(`${origin}${numerologyPath}`);
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error("Numerology browser server did not become ready.");
};

const stopServer = async (server) => {
  if (server.exitCode !== null) return;
  server.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => server.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ]);
  if (server.exitCode === null) server.kill("SIGKILL");
};

const server = spawn(process.execPath, ["start.mjs", "-H", host, "-p", String(port)], {
  cwd: `${process.cwd()}/apps/web`,
  env: { ...process.env, BRAND_CANONICAL_ORIGIN: origin },
  stdio: ["ignore", "ignore", "pipe"],
});
let serverError = "";
server.stderr?.on("data", (chunk) => {
  serverError += String(chunk);
});

const browser = await chromium.launch({ headless: true });
try {
  await waitForServer(server);
  const requests = [];
  const unexpected = [];
  const context = await browser.newContext({
    baseURL: origin,
    colorScheme: "dark",
    locale: "en-US",
    reducedMotion: "reduce",
    timezoneId: "Asia/Shanghai",
    viewport: { height: 844, width: 320 },
  });
  await context.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const key = `${request.method()}:${url.pathname}`;
    requests.push({ body: request.postData(), key, search: url.search });
    if (key === "GET:/api/v1/me") {
      return route.fulfill({
        body: JSON.stringify({ code: "ACCOUNT_SESSION_UNAVAILABLE", status: 401 }),
        contentType: "application/json",
        status: 401,
      });
    }
    if (key === "POST:/api/v1/numerology/calculate") return route.continue();
    unexpected.push(key);
    return route.abort("blockedbyclient");
  });

  const page = await context.newPage();
  page.setDefaultTimeout(5_000);
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().includes("401")) {
      consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(numerologyPath, { timeout: 30_000, waitUntil: "load" });
  await page.getByRole("heading", { name: "Read the rhythm in your numbers" }).waitFor();

  const scan = async () => {
    const result = await new AxeBuilder({ page }).analyze();
    const serious = result.violations
      .filter((finding) => finding.impact === "critical" || finding.impact === "serious")
      .map((finding) => `${finding.impact}:${finding.id}`);
    assert.deepEqual(serious, []);
    const incomplete = result.incomplete.filter(
      (finding) => finding.impact === "critical" || finding.impact === "serious",
    );
    assert.ok(
      incomplete.every((finding) => finding.id === "color-contrast"),
      JSON.stringify(
        incomplete.map(({ id, impact, nodes }) => ({
          id,
          impact,
          nodes: nodes.map(({ failureSummary, target }) => ({ failureSummary, target })),
        })),
      ),
    );
    return incomplete.flatMap((finding) => finding.nodes).length;
  };

  const initialIncomplete = await scan();
  assert.equal(await page.getByLabel("Name").count(), 0);
  assert.equal(await page.locator('input[name="birth-date"]').getAttribute("autocomplete"), "off");
  assert.equal(await page.locator('input[name="target-year"]').getAttribute("maxlength"), "4");
  await page.waitForFunction(
    () => document.querySelector('input[name="birth-date"]')?.disabled === false,
  );
  await page.getByLabel("Target year").focus();
  await page.keyboard.press("Tab");
  assert.equal(
    await page.evaluate(() => document.activeElement?.getAttribute("aria-label")),
    "Calculate my numbers",
  );
  await page.keyboard.press("Shift+Tab");
  assert.equal(
    await page.evaluate(() => document.activeElement?.getAttribute("name")),
    "target-year",
  );

  await page.getByLabel("Birth date").fill("1990-11-28");
  await page.getByLabel("Target year").fill("2026");
  await page.getByRole("button", { name: "Calculate my numbers" }).press("Enter");
  await page.getByRole("heading", { name: "Your number pattern" }).waitFor();

  const cards = page.locator(".numerology-result-card");
  assert.equal(await cards.count(), 3);
  assert.deepEqual(await cards.locator(".numerology-result-value").allTextContents(), [
    "Result: 4",
    "Result: 1",
    "Result: 22",
  ]);
  assert.match(await cards.nth(0).textContent(), /1 \+ 9 \+ 9 \+ 0 \+ 1 \+ 1 \+ 2 \+ 8 = 31/u);
  assert.match(await cards.nth(1).textContent(), /28 → 10 → 1/u);
  assert.match(await cards.nth(2).textContent(), /Master number preserved/u);
  assert.equal(
    await page.evaluate(() => document.activeElement?.classList.contains("numerology-result")),
    true,
  );
  const resultIncomplete = await scan();

  const numerologyPosts = () =>
    requests.filter(({ key }) => key === "POST:/api/v1/numerology/calculate");
  assert.equal(numerologyPosts().length, 1);
  assert.equal(numerologyPosts()[0].search, "");
  assert.deepEqual(JSON.parse(numerologyPosts()[0].body), {
    birthDate: "1990-11-28",
    schemaVersion: "numerology-calculation-request.v1",
    targetYear: 2026,
  });
  assert.equal(
    requests.some(
      ({ key, search }) => key !== "POST:/api/v1/numerology/calculate" && search !== "",
    ),
    false,
  );

  await page.getByRole("button", { name: "Clear birth data and start again" }).click();
  assert.equal(await page.getByLabel("Birth date").inputValue(), "");
  assert.equal(await page.getByLabel("Target year").inputValue(), "");
  await page.waitForFunction(() => document.activeElement?.getAttribute("name") === "birth-date");
  assert.equal(
    await page.evaluate(() => document.activeElement?.getAttribute("name")),
    "birth-date",
  );

  await page.getByLabel("Birth date").fill("1990-11-28");
  await page.getByLabel("Target year").fill("99");
  await page.getByRole("button", { name: "Calculate my numbers" }).click();
  assert.equal(await page.getByLabel("Target year").getAttribute("aria-invalid"), "true");
  assert.equal(numerologyPosts().length, 1);

  await page.getByLabel("Target year").fill("2026");
  await context.setOffline(true);
  await page.waitForFunction(() => navigator.onLine === false);
  await page.getByRole("button", { name: "Calculate my numbers" }).click();
  await page.getByText("You appear to be offline", { exact: true }).waitFor();
  const offlineResultText = await page.locator(".numerology-result").textContent();
  assert.match(offlineResultText ?? "", /You appear to be offline/u);
  assert.equal(numerologyPosts().length, 1);
  await context.setOffline(false);
  await page.waitForFunction(() => navigator.onLine === true);
  await page.getByRole("button", { name: "Check connection and try again" }).click();
  await page.getByRole("heading", { name: "Your number pattern" }).waitFor();
  assert.equal(numerologyPosts().length, 2);

  const targetSizes = await page
    .locator(
      ".numerology-form input, .numerology-form button, .numerology-result button, .numerology-method summary",
    )
    .evaluateAll((elements) =>
      elements.map((element) => {
        const rectangle = element.getBoundingClientRect();
        return { height: rectangle.height, width: rectangle.width };
      }),
    );
  assert.ok(targetSizes.every(({ height, width }) => height >= 44 && width >= 44));
  await page.addStyleTag({ content: "html { font-size: 140% !important; }" });
  await page.evaluate(() => {
    document.documentElement.dir = "rtl";
  });
  const layout = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    storage: localStorage.length + sessionStorage.length,
    viewportWidth: window.innerWidth,
  }));
  assert.ok(layout.documentWidth <= layout.viewportWidth);
  assert.equal(layout.storage, 0);
  assert.deepEqual(unexpected, []);
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(consoleErrors, []);

  process.stdout.write(
    `${JSON.stringify({
      axeCriticalOrSeriousViolations: 0,
      axeIncompleteColorContrastNodes: [initialIncomplete, resultIncomplete],
      birthDataStorageEntries: layout.storage,
      calculationPosts: numerologyPosts().length,
      mobileHorizontalOverflow: layout.documentWidth > layout.viewportWidth,
      route: numerologyPath,
    })}\n`,
  );
} finally {
  await browser.close();
  await stopServer(server);
  if (serverError !== "" && server.exitCode !== 0 && server.exitCode !== null) {
    process.stderr.write(serverError);
  }
}
