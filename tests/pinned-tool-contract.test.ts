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
    expect(source.match(/:generic-api-key:\d+"/g)).toHaveLength(13);
    expect(source).toContain(
      "b99f5234c99f842f3616c773e7871cb6b612db77:packages/db/src/commercial-fulfillment-persistence.ts:generic-api-key:8",
    );
    expect(source).toContain(
      "88141a2a91641c60347bd5bfe24085e015790dc6:packages/observability/src/beta-operations.ts:generic-api-key:3",
    );
    expect(source).toContain("historicalGitleaksIgnoreFingerprints.join");
    expect(source).toContain("attempt < 3");
    expect(source).toContain('execFileSync("/usr/bin/tar"');
    expect(source).toContain('"actionlint_1.7.12_linux_amd64.tar.gz"');
    expect(source).not.toContain("linux_x86_64");
  });
});
