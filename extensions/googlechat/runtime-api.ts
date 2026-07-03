// Private runtime barrel for the bundled Google Chat extension.
// Keep this barrel thin and avoid broad plugin-sdk surfaces during bootstrap.

export { DEFAULT_ACCOUNT_ID } from "mo/plugin-sdk/account-id";
export {
  createActionGate,
  jsonResult,
  readNumberParam,
  readReactionParams,
  readStringParam,
} from "mo/plugin-sdk/channel-actions";
export { buildChannelConfigSchema } from "mo/plugin-sdk/channel-config-primitives";
export type {
  ChannelMessageActionAdapter,
  ChannelMessageActionName,
  ChannelStatusIssue,
} from "mo/plugin-sdk/channel-contract";
export { missingTargetError } from "mo/plugin-sdk/channel-feedback";
export {
  createAccountStatusSink,
  runPassiveAccountLifecycle,
} from "mo/plugin-sdk/channel-outbound";
export { createChannelPairingController } from "mo/plugin-sdk/channel-pairing";
export { createChannelMessageReplyPipeline } from "mo/plugin-sdk/channel-outbound";
export { PAIRING_APPROVED_MESSAGE } from "mo/plugin-sdk/channel-status";
export { chunkTextForOutbound } from "mo/plugin-sdk/text-chunking";
export type { OpenClawConfig } from "mo/plugin-sdk/config-contracts";
export { GoogleChatConfigSchema } from "mo/plugin-sdk/bundled-channel-config-schema";
export {
  GROUP_POLICY_BLOCKED_LABEL,
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
  warnMissingProviderGroupPolicyFallbackOnce,
} from "mo/plugin-sdk/runtime-group-policy";
export { isDangerousNameMatchingEnabled } from "mo/plugin-sdk/dangerous-name-runtime";
export {
  readRemoteMediaBuffer,
  resolveChannelMediaMaxBytes,
} from "mo/plugin-sdk/media-runtime";
export { loadOutboundMediaFromUrl } from "mo/plugin-sdk/outbound-media";
export type { PluginRuntime } from "mo/plugin-sdk/runtime-store";
export { fetchWithSsrFGuard } from "mo/plugin-sdk/ssrf-runtime";
export type {
  GoogleChatAccountConfig,
  GoogleChatConfig,
} from "mo/plugin-sdk/config-contracts";
export { extractToolSend } from "mo/plugin-sdk/tool-send";
export { resolveInboundMentionDecision } from "mo/plugin-sdk/channel-inbound";
export { resolveInboundRouteEnvelopeBuilderWithRuntime } from "mo/plugin-sdk/inbound-envelope";
export { resolveWebhookPath } from "mo/plugin-sdk/webhook-ingress";
export {
  registerWebhookTargetWithPluginRoute,
  resolveWebhookTargetWithAuthOrReject,
  withResolvedWebhookRequestPipeline,
} from "mo/plugin-sdk/webhook-targets";
export {
  createWebhookInFlightLimiter,
  readJsonWebhookBodyOrReject,
  type WebhookInFlightLimiter,
} from "mo/plugin-sdk/webhook-request-guards";
export { setGoogleChatRuntime } from "./src/runtime.js";
