// Tavily helper module supports tavily tool config behavior.
import type { OpenClawConfig } from "mo/plugin-sdk/config-contracts";
import type { OpenClawPluginToolContext } from "mo/plugin-sdk/plugin-entry";
import type { OpenClawPluginApi } from "mo/plugin-sdk/plugin-runtime";

export type TavilyToolConfigContext = Pick<
  OpenClawPluginToolContext,
  "config" | "runtimeConfig" | "getRuntimeConfig"
>;

export function resolveTavilyToolConfig(
  api: OpenClawPluginApi,
  ctx?: TavilyToolConfigContext,
): OpenClawConfig {
  return ctx?.getRuntimeConfig?.() ?? ctx?.runtimeConfig ?? ctx?.config ?? api.config;
}
