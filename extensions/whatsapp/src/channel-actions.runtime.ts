// Whatsapp plugin module implements channel actions behavior.
import { createActionGate } from "mo/plugin-sdk/channel-actions";
import type { ChannelMessageActionName } from "mo/plugin-sdk/channel-contract";
import type { OpenClawConfig } from "mo/plugin-sdk/config-contracts";

export { listWhatsAppAccountIds, resolveWhatsAppAccount } from "./accounts.js";
export { resolveWhatsAppReactionLevel } from "./reaction-level.js";
export { createActionGate, type ChannelMessageActionName, type OpenClawConfig };
