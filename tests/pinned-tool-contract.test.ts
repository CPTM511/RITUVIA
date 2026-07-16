import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("pinned CI tool contract", () => {
  it("prevents repository content from weakening Gitleaks", async () => {
    const source = await readFile("scripts/run-pinned-ci-tool.mjs", "utf8");
    expect(source).toContain('"[extend]\\nuseDefault = true\\n"');
    expect(source).toContain('"--config"');
    expect(source).toContain('"--gitleaks-ignore-path"');
    expect(source).toContain('"--ignore-gitleaks-allow"');
    expect(source).not.toContain('path.resolve(".gitleaks');
    expect(source).toContain("attempt < 3");
    expect(source).toContain('execFileSync("/usr/bin/tar"');
  });
});
