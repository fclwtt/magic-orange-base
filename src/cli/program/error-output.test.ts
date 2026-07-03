// Error output tests cover program-level error display and exit messaging.
import { describe, expect, it } from "vitest";
import { formatCliParseErrorOutput } from "./error-output.js";

describe("formatCliParseErrorOutput", () => {
  it("explains unknown commands with root help and plugin hints", () => {
    const output = formatCliParseErrorOutput("error: unknown command 'wat'\n", {
      argv: ["node", "mo", "wat"],
    });

    expect(output).toBe(
      'OpenClaw does not know the command "wat".\nTry: mo --help\nPlugin command? mo plugins list\nDocs: https://docs.mo.ai/cli\n',
    );
  });

  it("suggests close known commands for unknown commands", () => {
    const output = formatCliParseErrorOutput("error: unknown command 'upate'\n", {
      argv: ["node", "mo", "upate"],
    });

    expect(output).toBe(
      'OpenClaw does not know the command "upate".\nDid you mean this?\n  mo update\nTry: mo --help\nPlugin command? mo plugins list\nDocs: https://docs.mo.ai/cli\n',
    );
  });

  it("suggests explicit aliases for common adjacent terminology", () => {
    const output = formatCliParseErrorOutput("error: unknown command 'upgrade'\n", {
      argv: ["node", "mo", "upgrade"],
    });

    expect(output).toContain("Did you mean this?\n  mo update\n");
  });

  it("preserves active profile context in command suggestions", () => {
    const originalProfile = process.env.MO_PROFILE;
    process.env.MO_PROFILE = "work";
    try {
      const output = formatCliParseErrorOutput("error: unknown command 'doctr'\n", {
        argv: ["node", "mo", "doctr"],
      });

      expect(output).toContain("Did you mean this?\n  mo --profile work doctor\n");
    } finally {
      if (originalProfile === undefined) {
        delete process.env.MO_PROFILE;
      } else {
        process.env.MO_PROFILE = originalProfile;
      }
    }
  });

  it("points unknown options at the active command help", () => {
    const output = formatCliParseErrorOutput("error: unknown option '--wat'\n", {
      argv: ["node", "mo", "channels", "status", "--wat"],
    });

    expect(output).toBe(
      'OpenClaw does not recognize option "--wat".\nTry: mo channels status --help\n',
    );
  });

  it("points missing required arguments at command help", () => {
    const output = formatCliParseErrorOutput("error: missing required argument 'name'\n", {
      argv: ["node", "mo", "plugins", "install"],
    });

    expect(output).toBe(
      'Missing required argument "name".\nTry: mo plugins install --help\n',
    );
  });
});
