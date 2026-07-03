// Private runtime barrel for the bundled Feishu extension.
// Keep this barrel thin and generic-only.

export type {
  AllowlistMatch,
  AnyAgentTool,
  BaseProbeResult,
  ChannelGroupContext,
  ChannelMessageActionName,
  ChannelMeta,
  ChannelOutboundAdapter,
  ChannelPlugin,
  HistoryEntry,
  OpenClawConfig,
  OpenClawPluginApi,
  OutboundIdentity,
  PluginRuntime,
  ReplyPayload,
} from "mo/plugin-sdk/core";
export type { OpenClawConfig as ClawdbotConfig } from "mo/plugin-sdk/core";
export type RuntimeEnv = {
  log: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  exit: (code: number) => void;
};
export type { GroupToolPolicyConfig } from "mo/plugin-sdk/config-contracts";
export {
  DEFAULT_ACCOUNT_ID,
  buildChannelConfigSchema,
  createActionGate,
  createDedupeCache,
} from "mo/plugin-sdk/core";
export {
  PAIRING_APPROVED_MESSAGE,
  buildProbeChannelStatusSummary,
  createDefaultChannelRuntimeState,
} from "mo/plugin-sdk/channel-status";
export { buildAgentMediaPayload } from "mo/plugin-sdk/agent-media-payload";
export { createChannelPairingController } from "mo/plugin-sdk/channel-pairing";
export { createReplyPrefixContext } from "mo/plugin-sdk/channel-outbound";
export {
  evaluateSupplementalContextVisibility,
  filterSupplementalContextItems,
  resolveChannelContextVisibilityMode,
} from "mo/plugin-sdk/context-visibility-runtime";
export { getSessionEntry } from "mo/plugin-sdk/session-store-runtime";
export { readJsonFileWithFallback } from "mo/plugin-sdk/json-store";
export { normalizeAgentId } from "mo/plugin-sdk/routing";
export { chunkTextForOutbound } from "mo/plugin-sdk/text-chunking";
export {
  isRequestBodyLimitError,
  readRequestBodyWithLimit,
  requestBodyErrorToText,
} from "mo/plugin-sdk/webhook-ingress";
export { setFeishuRuntime } from "./src/runtime.js";
