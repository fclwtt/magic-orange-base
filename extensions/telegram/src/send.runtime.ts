// Telegram plugin module implements send behavior.
export { requireRuntimeConfig } from "mo/plugin-sdk/plugin-config-runtime";
export { resolveMarkdownTableMode } from "mo/plugin-sdk/markdown-table-runtime";
export type { OpenClawConfig } from "mo/plugin-sdk/config-contracts";
export type { PollInput, MediaKind } from "mo/plugin-sdk/media-runtime";
export {
  buildOutboundMediaLoadOptions,
  getImageMetadata,
  isGifMedia,
  kindFromMime,
  normalizePollInput,
  probeVideoDimensions,
} from "mo/plugin-sdk/media-runtime";
export { loadWebMedia } from "mo/plugin-sdk/web-media";
