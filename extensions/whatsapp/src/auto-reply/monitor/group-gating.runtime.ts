// Whatsapp plugin module implements group gating behavior.
export {
  implicitMentionKindWhen,
  resolveInboundMentionDecision,
} from "mo/plugin-sdk/channel-mention-gating";
export { hasControlCommand } from "mo/plugin-sdk/command-detection";
export { createChannelHistoryWindow } from "mo/plugin-sdk/reply-history";
export { parseActivationCommand } from "mo/plugin-sdk/group-activation";
export { normalizeE164 } from "../../text-runtime.js";
