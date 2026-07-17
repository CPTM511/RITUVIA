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
if (systemStyles.includes("</style") || previewStyles.includes("</style")) {
  throw new TypeError("Preview styles contain an unsafe style terminator.");
}

const previewMarkup = renderToStaticMarkup(createElement(UiPreview));
type PreviewRoute = Readonly<{ direction: "ltr" | "rtl"; theme: "dark" | "light" | "system" }>;

const previewByPath: ReadonlyMap<string, PreviewRoute> = new Map([
  ["/", { direction: "ltr", theme: "system" }],
  ["/system", { direction: "ltr", theme: "system" }],
  ["/light", { direction: "ltr", theme: "light" }],
  ["/dark", { direction: "ltr", theme: "dark" }],
  ["/rtl", { direction: "rtl", theme: "system" }],
] as const);

createServer((request, response) => {
  const preview = previewByPath.get(request.url ?? "");
  if (request.method !== "GET" || preview === undefined) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }
  const document = `<!DOCTYPE html><html data-theme="${preview.theme}" dir="${preview.direction}" lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>RITUVIA UI contract preview</title><style>${systemStyles}\n${previewStyles}</style></head><body>${previewMarkup}</body></html>`;
  response.writeHead(200, {
    "cache-control": "no-store",
    "content-security-policy":
      "default-src 'none'; script-src 'none'; script-src-attr 'none'; style-src 'unsafe-inline'; style-src-attr 'none'; base-uri 'none'; frame-ancestors 'none'",
    "content-type": "text/html; charset=utf-8",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
  });
  response.end(document);
}).listen(port, "127.0.0.1");
