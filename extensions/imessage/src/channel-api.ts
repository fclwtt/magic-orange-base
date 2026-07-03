// Imessage API module exposes the plugin public contract.
import { formatTrimmedAllowFromEntries } from "mo/plugin-sdk/channel-config-helpers";
import { PAIRING_APPROVED_MESSAGE } from "mo/plugin-sdk/channel-status";
import {
  DEFAULT_ACCOUNT_ID,
  getChatChannelMeta,
  type ChannelPlugin,
} from "mo/plugin-sdk/core";
import { resolveChannelMediaMaxBytes } from "mo/plugin-sdk/media-runtime";
import { collectStatusIssuesFromLastError } from "mo/plugin-sdk/status-helpers";
import { normalizeIMessageMessagingTarget } from "./normalize.js";
export { chunkTextForOutbound } from "mo/plugin-sdk/text-chunking";

export {
  collectStatusIssuesFromLastError,
  DEFAULT_ACCOUNT_ID,
  formatTrimmedAllowFromEntries,
  getChatChannelMeta,
  normalizeIMessageMessagingTarget,
  PAIRING_APPROVED_MESSAGE,
  resolveChannelMediaMaxBytes,
};

export type { ChannelPlugin };
