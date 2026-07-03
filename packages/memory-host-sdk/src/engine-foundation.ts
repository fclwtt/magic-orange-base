// Real workspace contract for memory engine foundation concerns.

export {
  resolveAgentContextLimits,
  resolveAgentDir,
  resolveAgentWorkspaceDir,
  resolveDefaultAgentId,
  resolveSessionAgentId,
} from "./host/mo-runtime-agent.js";
export {
  resolveMemorySearchConfig,
  resolveMemorySearchSyncConfig,
  type ResolvedMemorySearchConfig,
  type ResolvedMemorySearchSyncConfig,
} from "./host/mo-runtime-agent.js";
export { parseDurationMs } from "./host/mo-runtime-config.js";
export { loadConfig } from "./host/mo-runtime-config.js";
export { resolveStateDir } from "./host/mo-runtime-config.js";
export { resolveSessionTranscriptsDirForAgent } from "./host/mo-runtime-config.js";
export {
  hasConfiguredSecretInput,
  normalizeResolvedSecretInputString,
} from "./host/mo-runtime-config.js";
export { root } from "./host/mo-runtime-io.js";
export { isPathInside } from "./host/fs-utils.js";
export { createSubsystemLogger } from "./host/mo-runtime-io.js";
export { detectMime } from "./host/mo-runtime-io.js";
export { resolveGlobalSingleton } from "./host/mo-runtime-io.js";
export { onSessionTranscriptUpdate } from "./host/mo-runtime-session.js";
export { splitShellArgs } from "./host/mo-runtime-io.js";
export { runTasksWithConcurrency } from "./host/mo-runtime-io.js";
export {
  shortenHomeInString,
  shortenHomePath,
  resolveUserPath,
  truncateUtf16Safe,
} from "./host/mo-runtime-io.js";
export type { OpenClawConfig } from "./host/mo-runtime-config.js";
export type { SessionSendPolicyConfig } from "./host/mo-runtime-config.js";
export type { SecretInput } from "./host/mo-runtime-config.js";
export type {
  MemoryBackend,
  MemoryCitationsMode,
  MemoryQmdConfig,
  MemoryQmdIndexPath,
  MemoryQmdMcporterConfig,
  MemoryQmdSearchMode,
} from "./host/mo-runtime-config.js";
export type { MemorySearchConfig } from "./host/mo-runtime-config.js";
