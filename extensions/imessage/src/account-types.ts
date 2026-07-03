// Imessage plugin module implements account types behavior.
import type { OpenClawConfig } from "mo/plugin-sdk/config-contracts";

export type IMessageAccountConfig = Omit<
  NonNullable<NonNullable<OpenClawConfig["channels"]>["imessage"]>,
  "accounts" | "defaultAccount"
>;
