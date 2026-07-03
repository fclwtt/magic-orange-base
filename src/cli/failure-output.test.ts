// Failure output tests cover CLI error formatting and failure summaries.
import { describe, expect, it } from "vitest";
import { formatCliFailureLines } from "./failure-output.js";

describe("formatCliFailureLines", () => {
  it("shows a concise reason and recovery commands by default", () => {
    const lines = formatCliFailureLines({
      title: "Could not start the CLI.",
      error: new Error("config file is invalid"),
      argv: ["node", "mo", "status"],
      env: {},
    });

    expect(lines).toEqual([
      "[mo] Could not start the CLI.",
      "[mo] Reason: config file is invalid",
      "[mo] Debug: set MO_DEBUG=1 to include the stack trace.",
      "[mo] Try: mo doctor",
      "[mo] Help: mo --help",
    ]);
  });

  it("prints stack details when debug output is requested", () => {
    const lines = formatCliFailureLines({
      title: "The CLI command failed.",
      error: new Error("boom"),
      env: { MO_DEBUG: "1" },
    });

    expect(lines.slice(0, 4)).toEqual([
      "[mo] The CLI command failed.",
      "[mo] Reason: boom",
      "[mo] Stack:",
      "[mo] Error: boom",
    ]);
    expect(lines.join("\n")).toContain("Error: boom");
  });
});
