import { CommerceError } from "./errors.js";
import type { EntitlementDirective, OrderV1 } from "./order.js";
import { parseInstant, parseResourceId } from "./validation.js";

export type EntitlementV1 = Readonly<{
  accountId: string;
  code: string;
  entitlementId: string;
  grantedAt: string;
  revokedAt: string | null;
  sourceOrderId: string;
  state: "active" | "revoked";
}>;

export type EntitlementApplication = Readonly<{
  disposition: "granted" | "ignored" | "revoked";
  entitlement: EntitlementV1 | null;
}>;

const freezeEntitlement = (entitlement: EntitlementV1): EntitlementV1 =>
  Object.freeze({ ...entitlement });

export const applyEntitlementDirective = (input: {
  at: string;
  directive: EntitlementDirective;
  entitlementId: string;
  existing: EntitlementV1 | null;
  order: OrderV1;
}): EntitlementApplication => {
  const at = parseInstant(input.at);
  const entitlementId = parseResourceId(input.entitlementId);
  const existing = input.existing;
  if (
    existing !== null &&
    (existing.accountId !== input.order.accountId ||
      existing.code !== input.order.entitlementCode ||
      existing.sourceOrderId !== input.order.orderId)
  ) {
    throw new CommerceError("COMMERCE_STATE_CONFLICT");
  }

  if (input.directive === "none") {
    return Object.freeze({ disposition: "ignored", entitlement: existing });
  }

  if (input.directive === "grant") {
    if (input.order.state !== "paid") throw new CommerceError("COMMERCE_STATE_CONFLICT");
    if (existing !== null) {
      return Object.freeze({ disposition: "ignored", entitlement: existing });
    }
    return Object.freeze({
      disposition: "granted",
      entitlement: freezeEntitlement({
        accountId: input.order.accountId,
        code: input.order.entitlementCode,
        entitlementId,
        grantedAt: at,
        revokedAt: null,
        sourceOrderId: input.order.orderId,
        state: "active",
      }),
    });
  }

  if (input.order.state !== "refunded" && input.order.state !== "disputed") {
    throw new CommerceError("COMMERCE_STATE_CONFLICT");
  }
  if (existing === null || existing.state === "revoked") {
    return Object.freeze({ disposition: "ignored", entitlement: existing });
  }
  return Object.freeze({
    disposition: "revoked",
    entitlement: freezeEntitlement({ ...existing, revokedAt: at, state: "revoked" }),
  });
};
