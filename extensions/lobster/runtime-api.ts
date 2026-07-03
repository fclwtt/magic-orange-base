// Lobster API module exposes the plugin public contract.
export { definePluginEntry } from "mo/plugin-sdk/core";
export type {
  AnyAgentTool,
  OpenClawPluginApi,
  OpenClawPluginToolContext,
  OpenClawPluginToolFactory,
} from "mo/plugin-sdk/core";
export {
  applyWindowsSpawnProgramPolicy,
  materializeWindowsSpawnProgram,
  resolveWindowsSpawnProgramCandidate,
} from "mo/plugin-sdk/windows-spawn";
