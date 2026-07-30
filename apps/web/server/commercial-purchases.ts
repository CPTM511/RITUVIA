import "server-only";

import {
  createCommercialFulfillmentPersistence,
  type CommercialFulfillmentPersistence,
  type CommercialPurchaseRestoration,
} from "@rituvia/db";

import { getWebRuntimeConfiguration } from "../config/server";
import { loadWebAccountIdentityService } from "./account-auth";
import { WebCommerceError } from "./commerce";
import { loadWebDatabase } from "./database";

type AccountGateway = Readonly<{
  resolveSession(token: string): Promise<Readonly<{ userId: string }> | null>;
}>;

export type CommercialPurchaseApplicationDependencies = Readonly<{
  accounts: AccountGateway;
  persistence: Pick<CommercialFulfillmentPersistence, "restorePurchases">;
}>;

export const createCommercialPurchaseApplicationService = (
  dependencies: CommercialPurchaseApplicationDependencies,
): Readonly<{
  restore(sessionToken: string | undefined): Promise<CommercialPurchaseRestoration>;
}> =>
  Object.freeze({
    async restore(sessionToken) {
      if (sessionToken === undefined) throw new WebCommerceError("session_required");
      try {
        const session = await dependencies.accounts.resolveSession(sessionToken);
        if (session === null) throw new WebCommerceError("session_required");
        return await dependencies.persistence.restorePurchases(session.userId);
      } catch (error) {
        if (error instanceof WebCommerceError) throw error;
        throw new WebCommerceError("unavailable");
      }
    },
  });

let purchaseService: ReturnType<typeof createCommercialPurchaseApplicationService> | undefined;

export const loadWebCommercialPurchaseApplicationService = (): ReturnType<
  typeof createCommercialPurchaseApplicationService
> => {
  if (purchaseService !== undefined) return purchaseService;
  if (getWebRuntimeConfiguration().databaseUrl === undefined) {
    throw new WebCommerceError("unavailable");
  }
  const accounts = loadWebAccountIdentityService();
  purchaseService = createCommercialPurchaseApplicationService({
    accounts: {
      resolveSession: (token) => accounts.resolveSession(token),
    },
    persistence: createCommercialFulfillmentPersistence(loadWebDatabase()),
  });
  return purchaseService;
};
