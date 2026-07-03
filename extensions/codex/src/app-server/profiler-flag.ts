/**
 * Resolves whether Codex app-server profiling instrumentation is enabled by
 * OpenClaw diagnostic flags.
 */
import type { OpenClawConfig } from "mo/plugin-sdk/config-contracts";
import { isDiagnosticFlagEnabled } from "mo/plugin-sdk/diagnostic-runtime";

const PROFILER_FLAGS = ["profiler", "codex.profiler"] as const;

/** Checks the generic and Codex-specific profiler diagnostic flags. */
export function isCodexAppServerProfilerEnabled(
  config?: OpenClawConfig,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return PROFILER_FLAGS.some((flag) => isDiagnosticFlagEnabled(flag, config, env));
}
