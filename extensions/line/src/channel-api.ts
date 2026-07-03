// Line API module exposes the plugin public contract.
export { clearAccountEntryFields } from "mo/plugin-sdk/core";
import { DEFAULT_ACCOUNT_ID } from "mo/plugin-sdk/account-id";
import type { OpenClawConfig } from "mo/plugin-sdk/account-resolution";
import type { ChannelPlugin } from "mo/plugin-sdk/core";
import { listLineAccountIds, resolveDefaultLineAccountId, resolveLineAccount } from "./accounts.js";
import { resolveExactLineGroupConfigKey } from "./group-keys.js";
import type { LineConfig, ResolvedLineAccount } from "./types.js";

export {
  DEFAULT_ACCOUNT_ID,
  listLineAccountIds,
  resolveDefaultLineAccountId,
  resolveExactLineGroupConfigKey,
  resolveLineAccount,
};

export type { ChannelPlugin, LineConfig, OpenClawConfig, ResolvedLineAccount };
