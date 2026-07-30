import type { CommercialReconciliationProviderSnapshot } from "@rituvia/payments";

export type CommercialPaymentProviderReader = Readonly<{
  attestAccount(): Promise<void>;
  readCheckout(checkoutId: string): Promise<CommercialReconciliationProviderSnapshot>;
}>;

export type StripeReconciliationRequest = (
  path: string,
) => Promise<Readonly<{ body: unknown; status: number }>>;

type JsonRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const expandableId = (value: unknown): string | null => {
  if (typeof value === "string") return value;
  return isRecord(value) && typeof value.id === "string" ? value.id : null;
};

const paymentState = (
  session: JsonRecord,
  charge: JsonRecord | null,
): Extract<
  CommercialReconciliationProviderSnapshot,
  { availability: "available" }
>["paymentState"] => {
  if (charge?.disputed === true) return "disputed";
  const chargeAmount = typeof charge?.amount === "number" ? charge.amount : 0;
  const refundedAmount = typeof charge?.amount_refunded === "number" ? charge.amount_refunded : 0;
  if (chargeAmount > 0 && refundedAmount >= chargeAmount) return "refunded";
  if (refundedAmount > 0) return "partially_refunded";
  if (session.payment_status === "paid" || session.payment_status === "no_payment_required") {
    return "paid";
  }
  if (session.status === "expired") return "expired";
  return "pending";
};

const createStripeRequest =
  (secretKey: string): StripeReconciliationRequest =>
  async (path) => {
    const response = await fetch(`https://api.stripe.com${path}`, {
      headers: { authorization: `Bearer ${secretKey}` },
      signal: AbortSignal.timeout(10_000),
    });
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    return Object.freeze({ body, status: response.status });
  };

export const createStripeReconciliationReader = (
  input: { accountId: string; secretKey: string },
  request: StripeReconciliationRequest = createStripeRequest(input.secretKey),
): CommercialPaymentProviderReader => {
  let accountAttestation: Promise<void> | undefined;
  const attestAccount = async (): Promise<void> => {
    accountAttestation ??= request("/v1/account").then(({ body, status }) => {
      if (status !== 200 || !isRecord(body) || body.id !== input.accountId) {
        throw new Error("Stripe reconciliation account does not match configuration.");
      }
    });
    try {
      await accountAttestation;
    } catch (error) {
      accountAttestation = undefined;
      throw error;
    }
  };

  return Object.freeze({
    attestAccount,
    async readCheckout(checkoutId) {
      await attestAccount();
      try {
        const path =
          `/v1/checkout/sessions/${encodeURIComponent(checkoutId)}` +
          "?expand[]=payment_intent.latest_charge.balance_transaction";
        const { body, status } = await request(path);
        if (status === 404) return Object.freeze({ availability: "missing" as const });
        if (status !== 200 || !isRecord(body)) {
          return Object.freeze({ availability: "unavailable" as const });
        }
        const session = body;
        if (
          session.livemode === true ||
          typeof session.id !== "string" ||
          !session.id.startsWith("cs_test_")
        ) {
          return Object.freeze({ availability: "unavailable" as const });
        }
        const intent = isRecord(session.payment_intent) ? session.payment_intent : null;
        const charge =
          intent !== null && isRecord(intent.latest_charge) ? intent.latest_charge : null;
        const balanceTransaction =
          charge !== null && isRecord(charge.balance_transaction)
            ? charge.balance_transaction
            : null;
        const state = paymentState(session, charge);
        const metadata = isRecord(session.metadata) ? session.metadata : null;
        return Object.freeze({
          amountMinor: typeof session.amount_total === "number" ? session.amount_total : 0,
          availability: "available" as const,
          currencyCode: typeof session.currency === "string" ? session.currency.toUpperCase() : "",
          orderId:
            typeof session.client_reference_id === "string"
              ? session.client_reference_id
              : typeof metadata?.orderId === "string"
                ? metadata.orderId
                : null,
          paymentState: state,
          providerCheckoutId: session.id,
          providerPaymentIntentId: expandableId(session.payment_intent),
          settlementState:
            state !== "paid"
              ? ("not_applicable" as const)
              : balanceTransaction === null
                ? ("missing" as const)
                : balanceTransaction.status === "available"
                  ? ("available" as const)
                  : ("pending" as const),
        });
      } catch {
        return Object.freeze({ availability: "unavailable" as const });
      }
    },
  });
};
