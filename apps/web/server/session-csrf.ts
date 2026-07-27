import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

const sessionTokenPattern = /^[A-Za-z0-9_-]{43}$/u;
const csrfTokenPattern = /^[A-Za-z0-9_-]{43}$/u;

export const sessionCsrfHeaderName = "x-csrf-token";

export const deriveSessionCsrfToken = (sessionToken: string): string => {
  if (!sessionTokenPattern.test(sessionToken)) {
    throw new TypeError("Session CSRF token derivation failed.");
  }
  return createHash("sha256")
    .update("rituvia.session-csrf.v1\0", "utf8")
    .update(sessionToken, "utf8")
    .digest("base64url");
};

export const hasValidSessionCsrfToken = (
  csrfToken: string | null,
  sessionTokens: readonly (string | undefined)[],
): boolean => {
  if (csrfToken === null || !csrfTokenPattern.test(csrfToken)) return false;
  const supplied = Buffer.from(csrfToken, "utf8");
  return sessionTokens.some((sessionToken) => {
    if (sessionToken === undefined || !sessionTokenPattern.test(sessionToken)) return false;
    const expected = Buffer.from(deriveSessionCsrfToken(sessionToken), "utf8");
    return supplied.byteLength === expected.byteLength && timingSafeEqual(supplied, expected);
  });
};
