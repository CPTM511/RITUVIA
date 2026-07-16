export async function register() {
  const { getWebRuntimeConfiguration } = await import("./config/server");
  getWebRuntimeConfiguration();
}
