// Tests shared utility helpers used by CLI and runtime modules.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { MAX_TIMER_TIMEOUT_MS } from "./shared/number-coercion.js";
import { withTempDir } from "./test-helpers/temp-dir.js";
import { withEnv } from "./test-utils/env.js";
import {
  CONFIG_DIR,
  ensureDir,
  pinConfigDir,
  resolveConfigDir,
  resolveHomeDir,
  resolveUserPath,
  shortenHomeInString,
  shortenHomePath,
  sleep,
} from "./utils.js";

describe("ensureDir", () => {
  it("creates nested directory", async () => {
    await withTempDir({ prefix: "mo-test-" }, async (tmp) => {
      const target = path.join(tmp, "nested", "dir");
      await ensureDir(target);
      expect(fs.existsSync(target)).toBe(true);
    });
  });
});

describe("sleep", () => {
  it("resolves after delay using fake timers", async () => {
    vi.useFakeTimers();
    try {
      const promise = sleep(1000);
      vi.advanceTimersByTime(1000);
      await expect(promise).resolves.toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it("clamps oversized sleep delays before scheduling", async () => {
    vi.useFakeTimers();
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    try {
      const promise = sleep(Number.MAX_SAFE_INTEGER);

      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), MAX_TIMER_TIMEOUT_MS);

      vi.advanceTimersByTime(MAX_TIMER_TIMEOUT_MS);
      await expect(promise).resolves.toBeUndefined();
    } finally {
      setTimeoutSpy.mockRestore();
      vi.useRealTimers();
    }
  });
});

describe("resolveConfigDir", () => {
  it("prefers ~/.mo when legacy dir is missing", async () => {
    await withTempDir({ prefix: "mo-config-dir-" }, async (root) => {
      const newDir = path.join(root, ".mo");
      await fs.promises.mkdir(newDir, { recursive: true });
      const resolved = resolveConfigDir({} as NodeJS.ProcessEnv, () => root);
      expect(resolved).toBe(newDir);
    });
  });

  it("expands MO_STATE_DIR using the provided env", () => {
    const env = {
      HOME: "/tmp/mo-home",
      MO_STATE_DIR: "~/state",
    } as NodeJS.ProcessEnv;

    expect(resolveConfigDir(env)).toBe(path.resolve("/tmp/mo-home", "state"));
  });

  it("falls back to the config file directory when only MO_CONFIG_PATH is set", () => {
    const env = {
      HOME: "/tmp/mo-home",
      MO_CONFIG_PATH: "~/profiles/dev/mo.json",
    } as NodeJS.ProcessEnv;

    expect(resolveConfigDir(env)).toBe(path.resolve("/tmp/mo-home", "profiles", "dev"));
  });

  it("re-pins the exported configuration root after startup environment selection", () => {
    const originalConfigDir = CONFIG_DIR;
    const selectedConfigDir = path.resolve("/tmp/mo-selected-config-root");
    try {
      expect(
        pinConfigDir({
          MO_STATE_DIR: selectedConfigDir,
          MO_TEST_FAST: "1",
        }),
      ).toBe(selectedConfigDir);
      expect(CONFIG_DIR).toBe(selectedConfigDir);
    } finally {
      pinConfigDir({
        MO_STATE_DIR: originalConfigDir,
        MO_TEST_FAST: "1",
      });
    }
  });
});

describe("resolveHomeDir", () => {
  it("prefers MO_HOME over HOME", () => {
    withEnv({ MO_HOME: "/srv/mo-home", HOME: "/home/other" }, () => {
      expect(resolveHomeDir()).toBe(path.resolve("/srv/mo-home"));
    });
  });
});

describe("shortenHomePath", () => {
  it("uses $MO_HOME prefix when MO_HOME is set", () => {
    withEnv({ MO_HOME: "/srv/mo-home", HOME: "/home/other" }, () => {
      expect(shortenHomePath(`${path.resolve("/srv/mo-home")}/.mo/mo.json`)).toBe(
        "$MO_HOME/.mo/mo.json",
      );
    });
  });
});

describe("shortenHomeInString", () => {
  it("uses $MO_HOME replacement when MO_HOME is set", () => {
    withEnv({ MO_HOME: "/srv/mo-home", HOME: "/home/other" }, () => {
      expect(
        shortenHomeInString(
          `config: ${path.resolve("/srv/mo-home")}/.mo/mo.json`,
        ),
      ).toBe("config: $MO_HOME/.mo/mo.json");
    });
  });
});

describe("resolveUserPath", () => {
  it("expands ~ to home dir", () => {
    expect(resolveUserPath("~", {}, () => "/Users/thoffman")).toBe(path.resolve("/Users/thoffman"));
  });

  it("expands ~/ to home dir", () => {
    expect(resolveUserPath("~/mo", {}, () => "/Users/thoffman")).toBe(
      path.resolve("/Users/thoffman", "mo"),
    );
  });

  it("resolves relative paths", () => {
    expect(resolveUserPath("tmp/dir")).toBe(path.resolve("tmp/dir"));
  });

  it("prefers MO_HOME for tilde expansion", () => {
    withEnv({ MO_HOME: "/srv/mo-home", HOME: "/home/other" }, () => {
      expect(resolveUserPath("~/mo")).toBe(path.resolve("/srv/mo-home", "mo"));
    });
  });

  it("uses the provided env for tilde expansion", () => {
    const env = {
      HOME: "/tmp/mo-home",
      MO_HOME: "/srv/mo-home",
    } as NodeJS.ProcessEnv;

    expect(resolveUserPath("~/mo", env)).toBe(path.resolve("/srv/mo-home", "mo"));
  });

  it("keeps blank paths blank", () => {
    expect(resolveUserPath("")).toBe("");
    expect(resolveUserPath("   ")).toBe("");
  });

  it("returns empty string for undefined/null input", () => {
    expect(resolveUserPath(undefined as unknown as string)).toBe("");
    expect(resolveUserPath(null as unknown as string)).toBe("");
  });
});
