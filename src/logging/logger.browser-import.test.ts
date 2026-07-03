// Logger browser import tests cover safe import behavior in browser-like runtimes.
import { importFreshModule } from "mo/plugin-sdk/test-fixtures";
import { afterEach, describe, expect, it, vi } from "vitest";

type LoggerModule = typeof import("./logger.js");

const originalGetBuiltinModule = (
  process as NodeJS.Process & { getBuiltinModule?: (id: string) => unknown }
).getBuiltinModule;

async function importBrowserSafeLogger(params?: {
  resolvePreferredOpenClawTmpDir?: ReturnType<typeof vi.fn>;
}): Promise<{
  module: LoggerModule;
  resolvePreferredOpenClawTmpDir: ReturnType<typeof vi.fn>;
}> {
  const resolvePreferredOpenClawTmpDir =
    params?.resolvePreferredOpenClawTmpDir ??
    vi.fn(() => {
      throw new Error("resolvePreferredOpenClawTmpDir should not run during browser-safe import");
    });

  vi.doMock("../infra/tmp-mo-dir.js", async () => {
    const actual = await vi.importActual<typeof import("../infra/tmp-mo-dir.js")>(
      "../infra/tmp-mo-dir.js",
    );
    return {
      ...actual,
      resolvePreferredOpenClawTmpDir,
    };
  });

  Object.defineProperty(process, "getBuiltinModule", {
    configurable: true,
    value: undefined,
  });

  const module = await importFreshModule<LoggerModule>(
    import.meta.url,
    "./logger.js?scope=browser-safe",
  );
  return { module, resolvePreferredOpenClawTmpDir };
}

describe("logging/logger browser-safe import", () => {
  afterEach(() => {
    vi.doUnmock("../infra/tmp-mo-dir.js");
    Object.defineProperty(process, "getBuiltinModule", {
      configurable: true,
      value: originalGetBuiltinModule,
    });
  });

  it("does not resolve the preferred temp dir at import time when node fs is unavailable", async () => {
    const { module, resolvePreferredOpenClawTmpDir } = await importBrowserSafeLogger();

    expect(resolvePreferredOpenClawTmpDir).not.toHaveBeenCalled();
    expect(module.DEFAULT_LOG_DIR).toBe("/tmp/mo");
    expect(module.DEFAULT_LOG_FILE).toBe("/tmp/mo/mo.log");
  });

  it("disables file logging when imported in a browser-like environment", async () => {
    const { module, resolvePreferredOpenClawTmpDir } = await importBrowserSafeLogger();

    expect(module.getResolvedLoggerSettings()).toStrictEqual({
      level: "silent",
      file: "/tmp/mo/mo.log",
      maxFileBytes: 100 * 1024 * 1024,
    });
    expect(module.isFileLogLevelEnabled("info")).toBe(false);
    expect(module.getLogger().info("browser-safe")).toBeUndefined();
    expect(resolvePreferredOpenClawTmpDir).not.toHaveBeenCalled();
  });
});
