import "server-only";

import { createHash, randomUUID } from "node:crypto";

import {
  CommercialRefundPersistenceError,
  createCommercialRefundPersistence,
  type CommercialRefundPersistence,
} from "@rituvia/db";
import { evaluateCommercialRefundEligibility } from "@rituvia/payments";

import { getWebRuntimeConfiguration } from "../config/server";
import { loadWebAccountIdentityService } from "./account-auth";
import { WebCommerceError } from "./commerce";
import { loadWebDatabase } from "./database";
import {
  loadWebPaymentProviderRegistry,
  stripeHostedCheckoutProviderId,
  WebPaymentProviderError,
} from "./payment-provider";

const idempotencyKeyPattern =
  /^(?:[A-Za-z0-9_-]{22,128}|[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/u;
const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const refundRequestSchemaVersion = "commercial-refund-request.v1";

type AccountGateway = Readonly<{
  getProfile(token: string): Promise<Readonly<{ id: string; status: "active" }>>;
  resolveSession(token: string): Promise<Readonly<{ userId: string }> | null>;
}>;

export type StripeRefundApplicationDependencies = Readonly<{
  accounts: AccountGateway;
  clock(): string;
  environment: "local" | "preview" | "staging";
  idFactory(): string;
  paymentProvider: Readonly<{
    attestAccount(): Promise<void>;
    requestRefund(input: {
      amountMinor: number;
      idempotencyKey: string;
      orderId: string;
      paymentIntentId: string;
    }): Promise<Readonly<{ providerRefundId: string }>>;
  }>;
  persistence: CommercialRefundPersistence;
  providerAccountFingerprint: string;
}>;

export type WebStripeRefundRequest = Readonly<{
  amountMinor: number;
  currencyCode: string;
  eligibilityPolicyVersion: string;
  kind: "created" | "replayed";
  orderId: string;
  providerConfirmationPending: boolean;
  refundId: string;
  refundPolicyVersion: string;
  state: "disputed" | "refund_requested" | "refunded";
}>;

const digest = (value: string): Uint8Array<ArrayBuffer> =>
  new Uint8Array(createHash("sha256").update(value, "utf8").digest());

const parseIdempotencyKey = (value: unknown): string => {
  if (typeof value !== "string" || !idempotencyKeyPattern.test(value)) {
    throw new WebCommerceError("input_invalid");
  }
  return value;
};

const parseOrderId = (value: unknown): string => {
  if (typeof value !== "string" || !uuidV4Pattern.test(value)) {
    throw new WebCommerceError("not_found");
  }
  return value;
};

const requireInstant = (value: string): string => {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new WebCommerceError("unavailable");
  }
  return value;
};

const canonicalRequest = (orderId: string): string =>
  JSON.stringify({
    operation: "request_full_unused_credit_pack_refund",
    orderId,
    schemaVersion: refundRequestSchemaVersion,
  });

const mapPersistenceError = (error: unknown): never => {
  if (error instanceof WebCommerceError) throw error;
  if (error instanceof CommercialRefundPersistenceError) {
    if (error.code === "COMMERCIAL_REFUND_NOT_FOUND") {
      throw new WebCommerceError("not_found");
    }
    if (
      error.code === "COMMERCIAL_REFUND_CONFLICT" ||
      error.code === "COMMERCIAL_REFUND_NOT_ELIGIBLE"
    ) {
      throw new WebCommerceError("conflict");
    }
  }
  throw new WebCommerceError("unavailable");
};

const responseState = (orderStatus: string): WebStripeRefundRequest["state"] => {
  if (orderStatus === "refunded" || orderStatus === "disputed") return orderStatus;
  return "refund_requested";
};

export const createStripeRefundApplicationService = (
  dependencies: StripeRefundApplicationDependencies,
) =>
  Object.freeze({
    async requestRefund(input: {
      idempotencyKey: unknown;
      orderId: unknown;
      sessionToken: string | undefined;
    }): Promise<WebStripeRefundRequest> {
      try {
        if (input.sessionToken === undefined) throw new WebCommerceError("session_required");
        const idempotencyKey = parseIdempotencyKey(input.idempotencyKey);
        const orderId = parseOrderId(input.orderId);
        const now = requireInstant(dependencies.clock());
        const session = await dependencies.accounts.resolveSession(input.sessionToken);
        if (session === null) throw new WebCommerceError("session_required");
        const profile = await dependencies.accounts.getProfile(input.sessionToken);
        if (profile.id !== session.userId || profile.status !== "active") {
          throw new WebCommerceError("session_required");
        }

        await dependencies.paymentProvider.attestAccount();
        const prepared = await dependencies.persistence.prepareStripeSandboxRefund(
          {
            canonicalRequestHash: digest(canonicalRequest(orderId)),
            createdAt: now,
            idempotencyKeyHash: digest(idempotencyKey),
            orderId,
            providerAccountFingerprint: dependencies.providerAccountFingerprint,
            refundId: dependencies.idFactory(),
            userId: session.userId,
          },
          evaluateCommercialRefundEligibility,
        );
        if (prepared.requestStatus === "submitted" || prepared.requestStatus === "confirmed") {
          const state = responseState(prepared.orderStatus);
          return Object.freeze({
            amountMinor: prepared.amountMinor,
            currencyCode: prepared.currencyCode,
            eligibilityPolicyVersion: prepared.eligibilityPolicyVersion,
            kind: "replayed",
            orderId: prepared.orderId,
            providerConfirmationPending: state !== "refunded",
            refundId: prepared.refundId,
            refundPolicyVersion: prepared.refundPolicyVersion,
            state,
          });
        }

        let providerRefundId: string;
        try {
          const providerRefund = await dependencies.paymentProvider.requestRefund({
            amountMinor: prepared.amountMinor,
            idempotencyKey: prepared.providerIdempotencyKey,
            orderId: prepared.orderId,
            paymentIntentId: prepared.providerPaymentIntentId,
          });
          providerRefundId = providerRefund.providerRefundId;
        } catch (error) {
          if (error instanceof WebPaymentProviderError && error.code === "rejected") {
            await dependencies.persistence.rejectStripeSandboxRefund({
              refundId: prepared.refundId,
              rejectedAt: now,
              userId: session.userId,
            });
            throw new WebCommerceError("conflict");
          }
          throw new WebCommerceError("unavailable");
        }

        const submitted = await dependencies.persistence.submitStripeSandboxRefund({
          providerRefundId,
          refundId: prepared.refundId,
          submittedAt: now,
          userId: session.userId,
        });
        const state = responseState(submitted.orderStatus);
        return Object.freeze({
          amountMinor: submitted.amountMinor,
          currencyCode: submitted.currencyCode,
          eligibilityPolicyVersion: submitted.eligibilityPolicyVersion,
          kind: prepared.kind,
          orderId: submitted.orderId,
          providerConfirmationPending: state !== "refunded",
          refundId: submitted.refundId,
          refundPolicyVersion: submitted.refundPolicyVersion,
          state,
        });
      } catch (error) {
        return mapPersistenceError(error);
      }
    },
  });

export type StripeRefundApplicationService = ReturnType<
  typeof createStripeRefundApplicationService
>;

let service: StripeRefundApplicationService | undefined;

export const loadWebStripeRefundApplicationService = (): StripeRefundApplicationService => {
  if (service !== undefined) return service;
  const configuration = getWebRuntimeConfiguration();
  if (
    configuration.deploymentEnvironment === "production" ||
    configuration.payment?.provider !== "stripe"
  ) {
    throw new WebCommerceError("unavailable");
  }
  const accounts = loadWebAccountIdentityService();
  const paymentProviders = loadWebPaymentProviderRegistry();
  service = createStripeRefundApplicationService({
    accounts: {
      getProfile: (token) => accounts.getProfile(token),
      resolveSession: (token) => accounts.resolveSession(token),
    },
    clock: () => new Date().toISOString(),
    environment: configuration.deploymentEnvironment,
    idFactory: randomUUID,
    paymentProvider: {
      attestAccount: () => paymentProviders.attestAccount(stripeHostedCheckoutProviderId),
      requestRefund: (input) => paymentProviders.requestStripeRefund(input),
    },
    persistence: createCommercialRefundPersistence(loadWebDatabase()),
    providerAccountFingerprint: paymentProviders.accountFingerprint(stripeHostedCheckoutProviderId),
  });
  return service;
};
