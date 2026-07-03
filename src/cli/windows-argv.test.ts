// Windows argv tests cover Windows-specific command-line argument normalization.
import { describe, expect, it } from "vitest";
import { mockProcessPlatform } from "../test-utils/vitest-spies.js";
import { normalizeWindowsArgv } from "./windows-argv.js";

describe("normalizeWindowsArgv", () => {
  it("removes duplicated Windows node launcher tokens", () => {
    const platform = mockProcessPlatform("win32");
    try {
      expect(
        normalizeWindowsArgv([
          "mo",
          "C:\\Program Files\\nodejs\\node.exe",
          "C:\\Users\\me\\AppData\\Roaming\\npm\\node_modules\\mo\\dist\\index.js",
          "status",
        ]),
      ).toEqual([
        "mo",
        "C:\\Users\\me\\AppData\\Roaming\\npm\\node_modules\\mo\\dist\\index.js",
        "status",
      ]);
    } finally {
      platform.mockRestore();
    }
  });

  it("preserves non-launcher arguments containing node.exe", () => {
    const platform = mockProcessPlatform("win32");
    try {
      expect(
        normalizeWindowsArgv([
          "mo",
          "C:\\Program Files\\nodejs\\node.exe",
          "C:\\Users\\me\\AppData\\Roaming\\npm\\node_modules\\mo\\dist\\index.js",
          "agent",
          "--message",
          "debug node.exe-wrapper startup",
        ]),
      ).toEqual([
        "mo",
        "C:\\Users\\me\\AppData\\Roaming\\npm\\node_modules\\mo\\dist\\index.js",
        "agent",
        "--message",
        "debug node.exe-wrapper startup",
      ]);
    } finally {
      platform.mockRestore();
    }
  });

  it("preserves non-launcher positionals containing node.exe after a duplicated launcher", () => {
    const platform = mockProcessPlatform("win32");
    try {
      expect(
        normalizeWindowsArgv([
          "C:\\Program Files\\nodejs\\node.exe",
          "C:\\Program Files\\nodejs\\node.exe",
          "C:\\Users\\me\\AppData\\Roaming\\npm\\node_modules\\mo\\dist\\index.js",
          "debug node.exe-wrapper startup",
          "--verbose",
        ]),
      ).toEqual([
        "C:\\Program Files\\nodejs\\node.exe",
        "C:\\Users\\me\\AppData\\Roaming\\npm\\node_modules\\mo\\dist\\index.js",
        "debug node.exe-wrapper startup",
        "--verbose",
      ]);
    } finally {
      platform.mockRestore();
    }
  });

  it("preserves exact node.exe option values outside the launcher prefix", () => {
    const platform = mockProcessPlatform("win32");
    try {
      expect(normalizeWindowsArgv(["mo", "run", "--message", "node.exe"])).toEqual([
        "mo",
        "run",
        "--message",
        "node.exe",
      ]);
    } finally {
      platform.mockRestore();
    }
  });
});
