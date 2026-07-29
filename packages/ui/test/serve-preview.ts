import { readFile } from "node:fs/promises";
import { createServer } from "node:http";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { UiPreview } from "../examples/preview.js";

const portArgument = process.argv[2] ?? "4175";
const port = Number.parseInt(portArgument, 10);
if (!Number.isSafeInteger(port) || port < 1024 || port > 65_535) {
  throw new TypeError("Preview port must be an unprivileged integer.");
}

const [systemStyles, previewStyles] = await Promise.all([
  readFile(new URL("../src/styles.css", import.meta.url), "utf8"),
  readFile(new URL("../examples/preview.css", import.meta.url), "utf8"),
]);
const webStyles = await readFile(
  new URL("../../../apps/web/app/styles.css", import.meta.url),
  "utf8",
);
const controlledBundlePath = process.env.RITUVIA_UI_CONTROLLED_BUNDLE;
const controlledBundle =
  controlledBundlePath === undefined ? null : await readFile(controlledBundlePath, "utf8");
if (
  systemStyles.includes("</style") ||
  previewStyles.includes("</style") ||
  webStyles.includes("</style")
) {
  throw new TypeError("Preview styles contain an unsafe style terminator.");
}

const previewMarkup = renderToStaticMarkup(createElement(UiPreview));
type PreviewRoute = Readonly<{
  controlled?: boolean;
  direction: "ltr" | "rtl";
  locale: "en" | "hi" | "ja";
  theme: "dark" | "light" | "system";
}>;

const previewByPath: ReadonlyMap<string, PreviewRoute> = new Map([
  ["/", { direction: "ltr", locale: "en", theme: "system" }],
  ["/system", { direction: "ltr", locale: "en", theme: "system" }],
  ["/light", { direction: "ltr", locale: "en", theme: "light" }],
  ["/dark", { direction: "ltr", locale: "en", theme: "dark" }],
  ["/rtl", { direction: "rtl", locale: "en", theme: "system" }],
  ["/cjk", { controlled: true, direction: "ltr", locale: "ja", theme: "system" }],
  ["/devanagari", { controlled: true, direction: "ltr", locale: "hi", theme: "system" }],
] as const);

createServer((request, response) => {
  if (request.method === "GET" && request.url === "/controlled.js" && controlledBundle !== null) {
    response.writeHead(200, {
      "cache-control": "no-store",
      "content-type": "text/javascript; charset=utf-8",
      "x-content-type-options": "nosniff",
    });
    response.end(controlledBundle);
    return;
  }
  const preview = previewByPath.get(request.url ?? "");
  if (request.method !== "GET" || preview === undefined) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }
  if (preview.controlled === true && controlledBundle === null) {
    response.writeHead(503, { "content-type": "text/plain; charset=utf-8" });
    response.end("Controlled preview unavailable");
    return;
  }
  const controlledRoot = preview.controlled === true ? '<div id="controlled-root"></div>' : "";
  const controlledScript =
    preview.controlled === true ? '<script src="/controlled.js" type="module"></script>' : "";
  const document = `<!DOCTYPE html><html data-theme="${preview.theme}" dir="${preview.direction}" lang="${preview.locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>RITUVIA UI contract preview</title><style>${systemStyles}\n${previewStyles}\n${webStyles}</style></head><body>${previewMarkup}${controlledRoot}${controlledScript}</body></html>`;
  response.writeHead(200, {
    "cache-control": "no-store",
    "content-security-policy": `default-src 'none'; script-src ${preview.controlled === true ? "'self'" : "'none'"}; script-src-attr 'none'; style-src 'unsafe-inline'; style-src-attr 'none'; base-uri 'none'; frame-ancestors 'none'`,
    "content-type": "text/html; charset=utf-8",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
  });
  response.end(document);
}).listen(port, "127.0.0.1");
