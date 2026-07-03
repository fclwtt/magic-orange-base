// Private runtime barrel for the bundled Twitch extension.
// Keep this barrel thin and aligned with the local extension surface.

export type {
  ChannelAccountSnapshot,
  ChannelCapabilities,
  ChannelGatewayContext,
  ChannelLogSink,
  ChannelMessageActionAdapter,
  ChannelMessageActionContext,
  ChannelMeta,
  ChannelOutboundAdapter,
  ChannelOutboundContext,
  ChannelResolveKind,
  ChannelResolveResult,
  ChannelStatusAdapter,
} from "mo/plugin-sdk/channel-contract";
export type { ChannelPlugin } from "mo/plugin-sdk/channel-core";
export type { OutboundDeliveryResult } from "mo/plugin-sdk/channel-send-result";
export type { OpenClawConfig } from "mo/plugin-sdk/config-contracts";
export type { RuntimeEnv } from "mo/plugin-sdk/runtime";
export type { WizardPrompter } from "mo/plugin-sdk/setup";
