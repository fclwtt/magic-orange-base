// Workspace default tests cover environment-variable precedence for the
// built-in agent workspace location.
import path from "node:path";
import { describe, expect, it } from "vitest";
import { withEnv } from "../test-utils/env.js";
import { resolveDefaultAgentWorkspaceDir } from "./workspace.js";

describe("DEFAULT_AGENT_WORKSPACE_DIR", () => {
  it("uses MO_HOME when resolving the default workspace dir", () => {
    const home = path.join(path.sep, "srv", "mo-home");

    const resolved = withEnv(
      {
        MO_WORKSPACE_DIR: undefined,
        MO_PROFILE: undefined,
        MO_HOME: home,
        HOME: path.join(path.sep, "home", "other"),
      },
      () => resolveDefaultAgentWorkspaceDir(),
    );

    expect(resolved).toBe(path.join(path.resolve(home), ".mo", "workspace"));
  });

  it("uses MO_WORKSPACE_DIR before MO_HOME", () => {
    const workspaceDir = path.join(path.sep, "srv", "mo-workspace");

    const resolved = withEnv(
      {
        MO_WORKSPACE_DIR: workspaceDir,
        MO_HOME: path.join(path.sep, "srv", "mo-home"),
      },
      () => resolveDefaultAgentWorkspaceDir(),
    );

    expect(resolved).toBe(path.resolve(workspaceDir));
  });
});
