import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";

const host = "127.0.0.1";
const port = 4191;
const origin = `http://${host}:${port}`;
const artifactRoot = await mkdtemp(path.join(tmpdir(), "rituvia-writing-systems-"));
const controlledBundlePath = path.join(artifactRoot, "controlled-preview.js");

execFileSync(
  "pnpm",
  [
    "exec",
    "esbuild",
    "packages/ui/test/controlled-preview.tsx",
    "--bundle",
    "--format=esm",
    "--log-level=error",
    "--platform=browser",
    `--outfile=${controlledBundlePath}`,
  ],
  { cwd: process.cwd(), stdio: "pipe" },
);

const waitForServer = async (server) => {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error("Writing-system preview server exited before ready.");
    }
    try {
      const response = await fetch(`${origin}/cjk`);
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error("Writing-system preview server did not become ready.");
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

const setComposingValue = async (locator, value, phase) =>
  locator.evaluate(
    (element, input) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      if (setter === undefined) throw new TypeError("Native input value setter unavailable.");
      if (input.phase === "start") {
        element.dispatchEvent(
          new CompositionEvent("compositionstart", { bubbles: true, data: "" }),
        );
      }
      setter.call(element, input.value);
      element.dispatchEvent(
        new CompositionEvent("compositionupdate", {
          bubbles: true,
          data: input.value,
        }),
      );
      element.dispatchEvent(
        new InputEvent("input", {
          bubbles: true,
          data: input.value,
          inputType: "insertCompositionText",
          isComposing: true,
        }),
      );
      if (input.phase === "end") {
        element.dispatchEvent(
          new CompositionEvent("compositionend", {
            bubbles: true,
            data: input.value,
          }),
        );
      }
    },
    { phase, value },
  );

const waitForControlledValue = async (page, value) => {
  await page.waitForFunction(
    (expected) =>
      document.querySelector('[data-controlled-value="true"]')?.textContent === expected,
    value,
  );
};

const renderedLines = async (locator, locale) =>
  locator.evaluate((element, localeInput) => {
    const node = element.firstChild;
    if (!(node instanceof Text)) throw new TypeError("Line-break probe text is unavailable.");
    const lines = new Map();
    const segments = new Intl.Segmenter(localeInput, { granularity: "grapheme" }).segment(
      node.data,
    );
    for (const segment of segments) {
      if (segment.segment.trim() === "") continue;
      const range = document.createRange();
      range.setStart(node, segment.index);
      range.setEnd(node, segment.index + segment.segment.length);
      const rectangle = range.getBoundingClientRect();
      const line = Math.round(rectangle.top * 2) / 2;
      const current = lines.get(line) ?? [];
      current.push(segment.segment);
      lines.set(line, current);
    }
    return [...lines.entries()]
      .sort(([left], [right]) => left - right)
      .map(([, graphemes]) => graphemes.join(""));
  }, locale);

const platformFontsFor = async (client, rootNodeId, selector) => {
  const { nodeId } = await client.send("DOM.querySelector", {
    nodeId: rootNodeId,
    selector,
  });
  assert.ok(nodeId > 0, `Missing font probe: ${selector}`);
  const { fonts } = await client.send("CSS.getPlatformFontsForNode", { nodeId });
  assert.ok(fonts.reduce((total, font) => total + font.glyphCount, 0) > 0);
  assert.equal(
    fonts.some((font) => /lastresort|tofu/iu.test(font.familyName)),
    false,
    JSON.stringify(fonts),
  );
  return fonts;
};

const server = spawn(
  process.execPath,
  ["--import", "tsx", "packages/ui/test/serve-preview.ts", String(port)],
  {
    cwd: process.cwd(),
    env: { ...process.env, RITUVIA_UI_CONTROLLED_BUNDLE: controlledBundlePath },
    stdio: ["ignore", "ignore", "pipe"],
  },
);
let serverError = "";
server.stderr?.on("data", (chunk) => {
  serverError += String(chunk);
});

