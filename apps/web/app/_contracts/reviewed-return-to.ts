const localCheckoutIdPattern = /^local_[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;

export const isReviewedReturnTo = (value: unknown): value is string => {
  if (value === "/en/account" || value === "/en/plans" || value === "/en/sanctuary") return true;
  if (typeof value !== "string" || value.length > 512) return false;
  try {
    const parsed = new URL(value, "https://local.invalid");
    const entries = [...parsed.searchParams.entries()];
    return (
      parsed.origin === "https://local.invalid" &&
      parsed.pathname === "/en/checkout/local" &&
      parsed.hash === "" &&
      entries.length === 1 &&
      entries[0]?.[0] === "checkout_id" &&
      localCheckoutIdPattern.test(entries[0][1])
    );
  } catch {
    return false;
  }
};

export const safeLocalReturnTo = (
  candidate: string | null | undefined,
  fallback: string,
): string => (isReviewedReturnTo(candidate) ? candidate : fallback);
