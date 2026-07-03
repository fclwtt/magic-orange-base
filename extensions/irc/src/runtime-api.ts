// Private runtime barrel for the bundled IRC extension.
// Keep this barrel thin and generic-only.

export type { BaseProbeResult } from "mo/plugin-sdk/channel-contract";
export type { ChannelPlugin } from "mo/plugin-sdk/channel-core";
export type { OpenClawConfig } from "mo/plugin-sdk/config-contracts";
export type { PluginRuntime } from "mo/plugin-sdk/runtime-store";
export type { RuntimeEnv } from "mo/plugin-sdk/runtime";
export type {
  BlockStreamingCoalesceConfig,
  DmConfig,
  DmPolicy,
  GroupPolicy,
  GroupToolPolicyBySenderConfig,
  GroupToolPolicyConfig,
  MarkdownConfig,
} from "mo/plugin-sdk/config-contracts";
export type { OutboundReplyPayload } from "mo/plugin-sdk/reply-payload";
export { DEFAULT_ACCOUNT_ID } from "mo/plugin-sdk/account-id";
export { buildChannelConfigSchema } from "mo/plugin-sdk/channel-config-primitives";
export {
  PAIRING_APPROVED_MESSAGE,
  buildBaseChannelStatusSummary,
} from "mo/plugin-sdk/channel-status";
export { createChannelPairingController } from "mo/plugin-sdk/channel-pairing";
export { createAccountStatusSink } from "mo/plugin-sdk/channel-outbound";
export { resolveControlCommandGate } from "mo/plugin-sdk/command-auth-native";
export { createChannelMessageReplyPipeline } from "mo/plugin-sdk/channel-outbound";
export { chunkTextForOutbound } from "mo/plugin-sdk/text-chunking";
export {
  deliverFormattedTextWithAttachments,
  formatTextWithAttachmentLinks,
  resolveOutboundMediaUrls,
} from "mo/plugin-sdk/reply-payload";
export {
  GROUP_POLICY_BLOCKED_LABEL,
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
  warnMissingProviderGroupPolicyFallbackOnce,
} from "mo/plugin-sdk/runtime-group-policy";
export { isDangerousNameMatchingEnabled } from "mo/plugin-sdk/dangerous-name-runtime";
export { logInboundDrop } from "mo/plugin-sdk/channel-inbound";
