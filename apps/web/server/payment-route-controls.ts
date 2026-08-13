import "server-only";

import type {
  PaymentActivationControlsV1,
  PaymentCheckoutFlagKey,
  PaymentRouteKind,
  ScopedPaymentControlFlagEvaluationV1,
} from "@rituvia/payments";

import { loadWebFeatureFlagEvaluator } from "./feature-flags";

export type WebPaymentActivationControlReader = Readonly<{
  read(input: {
    countryCode: string;
    kind: PaymentRouteKind;
  }): Promise<PaymentActivationControlsV1>;
}>;

const scopedEvaluation = (
  countryCode: string,
  evaluation: ReturnType<Awaited<ReturnType<typeof loadWebFeatureFlagEvaluator>>["evaluate"]>,
): ScopedPaymentControlFlagEvaluationV1 =>
  Object.freeze({
    countryCode,
    evaluation: Object.freeze({
      enabled: evaluation.enabled,
      evaluatedAt: evaluation.evaluatedAt,
      flagKey: evaluation.flagKey as ScopedPaymentControlFlagEvaluationV1["evaluation"]["flagKey"],
      reason: evaluation.reason,
      registryVersion: evaluation.registryVersion,
      source: evaluation.source,
      version: evaluation.version,
    }),
  });

export const webPaymentActivationControlReader: WebPaymentActivationControlReader = Object.freeze({
  async read(input) {
    const evaluator = await loadWebFeatureFlagEvaluator();
    const checkoutFlagKey: PaymentCheckoutFlagKey =
      input.kind === "fiat" ? "payments.fiat_checkout" : "payments.crypto_checkout";
    const context = Object.freeze({ countryCode: input.countryCode });
    return Object.freeze({
      checkoutActivation: scopedEvaluation(
        input.countryCode,
        evaluator.evaluate(checkoutFlagKey, context),
      ),
      countryActivation: scopedEvaluation(
        input.countryCode,
        evaluator.evaluate("market.country_activation", context),
      ),
    });
  },
});
