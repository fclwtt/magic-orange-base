// Private runtime barrel for the bundled Nextcloud Talk extension.
// Keep this barrel thin and aligned with the local extension surface.

export type { AllowlistMatch } from "mo/plugin-sdk/allow-from";
export type { ChannelGroupContext } from "mo/plugin-sdk/channel-contract";
export { logInboundDrop } from "mo/plugin-sdk/channel-inbound";
export { createChannelPairingController } from "mo/plugin-sdk/channel-pairing";
export type {
  BlockStreamingCoalesceConfig,
  DmConfig,
  DmPolicy,
  GroupPolicy,
  GroupToolPolicyConfig,
  OpenClawConfig,
} from "mo/plugin-sdk/config-contracts";
export {
  GROUP_POLICY_BLOCKED_LABEL,
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
  warnMissingProviderGroupPolicyFallbackOnce,
} from "mo/plugin-sdk/runtime-group-policy";
export { createChannelMessageReplyPipeline } from "mo/plugin-sdk/channel-outbound";
export type { OutboundReplyPayload } from "mo/plugin-sdk/reply-payload";
export { deliverFormattedTextWithAttachments } from "mo/plugin-sdk/reply-payload";
export type { PluginRuntime } from "mo/plugin-sdk/runtime-store";
export type { RuntimeEnv } from "mo/plugin-sdk/runtime";
export type { SecretInput } from "mo/plugin-sdk/secret-input";
export { fetchWithSsrFGuard } from "mo/plugin-sdk/ssrf-runtime";
export { setNextcloudTalkRuntime } from "./src/runtime.js";
