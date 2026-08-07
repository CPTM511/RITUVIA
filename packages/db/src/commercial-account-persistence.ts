import type { PrismaClient } from "./generated/prisma/client.js";

const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

export type CommercialAccountOrder = Readonly<{
  amountMinor: number;
  checkoutExpiresAt: string;
  createdAt: string;
  currencyCode: string;
  entitlementGranted: boolean;
  exactContents: readonly string[];
  orderId: string;
  productCode: string;
  providerPaymentIntentId: string | null;
  state: string;
  updatedAt: string;
}>;

export type CommercialAccountSnapshot = Readonly<{
  credits: Readonly<{
    promotional: number;
    purchased: number;
    reserved: number;
    subscription: number;
    totalAvailable: number;
  }>;
  ledger: readonly Readonly<{
    amount: number;
    createdAt: string;
    creditType: string;
    direction: string;
    id: string;
    reason: string;
  }>[];
  orders: readonly CommercialAccountOrder[];
  reconciliation: Readonly<{
    balanced: boolean;
    expectedPromotional: number;
    expectedPurchased: number;
    expectedSubscription: number;
  }>;
  subscriptions: readonly Readonly<{
    billingInterval: "month" | "year";
    cancelAtPeriodEnd: boolean;
    creditsPerMonth: number;
    currentPeriodEnd: string;
    currentPeriodStart: string;
    productCode: string;
    providerSubscriptionId: string;
    status: "active" | "cancelled" | "disputed" | "past_due";
    subscriptionId: string;
    updatedAt: string;
  }>[];
}>;

export type CommercialAccountPersistence = Readonly<{
  getOrder(userId: string, orderId: string): Promise<CommercialAccountOrder | null>;
  readSnapshot(userId: string): Promise<CommercialAccountSnapshot>;
}>;

const requireUuid = (value: string): string => {
  if (!uuidV4Pattern.test(value)) throw new TypeError("Commercial account identifier is invalid.");
  return value;
};

const mapOrder = async (
  database: PrismaClient,
  order: Awaited<ReturnType<PrismaClient["commercialOrderV2"]["findFirst"]>> & object,
): Promise<CommercialAccountOrder> => {
  const [item, attempt, grantCount] = await Promise.all([
    database.commercialOrderItemV2.findUnique({ where: { orderId: order.id } }),
    database.commercialPaymentAttemptV2.findUnique({
      where: { orderId_attemptNumber: { attemptNumber: 1, orderId: order.id } },
    }),
    database.creditLedgerEntry.count({
      where: { direction: "grant", orderId: order.id },
    }),
  ]);
  if (item === null || attempt === null) throw new TypeError("Commercial account data is invalid.");
  return Object.freeze({
    amountMinor: order.totalMinor,
    checkoutExpiresAt: attempt.expiresAt.toISOString(),
    createdAt: order.createdAt.toISOString(),
    currencyCode: order.currencyCode,
    entitlementGranted: grantCount > 0,
    exactContents: Object.freeze([...item.exactContentsSnapshot]),
    orderId: order.publicId,
    productCode: item.productCode,
    providerPaymentIntentId: attempt.providerPaymentIntentId,
    state: order.status,
    updatedAt: order.updatedAt.toISOString(),
  });
};

export const createCommercialAccountPersistence = (
  database: PrismaClient,
): CommercialAccountPersistence =>
  Object.freeze({
    async getOrder(userId, orderId) {
      requireUuid(userId);
      requireUuid(orderId);
      const order = await database.commercialOrderV2.findFirst({
        where: { publicId: orderId, userId },
      });
      return order === null ? null : mapOrder(database, order);
    },

    async readSnapshot(userId) {
      requireUuid(userId);
      const [orderRecords, projection, ledgerRecords, reconciliationRows, subscriptions] =
        await Promise.all([
          database.commercialOrderV2.findMany({
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: 50,
            where: { userId },
          }),
          database.creditProjection.findUnique({ where: { userId } }),
          database.creditLedgerEntry.findMany({
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: 200,
            where: { userId },
          }),
          database.$queryRaw<Readonly<{ amount: number; sourceCreditType: string }>[]>`
          SELECT
            COALESCE(SUM(
              CASE WHEN entries.direction IN ('grant', 'release')
                THEN entries.amount ELSE -entries.amount END
            ), 0)::int AS amount,
            COALESCE(sources.credit_type, entries.credit_type) AS "sourceCreditType"
          FROM credit_ledger_entry AS entries
          LEFT JOIN credit_ledger_entry AS sources ON sources.id = entries.source_entry_id
          WHERE entries.user_id = ${userId}::uuid
          GROUP BY COALESCE(sources.credit_type, entries.credit_type)
        `,
          database.commercialSubscriptionV2.findMany({
            orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
            take: 20,
            where: { userId },
          }),
        ]);
      const orders = await Promise.all(orderRecords.map((order) => mapOrder(database, order)));
      const expected = { promotional: 0, purchased: 0, subscription: 0 };
      for (const row of reconciliationRows) {
        if (row.sourceCreditType === "promotional_credit") expected.promotional = row.amount;
        if (row.sourceCreditType === "purchased_credit") expected.purchased = row.amount;
        if (row.sourceCreditType === "subscription_credit") expected.subscription = row.amount;
      }
      const credits = Object.freeze({
        promotional: projection?.promotionalAvailable ?? 0,
        purchased: projection?.purchasedAvailable ?? 0,
        reserved: projection?.reserved ?? 0,
        subscription: projection?.subscriptionAvailable ?? 0,
        totalAvailable:
          (projection?.promotionalAvailable ?? 0) +
          (projection?.purchasedAvailable ?? 0) +
          (projection?.subscriptionAvailable ?? 0),
      });
      return Object.freeze({
        credits,
        ledger: Object.freeze(
          ledgerRecords.map((entry) =>
            Object.freeze({
              amount: entry.amount,
              createdAt: entry.createdAt.toISOString(),
              creditType: entry.creditType,
              direction: entry.direction,
              id: entry.id,
              reason: entry.reason,
            }),
          ),
        ),
        orders: Object.freeze(orders),
        reconciliation: Object.freeze({
          balanced:
            expected.promotional === credits.promotional &&
            expected.purchased === credits.purchased &&
            expected.subscription === credits.subscription,
          expectedPromotional: expected.promotional,
          expectedPurchased: expected.purchased,
          expectedSubscription: expected.subscription,
        }),
        subscriptions: Object.freeze(
          subscriptions.map((subscription) =>
            Object.freeze({
              billingInterval: subscription.billingInterval as "month" | "year",
              cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
              creditsPerMonth: subscription.creditsPerMonth,
              currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
              currentPeriodStart: subscription.currentPeriodStart.toISOString(),
              productCode: subscription.productCode,
              providerSubscriptionId: subscription.providerSubscriptionId,
              status: subscription.status as "active" | "cancelled" | "disputed" | "past_due",
              subscriptionId: subscription.id,
              updatedAt: subscription.updatedAt.toISOString(),
            }),
          ),
        ),
      });
    },
  });
