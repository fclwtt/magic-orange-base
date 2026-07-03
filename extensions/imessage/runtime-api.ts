// Imessage API module exposes the plugin public contract.
import type { OpenClawConfig as RuntimeApiOpenClawConfig } from "mo/plugin-sdk/config-contracts";

export {
  DEFAULT_ACCOUNT_ID,
  getChatChannelMeta,
  type ChannelPlugin,
} from "mo/plugin-sdk/core";
export { buildChannelConfigSchema, IMessageConfigSchema } from "./config-api.js";
export { PAIRING_APPROVED_MESSAGE } from "mo/plugin-sdk/channel-status";
export {
  buildComputedAccountStatusSnapshot,
  collectStatusIssuesFromLastError,
} from "mo/plugin-sdk/status-helpers";
export { formatTrimmedAllowFromEntries } from "mo/plugin-sdk/channel-config-helpers";
export {
  resolveIMessageConfigAllowFrom,
  resolveIMessageConfigDefaultTo,
} from "./src/config-accessors.js";
export { looksLikeIMessageTargetId, normalizeIMessageMessagingTarget } from "./src/normalize.js";
export { resolveChannelMediaMaxBytes } from "mo/plugin-sdk/media-runtime";
export {
  resolveIMessageGroupRequireMention,
  resolveIMessageGroupToolPolicy,
} from "./src/group-policy.js";

export { monitorIMessageProvider } from "./src/monitor.js";
export type { MonitorIMessageOpts } from "./src/monitor.js";
export { probeIMessage } from "./src/probe.js";
export type { IMessageProbe } from "./src/probe.js";
export { sendMessageIMessage } from "./src/send.js";
export { imessageMessageActions } from "./src/actions.js";
export { setIMessageRuntime } from "./src/runtime.js";
export { chunkTextForOutbound } from "./src/channel-api.js";
export type IMessageAccountConfig = Omit<
  NonNullable<NonNullable<RuntimeApiOpenClawConfig["channels"]>["imessage"]>,
  "accounts" | "defaultAccount"
>;
