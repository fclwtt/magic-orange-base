// Private runtime barrel for the bundled Microsoft Teams extension.
// Keep this barrel thin and aligned with the local extension surface.

export { DEFAULT_ACCOUNT_ID } from "mo/plugin-sdk/account-id";
export type { AllowlistMatch } from "mo/plugin-sdk/allow-from";
export {
  mergeAllowlist,
  resolveAllowlistMatchSimple,
  summarizeMapping,
} from "mo/plugin-sdk/allow-from";
export type {
  BaseProbeResult,
  ChannelDirectoryEntry,
  ChannelGroupContext,
  ChannelMessageActionName,
  ChannelOutboundAdapter,
} from "mo/plugin-sdk/channel-contract";
export type { ChannelPlugin } from "mo/plugin-sdk/channel-core";
export { logTypingFailure } from "mo/plugin-sdk/channel-outbound";
export { createChannelPairingController } from "mo/plugin-sdk/channel-pairing";
export { resolveToolsBySender } from "mo/plugin-sdk/channel-policy";
export { createChannelMessageReplyPipeline } from "mo/plugin-sdk/channel-outbound";
export {
  PAIRING_APPROVED_MESSAGE,
  buildProbeChannelStatusSummary,
  createDefaultChannelRuntimeState,
} from "mo/plugin-sdk/channel-status";
export {
  buildChannelKeyCandidates,
  normalizeChannelSlug,
  resolveChannelEntryMatchWithFallback,
  resolveNestedAllowlistDecision,
} from "mo/plugin-sdk/channel-targets";
export type {
  GroupPolicy,
  GroupToolPolicyConfig,
  MSTeamsChannelConfig,
  MSTeamsCloudName,
  MSTeamsConfig,
  MSTeamsReplyStyle,
  MSTeamsTeamConfig,
  MarkdownTableMode,
  OpenClawConfig,
} from "mo/plugin-sdk/config-contracts";
export { isDangerousNameMatchingEnabled } from "mo/plugin-sdk/dangerous-name-runtime";
export { resolveDefaultGroupPolicy } from "mo/plugin-sdk/runtime-group-policy";
export { withFileLock } from "mo/plugin-sdk/file-lock";
export { keepHttpServerTaskAlive } from "mo/plugin-sdk/channel-outbound";
export {
  detectMime,
  extensionForMime,
  extractOriginalFilename,
  getFileExtension,
  resolveChannelMediaMaxBytes,
} from "mo/plugin-sdk/media-runtime";
export { dispatchReplyFromConfigWithSettledDispatcher } from "mo/plugin-sdk/channel-inbound";
export { loadOutboundMediaFromUrl } from "mo/plugin-sdk/outbound-media";
export { buildMediaPayload } from "mo/plugin-sdk/reply-payload";
export type { ReplyPayload } from "mo/plugin-sdk/reply-payload";
export type { PluginRuntime } from "mo/plugin-sdk/runtime-store";
export type { RuntimeEnv } from "mo/plugin-sdk/runtime";
export type { SsrFPolicy } from "mo/plugin-sdk/ssrf-runtime";
export { fetchWithSsrFGuard } from "mo/plugin-sdk/ssrf-runtime";
export { normalizeStringEntries } from "mo/plugin-sdk/string-normalization-runtime";
export { chunkTextForOutbound } from "mo/plugin-sdk/text-chunking";
export { DEFAULT_WEBHOOK_MAX_BODY_BYTES } from "mo/plugin-sdk/webhook-ingress";
export { setMSTeamsRuntime } from "./src/runtime.js";
