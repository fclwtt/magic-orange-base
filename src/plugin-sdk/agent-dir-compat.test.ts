/**
 * Tests agent directory compatibility helpers.
 */
import { describe, expect, it } from "vitest";
import { resolveOpenClawAgentDir } from "./agent-dir-compat.js";

describe("resolveOpenClawAgentDir", () => {
  it("keeps the shipped Pi env alias for deprecated plugin SDK callers", () => {
    expect(
      resolveOpenClawAgentDir({
        PI_CODING_AGENT_DIR: "/tmp/mo-legacy-agent",
      }),
    ).toBe("/tmp/mo-legacy-agent");
  });

  it("prefers the OpenClaw env override over the deprecated Pi alias", () => {
    expect(
      resolveOpenClawAgentDir({
        MO_AGENT_DIR: "/tmp/mo-agent",
        PI_CODING_AGENT_DIR: "/tmp/mo-legacy-agent",
      }),
    ).toBe("/tmp/mo-agent");
  });
});
