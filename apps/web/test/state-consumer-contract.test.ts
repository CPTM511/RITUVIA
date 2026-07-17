import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const errorBoundary = readFileSync("apps/web/app/[locale]/error.tsx", "utf8");
const connectionState = readFileSync("apps/web/app/_components/connection-state.tsx", "utf8");
const connectionNotice = readFileSync("apps/web/app/_components/connection-notice.tsx", "utf8");
const siteShell = readFileSync("apps/web/app/_components/site-shell.tsx", "utf8");
const proxy = readFileSync("apps/web/proxy.ts", "utf8");

describe("public-shell state consumer boundary", () => {
  it("uses shared state patterns in three truthful public-shell consumers", () => {
    expect(errorBoundary).toContain("<ResilientState");
    expect(errorBoundary).toContain('kind="error"');
    expect(errorBoundary).toContain('kind="offline"');
    expect(connectionNotice).toContain('kind="offline"');
    expect(siteShell).toContain('kind="empty"');
  });

  it("never reads or logs raw route errors", () => {
    expect(errorBoundary).not.toMatch(/\berror\.(?:cause|digest|message|name|stack)\b/u);
    expect(errorBoundary).not.toMatch(/\bconsole\s*\./u);
    expect(errorBoundary).not.toMatch(/(?:analytics|requestId|providerCode)/u);
    expect(errorBoundary).toContain("export default function LocaleError({ reset }");
    expect(errorBoundary).toContain("document.getElementById(errorTitleId)?.focus()");
    expect(errorBoundary).toContain("}, []);");
  });

  it("detects only the browser's explicit connection signal and cleans up listeners", () => {
    expect(connectionState).toContain("navigator.onLine");
    expect(connectionState).toContain('window.addEventListener("offline"');
    expect(connectionState).toContain('window.addEventListener("online"');
    expect(connectionState).toContain('window.removeEventListener("offline"');
    expect(connectionState).toContain('window.removeEventListener("online"');
    for (const source of [connectionNotice, connectionState]) {
      expect(source).not.toMatch(/(?:serviceWorker|caches\.|indexedDB|localStorage)/u);
    }
  });

  it("does not create a public state switch or weaken the safe-off proxy", () => {
    for (const source of [errorBoundary, connectionNotice, connectionState, siteShell]) {
      expect(source).not.toMatch(
        /(?:searchParams|location\.search|document\.cookie|x-rituvia-state)/u,
      );
    }
    expect(proxy).toContain("new NextResponse(null, { status: 404 })");
    expect(proxy).not.toMatch(/(?:provider-unavailable|state-messages|ResilientState)/u);
  });
});
