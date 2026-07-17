import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const primitives = readFileSync("packages/ui/src/primitives.tsx", "utf8");

describe("UI Server Component contract", () => {
  it("omits host event handlers unless the caller explicitly supplies the matching callback", () => {
    expect(
      primitives.match(/onClick=\{onPress === undefined \? undefined : handleClick\}/gu),
    ).toHaveLength(2);
    expect(
      primitives.match(/onChange=\{onValueChange === undefined \? undefined : handleChange\}/gu),
    ).toHaveLength(4);
    expect(
      primitives.match(/onChange=\{onCheckedChange === undefined \? undefined : handleChange\}/gu),
    ).toHaveLength(2);
    expect(primitives).not.toMatch(/on(?:Click|Change)=\{handle(?:Click|Change)\}/gu);
  });

  it("does not force the package catalog behind a client-only module boundary", () => {
    expect(primitives).not.toMatch(/^\s*["']use client["'];/mu);
  });
});
