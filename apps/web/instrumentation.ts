export async function register() {
  const { getWebObservability } = await import("./server/observability");
  const lifecycle = getWebObservability().start({
    kind: "service",
    operation: "service.lifecycle",
  });
  lifecycle.event({ name: "service.ready" });
  lifecycle.end({ outcome: "success" });
}