const browser = await chromium.launch({ headless: true });
try {
  await waitForServer(server);
  let axeScans = 0;
  let compositionScenarios = 0;
  let cjkLineBreakScenarios = 0;
  let fontFallbackScenarios = 0;
  let graphemeScenarios = 0;
  let screenshots = 0;

  for (const scenario of [
    {
      dateField: "#preview-japanese-date",
      documentLocale: "ja",
      locale: "ja-JP",
      nameField: "#preview-japanese-name",
      nameValue: "髙橋はるか",
      partialValue: "髙橋",
      pathname: "/cjk",
      writingSystem: "ja",
    },
    {
      dateField: "#preview-hindi-date",
      documentLocale: "hi",
      locale: "hi-IN",
      nameField: "#preview-hindi-name",
      nameValue: "अनन्या शर्मा",
      partialValue: "अनन्या",
      pathname: "/devanagari",
      writingSystem: "hi",
    },
  ]) {
    const context = await browser.newContext({
      baseURL: origin,
      colorScheme: "dark",
      locale: scenario.locale,
      reducedMotion: "reduce",
      timezoneId: "Asia/Shanghai",
      viewport: { height: 844, width: 320 },
    });
    const unexpectedRequests = [];
    await context.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.origin === origin) return route.continue();
      unexpectedRequests.push(`${route.request().method()}:${url.origin}${url.pathname}`);
      return route.abort("blockedbyclient");
    });
    const page = await context.newPage();
    page.setDefaultTimeout(5_000);
    const consoleErrors = [];
    const pageErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));

    const response = await page.goto(scenario.pathname, { waitUntil: "load" });
    assert.ok(response);
    assert.equal(response.status(), 200);
    assert.equal(await page.locator("html").getAttribute("lang"), scenario.documentLocale);
    await page.locator('[data-controlled-ready="true"]').waitFor();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
      true,
    );

    const client = await context.newCDPSession(page);
    await client.send("DOM.enable");
    await client.send("CSS.enable");
    const { root } = await client.send("DOM.getDocument");

    if (scenario.writingSystem === "ja") {
      const cjkProfiles = [
        { expectedFont: "Hiragino Sans", locale: "ja", writingSystem: "ja" },
        { expectedFont: "Malgun Gothic", locale: "ko", writingSystem: "ko" },
        { expectedFont: "PingFang SC", locale: "zh-Hans", writingSystem: "zh-Hans" },
        { expectedFont: "PingFang TC", locale: "zh-Hant", writingSystem: "zh-Hant" },
      ];
      for (const profile of cjkProfiles) {
        const selector = `[data-writing-system="${profile.writingSystem}"]`;
        const computed = await page.locator(selector).evaluate((element) => {
          const style = getComputedStyle(element);
          return {
            fontFamily: style.fontFamily,
            lineBreak: style.lineBreak,
            overflowWrap: style.overflowWrap,
            wordBreak: style.wordBreak,
          };
        });
        assert.equal(computed.fontFamily.includes(profile.expectedFont), true);
        assert.equal(computed.lineBreak, "strict");
        assert.equal(computed.overflowWrap, "anywhere");
        assert.equal(computed.wordBreak, "normal");
        await platformFontsFor(
          client,
          root.nodeId,
          `${selector} [data-line-break-probe="${profile.writingSystem}"]`,
        );
        fontFallbackScenarios += 1;

        const lines = await renderedLines(
          page.locator(`[data-line-break-probe="${profile.writingSystem}"]`),
          profile.locale,
        );
        assert.ok(lines.length > 1);
        for (const line of lines) {
          assert.equal(/^[、。，．？！：；）」』】》〉]/u.test(line), false, line);
          assert.equal(/[（「『【《〈]$/u.test(line), false, line);
        }
        cjkLineBreakScenarios += 1;
      }
    } else {
      const writingSystem = page.locator('[data-writing-system="hi"]');
      const computed = await writingSystem.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          fontFamily: style.fontFamily,
          fontVariantLigatures: style.fontVariantLigatures,
          overflowWrap: style.overflowWrap,
          wordBreak: style.wordBreak,
        };
      });
      assert.equal(computed.fontFamily.includes("Noto Sans Devanagari"), true);
      assert.equal(computed.fontVariantLigatures.includes("common-ligatures"), true);
      assert.equal(computed.overflowWrap, "anywhere");
      assert.equal(computed.wordBreak, "normal");
      await platformFontsFor(client, root.nodeId, '[data-shaping-probe="hi"]');
      const shaping = await page.locator('[data-shaping-probe="hi"]').evaluate((element) => {
        const style = getComputedStyle(element);
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        if (context === null) throw new TypeError("Canvas text metrics unavailable.");
        context.font = `${style.fontSize} ${style.fontFamily}`;
        const sample = "क्षि";
        return {
          combined: context.measureText(sample).width,
          separate: [...sample].reduce(
            (total, character) => total + context.measureText(character).width,
            0,
          ),
        };
      });
      assert.ok(shaping.combined < shaping.separate);
      fontFallbackScenarios += 1;
    }

    const nativeName = page.locator(scenario.nameField);
    assert.equal(await nativeName.getAttribute("autocomplete"), "name");
    assert.equal(await nativeName.getAttribute("dir"), "auto");
    assert.equal(await nativeName.getAttribute("maxlength"), null);
    await nativeName.fill(scenario.nameValue);
    assert.equal(await nativeName.inputValue(), scenario.nameValue);

    const controlledName = page.locator("#controlled-name");
    assert.equal(await controlledName.getAttribute("maxlength"), null);
    await setComposingValue(controlledName, scenario.partialValue, "start");
    await waitForControlledValue(page, scenario.partialValue);
    await page.locator("#controlled-rerender").click();
    assert.equal(await controlledName.inputValue(), scenario.partialValue);
    await setComposingValue(controlledName, scenario.nameValue, "end");
    await waitForControlledValue(page, scenario.nameValue);
    assert.equal(await controlledName.inputValue(), scenario.nameValue);
    compositionScenarios += 1;

    const date = page.locator(scenario.dateField);
    assert.equal(await date.getAttribute("type"), "date");
    assert.equal(await date.getAttribute("min"), "1900-01-01");
    await date.fill("2026-07-27");
    assert.equal(await date.inputValue(), "2026-07-27");

    const graphemes = await page.evaluate(
      ({ locale, value }) => ({
        codePoints: [...value].length,
        graphemes: [...new Intl.Segmenter(locale, { granularity: "grapheme" }).segment(value)]
          .length,
      }),
      { locale: scenario.locale, value: scenario.nameValue },
    );
    assert.ok(graphemes.graphemes > 0);
    assert.ok(graphemes.graphemes <= graphemes.codePoints);
    if (scenario.writingSystem === "hi") {
      assert.ok(graphemes.graphemes < graphemes.codePoints);
    }
    graphemeScenarios += 1;

    for (const field of [nativeName, controlledName, date]) {
      const box = await field.boundingBox();
      assert.ok(box);
      assert.ok(box.height >= 44);
      assert.ok(box.x >= 0 && box.x + box.width <= 320);
    }

    const axe = await new AxeBuilder({ page }).analyze();
    const seriousAxeFindings = axe.violations
      .filter((finding) => finding.impact === "critical" || finding.impact === "serious")
      .map(({ id, impact, nodes }) => ({
        id,
        impact,
        nodes: nodes.map(({ failureSummary, target }) => ({ failureSummary, target })),
      }));
    assert.deepEqual(seriousAxeFindings, [], JSON.stringify(seriousAxeFindings));
    axeScans += 1;

    assert.equal(new URL(page.url()).search, "");
    assert.equal((await page.title()).includes(scenario.nameValue), false);
    await page.screenshot({
      fullPage: true,
      path: path.join(artifactRoot, `${scenario.writingSystem}.png`),
    });
    screenshots += 1;
    assert.deepEqual(unexpectedRequests, []);
    assert.deepEqual(consoleErrors, []);
    assert.deepEqual(pageErrors, []);
    assert.deepEqual(
      await page.evaluate(() => ({
        local: localStorage.length,
        session: sessionStorage.length,
      })),
      { local: 0, session: 0 },
    );
    await context.close();
  }

  process.stdout.write(
    `${JSON.stringify({
      axeCriticalOrSeriousViolations: 0,
      axeScans,
      cjkLineBreakScenarios,
      compositionScenarios,
      consoleOrPageErrors: 0,
      externalRequests: 0,
      fontFallbackScenarios,
      graphemeScenarios,
      localeActivations: 0,
      screenshots,
      storageWrites: 0,
      viewportWidth: 320,
    })}\n`,
  );
} finally {
  await browser.close();
  await stopServer(server);
  await rm(artifactRoot, { force: true, recursive: true });
  if (server.exitCode !== 0 && server.exitCode !== null && server.exitCode !== 143) {
    throw new Error(`Writing-system preview server failed: ${serverError.trim()}`);
  }
}
