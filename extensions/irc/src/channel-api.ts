// Irc API module exposes the plugin public contract.
export { createAccountStatusSink } from "mo/plugin-sdk/channel-outbound";
export { DEFAULT_ACCOUNT_ID } from "mo/plugin-sdk/account-id";
export type { ChannelPlugin } from "mo/plugin-sdk/channel-core";
export { PAIRING_APPROVED_MESSAGE } from "mo/plugin-sdk/channel-status";
export { buildBaseChannelStatusSummary } from "mo/plugin-sdk/status-helpers";
export { chunkTextForOutbound } from "mo/plugin-sdk/text-chunking";
