// Matrix API module exposes the plugin public contract.
export {
  DEFAULT_ACCOUNT_ID,
  normalizeAccountId,
  normalizeOptionalAccountId,
} from "mo/plugin-sdk/account-id";
export {
  createActionGate,
  jsonResult,
  readNumberParam,
  readPositiveIntegerParam,
  readReactionParams,
  readStringArrayParam,
  readStringParam,
  ToolAuthorizationError,
} from "mo/plugin-sdk/channel-actions";
export { buildChannelConfigSchema } from "mo/plugin-sdk/channel-config-primitives";
export type { ChannelPlugin } from "mo/plugin-sdk/channel-core";
export type {
  BaseProbeResult,
  ChannelDirectoryEntry,
  ChannelGroupContext,
  ChannelMessageActionAdapter,
  ChannelMessageActionContext,
  ChannelMessageActionName,
  ChannelMessageToolDiscovery,
  ChannelOutboundAdapter,
  ChannelResolveKind,
  ChannelResolveResult,
  ChannelToolSend,
} from "mo/plugin-sdk/channel-contract";
export {
  formatLocationText,
  toLocationContext,
  type NormalizedLocation,
} from "mo/plugin-sdk/channel-inbound";
export { logInboundDrop } from "mo/plugin-sdk/channel-inbound";
export { logTypingFailure } from "mo/plugin-sdk/channel-outbound";
export { resolveAckReaction } from "mo/plugin-sdk/channel-feedback";
export type { ChannelSetupInput } from "mo/plugin-sdk/setup";
export type {
  OpenClawConfig,
  ContextVisibilityMode,
  DmPolicy,
  GroupPolicy,
} from "mo/plugin-sdk/config-contracts";
export type { GroupToolPolicyConfig } from "mo/plugin-sdk/config-contracts";
export type { WizardPrompter } from "mo/plugin-sdk/setup";
export type { SecretInput } from "mo/plugin-sdk/secret-input";
export {
  GROUP_POLICY_BLOCKED_LABEL,
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
  warnMissingProviderGroupPolicyFallbackOnce,
} from "mo/plugin-sdk/runtime-group-policy";
export {
  addWildcardAllowFrom,
  formatDocsLink,
  hasConfiguredSecretInput,
  mergeAllowFromEntries,
  moveSingleAccountChannelSectionToDefaultAccount,
  promptAccountId,
  promptChannelAccessConfig,
  splitSetupEntries,
} from "mo/plugin-sdk/setup";
export type { RuntimeEnv } from "mo/plugin-sdk/runtime";
export {
  assertHttpUrlTargetsPrivateNetwork,
  closeDispatcher,
  createPinnedDispatcher,
  isPrivateOrLoopbackHost,
  resolvePinnedHostnameWithPolicy,
  ssrfPolicyFromDangerouslyAllowPrivateNetwork,
  ssrfPolicyFromAllowPrivateNetwork,
  type LookupFn,
  type SsrFPolicy,
} from "mo/plugin-sdk/ssrf-runtime";
export { dispatchReplyFromConfigWithSettledDispatcher } from "mo/plugin-sdk/channel-inbound";
export {
  ensureConfiguredAcpBindingReady,
  resolveConfiguredAcpBindingRecord,
} from "mo/plugin-sdk/acp-binding-runtime";
export {
  buildProbeChannelStatusSummary,
  collectStatusIssuesFromLastError,
  PAIRING_APPROVED_MESSAGE,
} from "mo/plugin-sdk/channel-status";
export {
  getSessionBindingService,
  resolveThreadBindingIdleTimeoutMsForChannel,
  resolveThreadBindingMaxAgeMsForChannel,
} from "mo/plugin-sdk/conversation-runtime";
export { resolveOutboundSendDep } from "mo/plugin-sdk/channel-outbound";
export { resolveAgentIdFromSessionKey } from "mo/plugin-sdk/routing";
export { chunkTextForOutbound } from "mo/plugin-sdk/text-chunking";
export { createChannelMessageReplyPipeline } from "mo/plugin-sdk/channel-outbound";
export { loadOutboundMediaFromUrl } from "mo/plugin-sdk/outbound-media";
export { normalizePollInput, type PollInput } from "mo/plugin-sdk/poll-runtime";
export { writeJsonFileAtomically } from "mo/plugin-sdk/json-store";
export {
  buildChannelKeyCandidates,
  resolveChannelEntryMatch,
} from "mo/plugin-sdk/channel-targets";
export { buildTimeoutAbortSignal } from "./matrix/sdk/timeout-abort-signal.js";
export { formatZonedTimestamp } from "mo/plugin-sdk/time-runtime";
export type { PluginRuntime, RuntimeLogger } from "mo/plugin-sdk/plugin-runtime";
export type { ReplyPayload } from "mo/plugin-sdk/reply-runtime";
// resolveMatrixAccountStringValues already comes from the Matrix API barrel.
// Re-exporting auth-precedence here makes TS source loaders define the export twice.
