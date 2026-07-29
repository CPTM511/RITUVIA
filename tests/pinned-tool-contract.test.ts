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
    expect(source.match(/:generic-api-key:\d+"/g)).toHaveLength(11);
    expect(source).toContain("historicalGitleaksIgnoreFingerprints.join");
    expect(source).toContain("attempt < 3");
    expect(source).toContain('execFileSync("/usr/bin/tar"');
    expect(source).toContain('"actionlint_1.7.12_linux_amd64.tar.gz"');
    expect(source).not.toContain("linux_x86_64");
  });
});
