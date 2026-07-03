// Mattermost API module exposes the plugin public contract.
export type {
  BaseProbeResult,
  ChannelAccountSnapshot,
  ChannelDirectoryEntry,
  ChatType,
  HistoryEntry,
  OpenClawConfig,
  OpenClawPluginApi,
  ReplyPayload,
} from "mo/plugin-sdk/core";
export type { RuntimeEnv } from "mo/plugin-sdk/runtime";
export { buildAgentMediaPayload } from "mo/plugin-sdk/agent-media-payload";
export { resolveAllowlistMatchSimple } from "mo/plugin-sdk/allow-from";
export { logInboundDrop } from "mo/plugin-sdk/channel-inbound";
export { createChannelPairingController } from "mo/plugin-sdk/channel-pairing";
export { createChannelMessageReplyPipeline } from "mo/plugin-sdk/channel-outbound";
export { logTypingFailure } from "mo/plugin-sdk/channel-feedback";
export {
  listSkillCommandsForAgents,
  resolveControlCommandGate,
} from "mo/plugin-sdk/command-auth-native";
export { buildModelsProviderData } from "mo/plugin-sdk/models-provider-runtime";
export { isDangerousNameMatchingEnabled } from "mo/plugin-sdk/dangerous-name-runtime";
export {
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
  warnMissingProviderGroupPolicyFallbackOnce,
} from "mo/plugin-sdk/runtime-group-policy";
export { resolveChannelMediaMaxBytes } from "mo/plugin-sdk/media-runtime";
export { loadOutboundMediaFromUrl } from "mo/plugin-sdk/outbound-media";
// Legacy map-helper exports stay for older plugin consumers. New message-turn
// code should use createChannelHistoryWindow.
export {
  DEFAULT_GROUP_HISTORY_LIMIT,
  createChannelHistoryWindow,
  buildInboundHistoryFromMap,
  buildPendingHistoryContextFromMap,
  recordPendingHistoryEntryIfEnabled,
} from "mo/plugin-sdk/reply-history";
export { registerPluginHttpRoute } from "mo/plugin-sdk/webhook-targets";
export {
  isRequestBodyLimitError,
  readRequestBodyWithLimit,
} from "mo/plugin-sdk/webhook-ingress";
export {
  isTrustedProxyAddress,
  parseStrictPositiveInteger,
  resolveClientIp,
} from "mo/plugin-sdk/core";
export { parseTcpPort } from "mo/plugin-sdk/number-runtime";
