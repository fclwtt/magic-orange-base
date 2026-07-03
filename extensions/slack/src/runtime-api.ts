// Slack API module exposes the plugin public contract.
export {
  buildComputedAccountStatusSnapshot,
  PAIRING_APPROVED_MESSAGE,
  projectCredentialSnapshotFields,
  resolveConfiguredFromRequiredCredentialStatuses,
} from "mo/plugin-sdk/channel-status";
export { buildChannelConfigSchema, SlackConfigSchema } from "../config-api.js";
export type { ChannelMessageActionContext } from "mo/plugin-sdk/channel-contract";
export { DEFAULT_ACCOUNT_ID } from "mo/plugin-sdk/account-id";
export type {
  ChannelPlugin,
  OpenClawPluginApi,
  PluginRuntime,
} from "mo/plugin-sdk/channel-plugin-common";
export type { OpenClawConfig } from "mo/plugin-sdk/config-contracts";
export type { SlackAccountConfig } from "mo/plugin-sdk/config-contracts";
export {
  emptyPluginConfigSchema,
  formatPairingApproveHint,
} from "mo/plugin-sdk/channel-plugin-common";
export { loadOutboundMediaFromUrl } from "mo/plugin-sdk/outbound-media";
export { looksLikeSlackTargetId, normalizeSlackMessagingTarget } from "./target-parsing.js";
export { getChatChannelMeta } from "./channel-api.js";
export {
  createActionGate,
  imageResultFromFile,
  jsonResult,
  readNumberParam,
  readPositiveIntegerParam,
  readReactionParams,
  readStringParam,
  withNormalizedTimestamp,
} from "mo/plugin-sdk/channel-actions";
