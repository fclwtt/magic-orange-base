// Covers Nix integration config compatibility scenarios U3, U5, and U9.
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_GATEWAY_PORT,
  resolveConfigPathCandidate,
  resolveGatewayPort,
  resolveIsNixMode,
  resolveStateDir,
} from "./config.js";
import { withTempHome } from "./test-helpers.js";

vi.unmock("../version.js");

function envWith(overrides: Record<string, string | undefined>): NodeJS.ProcessEnv {
  // Hermetic env: don't inherit process.env because other tests may mutate it.
  return { ...overrides };
}

describe("Nix integration (U3, U5, U9)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("U3: isNixMode env var detection", () => {
    it("isNixMode is false when MO_NIX_MODE is not set", () => {
      expect(resolveIsNixMode(envWith({ MO_NIX_MODE: undefined }))).toBe(false);
    });

    it("isNixMode is false when MO_NIX_MODE is empty", () => {
      expect(resolveIsNixMode(envWith({ MO_NIX_MODE: "" }))).toBe(false);
    });

    it("isNixMode is false when MO_NIX_MODE is not '1'", () => {
      expect(resolveIsNixMode(envWith({ MO_NIX_MODE: "true" }))).toBe(false);
    });

    it("isNixMode is true when MO_NIX_MODE=1", () => {
      expect(resolveIsNixMode(envWith({ MO_NIX_MODE: "1" }))).toBe(true);
    });
  });

  describe("U5: CONFIG_PATH and STATE_DIR env var overrides", () => {
    it("STATE_DIR defaults to ~/.mo when env not set", () => {
      expect(resolveStateDir(envWith({ MO_STATE_DIR: undefined }))).toMatch(/\.mo$/);
    });

    it("STATE_DIR respects MO_STATE_DIR override", () => {
      expect(resolveStateDir(envWith({ MO_STATE_DIR: "/custom/state/dir" }))).toBe(
        path.resolve("/custom/state/dir"),
      );
    });

    it("STATE_DIR respects MO_HOME when state override is unset", () => {
      const customHome = path.join(path.sep, "custom", "home");
      expect(
        resolveStateDir(envWith({ MO_HOME: customHome, MO_STATE_DIR: undefined })),
      ).toBe(path.join(path.resolve(customHome), ".mo"));
    });

    it("CONFIG_PATH defaults to MO_HOME/.mo/mo.json", () => {
      const customHome = path.join(path.sep, "custom", "home");
      expect(
        resolveConfigPathCandidate(
          envWith({
            MO_HOME: customHome,
            MO_CONFIG_PATH: undefined,
            MO_STATE_DIR: undefined,
          }),
        ),
      ).toBe(path.join(path.resolve(customHome), ".mo", "mo.json"));
    });

    it("CONFIG_PATH defaults to ~/.mo/mo.json when env not set", () => {
      expect(
        resolveConfigPathCandidate(
          envWith({ MO_CONFIG_PATH: undefined, MO_STATE_DIR: undefined }),
        ),
      ).toMatch(/\.mo[\\/]mo\.json$/);
    });

    it("CONFIG_PATH respects MO_CONFIG_PATH override", () => {
      expect(
        resolveConfigPathCandidate(
          envWith({ MO_CONFIG_PATH: "/nix/store/abc/mo.json" }),
        ),
      ).toBe(path.resolve("/nix/store/abc/mo.json"));
    });

    it("CONFIG_PATH expands ~ in MO_CONFIG_PATH override", async () => {
      await withTempHome(async (home) => {
        expect(
          resolveConfigPathCandidate(
            envWith({ MO_HOME: home, MO_CONFIG_PATH: "~/.mo/custom.json" }),
            () => home,
          ),
        ).toBe(path.join(home, ".mo", "custom.json"));
      });
    });

    it("CONFIG_PATH uses STATE_DIR when only state dir is overridden", () => {
      expect(
        resolveConfigPathCandidate(
          envWith({ MO_STATE_DIR: "/custom/state", MO_TEST_FAST: "1" }),
          () => path.join(path.sep, "tmp", "mo-config-home"),
        ),
      ).toBe(path.join(path.resolve("/custom/state"), "mo.json"));
    });
  });

  describe("U6: gateway port resolution", () => {
    it("uses default when env and config are unset", () => {
      expect(resolveGatewayPort({}, envWith({ MO_GATEWAY_PORT: undefined }))).toBe(
        DEFAULT_GATEWAY_PORT,
      );
    });

    it("prefers MO_GATEWAY_PORT over config", () => {
      expect(
        resolveGatewayPort(
          { gateway: { port: 19002 } },
          envWith({ MO_GATEWAY_PORT: "19001" }),
        ),
      ).toBe(19001);
    });

    it("falls back to config when env is invalid", () => {
      expect(
        resolveGatewayPort(
          { gateway: { port: 19003 } },
          envWith({ MO_GATEWAY_PORT: "nope" }),
        ),
      ).toBe(19003);
    });
  });
});
