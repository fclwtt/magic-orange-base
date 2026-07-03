// Daemon runtime hint tests cover platform-specific daemon guidance.
import { describe, expect, it } from "vitest";
import { buildPlatformRuntimeLogHints, buildPlatformServiceStartHints } from "./runtime-hints.js";

describe("buildPlatformRuntimeLogHints", () => {
  it("renders launchd log hints on darwin", () => {
    expect(
      buildPlatformRuntimeLogHints({
        platform: "darwin",
        env: {
          HOME: "/Users/test",
          MO_STATE_DIR: "/tmp/mo-state",
          MO_LOG_PREFIX: "gateway",
        },
        systemdServiceName: "mo-gateway",
        windowsTaskName: "OpenClaw Gateway",
      }),
    ).toEqual([
      "Launchd stdout (if installed): /Users/test/Library/Logs/mo/gateway.log",
      "Launchd stderr (if installed): suppressed",
      "Restart attempts: /tmp/mo-state/logs/gateway-restart.log",
    ]);
  });

  it("renders systemd and windows hints by platform", () => {
    expect(
      buildPlatformRuntimeLogHints({
        platform: "linux",
        env: {
          MO_STATE_DIR: "/tmp/mo-state",
        },
        systemdServiceName: "mo-gateway",
        windowsTaskName: "OpenClaw Gateway",
      }),
    ).toEqual([
      "Logs: journalctl --user -u mo-gateway.service -n 200 --no-pager",
      "Restart attempts: /tmp/mo-state/logs/gateway-restart.log",
    ]);
    expect(
      buildPlatformRuntimeLogHints({
        platform: "win32",
        env: {
          MO_STATE_DIR: "/tmp/mo-state",
        },
        systemdServiceName: "mo-gateway",
        windowsTaskName: "OpenClaw Gateway",
      }),
    ).toEqual([
      'Logs: schtasks /Query /TN "OpenClaw Gateway" /V /FO LIST',
      "Restart attempts: /tmp/mo-state/logs/gateway-restart.log",
    ]);
  });
});

describe("buildPlatformServiceStartHints", () => {
  it("builds platform-specific service start hints", () => {
    expect(
      buildPlatformServiceStartHints({
        platform: "darwin",
        installCommand: "mo gateway install",
        startCommand: "mo gateway",
        launchAgentPlistPath: "~/Library/LaunchAgents/com.mo.gateway.plist",
        systemdServiceName: "mo-gateway",
        windowsTaskName: "OpenClaw Gateway",
      }),
    ).toEqual([
      "mo gateway install",
      "mo gateway",
      "launchctl bootstrap gui/$UID ~/Library/LaunchAgents/com.mo.gateway.plist",
    ]);
    expect(
      buildPlatformServiceStartHints({
        platform: "linux",
        installCommand: "mo gateway install",
        startCommand: "mo gateway",
        launchAgentPlistPath: "~/Library/LaunchAgents/com.mo.gateway.plist",
        systemdServiceName: "mo-gateway",
        windowsTaskName: "OpenClaw Gateway",
      }),
    ).toEqual([
      "mo gateway install",
      "mo gateway",
      "systemctl --user start mo-gateway.service",
    ]);
  });
});
