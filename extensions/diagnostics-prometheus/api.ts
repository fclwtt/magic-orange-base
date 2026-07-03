// Diagnostics Prometheus API module exposes the plugin public contract.
export type {
  DiagnosticEventMetadata,
  DiagnosticEventPayload,
} from "mo/plugin-sdk/diagnostic-runtime";
export { isInternalDiagnosticEventMetadata } from "mo/plugin-sdk/diagnostic-runtime";
export {
  emptyPluginConfigSchema,
  type OpenClawPluginApi,
  type OpenClawPluginHttpRouteHandler,
  type OpenClawPluginService,
  type OpenClawPluginServiceContext,
} from "mo/plugin-sdk/plugin-entry";
export { redactSensitiveText } from "mo/plugin-sdk/security-runtime";
