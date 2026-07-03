// Whatsapp plugin module implements doctor contract behavior.
import type { ChannelDoctorConfigMutation } from "mo/plugin-sdk/channel-contract";
import type { OpenClawConfig } from "mo/plugin-sdk/config-contracts";
import { normalizeCompatibilityConfig as normalizeCompatibilityConfigImpl } from "./doctor.js";

export function normalizeCompatibilityConfig({
  cfg,
}: {
  cfg: OpenClawConfig;
}): ChannelDoctorConfigMutation {
  return normalizeCompatibilityConfigImpl({ cfg });
}
