// Discord plugin module implements message handler.batch gate behavior.
import type { ReplyToMode } from "mo/plugin-sdk/config-contracts";
import type { ReplyThreadingPolicy } from "mo/plugin-sdk/reply-reference";
import { resolveBatchedReplyThreadingPolicy } from "mo/plugin-sdk/reply-reference";

type ReplyThreadingContext = {
  ReplyThreading?: ReplyThreadingPolicy;
};

export function applyImplicitReplyBatchGate(
  ctx: object,
  replyToMode: ReplyToMode,
  isBatched: boolean,
) {
  const replyThreading = resolveBatchedReplyThreadingPolicy(replyToMode, isBatched);
  if (!replyThreading) {
    return;
  }
  (ctx as ReplyThreadingContext).ReplyThreading = replyThreading;
}
