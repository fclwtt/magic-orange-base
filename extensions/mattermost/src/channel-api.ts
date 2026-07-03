// Mattermost API module exposes the plugin public contract.
export { createAccountStatusSink } from "mo/plugin-sdk/channel-outbound";
export type { ChannelPlugin } from "mo/plugin-sdk/core";
export { DEFAULT_ACCOUNT_ID } from "mo/plugin-sdk/core";
export { chunkTextForOutbound } from "mo/plugin-sdk/text-chunking";
