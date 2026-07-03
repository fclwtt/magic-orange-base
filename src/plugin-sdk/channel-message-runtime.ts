/**
 * @deprecated Use `mo/plugin-sdk/channel-outbound`. The outbound subpath
 * contains message lifecycle contracts plus runtime send helpers.
 */

export * from "./channel-outbound.js";

/** @deprecated Use `buildInboundReplyDispatchBase(...)` from `mo/plugin-sdk/channel-inbound`. */
export { buildChannelMessageReplyDispatchBase } from "./inbound-reply-dispatch.js";
/** @deprecated Use `dispatchChannelInboundReply(...)` or `runPreparedInboundReply(...)` from `mo/plugin-sdk/channel-inbound`. */
export { dispatchChannelMessageReplyWithBase } from "./inbound-reply-dispatch.js";
/** @deprecated Use `recordChannelMessageReplyDispatch(...)` only from legacy compatibility paths. */
export { recordChannelMessageReplyDispatch } from "./inbound-reply-dispatch.js";
/** @deprecated Use `hasFinalInboundReplyDispatch(...)` from `mo/plugin-sdk/channel-inbound`. */
export { hasFinalChannelMessageReplyDispatch } from "./inbound-reply-dispatch.js";
/** @deprecated Use `hasVisibleInboundReplyDispatch(...)` from `mo/plugin-sdk/channel-inbound`. */
export { hasVisibleChannelMessageReplyDispatch } from "./inbound-reply-dispatch.js";
/** @deprecated Use `resolveInboundReplyDispatchCounts(...)` from `mo/plugin-sdk/channel-inbound`. */
export { resolveChannelMessageReplyDispatchCounts } from "./inbound-reply-dispatch.js";
/** @deprecated Use `createChannelMessageReplyPipeline(...)` from `mo/plugin-sdk/channel-outbound`. */
export { createChannelTurnReplyPipeline } from "./channel-message.js";
/** @deprecated Use `deliverInboundReplyWithMessageSendContext(...)` from `mo/plugin-sdk/channel-outbound`. */
export { deliverDurableInboundReplyPayload } from "./channel-message.js";
