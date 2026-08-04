export const recoveryStagingMessages = Object.freeze({
  badge: "Founder Acceptance Recovery",
  baselineLabel: "Approved recovery baseline",
  boundaries: Object.freeze([
    "No product journey is enabled in Recovery Item 3.",
    "Database and object storage are not connected.",
    "Production Providers, real payments, unrestricted AI, DNS, and public release remain off.",
  ]),
  environmentLabel: "Environment",
  healthLink: "Open liveness JSON",
  intro:
    "This protected shell proves the staging boundary before any product journey is introduced.",
  itemLabel: "Recovery item",
  offline: "Offline / degraded: this already-loaded acceptance shell remains readable.",
  online: "Online: protected staging checks are available.",
  readinessFailed:
    "STOP: readiness failed. Do not begin another recovery item or treat this deployment as accepted.",
  readinessLink: "Open readiness JSON",
  readinessPassed: "Ready: source identity and Item 3 safe-off controls passed.",
  skip: "Skip to staging identity",
  sourceLabel: "Deployed source SHA",
  title: "Protected staging foundation",
});
