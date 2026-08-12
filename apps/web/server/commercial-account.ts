import "server-only";

import {
  createCommercialAccountPersistence,
  createCommercialPaymentEventPersistence,
  type CommercialAccountPersistence,
  type CommercialAccountSnapshot,
} from "@rituvia/db";

import { loadWebAccountIdentityService } from "./account-auth";
import { WebCommerceError } from "./commerce";
import { loadWebDatabase } from "./database";
import { loadWebPaymentWebhookDatabase } from "./payment-webhook-database";

const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

type AccountGateway = Readonly<{
  resolveSession(token: string): Promise<Readonly<{ userId: string }> | null>;
}>;

export type CommercialAccountApplicationDependencies = Readonly<{
  accounts: AccountGateway;
  clock: () => string;
  persistence: CommercialAccountPersistence;
  reconcileAnnualCredits(input: { asOf: string; userId: string }): Promise<number>;
}>;

const requireSession = async (
  accounts: AccountGateway,
  token: string | undefined,
): Promise<string> => {
  if (token === undefined) throw new WebCommerceError("session_required");
  const session = await accounts.resolveSession(token);
  if (session === null) throw new WebCommerceError("session_required");
  return session.userId;
};

const mapError = (error: unknown): never => {
  if (error instanceof WebCommerceError) throw error;
  throw new WebCommerceError("unavailable");
};

export const createCommercialAccountApplicationService = (
  dependencies: CommercialAccountApplicationDependencies,
) =>
  Object.freeze({
    async getOrder(input: { orderId: string; sessionToken: string | undefined }) {
      try {
        if (!uuidV4Pattern.test(input.orderId)) throw new WebCommerceError("not_found");
        const userId = await requireSession(dependencies.accounts, input.sessionToken);
        const order = await dependencies.persistence.getOrder(userId, input.orderId);
        if (order === null) throw new WebCommerceError("not_found");
        return order;
      } catch (error) {
        return mapError(error);
      }
    },

    async readSnapshot(sessionToken: string | undefined): Promise<CommercialAccountSnapshot> {
      try {
        const userId = await requireSession(dependencies.accounts, sessionToken);
        await dependencies.reconcileAnnualCredits({ asOf: dependencies.clock(), userId });
        return await dependencies.persistence.readSnapshot(userId);
      } catch (error) {
        return mapError(error);
      }
    },
  });

export type CommercialAccountApplicationService = ReturnType<
  typeof createCommercialAccountApplicationService
>;

let service: CommercialAccountApplicationService | undefined;

export const loadWebCommercialAccountApplicationService =
  (): CommercialAccountApplicationService => {
    if (service !== undefined) return service;
    const accounts = loadWebAccountIdentityService();
    service = createCommercialAccountApplicationService({
      accounts: { resolveSession: (token) => accounts.resolveSession(token) },
      clock: () => new Date().toISOString(),
      persistence: createCommercialAccountPersistence(loadWebDatabase()),
      reconcileAnnualCredits: (input) =>
        createCommercialPaymentEventPersistence(
          loadWebPaymentWebhookDatabase(),
        ).reconcileDueAnnualSubscriptionCredits(input),
    });
    return service;
  };
