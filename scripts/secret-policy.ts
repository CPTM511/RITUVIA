import { createHash } from "node:crypto";
import path from "node:path";

export type SecretFinding = Readonly<{
  fingerprint: string;
  line: number;
  path: string;
  rule: string;
}>;

type SecretRule = Readonly<{
  id: string;
  pattern: RegExp;
}>;

const rules: readonly SecretRule[] = Object.freeze([
  {
    id: "private-key",
    pattern: /-----BEGIN (?:[A-Z0-9]+ )?PRIVATE KEY-----/g,
  },
  {
    id: "github-token",
    pattern: /\bgh[pousr]_[A-Za-z0-9]{36,255}\b/g,
  },
  {
    id: "aws-access-key",
    pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g,
  },
  {
    id: "openai-api-key",
    pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g,
  },
  {
    id: "credentialed-database-url",
    pattern: /\bpostgres(?:ql)?:\/\/[^\s:/]+:(?!\$\{|PASSWORD@|password@)[^\s@/]{8,}@[^\s]+/g,
  },
  {
    id: "slack-token",
    pattern: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g,
  },
  {
    id: "npm-auth",
    pattern: /(?:_authToken|_password)[\t ]*=[\t ]*(?!\$\{)[^\s]{8,}/gi,
  },
]);

const sensitiveBasenames = new Set([
  ".env",
  ".env.local",
  ".env.production",
  "id_dsa",
  "id_ecdsa",
  "id_ed25519",
  "id_rsa",
]);

const binaryExtensions = new Set([
  ".7z",
  ".avif",
  ".bin",
  ".dmg",
  ".gif",
  ".gz",
  ".ico",
  ".jpeg",
  ".jpg",
  ".pdf",
  ".png",
  ".tar",
  ".webp",
  ".woff",
  ".woff2",
  ".zip",
]);

const reviewedStaticAssets = new Map<string, Readonly<{ bytes: number; sha256: string }>>([
  [
    "apps/web/public/images/rituvia-sanctuary-orb.png",
    Object.freeze({
      bytes: 1_951_492,
      sha256: "dc63dbfd1656d1e09b4b636c270b0ff61069d748d4cb549c573fc5d163879020",
    }),
  ],
  [
    "docs/codex/rituvia-production-2026-07-23/evidence/screenshots/desktop-about.png",
    Object.freeze({
      bytes: 1_036_012,
      sha256: "a1901cc2027e4600141ec3186569b7355f10c136c00175f7e5e69f92e3b2c5a6",
    }),
  ],
  [
    "docs/codex/rituvia-production-2026-07-23/evidence/screenshots/desktop-account-authenticated.png",
    Object.freeze({
      bytes: 943_674,
      sha256: "473aa7cf989505741e0549a89a7b0c06ed28753bef54ec912b0dbcfebf3ac962",
    }),
  ],
  [
    "docs/codex/rituvia-production-2026-07-23/evidence/screenshots/desktop-billing-wallets.png",
    Object.freeze({
      bytes: 708_485,
      sha256: "c15ade2f079af42a7f02a36d2e2cab49e13240086ec5cfa29e1e9d875d8c47c6",
    }),
  ],
  [
    "docs/codex/rituvia-production-2026-07-23/evidence/screenshots/desktop-checkout-stripe.png",
    Object.freeze({
      bytes: 829_014,
      sha256: "9a811c5fd42381952d9194766219344324198ef6da8c67ee41fc62c269432a20",
    }),
  ],
  [
    "docs/codex/rituvia-production-2026-07-23/evidence/screenshots/desktop-checkout-usdc-base.png",
    Object.freeze({
      bytes: 890_672,
      sha256: "ff3bed769e62dae6c4ea69ddc66484ac3a45a85a59dfabd1ab21aff777a0685e",
    }),
  ],
  [
    "docs/codex/rituvia-production-2026-07-23/evidence/screenshots/desktop-daily-revealed.png",
    Object.freeze({
      bytes: 696_139,
      sha256: "4d5fe8483af49ff856ee8355de4396348e0395f7e36a950d8a12892a5c422c3b",
    }),
  ],
  [
    "docs/codex/rituvia-production-2026-07-23/evidence/screenshots/desktop-deep-readings.png",
    Object.freeze({
      bytes: 602_149,
      sha256: "d35461e30959a1cd40f6b1dfdcc8f0bb9fbdfd68e425ffeea8ef2bce56708adc",
    }),
  ],
  [
    "docs/codex/rituvia-production-2026-07-23/evidence/screenshots/desktop-home.png",
    Object.freeze({
      bytes: 1_367_137,
      sha256: "b72bf31cdc7863f382367859036d2f0d309980b80d5d083721600a789dd4e5a1",
    }),
  ],
  [
    "docs/codex/rituvia-production-2026-07-23/evidence/screenshots/desktop-orders.png",
    Object.freeze({
      bytes: 467_542,
      sha256: "8b447afa02e3083605c29ddde4d948c6d8631fc343c3448893e1cb980f7d9002",
    }),
  ],
  [
    "docs/codex/rituvia-production-2026-07-23/evidence/screenshots/desktop-plans-credits.png",
    Object.freeze({
      bytes: 2_856_558,
      sha256: "51b6d35cd74ad2ed9b9176e88c25043edad6cc0880fe72ab8d3f361575320c49",
    }),
  ],
  [
    "docs/codex/rituvia-production-2026-07-23/evidence/screenshots/desktop-readings.png",
    Object.freeze({
      bytes: 1_254_861,
      sha256: "64959c5bfeda413c694dd646fd05d0a6f0de4f7a7a761f5ca2404e08cbb661d7",
    }),
  ],
  [
    "docs/codex/rituvia-production-2026-07-23/evidence/screenshots/desktop-sanctuary.png",
    Object.freeze({
      bytes: 1_080_502,
      sha256: "9724e288f8478195a68e1690617aa89e09bea795cd4027a119ed1ba81c63e67a",
    }),
  ],
  [
    "docs/codex/rituvia-production-2026-07-23/evidence/screenshots/desktop-sign-in.png",
    Object.freeze({
      bytes: 659_441,
      sha256: "e5a0d60763e8f6618f9474c4c8f1b1b951c0579d04d585fc8194248ebb314ec7",
    }),
  ],
  [
    "docs/codex/rituvia-production-2026-07-23/evidence/screenshots/desktop-tarot.png",
    Object.freeze({
      bytes: 715_196,
      sha256: "5e685693a2b95baa2741660a8cd38bf101e47e8ab04c32f43893640ef119cc51",
    }),
  ],
  [
    "docs/codex/rituvia-production-2026-07-23/evidence/screenshots/mobile-deep-zh.png",
    Object.freeze({
      bytes: 565_885,
      sha256: "8deb303119a3c54979d05e2d2a61d814c72590064ab08202308f3828e7a56d21",
    }),
  ],
  [
    "docs/codex/rituvia-production-2026-07-23/evidence/screenshots/mobile-home-zh.png",
    Object.freeze({
      bytes: 894_498,
      sha256: "68026d54825ddc223774c00ffdcf9bf247eeb974bf67db28ee891a78e95c9be9",
    }),
  ],
  [
    "docs/codex/rituvia-production-2026-07-23/evidence/screenshots/mobile-plans-zh.png",
    Object.freeze({
      bytes: 2_077_100,
      sha256: "9f46613af60485f15faf02752bb27418258a28aa16ee4aa6185636abe5ea784f",
    }),
  ],
  [
    "docs/codex/rituvia-production-2026-07-23/evidence/screenshots/mobile-sign-in-zh.png",
    Object.freeze({
      bytes: 349_940,
      sha256: "b58dc5c3ee5120528841e5cbbafe0015e6da68d155960137b3bf20fb26566b68",
    }),
  ],
]);

const lineForOffset = (content: string, offset: number): number => {
  let line = 1;
  for (let index = 0; index < offset; index += 1) {
    if (content.charCodeAt(index) === 10) line += 1;
  }
  return line;
};

const fingerprint = (rule: string, filePath: string, line: number): string =>
  createHash("sha256").update(`${rule}\0${filePath}\0${line}`).digest("hex").slice(0, 16);

export const isSensitiveFilePath = (filePath: string): boolean => {
  const normalized = filePath.replaceAll("\\", "/");
  const basename = path.posix.basename(normalized);
  return (
    (basename.startsWith(".env") && basename !== ".env.example") ||
    sensitiveBasenames.has(basename) ||
    /(?:^|\/)(?:credentials|secrets?)\.(?:json|ya?ml)$/i.test(normalized) ||
    /\.(?:key|p12|pfx|pem)$/i.test(basename)
  );
};

export const createSecretFinding = (rule: string, filePath: string, line = 1): SecretFinding => {
  const normalizedPath = filePath.replaceAll("\\", "/");
  return Object.freeze({
    fingerprint: fingerprint(rule, normalizedPath, line),
    line,
    path: normalizedPath,
    rule,
  });
};

export const isReviewedStaticAssetPath = (filePath: string): boolean =>
  reviewedStaticAssets.has(filePath);

export const isReviewedStaticAsset = (filePath: string, content: Uint8Array): boolean => {
  const reviewed = reviewedStaticAssets.get(filePath);
  return (
    reviewed !== undefined &&
    content.byteLength === reviewed.bytes &&
    createHash("sha256").update(content).digest("hex") === reviewed.sha256
  );
};

export const classifyReviewedStaticAsset = (
  filePath: string,
  content: Uint8Array | null,
): "accepted" | "content-mismatch" | "not-reviewed" | "type-mismatch" => {
  if (!isReviewedStaticAssetPath(filePath)) return "not-reviewed";
  if (content === null) return "type-mismatch";
  return isReviewedStaticAsset(filePath, content) ? "accepted" : "content-mismatch";
};

export const scanSecretText = (filePath: string, content: string): readonly SecretFinding[] => {
  const normalizedPath = filePath.replaceAll("\\", "/");
  const findings: SecretFinding[] = [];

  if (isSensitiveFilePath(normalizedPath)) {
    findings.push(createSecretFinding("sensitive-file", normalizedPath));
  }

  for (const rule of rules) {
    rule.pattern.lastIndex = 0;
    for (const match of content.matchAll(rule.pattern)) {
      const line = lineForOffset(content, match.index);
      findings.push(createSecretFinding(rule.id, normalizedPath, line));
    }
  }

  return Object.freeze(findings);
};

export const scanSecretBuffer = (
  filePath: string,
  content: Uint8Array,
): readonly SecretFinding[] => {
  const buffer = Buffer.from(content);
  if (
    binaryExtensions.has(path.posix.extname(filePath).toLowerCase()) ||
    buffer.some(
      (value) =>
        value === 0 || (value < 32 && value !== 9 && value !== 10 && value !== 12 && value !== 13),
    )
  ) {
    return [createSecretFinding("binary-content", filePath)];
  }
  try {
    return scanSecretText(filePath, new TextDecoder("utf-8", { fatal: true }).decode(buffer));
  } catch {
    return [createSecretFinding("binary-content", filePath)];
  }
};
