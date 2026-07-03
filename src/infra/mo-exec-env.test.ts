// Tests OpenClaw execution environment construction.
import { describe, expect, it } from "vitest";
import { deleteTestEnvValue, setTestEnvValue } from "../test-utils/env.js";
import {
  ensureOpenClawExecMarkerOnProcess,
  markOpenClawExecEnv,
  MO_CLI_ENV_VALUE,
  MO_CLI_ENV_VAR,
} from "./mo-exec-env.js";

describe("markOpenClawExecEnv", () => {
  it("returns a cloned env object with the exec marker set", () => {
    const env = { PATH: "/usr/bin", MO_CLI: "0" };
    const marked = markOpenClawExecEnv(env);

    expect(marked).toEqual({
      PATH: "/usr/bin",
      MO_CLI: MO_CLI_ENV_VALUE,
    });
    expect(marked).not.toBe(env);
    expect(env.MO_CLI).toBe("0");
  });
});

describe("ensureOpenClawExecMarkerOnProcess", () => {
  it.each([
    {
      name: "mutates and returns the provided process env",
      env: { PATH: "/usr/bin" } as NodeJS.ProcessEnv,
    },
    {
      name: "overwrites an existing marker on the provided process env",
      env: { PATH: "/usr/bin", [MO_CLI_ENV_VAR]: "0" } as NodeJS.ProcessEnv,
    },
  ])("$name", ({ env }) => {
    expect(ensureOpenClawExecMarkerOnProcess(env)).toBe(env);
    expect(env[MO_CLI_ENV_VAR]).toBe(MO_CLI_ENV_VALUE);
  });

  it("defaults to mutating process.env when no env object is provided", () => {
    const previous = process.env[MO_CLI_ENV_VAR];
    deleteTestEnvValue(MO_CLI_ENV_VAR);

    try {
      expect(ensureOpenClawExecMarkerOnProcess()).toBe(process.env);
      expect(process.env[MO_CLI_ENV_VAR]).toBe(MO_CLI_ENV_VALUE);
    } finally {
      if (previous === undefined) {
        deleteTestEnvValue(MO_CLI_ENV_VAR);
      } else {
        setTestEnvValue(MO_CLI_ENV_VAR, previous);
      }
    }
  });
});
