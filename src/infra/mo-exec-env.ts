/** Process env key that marks child commands as launched by the OpenClaw CLI. */
export const MO_CLI_ENV_VAR = "MO_CLI";

/** Stable marker value used for OpenClaw-launched subprocess detection. */
export const MO_CLI_ENV_VALUE = "1";

/** Returns a cloned env object with the OpenClaw CLI marker set. */
export function markOpenClawExecEnv<T extends Record<string, string | undefined>>(
  /** Source environment to clone before adding the subprocess marker. */
  env: T,
): T {
  return {
    ...env,
    [MO_CLI_ENV_VAR]: MO_CLI_ENV_VALUE,
  };
}

/** Mutates an existing process env object so current-process children inherit the marker. */
export function ensureOpenClawExecMarkerOnProcess(
  /** Process env object to mutate; defaults to the current process environment. */
  env: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  env[MO_CLI_ENV_VAR] = MO_CLI_ENV_VALUE;
  return env;
}
