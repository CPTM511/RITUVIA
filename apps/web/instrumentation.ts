export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { attestConfiguredWebPaymentProvider } = await import("./server/payment-provider");
    await attestConfiguredWebPaymentProvider();
  }
  const { getWebObservability } = await import("./server/observability");
  const lifecycle = getWebObservability().start({
    kind: "service",
    operation: "service.lifecycle",
  });
  lifecycle.event({ name: "service.ready" });
  lifecycle.end({ outcome: "success" });
}
