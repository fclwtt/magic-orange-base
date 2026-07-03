// Private runtime barrel for the bundled Mattermost extension.
// Keep this barrel thin and generic-only.

export type {
  BaseProbeResult,
  ChannelAccountSnapshot,
  ChannelDirectoryEntry,
  ChannelGroupContext,
  ChannelMessageActionName,
  ChannelPlugin,
  ChatType,
  HistoryEntry,
  OpenClawConfig,
  OpenClawPluginApi,
  PluginRuntime,
} from "mo/plugin-sdk/core";
export type { RuntimeEnv } from "mo/plugin-sdk/runtime";
export type { ReplyPayload } from "mo/plugin-sdk/reply-runtime";
export type { ModelsProviderData } from "mo/plugin-sdk/models-provider-runtime";
export type {
  BlockStreamingCoalesceConfig,
  DmPolicy,
  GroupPolicy,
} from "mo/plugin-sdk/config-contracts";
export {
  DEFAULT_ACCOUNT_ID,
  buildChannelConfigSchema,
  createDedupeCache,
  parseStrictPositiveInteger,
  resolveClientIp,
  isTrustedProxyAddress,
} from "mo/plugin-sdk/core";
export { buildComputedAccountStatusSnapshot } from "mo/plugin-sdk/channel-status";
export { createAccountStatusSink } from "mo/plugin-sdk/channel-outbound";
export { buildAgentMediaPayload } from "mo/plugin-sdk/agent-media-payload";
export {
  listSkillCommandsForAgents,
  resolveControlCommandGate,
  resolveStoredModelOverride,
} from "mo/plugin-sdk/command-auth-native";
export { buildModelsProviderData } from "mo/plugin-sdk/models-provider-runtime";
export {
  GROUP_POLICY_BLOCKED_LABEL,
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
  warnMissingProviderGroupPolicyFallbackOnce,
} from "mo/plugin-sdk/runtime-group-policy";
export { isDangerousNameMatchingEnabled } from "mo/plugin-sdk/dangerous-name-runtime";
export { resolveStorePath } from "mo/plugin-sdk/session-store-runtime";
export { formatInboundFromLabel } from "mo/plugin-sdk/channel-inbound";
export { logInboundDrop } from "mo/plugin-sdk/channel-inbound";
export { createChannelPairingController } from "mo/plugin-sdk/channel-pairing";
export { createChannelMessageReplyPipeline } from "mo/plugin-sdk/channel-outbound";
export { logTypingFailure } from "mo/plugin-sdk/channel-feedback";
export { loadOutboundMediaFromUrl } from "mo/plugin-sdk/outbound-media";
export { rawDataToString } from "mo/plugin-sdk/webhook-ingress";
export { chunkTextForOutbound } from "mo/plugin-sdk/text-chunking";
// Legacy map-helper exports stay for older plugin consumers. New message-turn
// code should use createChannelHistoryWindow.
export {
  DEFAULT_GROUP_HISTORY_LIMIT,
  createChannelHistoryWindow,
  buildPendingHistoryContextFromMap,
  clearHistoryEntriesIfEnabled,
  recordPendingHistoryEntryIfEnabled,
} from "mo/plugin-sdk/reply-history";
export { normalizeAccountId, resolveThreadSessionKeys } from "mo/plugin-sdk/routing";
export { resolveAllowlistMatchSimple } from "mo/plugin-sdk/allow-from";
export { registerPluginHttpRoute } from "mo/plugin-sdk/webhook-targets";
export {
  isRequestBodyLimitError,
  readRequestBodyWithLimit,
} from "mo/plugin-sdk/webhook-ingress";
export {
  applyAccountNameToChannelSection,
  applySetupAccountConfigPatch,
  migrateBaseNameToDefaultAccount,
} from "mo/plugin-sdk/setup";
export {
  getAgentScopedMediaLocalRoots,
  resolveChannelMediaMaxBytes,
} from "mo/plugin-sdk/media-runtime";
export { normalizeProviderId } from "mo/plugin-sdk/provider-model-shared";
export { setMattermostRuntime } from "./src/runtime.js";
