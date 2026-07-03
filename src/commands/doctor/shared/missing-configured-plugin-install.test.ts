// Missing configured plugin install tests cover doctor diagnostics for absent plugin installs.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveRegistryUpdateChannel } from "../../../infra/update-channels.js";
import { CLAWHUB_INSTALL_ERROR_CODE } from "../../../plugins/clawhub-error-codes.js";
import {
  resolveClawHubInstallSpecsForUpdateChannel,
  resolveNpmInstallSpecsForUpdateChannel,
} from "../../../plugins/install-channel-specs.js";
import { VERSION } from "../../../version.js";

function expectedNpmInstallSpec(spec: string): string {
  return resolveNpmInstallSpecsForUpdateChannel({
    spec,
    updateChannel: resolveRegistryUpdateChannel({ currentVersion: VERSION }),
  }).installSpec;
}

function expectedClawHubInstallSpec(spec: string): string {
  return resolveClawHubInstallSpecsForUpdateChannel({
    spec,
    updateChannel: resolveRegistryUpdateChannel({ currentVersion: VERSION }),
  }).installSpec;
}

function currentOpenClawReleaseBase(): string {
  return VERSION.replace(/-(?:alpha|beta)\.[1-9]\d*$/u, "");
}

function expectRecordFields(record: unknown, expected: Record<string, unknown>) {
  if (!record || typeof record !== "object") {
    throw new Error("Expected record");
  }
  const actual = record as Record<string, unknown>;
  for (const [key, value] of Object.entries(expected)) {
    expect(actual[key]).toEqual(value);
  }
  return actual;
}

function mockCallArg(mock: ReturnType<typeof vi.fn>, callIndex = 0, argIndex = 0) {
  const call = mock.mock.calls[callIndex];
  if (!call) {
    throw new Error(`Expected mock call ${callIndex}`);
  }
  return call[argIndex];
}

const mocks = vi.hoisted(() => ({
  installPluginFromClawHub: vi.fn(),
  installPluginFromNpmSpec: vi.fn(),
  listChannelPluginCatalogEntries: vi.fn(),
  listOfficialExternalChannelEnvVars: vi.fn(() => []),
  listOfficialExternalPluginCatalogEntries: vi.fn(),
  loadInstalledPluginIndex: vi.fn(),
  loadInstalledPluginIndexInstallRecords: vi.fn(),
  loadPluginMetadataSnapshot: vi.fn(),
  getOfficialExternalPluginCatalogManifest: vi.fn(
    (entry: { mo?: unknown }) => entry.mo,
  ),
  resolveOfficialExternalPluginId: vi.fn((entry: { id?: string }) => entry.id),
  resolveOfficialExternalPluginInstall: vi.fn(
    (entry: { install?: unknown }) => entry.install ?? null,
  ),
  resolveOfficialExternalPluginLabel: vi.fn(
    (entry: { label?: string; id?: string }) => entry.label ?? entry.id ?? "plugin",
  ),
  resolveOfficialExternalProviderContractPluginIds: vi.fn(),
  resolveOfficialExternalProviderPluginIds: vi.fn(),
  resolveOfficialExternalProviderPluginIdsForEnv: vi.fn(),
  resolveOfficialExternalWebProviderContractPluginIdsForEnv: vi.fn(),
  resolveDefaultPluginExtensionsDir: vi.fn(() => "/tmp/mo-plugins"),
  resolveDefaultPluginNpmDir: vi.fn(() => "/tmp/mo-npm"),
  resolvePluginNpmPackageDir: vi.fn(
    ({ npmDir, packageName }: { npmDir?: string; packageName: string }) =>
      path.join(
        npmDir ?? "/tmp/mo-npm",
        "projects",
        packageName.replace(/[^a-zA-Z0-9._-]+/g, "-"),
        "node_modules",
        ...packageName.split("/"),
      ),
  ),
  resolvePluginInstallDir: vi.fn(
    (pluginId: string, extensionsDir = "/tmp/mo-plugins") => `${extensionsDir}/${pluginId}`,
  ),
  validatePluginId: vi.fn(() => null),
  resolveProviderInstallCatalogEntries: vi.fn(),
  updateNpmInstalledPlugins: vi.fn(),
  writePersistedInstalledPluginIndexInstallRecords: vi.fn(),
}));

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mo-plugin-stub-repair-"));
  tempDirs.push(dir);
  return dir;
}

function writeLegacyNpmDeclarationStub(params: {
  pluginDir: string;
  pluginId: string;
  npmSpec: string;
}): void {
  fs.mkdirSync(params.pluginDir, { recursive: true });
  fs.writeFileSync(
    path.join(params.pluginDir, "mo.extension.json"),
    JSON.stringify({
      name: params.pluginId,
      type: "npm",
      npmSpec: params.npmSpec,
    }),
    "utf8",
  );
}

vi.mock("../../../channels/plugins/catalog.js", () => ({
  listChannelPluginCatalogEntries: mocks.listChannelPluginCatalogEntries,
  listRawChannelPluginCatalogEntries: mocks.listChannelPluginCatalogEntries,
}));

vi.mock("../../../plugins/installed-plugin-index-records.js", () => ({
  loadInstalledPluginIndexInstallRecords: mocks.loadInstalledPluginIndexInstallRecords,
  writePersistedInstalledPluginIndexInstallRecords:
    mocks.writePersistedInstalledPluginIndexInstallRecords,
}));

vi.mock("../../../plugins/installed-plugin-index.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../plugins/installed-plugin-index.js")>()),
  loadInstalledPluginIndex: mocks.loadInstalledPluginIndex,
}));

vi.mock("../../../plugins/install-paths.js", () => ({
  resolveDefaultPluginExtensionsDir: mocks.resolveDefaultPluginExtensionsDir,
  resolveDefaultPluginNpmDir: mocks.resolveDefaultPluginNpmDir,
  resolvePluginNpmPackageDir: mocks.resolvePluginNpmPackageDir,
  resolvePluginInstallDir: mocks.resolvePluginInstallDir,
  validatePluginId: mocks.validatePluginId,
}));

vi.mock("../../../plugins/install.js", () => ({
  installPluginFromNpmSpec: mocks.installPluginFromNpmSpec,
}));

vi.mock("../../../plugins/clawhub.js", () => ({
  CLAWHUB_INSTALL_ERROR_CODE: {
    PACKAGE_NOT_FOUND: "package_not_found",
    VERSION_NOT_FOUND: "version_not_found",
    ARTIFACT_UNAVAILABLE: "artifact_unavailable",
    ARTIFACT_DOWNLOAD_UNAVAILABLE: "artifact_download_unavailable",
    CLAWHUB_DOWNLOAD_BLOCKED: "clawhub_download_blocked",
    CLAWHUB_SECURITY_UNAVAILABLE: "clawhub_security_unavailable",
  },
  installPluginFromClawHub: mocks.installPluginFromClawHub,
}));

vi.mock("../../../plugins/plugin-metadata-snapshot.js", () => ({
  loadPluginMetadataSnapshot: mocks.loadPluginMetadataSnapshot,
  resolvePluginMetadataSnapshot: mocks.loadPluginMetadataSnapshot,
}));

vi.mock("../../../plugins/official-external-plugin-catalog.js", () => ({
  getOfficialExternalPluginCatalogManifest: mocks.getOfficialExternalPluginCatalogManifest,
  listOfficialExternalChannelEnvVars: mocks.listOfficialExternalChannelEnvVars,
  listOfficialExternalPluginCatalogEntries: mocks.listOfficialExternalPluginCatalogEntries,
  resolveOfficialExternalPluginId: mocks.resolveOfficialExternalPluginId,
  resolveOfficialExternalPluginInstall: mocks.resolveOfficialExternalPluginInstall,
  resolveOfficialExternalPluginLabel: mocks.resolveOfficialExternalPluginLabel,
  resolveOfficialExternalProviderContractPluginIds:
    mocks.resolveOfficialExternalProviderContractPluginIds,
  resolveOfficialExternalProviderPluginIds: mocks.resolveOfficialExternalProviderPluginIds,
  resolveOfficialExternalProviderPluginIdsForEnv:
    mocks.resolveOfficialExternalProviderPluginIdsForEnv,
  resolveOfficialExternalWebProviderContractPluginIdsForEnv:
    mocks.resolveOfficialExternalWebProviderContractPluginIdsForEnv,
}));

vi.mock("../../../plugins/provider-install-catalog.js", () => ({
  resolveProviderInstallCatalogEntries: mocks.resolveProviderInstallCatalogEntries,
}));

vi.mock("../../../plugins/update.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../plugins/update.js")>();
  return {
    ...actual,
    updateNpmInstalledPlugins: mocks.updateNpmInstalledPlugins,
  };
});

describe("repairMissingConfiguredPluginInstalls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadPluginMetadataSnapshot.mockReturnValue({
      plugins: [],
      diagnostics: [],
    });
    mocks.loadInstalledPluginIndex.mockReturnValue({
      plugins: [],
      diagnostics: [],
      installRecords: {},
    });
    mocks.loadInstalledPluginIndexInstallRecords.mockResolvedValue({});
    mocks.listChannelPluginCatalogEntries.mockReturnValue([]);
    mocks.listOfficialExternalPluginCatalogEntries.mockReturnValue([]);
    mocks.resolveDefaultPluginExtensionsDir.mockReturnValue("/tmp/mo-plugins");
    mocks.resolveDefaultPluginNpmDir.mockReturnValue("/tmp/mo-npm");
    mocks.resolveProviderInstallCatalogEntries.mockReturnValue([]);
    mocks.resolveOfficialExternalProviderPluginIdsForEnv.mockReturnValue([]);
    mocks.resolveOfficialExternalWebProviderContractPluginIdsForEnv.mockReturnValue([]);
    mocks.resolveOfficialExternalProviderContractPluginIds.mockImplementation(
      ({ contract, providerIds }: { contract: string; providerIds: ReadonlySet<string> }) => {
        const configuredProviderIds = new Set(
          [...providerIds].map((providerId) => providerId.trim().toLowerCase()),
        );
        const entries = mocks.listOfficialExternalPluginCatalogEntries.getMockImplementation()?.();
        if (!Array.isArray(entries)) {
          return [];
        }
        return entries.flatMap((entry) => {
          if (!entry || typeof entry !== "object") {
            return [];
          }
          const candidate = entry as {
            id?: string;
            mo?: {
              plugin?: { id?: string };
              contracts?: Record<string, unknown>;
            };
          };
          const pluginId = candidate.mo?.plugin?.id ?? candidate.id;
          const ownedProviderIds = candidate.mo?.contracts?.[contract];
          if (
            !pluginId ||
            !Array.isArray(ownedProviderIds) ||
            !ownedProviderIds.some(
              (providerId) =>
                typeof providerId === "string" &&
                configuredProviderIds.has(providerId.trim().toLowerCase()),
            )
          ) {
            return [];
          }
          return [pluginId];
        });
      },
    );
    mocks.resolveOfficialExternalProviderPluginIds.mockImplementation(
      ({ providerIds }: { providerIds: ReadonlySet<string> }) => {
        const configuredProviderIds = new Set(
          [...providerIds].map((providerId) => providerId.trim().toLowerCase()),
        );
        const entries = mocks.listOfficialExternalPluginCatalogEntries.getMockImplementation()?.();
        if (!Array.isArray(entries)) {
          return [];
        }
        return entries.flatMap((entry) => {
          if (!entry || typeof entry !== "object") {
            return [];
          }
          const candidate = entry as {
            id?: string;
            mo?: {
              plugin?: { id?: string };
              providers?: Array<{ id?: string; aliases?: string[] }>;
            };
          };
          const pluginId = candidate.mo?.plugin?.id ?? candidate.id;
          const ownsConfiguredProvider = candidate.mo?.providers?.some((provider) =>
            [provider.id, ...(provider.aliases ?? [])].some(
              (providerId) =>
                typeof providerId === "string" &&
                configuredProviderIds.has(providerId.trim().toLowerCase()),
            ),
          );
          return pluginId && ownsConfiguredProvider ? [pluginId] : [];
        });
      },
    );
    mocks.installPluginFromClawHub.mockResolvedValue({
      ok: true,
      pluginId: "matrix",
      targetDir: "/tmp/mo-plugins/matrix",
      version: "1.2.3",
      clawhub: {
        source: "clawhub",
        clawhubUrl: "https://clawhub.ai",
        clawhubPackage: "@mo/plugin-matrix",
        clawhubFamily: "code-plugin",
        clawhubChannel: "official",
        version: "1.2.3",
        integrity: "sha256-clawhub",
        resolvedAt: "2026-05-01T00:00:00.000Z",
        clawpackSha256: "0".repeat(64),
        clawpackSpecVersion: 1,
        clawpackManifestSha256: "1".repeat(64),
        clawpackSize: 1234,
      },
    });
    mocks.installPluginFromNpmSpec.mockResolvedValue({
      ok: true,
      pluginId: "matrix",
      targetDir: "/tmp/mo-plugins/matrix",
      version: "1.2.3",
      npmResolution: {
        name: "@mo/plugin-matrix",
        version: "1.2.3",
        resolvedSpec: "@mo/plugin-matrix@1.2.3",
        integrity: "sha512-test",
        resolvedAt: "2026-05-01T00:00:00.000Z",
      },
    });
  });

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("maps a missing configured plugin install to a structured finding and dry-run effect", async () => {
    mocks.listChannelPluginCatalogEntries.mockReturnValue([
      {
        id: "matrix",
        pluginId: "matrix",
        meta: { label: "Matrix" },
        install: {
          npmSpec: "@mo/plugin-matrix@1.2.3",
          expectedIntegrity: "sha512-test",
        },
        trustedSourceLinkedOfficialInstall: true,
      },
    ]);

    const {
      configuredPluginInstallIssueToHealthFinding,
      configuredPluginInstallIssueToRepairEffect,
      detectConfiguredPluginInstallHealthIssues,
    } = await import("./missing-configured-plugin-install.js");
    const [issue] = await detectConfiguredPluginInstallHealthIssues({
      cfg: {
        channels: {
          matrix: { enabled: true, homeserver: "https://matrix.example.org" },
        },
      },
      env: {},
    });

    expect(mocks.installPluginFromClawHub).not.toHaveBeenCalled();
    expect(mocks.installPluginFromNpmSpec).not.toHaveBeenCalled();
    expect(mocks.writePersistedInstalledPluginIndexInstallRecords).not.toHaveBeenCalled();
    expect(issue).toEqual({
      kind: "missing-install-record",
      pluginId: "matrix",
      installSpec: "@mo/plugin-matrix@1.2.3",
    });
    expect(configuredPluginInstallIssueToHealthFinding(issue)).toMatchObject({
      checkId: "core/doctor/configured-plugin-installs",
      severity: "warning",
      target: "matrix",
      fixHint: "Run `mo doctor --fix` to install @mo/plugin-matrix@1.2.3.",
    });
    expect(configuredPluginInstallIssueToRepairEffect(issue)).toEqual({
      kind: "package",
      action: "would-install-configured-plugin",
      target: "matrix",
      dryRunSafe: false,
    });
  });

  it("maps package-update deferrals to structured findings without installing packages", async () => {
    const missingDiscordPath = path.resolve("/missing/discord");
    const records = {
      discord: {
        source: "npm",
        spec: "@mo/discord",
        installPath: missingDiscordPath,
      },
    };
    mocks.loadInstalledPluginIndexInstallRecords.mockResolvedValue(records);
    mocks.listChannelPluginCatalogEntries.mockReturnValue([
      {
        id: "discord",
        pluginId: "discord",
        meta: { label: "Discord" },
        install: {
          npmSpec: "@mo/discord",
        },
      },
    ]);

    const {
      configuredPluginInstallIssueToHealthFinding,
      configuredPluginInstallIssueToRepairEffect,
      detectConfiguredPluginInstallHealthIssues,
    } = await import("./missing-configured-plugin-install.js");
    const [issue] = await detectConfiguredPluginInstallHealthIssues({
      cfg: {
        plugins: {
          entries: {
            discord: { enabled: true },
          },
        },
        channels: {
          discord: { enabled: true },
        },
      },
      env: {
        MO_UPDATE_IN_PROGRESS: "1",
        MO_UPDATE_DEFER_CONFIGURED_PLUGIN_INSTALL_REPAIR: "1",
      },
    });

    expect(mocks.installPluginFromClawHub).not.toHaveBeenCalled();
    expect(mocks.installPluginFromNpmSpec).not.toHaveBeenCalled();
    expect(issue).toEqual({
      kind: "deferred-package-manager-repair",
      pluginId: "discord",
      installPath: missingDiscordPath,
    });
    expect(configuredPluginInstallIssueToHealthFinding(issue)).toMatchObject({
      checkId: "core/doctor/configured-plugin-installs",
      severity: "warning",
      path: missingDiscordPath,
      target: "discord",
    });
    expect(configuredPluginInstallIssueToRepairEffect(issue)).toEqual({
      kind: "package",
      action: "would-defer-configured-plugin-install-repair",
      target: "discord",
      dryRunSafe: true,
    });
  });

  it("reports one finding when a configured plugin record points at a missing package", async () => {
    const missingDiscordPath = path.resolve("/missing/discord");
    const records = {
      discord: {
        source: "npm",
        spec: "@mo/discord",
        installPath: missingDiscordPath,
      },
    };
    mocks.loadInstalledPluginIndexInstallRecords.mockResolvedValue(records);
    mocks.listChannelPluginCatalogEntries.mockReturnValue([
      {
        id: "discord",
        pluginId: "discord",
        meta: { label: "Discord" },
        install: {
          npmSpec: "@mo/discord",
        },
      },
    ]);

    const { detectConfiguredPluginInstallHealthIssues } =
      await import("./missing-configured-plugin-install.js");
    const issues = await detectConfiguredPluginInstallHealthIssues({
      cfg: {
        plugins: {
          entries: {
            discord: { enabled: true },
          },
        },
        channels: {
          discord: { enabled: true },
        },
      },
      env: {},
    });

    expect(issues).toEqual([
      {
        kind: "missing-installed-payload",
        pluginId: "discord",
        installPath: missingDiscordPath,
        installSpec: "@mo/discord",
      },
    ]);
  });

  it("installs a missing configured OpenClaw channel plugin from npm by default", async () => {
    mocks.listChannelPluginCatalogEntries.mockReturnValue([
      {
        id: "matrix",
        pluginId: "matrix",
        meta: { label: "Matrix" },
        install: {
          npmSpec: "@mo/plugin-matrix@1.2.3",
          expectedIntegrity: "sha512-test",
        },
        trustedSourceLinkedOfficialInstall: true,
      },
    ]);

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        channels: {
          matrix: { enabled: true, homeserver: "https://matrix.example.org" },
        },
      },
      env: {},
    });

    expect(mocks.installPluginFromClawHub).not.toHaveBeenCalled();
    expectRecordFields(mockCallArg(mocks.installPluginFromNpmSpec), {
      spec: "@mo/plugin-matrix@1.2.3",
      extensionsDir: "/tmp/mo-plugins",
      expectedPluginId: "matrix",
      expectedIntegrity: "sha512-test",
      trustedSourceLinkedOfficialInstall: true,
    });
    const records = mockCallArg(mocks.writePersistedInstalledPluginIndexInstallRecords);
    expectRecordFields((records as Record<string, unknown>).matrix, {
      source: "npm",
      spec: "@mo/plugin-matrix@1.2.3",
      installPath: "/tmp/mo-plugins/matrix",
      version: "1.2.3",
    });
    expect(mockCallArg(mocks.writePersistedInstalledPluginIndexInstallRecords, 0, 1)).toEqual({
      env: {},
    });
    expect(result.changes).toEqual([
      'Installed missing configured plugin "matrix" from @mo/plugin-matrix@1.2.3.',
    ]);
    expect(result.warnings).toStrictEqual([]);
  });

  it("uses an explicit ClawHub install spec before npm", async () => {
    const reviewNotice =
      "╭─ REVIEW RECOMMENDED - ClawHub has not completed a fresh clean check ─╮\n" +
      "│ • Status:            security scan is pending                         │\n" +
      "╰───────────────────────────────────────────────────────────────────────╯";
    const coloredReviewNotice = `\u001b[33m${reviewNotice}\u001b[39m`;
    mocks.installPluginFromClawHub.mockImplementationOnce(
      async (params: { logger?: { warn?: (message: string) => void } }) => {
        params.logger?.warn?.(coloredReviewNotice);
        return {
          ok: true,
          pluginId: "matrix",
          targetDir: "/tmp/mo-plugins/matrix",
          version: "1.2.3",
          clawhub: {
            source: "clawhub",
            clawhubUrl: "https://clawhub.ai",
            clawhubPackage: "@mo/plugin-matrix",
            clawhubFamily: "code-plugin",
            clawhubChannel: "official",
            version: "1.2.3",
            integrity: "sha256-clawhub",
            resolvedAt: "2026-05-01T00:00:00.000Z",
            clawpackSha256: "0".repeat(64),
            clawpackSpecVersion: 1,
            clawpackManifestSha256: "1".repeat(64),
            clawpackSize: 1234,
          },
        };
      },
    );
    mocks.listChannelPluginCatalogEntries.mockReturnValue([
      {
        id: "matrix",
        pluginId: "matrix",
        meta: { label: "Matrix" },
        install: {
          clawhubSpec: "clawhub:@mo/plugin-matrix@stable",
          npmSpec: "@mo/plugin-matrix@1.2.3",
          expectedIntegrity: "sha512-test",
        },
      },
    ]);

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        channels: {
          matrix: { enabled: true, homeserver: "https://matrix.example.org" },
        },
      },
      env: {},
    });

    const clawHubCall = expectRecordFields(mockCallArg(mocks.installPluginFromClawHub), {
      spec: "clawhub:@mo/plugin-matrix@stable",
      expectedPluginId: "matrix",
    });
    expect(clawHubCall.logger).toEqual(expect.objectContaining({ terminalLinks: false }));
    expect(mocks.installPluginFromNpmSpec).not.toHaveBeenCalled();
    expect(result.changes).toEqual([
      'Installed missing configured plugin "matrix" from clawhub:@mo/plugin-matrix@stable.',
    ]);
    expect(result.notices).toContain(reviewNotice);
    expect(result.notices?.[0]).not.toContain("\u001b");
    expect(result.warnings).toStrictEqual([]);
  });

  it("adds actionable acknowledgement guidance for risky ClawHub candidate failures", async () => {
    mocks.installPluginFromClawHub.mockResolvedValueOnce({
      ok: false,
      code: "clawhub_risk_acknowledgement_required",
      error:
        'ClawHub release "@mo/plugin-matrix@stable" has trust warnings. Review the package and rerun with --acknowledge-clawhub-risk to continue.',
    });
    mocks.listChannelPluginCatalogEntries.mockReturnValue([
      {
        id: "matrix",
        pluginId: "matrix",
        meta: { label: "Matrix" },
        install: {
          clawhubSpec: "clawhub:@mo/plugin-matrix@stable",
        },
      },
    ]);

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        channels: {
          matrix: { enabled: true, homeserver: "https://matrix.example.org" },
        },
      },
      env: {},
    });

    expect(result.warnings[0]).toContain(
      "mo plugins install clawhub:@mo/plugin-matrix@stable --acknowledge-clawhub-risk",
    );
  });

  it("adds repair warnings for blocked ClawHub update outcomes", async () => {
    const records = {
      demo: {
        source: "clawhub",
        spec: "clawhub:@mo/plugin-demo@stable",
        clawhubPackage: "@mo/plugin-demo",
        installPath: "/missing/demo",
      },
    };
    mocks.loadInstalledPluginIndexInstallRecords.mockResolvedValue(records);
    mocks.updateNpmInstalledPlugins.mockResolvedValueOnce({
      changed: false,
      config: {
        plugins: {
          installs: records,
        },
      },
      outcomes: [
        {
          pluginId: "demo",
          status: "skipped",
          code: "clawhub_download_blocked",
          message:
            'Skipped demo ClawHub update: ClawHub release "@mo/plugin-demo@1.2.4" cannot be installed because ClawHub flagged it as blocked or malicious. Review the security details above or choose a different version. Existing installed plugin left unchanged.',
        },
      ],
    });

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        plugins: {
          entries: {
            demo: { enabled: true },
          },
        },
      },
      env: {},
    });

    expect(mocks.updateNpmInstalledPlugins).toHaveBeenCalledWith(
      expect.objectContaining({
        pluginIds: ["demo"],
      }),
    );
    expect(result.changes).toStrictEqual([]);
    expect(result.warnings).toStrictEqual([
      'Skipped demo ClawHub update: ClawHub release "@mo/plugin-demo@1.2.4" cannot be installed because ClawHub flagged it as blocked or malicious. Review the security details above or choose a different version. Existing installed plugin left unchanged.',
    ]);
  });

  it("sanitizes and shell-quotes ClawHub acknowledgement guidance specs before rendering commands", async () => {
    mocks.installPluginFromClawHub.mockResolvedValueOnce({
      ok: false,
      code: "clawhub_risk_acknowledgement_required",
      error:
        'ClawHub release "@mo/plugin-matrix@stable" has trust warnings. Review the package and rerun with --acknowledge-clawhub-risk to continue.',
    });
    mocks.listChannelPluginCatalogEntries.mockReturnValue([
      {
        id: "matrix",
        pluginId: "matrix",
        meta: { label: "Matrix" },
        install: {
          clawhubSpec: "clawhub:@mo/plugin-matrix\n\u001b[31m@stable;$(touch /tmp/pwned)",
        },
      },
    ]);

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        channels: {
          matrix: { enabled: true, homeserver: "https://matrix.example.org" },
        },
      },
      env: {},
    });

    const warning = result.warnings[0] ?? "";
    expect(warning).toContain(
      "mo plugins install 'clawhub:@mo/plugin-matrix\\n@stable;$(touch /tmp/pwned)' --acknowledge-clawhub-risk",
    );
    expect(warning).not.toContain(
      "mo plugins install clawhub:@mo/plugin-matrix\\n@stable;$(touch /tmp/pwned) --acknowledge-clawhub-risk",
    );
    expect(warning).not.toContain("\u001b");
    expect(warning).not.toContain("plugin-matrix\n");
  });

  it("installs a missing channel plugin selected by environment config from npm", async () => {
    mocks.installPluginFromNpmSpec.mockResolvedValueOnce({
      ok: true,
      pluginId: "matrix",
      targetDir: "/tmp/mo-plugins/matrix",
      version: "1.2.3",
      npmResolution: {
        name: "@mo/plugin-matrix",
        version: "1.2.3",
        resolvedSpec: "@mo/plugin-matrix@1.2.3",
        integrity: "sha512-matrix",
        resolvedAt: "2026-05-01T00:00:00.000Z",
      },
    });
    mocks.listChannelPluginCatalogEntries.mockReturnValue([
      {
        id: "matrix",
        pluginId: "matrix",
        meta: { label: "Matrix" },
        install: {
          npmSpec: "@mo/plugin-matrix@1.2.3",
        },
        trustedSourceLinkedOfficialInstall: true,
      },
    ]);

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {},
      env: { MATRIX_HOMESERVER: "https://matrix.example.org" },
    });

    expect(mocks.installPluginFromClawHub).not.toHaveBeenCalled();
    expectRecordFields(mockCallArg(mocks.installPluginFromNpmSpec), {
      spec: "@mo/plugin-matrix@1.2.3",
      extensionsDir: "/tmp/mo-plugins",
      expectedPluginId: "matrix",
      trustedSourceLinkedOfficialInstall: true,
    });
    const records = mockCallArg(mocks.writePersistedInstalledPluginIndexInstallRecords);
    expectRecordFields((records as Record<string, unknown>).matrix, {
      source: "npm",
      spec: "@mo/plugin-matrix@1.2.3",
      installPath: "/tmp/mo-plugins/matrix",
    });
    expect(mockCallArg(mocks.writePersistedInstalledPluginIndexInstallRecords, 0, 1)).toEqual({
      env: { MATRIX_HOMESERVER: "https://matrix.example.org" },
    });
    expect(result.changes).toEqual([
      'Installed missing configured plugin "matrix" from @mo/plugin-matrix@1.2.3.',
    ]);
    expect(result.warnings).toStrictEqual([]);
  });

  it("falls back to npm when an OpenClaw channel plugin artifact is unavailable on ClawHub", async () => {
    mocks.installPluginFromClawHub.mockResolvedValueOnce({
      ok: false,
      code: "artifact_unavailable",
      error: "ClawHub artifact download is not available yet.",
    });
    mocks.listChannelPluginCatalogEntries.mockReturnValue([
      {
        id: "matrix",
        pluginId: "matrix",
        meta: { label: "Matrix" },
        install: {
          clawhubSpec: "clawhub:@mo/plugin-matrix@stable",
          npmSpec: "@mo/plugin-matrix@1.2.3",
        },
        trustedSourceLinkedOfficialInstall: true,
      },
    ]);

    const { repairMissingPluginInstallsForIds } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingPluginInstallsForIds({
      cfg: {},
      pluginIds: [],
      channelIds: ["matrix"],
      env: {},
    });

    expectRecordFields(mockCallArg(mocks.installPluginFromNpmSpec), {
      spec: "@mo/plugin-matrix@1.2.3",
      expectedPluginId: "matrix",
      trustedSourceLinkedOfficialInstall: true,
    });
    expect(result.changes).toEqual([
      'ClawHub clawhub:@mo/plugin-matrix@stable unavailable for "matrix"; falling back to npm @mo/plugin-matrix@1.2.3.',
      'Installed missing configured plugin "matrix" from @mo/plugin-matrix@1.2.3.',
    ]);
    expect(result.warnings).toStrictEqual([]);
  });

  it("does not fall back from ClawHub to non-OpenClaw npm packages", async () => {
    mocks.installPluginFromClawHub.mockResolvedValueOnce({
      ok: false,
      code: "artifact_download_unavailable",
      error: "ClawHub artifact download is not available yet.",
    });
    mocks.listChannelPluginCatalogEntries.mockReturnValue([
      {
        id: "matrix",
        pluginId: "matrix",
        meta: { label: "Matrix" },
        install: {
          clawhubSpec: "clawhub:@mo/plugin-matrix@stable",
          npmSpec: "@someone-else/plugin-matrix@1.2.3",
        },
      },
    ]);

    const { repairMissingPluginInstallsForIds } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingPluginInstallsForIds({
      cfg: {},
      pluginIds: [],
      channelIds: ["matrix"],
      env: {},
    });

    expect(mocks.installPluginFromNpmSpec).not.toHaveBeenCalled();
    expect(result.changes).toStrictEqual([]);
    expect(result.warnings).toEqual([
      'Failed to install missing configured plugin "matrix" from clawhub:@mo/plugin-matrix@stable: ClawHub artifact download is not available yet.',
    ]);
  });

  it("honors npm-first catalog metadata for missing OpenClaw channel plugins", async () => {
    mocks.installPluginFromNpmSpec.mockResolvedValueOnce({
      ok: true,
      pluginId: "twitch",
      targetDir: "/tmp/mo-plugins/twitch",
      version: "2026.5.2",
      npmResolution: {
        name: "@mo/twitch",
        version: "2026.5.2",
        resolvedSpec: "@mo/twitch@2026.5.2",
        integrity: "sha512-twitch",
        resolvedAt: "2026-05-01T00:00:00.000Z",
      },
    });
    mocks.listChannelPluginCatalogEntries.mockReturnValue([
      {
        id: "twitch",
        pluginId: "twitch",
        meta: { label: "Twitch" },
        install: {
          npmSpec: "@mo/twitch",
          defaultChoice: "npm",
        },
        trustedSourceLinkedOfficialInstall: true,
      },
    ]);

    const { repairMissingPluginInstallsForIds } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingPluginInstallsForIds({
      cfg: {},
      pluginIds: [],
      channelIds: ["twitch"],
      env: {},
    });

    expect(mocks.installPluginFromClawHub).not.toHaveBeenCalled();
    expectRecordFields(mockCallArg(mocks.installPluginFromNpmSpec), {
      spec: expectedNpmInstallSpec("@mo/twitch"),
      expectedPluginId: "twitch",
      trustedSourceLinkedOfficialInstall: true,
    });
    expect(result.changes).toEqual([
      `Installed missing configured plugin "twitch" from ${expectedNpmInstallSpec("@mo/twitch")}.`,
    ]);
  });

  it("installs missing configured non-channel plugins from the official external catalog", async () => {
    mocks.installPluginFromNpmSpec.mockResolvedValueOnce({
      ok: true,
      pluginId: "diagnostics-otel",
      targetDir: "/tmp/mo-plugins/diagnostics-otel",
      version: "2026.5.2",
      npmResolution: {
        name: "@mo/diagnostics-otel",
        version: "2026.5.2",
        resolvedSpec: "@mo/diagnostics-otel@2026.5.2",
        integrity: "sha512-otel",
        resolvedAt: "2026-05-01T00:00:00.000Z",
      },
    });
    mocks.listOfficialExternalPluginCatalogEntries.mockReturnValue([
      {
        id: "diagnostics-otel",
        label: "Diagnostics OpenTelemetry",
        install: {
          clawhubSpec: "clawhub:@mo/diagnostics-otel",
          npmSpec: "@mo/diagnostics-otel",
          defaultChoice: "npm",
        },
      },
    ]);

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        plugins: {
          entries: {
            "diagnostics-otel": { enabled: true },
          },
        },
      },
      env: {},
    });

    expect(mocks.installPluginFromClawHub).not.toHaveBeenCalled();
    expectRecordFields(mockCallArg(mocks.installPluginFromNpmSpec), {
      spec: expectedNpmInstallSpec("@mo/diagnostics-otel"),
      expectedPluginId: "diagnostics-otel",
    });
    expect(result.changes).toEqual([
      `Installed missing configured plugin "diagnostics-otel" from ${expectedNpmInstallSpec("@mo/diagnostics-otel")}.`,
    ]);
  });

  it("installs the official llama.cpp plugin for configured local memory embeddings", async () => {
    mocks.installPluginFromNpmSpec.mockResolvedValueOnce({
      ok: true,
      pluginId: "llama-cpp",
      targetDir: "/tmp/mo-plugins/llama-cpp",
      version: "2026.6.2",
      npmResolution: {
        name: "@mo/llama-cpp-provider",
        version: "2026.6.2",
        resolvedSpec: "@mo/llama-cpp-provider@2026.6.2",
        integrity: "sha512-llama",
        resolvedAt: "2026-06-08T00:00:00.000Z",
      },
    });
    mocks.listOfficialExternalPluginCatalogEntries.mockReturnValue([
      {
        id: "llama-cpp",
        label: "llama.cpp Provider",
        mo: {
          plugin: { id: "llama-cpp", label: "llama.cpp Provider" },
          contracts: { embeddingProviders: ["local"] },
          install: {
            npmSpec: "@mo/llama-cpp-provider",
            defaultChoice: "npm",
          },
        },
        install: {
          npmSpec: "@mo/llama-cpp-provider",
          defaultChoice: "npm",
        },
      },
    ]);

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        agents: {
          defaults: {
            memorySearch: {
              provider: "local",
            },
          },
        },
      },
      env: {},
    });

    expect(mocks.installPluginFromClawHub).not.toHaveBeenCalled();
    expectRecordFields(mockCallArg(mocks.installPluginFromNpmSpec), {
      spec: expectedNpmInstallSpec("@mo/llama-cpp-provider"),
      expectedPluginId: "llama-cpp",
    });
    expect(result.changes).toEqual([
      `Installed missing configured plugin "llama-cpp" from ${expectedNpmInstallSpec("@mo/llama-cpp-provider")}.`,
    ]);
  });

  it("does not let runtime fallback metadata override official catalog install specs", async () => {
    mocks.installPluginFromNpmSpec.mockResolvedValueOnce({
      ok: true,
      pluginId: "acpx",
      targetDir: "/tmp/mo-plugins/acpx",
      version: "2026.5.2-beta.2",
      npmResolution: {
        name: "@mo/acpx",
        version: "2026.5.2-beta.2",
        resolvedSpec: "@mo/acpx@2026.5.2-beta.2",
        integrity: "sha512-acpx",
        resolvedAt: "2026-05-01T00:00:00.000Z",
      },
    });
    mocks.listOfficialExternalPluginCatalogEntries.mockReturnValue([
      {
        id: "acpx",
        label: "ACPX Runtime",
        install: {
          npmSpec: "@mo/acpx",
          defaultChoice: "npm",
        },
      },
    ]);

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        acp: {
          backend: "acpx",
        },
      },
      env: {},
    });

    expectRecordFields(mockCallArg(mocks.installPluginFromNpmSpec), {
      spec: expectedNpmInstallSpec("@mo/acpx"),
      expectedPluginId: "acpx",
      trustedSourceLinkedOfficialInstall: true,
    });
    expect(result.changes).toEqual([
      `Installed missing configured plugin "acpx" from ${expectedNpmInstallSpec("@mo/acpx")}.`,
    ]);
  });

  it("does not install disabled configured plugin entries", async () => {
    mocks.listOfficialExternalPluginCatalogEntries.mockReturnValue([
      {
        id: "diagnostics-otel",
        label: "Diagnostics OpenTelemetry",
        install: {
          npmSpec: "@mo/diagnostics-otel",
          defaultChoice: "npm",
        },
      },
    ]);

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        plugins: {
          entries: {
            "diagnostics-otel": { enabled: false },
          },
        },
      },
      env: {},
    });

    expect(mocks.installPluginFromClawHub).not.toHaveBeenCalled();
    expect(mocks.installPluginFromNpmSpec).not.toHaveBeenCalled();
    expect(mocks.writePersistedInstalledPluginIndexInstallRecords).not.toHaveBeenCalled();
    expect(result).toEqual({ changes: [], warnings: [], records: {} });
  });

  it.each([
    ["enabled-only disabled stub", { channels: { matrix: { enabled: false } } }],
    [
      "disabled configured channel",
      { channels: { matrix: { enabled: false, homeserver: "https://matrix.example.org" } } },
    ],
  ])("does not install channel plugins for a %s", async (_label, cfg) => {
    mocks.listChannelPluginCatalogEntries.mockReturnValue([
      {
        id: "matrix",
        pluginId: "matrix",
        meta: { label: "Matrix" },
        install: {
          npmSpec: "@mo/plugin-matrix@1.2.3",
        },
      },
    ]);

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg,
      env: {},
    });

    expect(mocks.installPluginFromClawHub).not.toHaveBeenCalled();
    expect(mocks.installPluginFromNpmSpec).not.toHaveBeenCalled();
    expect(mocks.writePersistedInstalledPluginIndexInstallRecords).not.toHaveBeenCalled();
    expect(result).toEqual({ changes: [], warnings: [], records: {} });
  });

  it("does not install channel plugins when the matching plugin entry is disabled", async () => {
    mocks.listChannelPluginCatalogEntries.mockReturnValue([
      {
        id: "matrix",
        pluginId: "matrix",
        meta: { label: "Matrix" },
        install: {
          npmSpec: "@mo/plugin-matrix@1.2.3",
        },
      },
    ]);

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        plugins: {
          entries: {
            matrix: { enabled: false },
          },
        },
        channels: {
          matrix: { homeserver: "https://matrix.example.org" },
        },
      },
      env: {},
    });

    expect(mocks.installPluginFromClawHub).not.toHaveBeenCalled();
    expect(mocks.installPluginFromNpmSpec).not.toHaveBeenCalled();
    expect(mocks.writePersistedInstalledPluginIndexInstallRecords).not.toHaveBeenCalled();
    expect(result).toEqual({ changes: [], warnings: [], records: {} });
  });

  it("does not download configured channel plugins that are still bundled", async () => {
    mocks.listChannelPluginCatalogEntries.mockReturnValue([
      {
        id: "matrix",
        pluginId: "matrix",
        origin: "bundled",
        meta: { label: "Matrix" },
        install: {
          npmSpec: "@mo/matrix",
        },
      },
    ]);
    mocks.loadPluginMetadataSnapshot.mockReturnValue({
      plugins: [
        {
          id: "matrix",
          origin: "bundled",
          packageName: "@mo/matrix",
          channels: ["matrix"],
        },
      ],
      diagnostics: [],
    });

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        plugins: {
          entries: {
            matrix: { enabled: true },
          },
        },
        channels: {
          matrix: { enabled: true, homeserver: "https://matrix.example.org" },
        },
      },
      env: {},
    });

    expect(mocks.updateNpmInstalledPlugins).not.toHaveBeenCalled();
    expect(mocks.installPluginFromClawHub).not.toHaveBeenCalled();
    expect(mocks.installPluginFromNpmSpec).not.toHaveBeenCalled();
    expect(mocks.writePersistedInstalledPluginIndexInstallRecords).not.toHaveBeenCalled();
    expect(result).toEqual({ changes: [], warnings: [], records: {} });
  });

  it("removes stale managed install records when the configured plugin is bundled", async () => {
    const records = {
      matrix: {
        source: "npm",
        spec: "@mo/matrix",
        installPath: "/missing/matrix",
      },
    };
    mocks.loadInstalledPluginIndexInstallRecords.mockResolvedValue(records);
    mocks.listChannelPluginCatalogEntries.mockReturnValue([
      {
        id: "matrix",
        pluginId: "matrix",
        origin: "bundled",
        meta: { label: "Matrix" },
        install: {
          npmSpec: "@mo/matrix",
        },
      },
    ]);
    mocks.loadPluginMetadataSnapshot.mockReturnValue({
      plugins: [
        {
          id: "matrix",
          origin: "bundled",
          packageName: "@mo/matrix",
          channels: ["matrix"],
        },
      ],
      diagnostics: [
        {
          pluginId: "matrix",
          message: "manifest without channelConfigs metadata",
        },
      ],
    });

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        plugins: {
          entries: {
            matrix: { enabled: true },
          },
        },
        channels: {
          matrix: { enabled: true, homeserver: "https://matrix.example.org" },
        },
      },
      env: {},
    });

    expect(mocks.updateNpmInstalledPlugins).not.toHaveBeenCalled();
    expect(mocks.installPluginFromClawHub).not.toHaveBeenCalled();
    expect(mocks.installPluginFromNpmSpec).not.toHaveBeenCalled();
    expect(mocks.writePersistedInstalledPluginIndexInstallRecords).toHaveBeenCalledWith(
      {},
      {
        env: {},
      },
    );
    expect(result).toEqual({
      changes: ['Removed stale managed install record for bundled plugin "matrix".'],
      warnings: [],
      records: {},
    });
  });

  it("uses current bundled discovery to remove records before stale snapshots can reinstall official plugins", async () => {
    const records = {
      "google-meet": {
        source: "npm",
        spec: "@mo/google-meet",
        resolvedName: "@mo/google-meet",
        installPath: "/missing/google-meet",
      },
    };
    mocks.loadInstalledPluginIndexInstallRecords.mockResolvedValue(records);
    mocks.loadPluginMetadataSnapshot.mockReturnValue({
      plugins: [
        {
          id: "google-meet",
          origin: "npm",
          packageName: "@mo/google-meet",
        },
      ],
      diagnostics: [],
    });
    mocks.loadInstalledPluginIndex.mockReturnValue({
      plugins: [
        {
          pluginId: "google-meet",
          origin: "bundled",
          packageName: "@mo/google-meet",
        },
      ],
      diagnostics: [],
      installRecords: {},
    });
    mocks.listOfficialExternalPluginCatalogEntries.mockReturnValue([
      {
        id: "google-meet",
        label: "Google Meet",
        install: { npmSpec: "@mo/google-meet" },
        mo: {
          id: "google-meet",
          install: { npmSpec: "@mo/google-meet" },
        },
      },
    ]);

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        plugins: {
          entries: {
            "google-meet": { enabled: true },
          },
        },
      },
      env: {},
    });

    expect(mocks.installPluginFromNpmSpec).not.toHaveBeenCalled();
    expect(mocks.writePersistedInstalledPluginIndexInstallRecords).toHaveBeenCalledWith(
      {},
      {
        env: {},
      },
    );
    expect(result).toEqual({
      changes: ['Removed stale managed install record for bundled plugin "google-meet".'],
      warnings: [],
      records: {},
    });
  });

  it("removes stale bundled install records even when the plugin is not configured", async () => {
    const records = {
      "google-meet": {
        source: "npm",
        spec: "@mo/google-meet",
        resolvedName: "@mo/google-meet",
        installPath: "/missing/google-meet",
      },
    };
    mocks.loadInstalledPluginIndexInstallRecords.mockResolvedValue(records);
    mocks.loadPluginMetadataSnapshot.mockReturnValue({
      plugins: [],
      diagnostics: [],
    });
    mocks.loadInstalledPluginIndex.mockReturnValue({
      plugins: [
        {
          pluginId: "google-meet",
          origin: "bundled",
          packageName: "@mo/google-meet",
        },
      ],
      diagnostics: [],
      installRecords: {},
    });

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {},
      env: {},
    });

    expect(mocks.installPluginFromNpmSpec).not.toHaveBeenCalled();
    expect(mocks.writePersistedInstalledPluginIndexInstallRecords).toHaveBeenCalledWith(
      {},
      {
        env: {},
      },
    );
    expect(result).toEqual({
      changes: ['Removed stale managed install record for bundled plugin "google-meet".'],
      warnings: [],
      records: {},
    });
  });

  it.each([
    [
      "npm",
      {
        source: "npm",
        spec: "@mo/matrix-fork",
        resolvedName: "@mo/matrix-fork",
        resolvedSpec: "@mo/matrix-fork@1.2.3",
        installPath: "/missing/matrix-fork",
      },
    ],
    [
      "clawhub",
      {
        source: "clawhub",
        spec: "clawhub:@mo/matrix-fork@stable",
        clawhubPackage: "@mo/matrix-fork",
        installPath: "/missing/matrix-fork",
      },
    ],
  ])(
    "keeps %s install records whose package names only share a bundled prefix",
    async (_, record) => {
      const records = { matrix: record };
      mocks.loadInstalledPluginIndexInstallRecords.mockResolvedValue(records);
      mocks.listChannelPluginCatalogEntries.mockReturnValue([
        {
          id: "matrix",
          pluginId: "matrix",
          origin: "bundled",
          meta: { label: "Matrix" },
          install: {
            npmSpec: "@mo/matrix",
          },
        },
      ]);
      mocks.loadPluginMetadataSnapshot.mockReturnValue({
        plugins: [
          {
            id: "matrix",
            origin: "bundled",
            packageName: "@mo/matrix",
            channels: ["matrix"],
          },
        ],
        diagnostics: [
          {
            pluginId: "matrix",
            message: "manifest without channelConfigs metadata",
          },
        ],
      });

      const { repairMissingConfiguredPluginInstalls } =
        await import("./missing-configured-plugin-install.js");
      const result = await repairMissingConfiguredPluginInstalls({
        cfg: {
          plugins: {
            entries: {
              matrix: { enabled: true },
            },
          },
          channels: {
            matrix: { enabled: true, homeserver: "https://matrix.example.org" },
          },
        },
        env: {},
      });

      expect(mocks.updateNpmInstalledPlugins).not.toHaveBeenCalled();
      expect(mocks.installPluginFromClawHub).not.toHaveBeenCalled();
      expect(mocks.installPluginFromNpmSpec).not.toHaveBeenCalled();
      expect(mocks.writePersistedInstalledPluginIndexInstallRecords).not.toHaveBeenCalled();
      expect(result).toEqual({ changes: [], warnings: [], records });
    },
  );

  it("defers missing external payload repair during the package update doctor pass", async () => {
    const records = {
      discord: {
        source: "npm",
        spec: "@mo/discord",
        installPath: "/missing/discord",
      },
    };
    mocks.loadInstalledPluginIndexInstallRecords.mockResolvedValue(records);
    mocks.listChannelPluginCatalogEntries.mockReturnValue([
      {
        id: "discord",
        pluginId: "discord",
        meta: { label: "Discord" },
        install: {
          npmSpec: "@mo/discord",
        },
      },
    ]);

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        plugins: {
          entries: {
            discord: { enabled: true },
          },
        },
        channels: {
          discord: { enabled: true },
        },
      },
      env: {
        MO_UPDATE_IN_PROGRESS: "1",
        MO_UPDATE_DEFER_CONFIGURED_PLUGIN_INSTALL_REPAIR: "1",
      },
    });

    expect(mocks.updateNpmInstalledPlugins).not.toHaveBeenCalled();
    expect(mocks.installPluginFromClawHub).not.toHaveBeenCalled();
    expect(mocks.installPluginFromNpmSpec).not.toHaveBeenCalled();
    expect(mocks.writePersistedInstalledPluginIndexInstallRecords).not.toHaveBeenCalled();
    expect(result).toEqual({
      changes: [
        'Skipped package-manager repair for configured plugin "discord" during package update; rerun "mo doctor --fix" after the update completes.',
      ],
      warnings: [],
      deferredRepairDetails: [
        'Skipped package-manager repair for configured plugin "discord" during package update; rerun "mo doctor --fix" after the update completes.',
      ],
      records,
    });
  });

  it("updates an existing npm target when stale baseline records miss an installed package", async () => {
    const npmRoot = makeTempDir();
    const packageDir = path.join(npmRoot, "node_modules", "@mo", "discord");
    fs.mkdirSync(packageDir, { recursive: true });
    mocks.resolveDefaultPluginNpmDir.mockReturnValue(npmRoot);
    mocks.listChannelPluginCatalogEntries.mockReturnValue([
      {
        id: "discord",
        pluginId: "discord",
        meta: { label: "Discord" },
        install: {
          npmSpec: "@mo/discord",
        },
      },
    ]);
    mocks.installPluginFromNpmSpec.mockResolvedValue({
      ok: true,
      pluginId: "discord",
      targetDir: packageDir,
      version: "1.2.3",
      npmResolution: {
        name: "@mo/discord",
        version: "1.2.3",
        resolvedSpec: "@mo/discord@1.2.3",
        integrity: "sha512-discord",
        resolvedAt: "2026-05-01T00:00:00.000Z",
      },
    });

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        plugins: {
          entries: {
            discord: { enabled: true },
          },
        },
        channels: {
          discord: { enabled: true },
        },
      },
      env: {
        MO_UPDATE_POST_CORE_CONVERGENCE: "1",
      },
    });

    expect(mocks.installPluginFromClawHub).not.toHaveBeenCalled();
    expectRecordFields(mockCallArg(mocks.installPluginFromNpmSpec), {
      spec: expectedNpmInstallSpec("@mo/discord"),
      expectedPluginId: "discord",
      npmDir: npmRoot,
      mode: "update",
    });
    expect(result.changes).toEqual([
      `Installed missing configured plugin "discord" from ${expectedNpmInstallSpec("@mo/discord")}.`,
    ]);
    expect(result.warnings).toEqual([]);
    expect(result.records.discord?.installPath).toBe(packageDir);
  });

  it("retries npm repair as an update when the install target appears stale", async () => {
    const npmRoot = makeTempDir();
    const packageDir = path.join(npmRoot, "node_modules", "@mo", "discord");
    mocks.resolveDefaultPluginNpmDir.mockReturnValue(npmRoot);
    mocks.listChannelPluginCatalogEntries.mockReturnValue([
      {
        id: "discord",
        pluginId: "discord",
        meta: { label: "Discord" },
        install: {
          npmSpec: "@mo/discord",
        },
      },
    ]);
    mocks.installPluginFromNpmSpec
      .mockResolvedValueOnce({
        ok: false,
        error: `plugin already exists: ${packageDir} (delete it first)`,
      })
      .mockResolvedValueOnce({
        ok: true,
        pluginId: "discord",
        targetDir: packageDir,
        version: "1.2.3",
        npmResolution: {
          name: "@mo/discord",
          version: "1.2.3",
          resolvedSpec: "@mo/discord@1.2.3",
          integrity: "sha512-discord",
          resolvedAt: "2026-05-01T00:00:00.000Z",
        },
      });

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        plugins: {
          entries: {
            discord: { enabled: true },
          },
        },
      },
      env: {
        MO_UPDATE_POST_CORE_CONVERGENCE: "1",
      },
    });

    expect(mocks.installPluginFromNpmSpec).toHaveBeenCalledTimes(2);
    expectRecordFields(mockCallArg(mocks.installPluginFromNpmSpec, 0), {
      spec: expectedNpmInstallSpec("@mo/discord"),
      npmDir: npmRoot,
      mode: "install",
    });
    expectRecordFields(mockCallArg(mocks.installPluginFromNpmSpec, 1), {
      spec: expectedNpmInstallSpec("@mo/discord"),
      npmDir: npmRoot,
      mode: "update",
    });
    expect(result.warnings).toEqual([]);
    expect(result.records.discord?.installPath).toBe(packageDir);
  });

  it("prefers an existing npm payload over ClawHub during post-core repair", async () => {
    const npmRoot = makeTempDir();
    const packageDir = path.join(npmRoot, "node_modules", "@mo", "matrix");
    fs.mkdirSync(packageDir, { recursive: true });
    fs.writeFileSync(
      path.join(packageDir, "package.json"),
      JSON.stringify({ name: "@mo/matrix", version: "1.2.3" }),
    );
    mocks.resolveDefaultPluginNpmDir.mockReturnValue(npmRoot);
    mocks.listChannelPluginCatalogEntries.mockReturnValue([
      {
        id: "matrix",
        pluginId: "matrix",
        meta: { label: "Matrix" },
        install: {
          clawhubSpec: "clawhub:@mo/matrix",
          npmSpec: "@mo/matrix",
        },
      },
    ]);
    mocks.installPluginFromClawHub.mockResolvedValue({
      ok: false,
      error: 'Plugin "@mo/matrix" requires plugin API >=2026.5.18.',
    });
    mocks.installPluginFromNpmSpec.mockResolvedValue({
      ok: true,
      pluginId: "matrix",
      targetDir: packageDir,
      version: "1.2.3",
      npmResolution: {
        name: "@mo/matrix",
        version: "1.2.3",
        resolvedSpec: "@mo/matrix@1.2.3",
        integrity: "sha512-matrix",
        resolvedAt: "2026-05-01T00:00:00.000Z",
      },
    });

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        plugins: {
          entries: {
            matrix: { enabled: true },
          },
        },
        channels: {
          matrix: { enabled: true },
        },
      },
      env: {
        MO_UPDATE_POST_CORE_CONVERGENCE: "1",
      },
    });

    expect(mocks.installPluginFromClawHub).not.toHaveBeenCalled();
    expect(mocks.installPluginFromNpmSpec).not.toHaveBeenCalled();
    expect(result.warnings).toEqual([]);
    expectRecordFields(result.records.matrix, {
      source: "npm",
      spec: "@mo/matrix",
      installPath: packageDir,
      version: "1.2.3",
      resolvedName: "@mo/matrix",
      resolvedVersion: "1.2.3",
      resolvedSpec: "@mo/matrix@1.2.3",
    });
  });

  it("passes the post-core compatibility host version to ClawHub repair", async () => {
    const npmRoot = makeTempDir();
    mocks.resolveDefaultPluginNpmDir.mockReturnValue(npmRoot);
    mocks.listChannelPluginCatalogEntries.mockReturnValue([
      {
        id: "whatsapp",
        pluginId: "whatsapp",
        meta: { label: "WhatsApp" },
        install: {
          clawhubSpec: "clawhub:@mo/whatsapp",
          npmSpec: "@mo/whatsapp",
        },
      },
    ]);
    mocks.installPluginFromClawHub.mockResolvedValue({
      ok: true,
      pluginId: "whatsapp",
      targetDir: "/tmp/mo-plugins/whatsapp",
      version: "1.2.3",
      clawhub: {
        source: "clawhub",
        clawhubUrl: "https://clawhub.ai",
        clawhubPackage: "@mo/whatsapp",
        clawhubFamily: "code-plugin",
        clawhubChannel: "official",
        version: "1.2.3",
        integrity: "sha256-whatsapp",
        resolvedAt: "2026-05-01T00:00:00.000Z",
        clawpackSha256: "2".repeat(64),
        clawpackSpecVersion: 1,
        clawpackManifestSha256: "3".repeat(64),
        clawpackSize: 1234,
      },
    });

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        plugins: {
          entries: {
            whatsapp: { enabled: true },
          },
        },
        channels: {
          whatsapp: { enabled: true },
        },
      },
      env: {
        MO_COMPATIBILITY_HOST_VERSION: "2026.5.19",
        MO_UPDATE_POST_CORE_CONVERGENCE: "1",
      },
    });

    expectRecordFields(mockCallArg(mocks.installPluginFromClawHub), {
      spec: expectedClawHubInstallSpec("clawhub:@mo/whatsapp"),
      env: {
        MO_COMPATIBILITY_HOST_VERSION: "2026.5.19",
        MO_UPDATE_POST_CORE_CONVERGENCE: "1",
      },
      mode: "install",
    });
    expect(mocks.installPluginFromNpmSpec).not.toHaveBeenCalled();
    expect(result.warnings).toEqual([]);
    expectRecordFields(result.records.whatsapp, {
      source: "clawhub",
      spec: "clawhub:@mo/whatsapp",
      installPath: "/tmp/mo-plugins/whatsapp",
      clawhubPackage: "@mo/whatsapp",
    });
  });

  it("repairs missing external payload during post-core convergence even with MO_UPDATE_IN_PROGRESS=1", async () => {
    const records = {
      discord: {
        source: "npm",
        spec: "@mo/discord",
        installPath: "/missing/discord",
      },
    };
    mocks.loadInstalledPluginIndexInstallRecords.mockResolvedValue(records);
    mocks.listChannelPluginCatalogEntries.mockReturnValue([
      {
        id: "discord",
        pluginId: "discord",
        meta: { label: "Discord" },
        install: { npmSpec: "@mo/discord" },
      },
    ]);
    mocks.updateNpmInstalledPlugins.mockResolvedValue({
      config: {
        plugins: {
          installs: { discord: { source: "npm", installPath: "/repaired/discord" } },
        },
      },
      changed: true,
      outcomes: [{ pluginId: "discord", status: "updated", message: "ok" }],
    });

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        plugins: {
          entries: { discord: { enabled: true } },
        },
        channels: {
          discord: { enabled: true },
        },
      },
      env: {
        MO_UPDATE_IN_PROGRESS: "1",
        MO_UPDATE_POST_CORE_CONVERGENCE: "1",
      },
    });

    expect(mocks.updateNpmInstalledPlugins).toHaveBeenCalledTimes(1);
    expect(result.warnings).toEqual([]);
    expect(result.changes[0]).toBe('Repaired missing configured plugin "discord".');
    expectRecordFields(result.records.discord, {
      source: "npm",
      installPath: "/repaired/discord",
    });
  });

  it("defers channel-selected external payload repair during the package update doctor pass", async () => {
    const records = {
      discord: {
        source: "npm",
        spec: "@mo/discord",
        installPath: "/missing/discord",
      },
    };
    mocks.loadInstalledPluginIndexInstallRecords.mockResolvedValue(records);
    mocks.listChannelPluginCatalogEntries.mockReturnValue([
      {
        id: "discord",
        pluginId: "discord",
        meta: { label: "Discord" },
        install: {
          npmSpec: "@mo/discord",
        },
      },
    ]);

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        channels: {
          discord: { enabled: true, token: "secret" },
        },
      },
      env: {
        MO_UPDATE_IN_PROGRESS: "1",
        MO_UPDATE_DEFER_CONFIGURED_PLUGIN_INSTALL_REPAIR: "1",
      },
    });

    expect(mocks.updateNpmInstalledPlugins).not.toHaveBeenCalled();
    expect(mocks.installPluginFromClawHub).not.toHaveBeenCalled();
    expect(mocks.installPluginFromNpmSpec).not.toHaveBeenCalled();
    expect(mocks.writePersistedInstalledPluginIndexInstallRecords).not.toHaveBeenCalled();
    expect(result).toEqual({
      changes: [
        'Skipped package-manager repair for configured plugin "discord" during package update; rerun "mo doctor --fix" after the update completes.',
      ],
      warnings: [],
      deferredRepairDetails: [
        'Skipped package-manager repair for configured plugin "discord" during package update; rerun "mo doctor --fix" after the update completes.',
      ],
      records,
    });
  });

  it("does not install channel-selected external plugins during an opted-in package update doctor pass", async () => {
    mocks.listChannelPluginCatalogEntries.mockReturnValue([
      {
        id: "discord",
        pluginId: "discord",
        meta: { label: "Discord" },
        install: {
          npmSpec: "@mo/discord",
        },
      },
    ]);

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        channels: {
          discord: { enabled: true, token: "secret" },
        },
      },
      env: {
        MO_UPDATE_IN_PROGRESS: "1",
        MO_UPDATE_DEFER_CONFIGURED_PLUGIN_INSTALL_REPAIR: "1",
      },
    });

    expect(mocks.updateNpmInstalledPlugins).not.toHaveBeenCalled();
    expect(mocks.installPluginFromClawHub).not.toHaveBeenCalled();
    expect(mocks.installPluginFromNpmSpec).not.toHaveBeenCalled();
    expect(mocks.writePersistedInstalledPluginIndexInstallRecords).not.toHaveBeenCalled();
    expect(result).toEqual({ changes: [], warnings: [], records: {} });
  });

  it("installs channel-selected external plugins during a legacy package update doctor pass", async () => {
    mocks.installPluginFromNpmSpec.mockResolvedValueOnce({
      ok: true,
      pluginId: "discord",
      targetDir: "/tmp/mo-plugins/discord",
      version: "2026.5.17",
      npmResolution: {
        name: "@mo/discord",
        version: "2026.5.17",
        resolvedSpec: "@mo/discord@2026.5.17",
        integrity: "sha512-discord",
        resolvedAt: "2026-05-17T00:00:00.000Z",
      },
    });
    mocks.listChannelPluginCatalogEntries.mockReturnValue([
      {
        id: "discord",
        pluginId: "discord",
        meta: { label: "Discord" },
        install: {
          npmSpec: "@mo/discord",
        },
      },
    ]);

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        channels: {
          discord: { enabled: true, token: "secret" },
        },
      },
      env: {
        MO_UPDATE_IN_PROGRESS: "1",
      },
    });

    expect(mocks.installPluginFromNpmSpec).toHaveBeenCalledTimes(1);
    expect(result.changes).toEqual([
      `Installed missing configured plugin "discord" from ${expectedNpmInstallSpec("@mo/discord")}.`,
    ]);
    expectRecordFields(result.records.discord, {
      source: "npm",
      installPath: "/tmp/mo-plugins/discord",
    });
  });

  it("prefers npm over ClawHub during a legacy package update doctor pass", async () => {
    mocks.installPluginFromNpmSpec.mockResolvedValueOnce({
      ok: true,
      pluginId: "whatsapp",
      targetDir: "/tmp/mo-plugins/whatsapp",
      version: "2026.5.17",
      npmResolution: {
        name: "@mo/whatsapp",
        version: "2026.5.17",
        resolvedSpec: "@mo/whatsapp@2026.5.17",
        integrity: "sha512-whatsapp",
        resolvedAt: "2026-05-17T00:00:00.000Z",
      },
    });
    mocks.listChannelPluginCatalogEntries.mockReturnValue([
      {
        id: "whatsapp",
        pluginId: "whatsapp",
        meta: { label: "WhatsApp" },
        install: {
          clawhubSpec: "clawhub:@mo/whatsapp",
          npmSpec: "@mo/whatsapp",
          defaultChoice: "clawhub",
        },
      },
    ]);

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        channels: {
          whatsapp: { enabled: true, allowFrom: ["+15555550123"] },
        },
      },
      env: {
        MO_UPDATE_IN_PROGRESS: "1",
      },
    });

    expect(mocks.installPluginFromClawHub).not.toHaveBeenCalled();
    expectRecordFields(mockCallArg(mocks.installPluginFromNpmSpec), {
      spec: expectedNpmInstallSpec("@mo/whatsapp"),
      expectedPluginId: "whatsapp",
    });
    expect(result.changes).toEqual([
      `Installed missing configured plugin "whatsapp" from ${expectedNpmInstallSpec("@mo/whatsapp")}.`,
    ]);
    expectRecordFields(result.records.whatsapp, {
      source: "npm",
      installPath: "/tmp/mo-plugins/whatsapp",
    });
  });

  it("keeps ClawHub-only candidates available during a legacy package update doctor pass", async () => {
    mocks.listChannelPluginCatalogEntries.mockReturnValue([
      {
        id: "matrix",
        pluginId: "matrix",
        meta: { label: "Matrix" },
        install: {
          clawhubSpec: "clawhub:@mo/plugin-matrix@stable",
          defaultChoice: "clawhub",
        },
      },
    ]);

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        channels: {
          matrix: { enabled: true, homeserver: "https://matrix.example.org" },
        },
      },
      env: {
        MO_UPDATE_IN_PROGRESS: "1",
      },
    });

    expectRecordFields(mockCallArg(mocks.installPluginFromClawHub), {
      spec: "clawhub:@mo/plugin-matrix@stable",
      expectedPluginId: "matrix",
    });
    expect(mocks.installPluginFromNpmSpec).not.toHaveBeenCalled();
    expect(result.changes).toEqual([
      'Installed missing configured plugin "matrix" from clawhub:@mo/plugin-matrix@stable.',
    ]);
  });

  it("does not install configured plugins when plugins are globally disabled", async () => {
    mocks.listChannelPluginCatalogEntries.mockReturnValue([
      {
        id: "matrix",
        pluginId: "matrix",
        meta: { label: "Matrix" },
        install: {
          npmSpec: "@mo/plugin-matrix@1.2.3",
        },
      },
    ]);
    mocks.listOfficialExternalPluginCatalogEntries.mockReturnValue([
      {
        id: "codex",
        label: "Codex",
        install: {
          npmSpec: "@mo/codex",
          defaultChoice: "npm",
        },
      },
      {
        id: "diagnostics-otel",
        label: "Diagnostics OpenTelemetry",
        install: {
          npmSpec: "@mo/diagnostics-otel",
          defaultChoice: "npm",
        },
      },
    ]);

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        plugins: {
          enabled: false,
          entries: {
            "diagnostics-otel": { enabled: true },
          },
        },
        channels: {
          matrix: { homeserver: "https://matrix.example.org" },
        },
        agents: {
          defaults: {
            agentRuntime: { id: "codex" },
          },
        },
      },
      env: {},
    });

    expect(mocks.installPluginFromClawHub).not.toHaveBeenCalled();
    expect(mocks.installPluginFromNpmSpec).not.toHaveBeenCalled();
    expect(mocks.writePersistedInstalledPluginIndexInstallRecords).not.toHaveBeenCalled();
    expect(result).toEqual({ changes: [], warnings: [], records: {} });
  });

  it("does not install plugins merely listed in plugins.allow", async () => {
    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        plugins: {
          allow: ["codex"],
        },
      },
      env: {},
    });

    expect(mocks.installPluginFromNpmSpec).not.toHaveBeenCalled();
    expect(mocks.writePersistedInstalledPluginIndexInstallRecords).not.toHaveBeenCalled();
    expect(result).toEqual({ changes: [], warnings: [], records: {} });
  });

  it("installs a missing third-party downloadable plugin from npm only", async () => {
    mocks.installPluginFromNpmSpec.mockResolvedValueOnce({
      ok: true,
      pluginId: "wecom",
      targetDir: "/tmp/mo-plugins/wecom",
      version: "2026.4.23",
      npmResolution: {
        name: "@wecom/wecom-mo-plugin",
        version: "2026.4.23",
        resolvedSpec: "@wecom/wecom-mo-plugin@2026.4.23",
        integrity: "sha512-third-party",
        resolvedAt: "2026-05-01T00:00:00.000Z",
      },
    });
    mocks.listChannelPluginCatalogEntries.mockReturnValue([
      {
        id: "wecom",
        pluginId: "wecom",
        meta: { label: "WeCom" },
        install: {
          npmSpec: "@wecom/wecom-mo-plugin@2026.4.23",
        },
      },
    ]);

    const { repairMissingPluginInstallsForIds } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingPluginInstallsForIds({
      cfg: {},
      pluginIds: [],
      channelIds: ["wecom"],
      env: {},
    });

    expect(mocks.installPluginFromClawHub).not.toHaveBeenCalled();
    const installArg = mockCallArg(mocks.installPluginFromNpmSpec);
    expectRecordFields(installArg, {
      spec: "@wecom/wecom-mo-plugin@2026.4.23",
      expectedPluginId: "wecom",
    });
    expect(installArg).not.toHaveProperty("trustedSourceLinkedOfficialInstall", true);
    expect(result.changes).toEqual([
      'Installed missing configured plugin "wecom" from @wecom/wecom-mo-plugin@2026.4.23.',
    ]);
  });

  it("installs a missing default Codex runtime plugin from the official external catalog", async () => {
    mocks.installPluginFromNpmSpec.mockResolvedValueOnce({
      ok: true,
      pluginId: "codex",
      targetDir: "/tmp/mo-plugins/codex",
      version: "2026.5.2",
      npmResolution: {
        name: "@mo/codex",
        version: "2026.5.2",
        resolvedSpec: "@mo/codex@2026.5.2",
        integrity: "sha512-codex",
        resolvedAt: "2026-05-01T00:00:00.000Z",
      },
    });
    mocks.listOfficialExternalPluginCatalogEntries.mockReturnValue([
      {
        id: "codex",
        label: "Codex",
        install: {
          npmSpec: "@mo/codex",
          defaultChoice: "npm",
        },
      },
    ]);

    const { repairMissingPluginInstallsForIds } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingPluginInstallsForIds({
      cfg: {
        agents: {
          defaults: {
            model: "openai/gpt-5.4",
            agentRuntime: { id: "codex" },
          },
        },
      },
      pluginIds: ["codex"],
      env: {},
    });

    expect(mocks.resolveProviderInstallCatalogEntries).toHaveBeenCalled();
    expectRecordFields(mockCallArg(mocks.installPluginFromNpmSpec), {
      spec: expectedNpmInstallSpec("@mo/codex"),
      expectedPluginId: "codex",
      trustedSourceLinkedOfficialInstall: true,
    });
    const records = mockCallArg(mocks.writePersistedInstalledPluginIndexInstallRecords);
    expectRecordFields((records as Record<string, unknown>).codex, {
      source: "npm",
      spec: "@mo/codex@2026.5.2",
      installPath: "/tmp/mo-plugins/codex",
      version: "2026.5.2",
    });
    expect(mockCallArg(mocks.writePersistedInstalledPluginIndexInstallRecords, 0, 1)).toEqual({
      env: {},
    });
    expect(result.changes).toEqual([
      `Installed missing configured plugin "codex" from ${expectedNpmInstallSpec("@mo/codex")}.`,
    ]);
    expect(result.warnings).toStrictEqual([]);
  });

  it("refreshes a stale managed Codex runtime plugin selected by the OpenAI Codex route", async () => {
    const installDir = makeTempDir();
    fs.writeFileSync(
      path.join(installDir, "package.json"),
      JSON.stringify({ name: "@mo/codex", version: "2026.5.6" }),
    );
    const records = {
      codex: {
        source: "npm",
        spec: "@mo/codex",
        resolvedName: "@mo/codex",
        resolvedSpec: "@mo/codex@2026.5.6",
        resolvedVersion: "2026.5.6",
        version: "2026.5.6",
        integrity: "sha512-old-codex",
        installPath: installDir,
      },
    };
    mocks.loadInstalledPluginIndexInstallRecords.mockResolvedValue(records);
    mocks.loadPluginMetadataSnapshot.mockReturnValue({
      plugins: [
        {
          id: "codex",
          packageVersion: "2026.5.6",
          providers: ["codex"],
        },
      ],
      diagnostics: [],
      byPluginId: new Map([
        [
          "codex",
          {
            id: "codex",
            packageVersion: "2026.5.6",
            providers: ["codex"],
          },
        ],
      ]),
    });
    mocks.installPluginFromNpmSpec.mockResolvedValueOnce({
      ok: true,
      pluginId: "codex",
      targetDir: "/tmp/mo-plugins/codex",
      version: VERSION,
      npmResolution: {
        name: "@mo/codex",
        version: VERSION,
        resolvedSpec: `@mo/codex@${VERSION}`,
        integrity: "sha512-new-codex",
        resolvedAt: "2026-05-01T00:00:00.000Z",
      },
    });
    mocks.listOfficialExternalPluginCatalogEntries.mockReturnValue([
      {
        id: "codex",
        label: "Codex",
        install: {
          npmSpec: "@mo/codex",
          defaultChoice: "npm",
        },
      },
    ]);

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        agents: {
          defaults: {
            model: "openai/gpt-5.5",
          },
        },
      },
      env: {},
    });

    expect(mocks.updateNpmInstalledPlugins).not.toHaveBeenCalled();
    expectRecordFields(mockCallArg(mocks.installPluginFromNpmSpec), {
      spec: expectedNpmInstallSpec("@mo/codex"),
      expectedPluginId: "codex",
      trustedSourceLinkedOfficialInstall: true,
      mode: "update",
    });
    expect(result.changes).toEqual([
      `Refreshed stale configured plugin "codex" from ${expectedNpmInstallSpec("@mo/codex")}.`,
    ]);
    expectRecordFields(result.records.codex, {
      source: "npm",
      spec: `@mo/codex@${VERSION}`,
      installPath: "/tmp/mo-plugins/codex",
      version: VERSION,
      resolvedName: "@mo/codex",
      resolvedVersion: VERSION,
      resolvedSpec: `@mo/codex@${VERSION}`,
    });
  });

  it("does not refresh a converged beta Codex runtime plugin on the second doctor pass", async () => {
    const codexBetaVersion = `${currentOpenClawReleaseBase()}-beta.4`;
    const installDir = makeTempDir();
    fs.writeFileSync(
      path.join(installDir, "package.json"),
      JSON.stringify({ name: "@mo/codex", version: "2026.5.6" }),
    );
    const records = {
      codex: {
        source: "npm",
        spec: "@mo/codex",
        resolvedName: "@mo/codex",
        resolvedSpec: "@mo/codex@2026.5.6",
        resolvedVersion: "2026.5.6",
        version: "2026.5.6",
        integrity: "sha512-old-codex",
        installPath: installDir,
      },
    };
    mocks.loadInstalledPluginIndexInstallRecords.mockResolvedValue(records);
    mocks.loadPluginMetadataSnapshot.mockReturnValue({
      plugins: [
        {
          id: "codex",
          packageVersion: "2026.5.6",
          providers: ["codex"],
        },
      ],
      diagnostics: [],
      byPluginId: new Map([
        [
          "codex",
          {
            id: "codex",
            packageVersion: "2026.5.6",
            providers: ["codex"],
          },
        ],
      ]),
    });
    mocks.installPluginFromNpmSpec.mockResolvedValueOnce({
      ok: true,
      pluginId: "codex",
      targetDir: installDir,
      version: codexBetaVersion,
      npmResolution: {
        name: "@mo/codex",
        version: codexBetaVersion,
        resolvedSpec: `@mo/codex@${codexBetaVersion}`,
        integrity: "sha512-new-codex-beta",
        resolvedAt: "2026-05-01T00:00:00.000Z",
      },
    });
    mocks.listOfficialExternalPluginCatalogEntries.mockReturnValue([
      {
        id: "codex",
        label: "Codex",
        install: {
          npmSpec: "@mo/codex",
          defaultChoice: "npm",
        },
      },
    ]);

    const cfg = {
      update: { channel: "beta" as const },
      agents: {
        defaults: {
          model: "openai/gpt-5.5",
        },
      },
    };
    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const firstPass = await repairMissingConfiguredPluginInstalls({
      cfg,
      env: {},
    });

    expectRecordFields(mockCallArg(mocks.installPluginFromNpmSpec), {
      spec: "@mo/codex@beta",
      expectedPluginId: "codex",
      trustedSourceLinkedOfficialInstall: true,
      mode: "update",
    });
    expect(firstPass.changes).toEqual([
      'Refreshed stale configured plugin "codex" from @mo/codex@beta.',
    ]);
    expectRecordFields(firstPass.records.codex, {
      source: "npm",
      spec: `@mo/codex@${codexBetaVersion}`,
      installPath: installDir,
      version: codexBetaVersion,
      resolvedName: "@mo/codex",
      resolvedVersion: codexBetaVersion,
      resolvedSpec: `@mo/codex@${codexBetaVersion}`,
    });

    mocks.installPluginFromNpmSpec.mockClear();
    mocks.writePersistedInstalledPluginIndexInstallRecords.mockClear();
    mocks.loadInstalledPluginIndexInstallRecords.mockResolvedValueOnce(firstPass.records);
    mocks.loadPluginMetadataSnapshot.mockReturnValue({
      plugins: [
        {
          id: "codex",
          packageVersion: codexBetaVersion,
          providers: ["codex"],
        },
      ],
      diagnostics: [],
      byPluginId: new Map([
        [
          "codex",
          {
            id: "codex",
            packageVersion: codexBetaVersion,
            providers: ["codex"],
          },
        ],
      ]),
    });

    const secondPass = await repairMissingConfiguredPluginInstalls({
      cfg,
      env: {},
    });

    expect(mocks.installPluginFromNpmSpec).not.toHaveBeenCalled();
    expect(mocks.writePersistedInstalledPluginIndexInstallRecords).not.toHaveBeenCalled();
    expect(secondPass).toEqual({ changes: [], warnings: [], records: firstPass.records });
  });

  it("does not downgrade a newer managed Codex runtime plugin", async () => {
    const installDir = makeTempDir();
    fs.writeFileSync(
      path.join(installDir, "package.json"),
      JSON.stringify({ name: "@mo/codex", version: "9999.1.1" }),
    );
    const records = {
      codex: {
        source: "npm",
        spec: "@mo/codex",
        resolvedName: "@mo/codex",
        resolvedSpec: "@mo/codex@9999.1.1",
        resolvedVersion: "9999.1.1",
        version: "9999.1.1",
        integrity: "sha512-newer-codex",
        installPath: installDir,
      },
    };
    mocks.loadInstalledPluginIndexInstallRecords.mockResolvedValue(records);
    mocks.loadPluginMetadataSnapshot.mockReturnValue({
      plugins: [
        {
          id: "codex",
          packageVersion: "9999.1.1",
          providers: ["codex", "openai-codex", "openai"],
        },
      ],
      diagnostics: [],
      byPluginId: new Map([
        [
          "codex",
          {
            id: "codex",
            packageVersion: "9999.1.1",
            providers: ["codex", "openai-codex", "openai"],
          },
        ],
      ]),
    });

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        agents: {
          defaults: {
            model: "openai/gpt-5.5",
          },
        },
      },
      env: {},
    });

    expect(mocks.installPluginFromNpmSpec).not.toHaveBeenCalled();
    expect(mocks.writePersistedInstalledPluginIndexInstallRecords).not.toHaveBeenCalled();
    expect(result).toEqual({ changes: [], warnings: [], records });
  });

  it.each([
    [
      "default OpenAI model route",
      {
        agents: {
          defaults: {
            model: "openai/gpt-5.5",
          },
        },
      },
      {},
    ],
    [
      "provider runtime policy",
      {
        models: {
          providers: {
            openai: {
              baseUrl: "https://api.openai.com/v1",
              agentRuntime: { id: "codex" },
              models: [],
            },
          },
        },
      },
      {},
    ],
    [
      "default model runtime policy",
      {
        agents: {
          defaults: {
            models: {
              "openai/gpt-5.5": { agentRuntime: { id: "codex" } },
            },
          },
        },
      },
      {},
    ],
    [
      "default selectable OpenAI agent model",
      {
        agents: {
          defaults: {
            model: { primary: "anthropic/claude-sonnet-4-6" },
            models: {
              "openai/gpt-5.5": {},
            },
          },
        },
      },
      {},
    ],
    [
      "agent model runtime policy",
      {
        agents: {
          list: [
            {
              id: "main",
              model: "anthropic/claude-opus-4-7",
              models: {
                "anthropic/claude-opus-4-7": { agentRuntime: { id: "codex" } },
              },
            },
          ],
        },
      },
      {},
    ],
  ])("repairs a missing Codex plugin selected by %s", async (_label, cfg, env) => {
    mocks.installPluginFromNpmSpec.mockResolvedValueOnce({
      ok: true,
      pluginId: "codex",
      targetDir: "/tmp/mo-plugins/codex",
      version: "2026.5.2",
      npmResolution: {
        name: "@mo/codex",
        version: "2026.5.2",
        resolvedSpec: "@mo/codex@2026.5.2",
        integrity: "sha512-codex",
        resolvedAt: "2026-05-01T00:00:00.000Z",
      },
    });
    mocks.listOfficialExternalPluginCatalogEntries.mockReturnValue([
      {
        id: "codex",
        label: "Codex",
        install: {
          npmSpec: "@mo/codex",
          defaultChoice: "npm",
        },
      },
    ]);

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg,
      env,
    });

    expectRecordFields(mockCallArg(mocks.installPluginFromNpmSpec), {
      spec: expectedNpmInstallSpec("@mo/codex"),
      expectedPluginId: "codex",
      trustedSourceLinkedOfficialInstall: true,
    });
    const records = mockCallArg(mocks.writePersistedInstalledPluginIndexInstallRecords);
    expectRecordFields((records as Record<string, unknown>).codex, {
      source: "npm",
      spec: "@mo/codex@2026.5.2",
      installPath: "/tmp/mo-plugins/codex",
      version: "2026.5.2",
    });
    expect(mockCallArg(mocks.writePersistedInstalledPluginIndexInstallRecords, 0, 1)).toEqual({
      env,
    });
    expect(result.changes).toEqual([
      `Installed missing configured plugin "codex" from ${expectedNpmInstallSpec("@mo/codex")}.`,
    ]);
    expect(result.warnings).toEqual([]);
    expect(Object.keys(result.records)).toEqual(["codex"]);
    expectRecordFields(result.records.codex, {
      source: "npm",
      spec: "@mo/codex@2026.5.2",
      installPath: "/tmp/mo-plugins/codex",
      version: "2026.5.2",
      resolvedName: "@mo/codex",
      resolvedSpec: "@mo/codex@2026.5.2",
      integrity: "sha512-codex",
      resolvedAt: "2026-05-01T00:00:00.000Z",
    });
    expect(typeof result.records.codex?.installedAt).toBe("string");
  });

  it.each([
    [
      "default agent runtime",
      {
        agents: {
          defaults: {
            agentRuntime: { id: "codex" },
          },
        },
      },
      {},
    ],
    [
      "agent runtime override",
      {
        agents: {
          list: [{ id: "main", agentRuntime: { id: "codex" } }],
        },
      },
      {},
    ],
    ["environment runtime override", {}, { MO_AGENT_RUNTIME: "codex" }],
  ])("ignores legacy whole-agent Codex runtime selected by %s", async (_label, cfg, env) => {
    mocks.listOfficialExternalPluginCatalogEntries.mockReturnValue([
      {
        id: "codex",
        label: "Codex",
        install: {
          npmSpec: "@mo/codex",
          defaultChoice: "npm",
        },
      },
    ]);

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg,
      env,
    });

    expect(mocks.installPluginFromNpmSpec).not.toHaveBeenCalled();
    expect(mocks.writePersistedInstalledPluginIndexInstallRecords).not.toHaveBeenCalled();
    expect(result).toEqual({ changes: [], warnings: [], records: {} });
  });

  it("does not install a blocked downloadable plugin from explicit channel ids", async () => {
    mocks.listChannelPluginCatalogEntries.mockReturnValue([
      {
        id: "matrix",
        pluginId: "matrix",
        meta: { label: "Matrix" },
        install: {
          npmSpec: "@mo/plugin-matrix@1.2.3",
        },
      },
    ]);

    const { repairMissingPluginInstallsForIds } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingPluginInstallsForIds({
      cfg: {},
      pluginIds: [],
      channelIds: ["matrix"],
      blockedPluginIds: ["matrix"],
      env: {},
    });

    expect(mocks.installPluginFromClawHub).not.toHaveBeenCalled();
    expect(mocks.installPluginFromNpmSpec).not.toHaveBeenCalled();
    expect(result).toEqual({ changes: [], warnings: [], records: {} });
  });

  it("does not install a channel catalog plugin when a configured plugin already owns that channel", async () => {
    mocks.loadPluginMetadataSnapshot.mockReturnValue({
      plugins: [
        {
          id: "mo-lark",
          origin: "config",
          channels: ["feishu"],
          channelConfigs: {
            feishu: {
              schema: {
                type: "object",
              },
            },
          },
        },
      ],
      diagnostics: [],
    });
    mocks.listChannelPluginCatalogEntries.mockReturnValue([
      {
        id: "feishu",
        pluginId: "feishu",
        meta: { label: "Feishu" },
        install: {
          npmSpec: "@mo/feishu",
        },
        trustedSourceLinkedOfficialInstall: true,
      },
    ]);

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        plugins: {
          entries: {
            "mo-lark": {
              enabled: true,
            },
          },
        },
        channels: {
          feishu: {
            footer: {
              model: false,
            },
          },
        },
      },
      env: {},
    });

    expect(mocks.installPluginFromClawHub).not.toHaveBeenCalled();
    expect(mocks.installPluginFromNpmSpec).not.toHaveBeenCalled();
    expect(mocks.writePersistedInstalledPluginIndexInstallRecords).not.toHaveBeenCalled();
    expect(result).toEqual({ changes: [], warnings: [], records: {} });
  });

  it("still installs a channel catalog plugin when the configured owner is blocked by the allowlist", async () => {
    mocks.loadPluginMetadataSnapshot.mockReturnValue({
      plugins: [
        {
          id: "mo-lark",
          origin: "config",
          channels: ["feishu"],
          channelConfigs: {
            feishu: {
              schema: {
                type: "object",
              },
            },
          },
        },
      ],
      diagnostics: [],
    });
    mocks.listChannelPluginCatalogEntries.mockReturnValue([
      {
        id: "feishu",
        pluginId: "feishu",
        meta: { label: "Feishu" },
        install: {
          npmSpec: "@mo/feishu",
        },
        trustedSourceLinkedOfficialInstall: true,
      },
    ]);
    mocks.installPluginFromNpmSpec.mockResolvedValueOnce({
      ok: true,
      pluginId: "feishu",
      targetDir: "/tmp/mo-plugins/feishu",
      version: "2026.5.2",
      npmResolution: {
        name: "@mo/feishu",
        version: "2026.5.2",
        resolvedSpec: "@mo/feishu@2026.5.2",
      },
    });

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        plugins: {
          allow: ["some-other-plugin"],
          entries: {
            "mo-lark": {
              enabled: true,
            },
          },
        },
        channels: {
          feishu: {
            footer: {
              model: false,
            },
          },
        },
      },
      env: {},
    });

    expectRecordFields(mockCallArg(mocks.installPluginFromNpmSpec), {
      spec: expectedNpmInstallSpec("@mo/feishu"),
      expectedPluginId: "feishu",
      trustedSourceLinkedOfficialInstall: true,
    });
    expect(result.changes).toEqual([
      `Installed missing configured plugin "feishu" from ${expectedNpmInstallSpec("@mo/feishu")}.`,
    ]);
  });

  it("still installs a channel catalog plugin when that plugin is explicitly configured", async () => {
    mocks.loadPluginMetadataSnapshot.mockReturnValue({
      plugins: [
        {
          id: "mo-lark",
          origin: "config",
          channels: ["feishu"],
          channelConfigs: {
            feishu: {
              schema: {
                type: "object",
              },
            },
          },
        },
      ],
      diagnostics: [],
    });
    mocks.listChannelPluginCatalogEntries.mockReturnValue([
      {
        id: "feishu",
        pluginId: "feishu",
        meta: { label: "Feishu" },
        install: {
          npmSpec: "@mo/feishu",
        },
        trustedSourceLinkedOfficialInstall: true,
      },
    ]);
    mocks.installPluginFromNpmSpec.mockResolvedValueOnce({
      ok: true,
      pluginId: "feishu",
      targetDir: "/tmp/mo-plugins/feishu",
      version: "2026.5.2",
      npmResolution: {
        name: "@mo/feishu",
        version: "2026.5.2",
        resolvedSpec: "@mo/feishu@2026.5.2",
      },
    });

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        plugins: {
          entries: {
            feishu: {
              enabled: true,
            },
            "mo-lark": {
              enabled: true,
            },
          },
        },
        channels: {
          feishu: {
            footer: {
              model: false,
            },
          },
        },
      },
      env: {},
    });

    expectRecordFields(mockCallArg(mocks.installPluginFromNpmSpec), {
      spec: expectedNpmInstallSpec("@mo/feishu"),
      expectedPluginId: "feishu",
      trustedSourceLinkedOfficialInstall: true,
    });
    expect(result.changes).toEqual([
      `Installed missing configured plugin "feishu" from ${expectedNpmInstallSpec("@mo/feishu")}.`,
    ]);
  });

  it("reinstalls a missing configured plugin from its persisted install record", async () => {
    const records = {
      demo: {
        source: "npm",
        spec: "@mo/plugin-demo@1.0.0",
        installPath: "/missing/demo",
      },
    };
    mocks.loadInstalledPluginIndexInstallRecords.mockResolvedValue(records);
    mocks.updateNpmInstalledPlugins.mockResolvedValue({
      changed: true,
      config: {
        plugins: {
          installs: {
            demo: {
              source: "npm",
              spec: "@mo/plugin-demo@1.0.0",
              installPath: "/tmp/mo-plugins/demo",
            },
          },
        },
      },
      outcomes: [
        {
          pluginId: "demo",
          status: "updated",
          message: "Updated demo.",
        },
      ],
    });

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        plugins: {
          entries: {
            demo: { enabled: true },
          },
        },
      },
      env: {},
    });

    const updateArg = expectRecordFields(mockCallArg(mocks.updateNpmInstalledPlugins), {
      pluginIds: ["demo"],
    });
    const updateConfig = updateArg.config as Record<string, unknown>;
    expectRecordFields(updateConfig.plugins, { installs: records });
    const persistedRecords = mockCallArg(mocks.writePersistedInstalledPluginIndexInstallRecords);
    expectRecordFields((persistedRecords as Record<string, unknown>).demo, {
      installPath: "/tmp/mo-plugins/demo",
    });
    expect(mockCallArg(mocks.writePersistedInstalledPluginIndexInstallRecords, 0, 1)).toEqual({
      env: {},
    });
    expect(result.changes).toEqual(['Repaired missing configured plugin "demo".']);
  });

  it("forwards ClawHub risk acknowledgement to persisted-record repair", async () => {
    const records = {
      demo: {
        source: "clawhub",
        spec: "clawhub:@mo/plugin-demo@1.0.0",
        clawhubPackage: "@mo/plugin-demo",
        installPath: "/missing/demo",
      },
    };
    const onClawHubRisk = vi.fn(async () => true);
    mocks.loadInstalledPluginIndexInstallRecords.mockResolvedValue(records);
    mocks.updateNpmInstalledPlugins.mockResolvedValue({
      changed: true,
      config: {
        plugins: {
          installs: {
            demo: {
              source: "clawhub",
              spec: "clawhub:@mo/plugin-demo@1.0.0",
              installPath: "/tmp/mo-plugins/demo",
            },
          },
        },
      },
      outcomes: [
        {
          pluginId: "demo",
          status: "updated",
          message: "Updated demo.",
        },
      ],
    });

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    await repairMissingConfiguredPluginInstalls({
      cfg: {
        plugins: {
          entries: {
            demo: { enabled: true },
          },
        },
      },
      env: {},
      acknowledgeClawHubRisk: true,
      onClawHubRisk,
    });

    const updateArg = expectRecordFields(mockCallArg(mocks.updateNpmInstalledPlugins), {
      pluginIds: ["demo"],
      acknowledgeClawHubRisk: true,
      onClawHubRisk,
    });
    expect(updateArg.logger).toEqual(expect.objectContaining({ terminalLinks: false }));
    const updateConfig = updateArg.config as Record<string, unknown>;
    expectRecordFields(updateConfig.plugins, { installs: records });
  });

  it("keeps non-ClawHub updater warnings as persisted-record repair warnings", async () => {
    const records = {
      demo: {
        source: "npm",
        spec: "@mo/plugin-demo@1.0.0",
        installPath: "/missing/demo",
      },
    };
    const repairWarning =
      'Could not repair mo peer link for "demo" at /tmp/mo-plugins/demo: permission denied';
    mocks.loadInstalledPluginIndexInstallRecords.mockResolvedValue(records);
    mocks.updateNpmInstalledPlugins.mockImplementationOnce(
      async (params: {
        logger?: { warn?: (message: string) => void };
        config: Record<string, unknown>;
      }) => {
        params.logger?.warn?.(repairWarning);
        return {
          changed: true,
          config: {
            plugins: {
              installs: {
                demo: {
                  source: "npm",
                  spec: "@mo/plugin-demo@1.0.0",
                  installPath: "/tmp/mo-plugins/demo",
                },
              },
            },
          },
          outcomes: [
            {
              pluginId: "demo",
              status: "updated",
              message: "Updated demo.",
            },
          ],
        };
      },
    );

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        plugins: {
          entries: {
            demo: { enabled: true },
          },
        },
      },
      env: {},
    });

    expect(result.warnings).toContain(repairWarning);
    expect(result.notices ?? []).not.toContain(repairWarning);
  });

  it("keeps ClawHub review notices non-fatal during persisted-record repair", async () => {
    const records = {
      demo: {
        source: "clawhub",
        spec: "clawhub:@mo/plugin-demo@1.0.0",
        clawhubPackage: "@mo/plugin-demo",
        installPath: "/missing/demo",
      },
    };
    const reviewNotice =
      "╭─ WARNING - ClawHub found security risks in this release ─╮\n" +
      "│ • Security scan:     suspicious                                      │\n" +
      "╰───────────────────────────────────────────────────────────────────────╯";
    const coloredReviewNotice = `\u001b[33m${reviewNotice}\u001b[39m`;
    mocks.loadInstalledPluginIndexInstallRecords.mockResolvedValue(records);
    mocks.updateNpmInstalledPlugins.mockImplementationOnce(
      async (params: {
        logger?: { warn?: (message: string) => void };
        config: Record<string, unknown>;
      }) => {
        params.logger?.warn?.(coloredReviewNotice);
        return {
          changed: true,
          config: {
            plugins: {
              installs: {
                demo: {
                  source: "clawhub",
                  spec: "clawhub:@mo/plugin-demo@1.0.0",
                  installPath: "/tmp/mo-plugins/demo",
                },
              },
            },
          },
          outcomes: [
            {
              pluginId: "demo",
              status: "updated",
              message: "Updated demo.",
            },
          ],
        };
      },
    );

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        plugins: {
          entries: {
            demo: { enabled: true },
          },
        },
      },
      env: {},
    });

    expect(result.notices).toContain(reviewNotice);
    expect(result.notices?.[0]).not.toContain("\u001b");
    expect(result.warnings).toStrictEqual([]);
  });

  it("adds actionable acknowledgement guidance for risky persisted ClawHub repair failures", async () => {
    const records = {
      demo: {
        source: "clawhub",
        spec: "clawhub:@mo/plugin-demo@1.0.0",
        clawhubPackage: "@mo/plugin-demo",
        installPath: "/missing/demo",
      },
    };
    mocks.loadInstalledPluginIndexInstallRecords.mockResolvedValue(records);
    mocks.updateNpmInstalledPlugins.mockResolvedValue({
      changed: false,
      config: { plugins: { installs: records } },
      outcomes: [
        {
          pluginId: "demo",
          status: "skipped",
          code: CLAWHUB_INSTALL_ERROR_CODE.CLAWHUB_RISK_ACKNOWLEDGEMENT_REQUIRED,
          message:
            'Skipped demo ClawHub update: ClawHub release "@mo/plugin-demo@1.0.0" has trust warnings. Review the package and rerun with --acknowledge-clawhub-risk to continue. Existing installed plugin left unchanged.',
        },
      ],
    });

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        plugins: {
          entries: {
            demo: { enabled: true },
          },
        },
      },
      env: {},
    });

    expect(result.warnings[0]).toContain(
      "mo plugins install clawhub:@mo/plugin-demo@1.0.0 --acknowledge-clawhub-risk",
    );
  });

  it("prefixes legacy persisted ClawHub package records in acknowledgement guidance", async () => {
    const records = {
      demo: {
        source: "clawhub",
        clawhubPackage: "@mo/plugin-demo",
        installPath: "/missing/demo",
      },
    };
    mocks.loadInstalledPluginIndexInstallRecords.mockResolvedValue(records);
    mocks.updateNpmInstalledPlugins.mockResolvedValue({
      changed: false,
      config: { plugins: { installs: records } },
      outcomes: [
        {
          pluginId: "demo",
          status: "skipped",
          code: CLAWHUB_INSTALL_ERROR_CODE.CLAWHUB_RISK_ACKNOWLEDGEMENT_REQUIRED,
          message:
            'Skipped demo ClawHub update: ClawHub release "@mo/plugin-demo@latest" has trust warnings. Review the package and rerun with --acknowledge-clawhub-risk to continue. Existing installed plugin left unchanged.',
        },
      ],
    });

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        plugins: {
          entries: {
            demo: { enabled: true },
          },
        },
      },
      env: {},
    });

    expect(result.warnings[0]).toContain(
      "mo plugins install clawhub:@mo/plugin-demo --acknowledge-clawhub-risk",
    );
  });

  it("repairs a broken managed package entry from its attributed registry diagnostic", async () => {
    const records = {
      demo: {
        source: "npm",
        spec: "@mo/plugin-demo@1.0.0",
        resolvedName: "@mo/plugin-demo",
        resolvedSpec: "@mo/plugin-demo@1.0.0",
        resolvedVersion: "1.0.0",
        integrity: "sha512-demo",
        installPath: "/tmp/mo-plugins/demo",
      },
    };
    mocks.loadInstalledPluginIndexInstallRecords.mockResolvedValue(records);
    mocks.loadPluginMetadataSnapshot.mockReturnValue({
      plugins: [],
      diagnostics: [
        {
          level: "error",
          pluginId: "demo",
          message: "extension entry escapes package directory: ./index.ts",
        },
      ],
    });
    mocks.updateNpmInstalledPlugins.mockResolvedValue({
      changed: true,
      config: {
        plugins: {
          installs: {
            demo: {
              source: "npm",
              spec: "@mo/plugin-demo@1.0.0",
              installPath: "/tmp/mo-plugins/demo",
            },
          },
        },
      },
      outcomes: [
        {
          pluginId: "demo",
          status: "updated",
          message: "Updated demo.",
        },
      ],
    });

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {},
      env: {},
    });

    const updateArg = expectRecordFields(mockCallArg(mocks.updateNpmInstalledPlugins), {
      pluginIds: ["demo"],
    });
    const updateConfig = updateArg.config as { plugins?: { installs?: Record<string, unknown> } };
    const updateRecord = expectRecordFields(updateConfig.plugins?.installs?.demo, {
      source: "npm",
      spec: "@mo/plugin-demo@1.0.0",
      integrity: "sha512-demo",
      installPath: "/tmp/mo-plugins/demo",
    });
    expect(updateRecord.resolvedSpec).toBeUndefined();
    expect(updateRecord.resolvedVersion).toBeUndefined();
    expect(result.changes).toEqual(['Repaired broken installed plugin "demo".']);
  });

  it("reinstalls a known configured plugin from the catalog when its recorded install path is missing", async () => {
    const records = {
      discord: {
        source: "npm",
        spec: "@mo/discord",
        installPath: "/tmp/mo-missing-discord-install-record",
      },
    };
    mocks.loadInstalledPluginIndexInstallRecords.mockResolvedValue(records);
    mocks.loadPluginMetadataSnapshot.mockReturnValue({
      plugins: [
        {
          id: "discord",
          channels: ["discord"],
        },
      ],
      diagnostics: [],
    });
    mocks.listChannelPluginCatalogEntries.mockReturnValue([
      {
        id: "discord",
        pluginId: "discord",
        meta: { label: "Discord" },
        install: {
          npmSpec: "@mo/discord",
        },
        trustedSourceLinkedOfficialInstall: true,
      },
    ]);
    mocks.installPluginFromNpmSpec.mockResolvedValueOnce({
      ok: true,
      pluginId: "discord",
      targetDir: "/tmp/mo-plugins/discord",
      version: "1.2.3",
      npmResolution: {
        name: "@mo/discord",
        version: "1.2.3",
        resolvedSpec: "@mo/discord@1.2.3",
        integrity: "sha512-discord",
        resolvedAt: "2026-05-01T00:00:00.000Z",
      },
    });
    mocks.updateNpmInstalledPlugins.mockResolvedValue({
      changed: false,
      config: {
        plugins: {
          installs: records,
        },
      },
      outcomes: [
        {
          pluginId: "discord",
          status: "skipped",
          message: "No update applied.",
        },
      ],
    });

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        plugins: {
          entries: {
            discord: { enabled: true },
          },
        },
        channels: {
          discord: { enabled: true },
        },
      },
      env: {},
    });

    const updateArg = expectRecordFields(mockCallArg(mocks.updateNpmInstalledPlugins), {
      pluginIds: ["discord"],
    });
    const updateConfig = updateArg.config as Record<string, unknown>;
    expectRecordFields(updateConfig.plugins, { installs: records });
    expectRecordFields(mockCallArg(mocks.installPluginFromNpmSpec), {
      spec: expectedNpmInstallSpec("@mo/discord"),
      expectedPluginId: "discord",
      trustedSourceLinkedOfficialInstall: true,
    });
    const persistedRecords = mockCallArg(mocks.writePersistedInstalledPluginIndexInstallRecords);
    expectRecordFields((persistedRecords as Record<string, unknown>).discord, {
      spec: "@mo/discord@1.2.3",
      installPath: "/tmp/mo-plugins/discord",
    });
    expect(mockCallArg(mocks.writePersistedInstalledPluginIndexInstallRecords, 0, 1)).toEqual({
      env: {},
    });
    expect(result.changes).toEqual([
      `Installed missing configured plugin "discord" from ${expectedNpmInstallSpec("@mo/discord")}.`,
    ]);
  });

  it("updates a known configured plugin when its installed manifest path still exists", async () => {
    const records = {
      discord: {
        source: "npm",
        spec: "@mo/discord",
        installPath: process.cwd(),
      },
    };
    mocks.loadInstalledPluginIndexInstallRecords.mockResolvedValue(records);
    mocks.loadPluginMetadataSnapshot.mockReturnValue({
      plugins: [
        {
          id: "discord",
          channels: ["discord"],
        },
      ],
      diagnostics: [
        {
          pluginId: "discord",
          message: "manifest without channelConfigs metadata",
        },
      ],
    });
    mocks.updateNpmInstalledPlugins.mockResolvedValue({
      changed: true,
      config: {
        plugins: {
          installs: {
            discord: {
              source: "npm",
              spec: "@mo/discord",
              installPath: process.cwd(),
            },
          },
        },
      },
      outcomes: [
        {
          pluginId: "discord",
          status: "updated",
          message: "Updated discord.",
        },
      ],
    });

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        plugins: {
          entries: {
            discord: { enabled: true },
          },
        },
        channels: {
          discord: { enabled: true },
        },
      },
      env: {},
    });

    const updateArg = expectRecordFields(mockCallArg(mocks.updateNpmInstalledPlugins), {
      pluginIds: ["discord"],
    });
    const updateConfig = updateArg.config as Record<string, unknown>;
    expectRecordFields(updateConfig.plugins, { installs: records });
    const persistedRecords = mockCallArg(mocks.writePersistedInstalledPluginIndexInstallRecords);
    expectRecordFields((persistedRecords as Record<string, unknown>).discord, {
      installPath: process.cwd(),
    });
    expect(mockCallArg(mocks.writePersistedInstalledPluginIndexInstallRecords, 0, 1)).toEqual({
      env: {},
    });
    expect(result.changes).toEqual(['Repaired missing configured plugin "discord".']);
  });

  it("updates a configured plugin when its installed manifest lacks channel config descriptors", async () => {
    const records = {
      discord: {
        source: "npm",
        spec: "@mo/discord",
        installPath: "/tmp/mo-plugins/discord",
      },
    };
    mocks.loadInstalledPluginIndexInstallRecords.mockResolvedValue(records);
    mocks.listChannelPluginCatalogEntries.mockReturnValue([
      {
        id: "discord",
        pluginId: "discord",
        meta: { label: "Discord" },
        install: {
          npmSpec: "@mo/discord",
        },
      },
    ]);
    mocks.loadPluginMetadataSnapshot.mockReturnValue({
      plugins: [
        {
          id: "discord",
          channels: ["discord"],
        },
      ],
      diagnostics: [
        {
          level: "warn",
          pluginId: "discord",
          message:
            "channel plugin manifest declares discord without channelConfigs metadata; add mo.plugin.json#channelConfigs so config schema and setup surfaces work before runtime loads",
        },
      ],
    });
    mocks.updateNpmInstalledPlugins.mockResolvedValue({
      changed: true,
      config: {
        plugins: {
          installs: {
            discord: {
              source: "npm",
              spec: "@mo/discord",
              installPath: process.cwd(),
            },
          },
        },
      },
      outcomes: [
        {
          pluginId: "discord",
          status: "updated",
          message: "Updated discord.",
        },
      ],
    });

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        update: { channel: "beta" },
        plugins: {
          entries: {
            discord: { enabled: true },
          },
        },
        channels: {
          discord: { enabled: true },
        },
      },
      env: {},
    });

    const updateArg = expectRecordFields(mockCallArg(mocks.updateNpmInstalledPlugins), {
      pluginIds: ["discord"],
      updateChannel: "beta",
    });
    const updateConfig = updateArg.config as Record<string, unknown>;
    expectRecordFields(updateConfig.plugins, { installs: records });
    const persistedRecords = mockCallArg(
      mocks.writePersistedInstalledPluginIndexInstallRecords,
    ) as Record<string, unknown>;
    expectRecordFields(persistedRecords.discord, { installPath: process.cwd() });
    expect(mockCallArg(mocks.writePersistedInstalledPluginIndexInstallRecords, 0, 1)).toEqual({
      env: {},
    });
    expect(result).toEqual({
      changes: ['Repaired missing configured plugin "discord".'],
      warnings: [],
      repairedPluginIds: ["discord"],
      records: {
        discord: {
          source: "npm",
          spec: "@mo/discord",
          installPath: process.cwd(),
        },
      },
    });
  });

  it("reinstalls a recorded external web search plugin from provider-only config", async () => {
    const records = {
      brave: {
        source: "npm",
        spec: "@mo/brave-plugin@beta",
        installPath: "/missing/brave",
      },
    };
    mocks.loadInstalledPluginIndexInstallRecords.mockResolvedValue(records);
    mocks.listOfficialExternalPluginCatalogEntries.mockReturnValue([
      {
        id: "brave",
        label: "Brave",
        install: {
          npmSpec: "@mo/brave-plugin",
          defaultChoice: "npm",
        },
        mo: {
          plugin: { id: "brave", label: "Brave" },
          webSearchProviders: [
            {
              id: "brave",
              label: "Brave Search",
              hint: "Brave Search",
              envVars: ["BRAVE_API_KEY"],
              placeholder: "BSA...",
              signupUrl: "https://example.test/brave",
            },
          ],
        },
      },
    ]);
    mocks.updateNpmInstalledPlugins.mockResolvedValue({
      changed: true,
      config: {
        plugins: {
          installs: {
            brave: {
              source: "npm",
              spec: "@mo/brave-plugin@beta",
              installPath: process.cwd(),
            },
          },
        },
      },
      outcomes: [
        {
          pluginId: "brave",
          status: "updated",
          message: "Updated brave.",
        },
      ],
    });

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        tools: {
          web: {
            search: {
              provider: "brave",
            },
          },
        },
      },
      env: {},
    });

    const updateArg = expectRecordFields(mockCallArg(mocks.updateNpmInstalledPlugins), {
      pluginIds: ["brave"],
    });
    const updateConfig = updateArg.config as Record<string, unknown>;
    expectRecordFields(updateConfig.plugins, { installs: records });
    const persistedRecords = mockCallArg(
      mocks.writePersistedInstalledPluginIndexInstallRecords,
    ) as Record<string, unknown>;
    expectRecordFields(persistedRecords.brave, { installPath: process.cwd() });
    expect(mockCallArg(mocks.writePersistedInstalledPluginIndexInstallRecords, 0, 1)).toEqual({
      env: {},
    });
    expect(result.changes).toEqual(['Repaired missing configured plugin "brave".']);
  });

  it("replaces a configured official web search plugin when its installed package is source-only", async () => {
    const extensionsDir = path.join(makeTempDir(), "extensions");
    const installDir = path.join(extensionsDir, "brave");
    mocks.resolveDefaultPluginExtensionsDir.mockReturnValue(extensionsDir);
    fs.mkdirSync(installDir, { recursive: true });
    fs.writeFileSync(path.join(installDir, "package.json"), JSON.stringify({ name: "brave" }));
    const records = {
      brave: {
        source: "clawhub",
        spec: "clawhub:@mo/brave-plugin@2026.5.1-beta.1",
        installPath: installDir,
        clawhubPackage: "@mo/brave-plugin",
        clawhubChannel: "official",
        clawhubUrl: "https://clawhub.ai",
      },
    };
    mocks.loadInstalledPluginIndexInstallRecords.mockResolvedValue(records);
    mocks.loadPluginMetadataSnapshot.mockReturnValue({
      plugins: [],
      diagnostics: [
        {
          level: "error",
          pluginId: "brave",
          message:
            "installed plugin package requires compiled runtime output for TypeScript entry index.ts: expected ./dist/index.js, ./dist/index.mjs, ./dist/index.cjs, index.js, index.mjs, index.cjs.",
        },
      ],
    });
    mocks.listOfficialExternalPluginCatalogEntries.mockReturnValue([
      {
        id: "brave",
        label: "Brave",
        install: {
          npmSpec: "@mo/brave-plugin",
          defaultChoice: "npm",
        },
        mo: {
          plugin: { id: "brave", label: "Brave" },
          webSearchProviders: [
            {
              id: "brave",
              label: "Brave Search",
              hint: "Brave Search",
              envVars: ["BRAVE_API_KEY"],
              placeholder: "BSA...",
              signupUrl: "https://example.test/brave",
            },
          ],
        },
      },
    ]);
    mocks.installPluginFromNpmSpec.mockResolvedValueOnce({
      ok: true,
      pluginId: "brave",
      targetDir: "/tmp/mo-plugins/brave",
      version: "2026.5.12",
      npmResolution: {
        name: "@mo/brave-plugin",
        version: "2026.5.12",
        resolvedSpec: "@mo/brave-plugin@2026.5.12",
        integrity: "sha512-brave",
        resolvedAt: "2026-05-01T00:00:00.000Z",
      },
    });

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        tools: {
          web: {
            search: {
              provider: "brave",
            },
          },
        },
      },
      env: {},
    });

    expect(mocks.updateNpmInstalledPlugins).not.toHaveBeenCalled();
    expect(fs.existsSync(installDir)).toBe(false);
    expectRecordFields(mockCallArg(mocks.installPluginFromNpmSpec), {
      spec: expectedNpmInstallSpec("@mo/brave-plugin"),
      expectedPluginId: "brave",
      trustedSourceLinkedOfficialInstall: true,
      mode: "update",
    });
    const persistedRecords = mockCallArg(
      mocks.writePersistedInstalledPluginIndexInstallRecords,
    ) as Record<string, unknown>;
    expectRecordFields(persistedRecords.brave, {
      source: "npm",
      spec: "@mo/brave-plugin@2026.5.12",
      installPath: "/tmp/mo-plugins/brave",
      version: "2026.5.12",
    });
    expect(result).toEqual({
      changes: [
        `Installed missing configured plugin "brave" from ${expectedNpmInstallSpec("@mo/brave-plugin")}.`,
      ],
      warnings: [],
      repairedPluginIds: ["brave"],
      records: persistedRecords,
    });
  });

  it("replaces a configured official channel plugin when only its channel is configured", async () => {
    const extensionsDir = path.join(makeTempDir(), "extensions");
    const installDir = path.join(extensionsDir, "slack");
    mocks.resolveDefaultPluginExtensionsDir.mockReturnValue(extensionsDir);
    fs.mkdirSync(installDir, { recursive: true });
    fs.writeFileSync(path.join(installDir, "package.json"), JSON.stringify({ name: "slack" }));
    const records = {
      slack: {
        source: "clawhub",
        spec: "clawhub:@mo/slack@2026.5.12-beta.1",
        installPath: installDir,
        clawhubPackage: "@mo/slack",
        clawhubChannel: "official",
        clawhubUrl: "https://clawhub.ai",
      },
    };
    mocks.loadInstalledPluginIndexInstallRecords.mockResolvedValue(records);
    mocks.loadPluginMetadataSnapshot.mockReturnValue({
      plugins: [],
      diagnostics: [
        {
          level: "error",
          pluginId: "slack",
          message:
            "installed plugin package requires compiled runtime output for TypeScript entry index.ts: expected ./dist/index.js.",
        },
      ],
    });
    mocks.listChannelPluginCatalogEntries.mockReturnValue([
      {
        id: "slack",
        pluginId: "slack",
        meta: { label: "Slack" },
        install: {
          npmSpec: "@mo/slack",
          defaultChoice: "npm",
        },
        trustedSourceLinkedOfficialInstall: true,
      },
    ]);
    mocks.installPluginFromNpmSpec.mockResolvedValueOnce({
      ok: true,
      pluginId: "slack",
      targetDir: "/tmp/mo-npm/node_modules/@mo/slack",
      version: "2026.5.12",
      npmResolution: {
        name: "@mo/slack",
        version: "2026.5.12",
        resolvedSpec: "@mo/slack@2026.5.12",
        integrity: "sha512-slack",
        resolvedAt: "2026-05-01T00:00:00.000Z",
      },
    });

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        channels: {
          slack: {
            enabled: true,
            botToken: "xoxb-test",
          },
        },
      },
      env: {},
    });

    expect(mocks.updateNpmInstalledPlugins).not.toHaveBeenCalled();
    expect(fs.existsSync(installDir)).toBe(false);
    expectRecordFields(mockCallArg(mocks.installPluginFromNpmSpec), {
      spec: expectedNpmInstallSpec("@mo/slack"),
      expectedPluginId: "slack",
      trustedSourceLinkedOfficialInstall: true,
      mode: "update",
    });
    expect(result.changes).toEqual([
      `Installed missing configured plugin "slack" from ${expectedNpmInstallSpec("@mo/slack")}.`,
    ]);
  });

  it("does not delete an arbitrary recorded path when replacing a broken official plugin", async () => {
    const installDir = makeTempDir();
    fs.writeFileSync(path.join(installDir, "package.json"), JSON.stringify({ name: "brave" }));
    const records = {
      brave: {
        source: "clawhub",
        spec: "clawhub:@mo/brave-plugin@2026.5.1-beta.1",
        installPath: installDir,
        clawhubPackage: "@mo/brave-plugin",
        clawhubChannel: "official",
        clawhubUrl: "https://clawhub.ai",
      },
    };
    mocks.loadInstalledPluginIndexInstallRecords.mockResolvedValue(records);
    mocks.loadPluginMetadataSnapshot.mockReturnValue({
      plugins: [],
      diagnostics: [
        {
          level: "error",
          pluginId: "brave",
          message:
            "installed plugin package requires compiled runtime output for TypeScript entry index.ts: expected ./dist/index.js.",
        },
      ],
    });
    mocks.listOfficialExternalPluginCatalogEntries.mockReturnValue([
      {
        id: "brave",
        label: "Brave",
        install: {
          npmSpec: "@mo/brave-plugin",
          defaultChoice: "npm",
        },
        mo: {
          plugin: { id: "brave", label: "Brave" },
          webSearchProviders: [
            {
              id: "brave",
              label: "Brave Search",
              hint: "Brave Search",
              envVars: ["BRAVE_API_KEY"],
              placeholder: "BSA...",
              signupUrl: "https://example.test/brave",
            },
          ],
        },
      },
    ]);
    mocks.installPluginFromNpmSpec.mockResolvedValueOnce({
      ok: true,
      pluginId: "brave",
      targetDir: "/tmp/mo-plugins/brave",
      version: "2026.5.12",
      npmResolution: {
        name: "@mo/brave-plugin",
        version: "2026.5.12",
        resolvedSpec: "@mo/brave-plugin@2026.5.12",
        integrity: "sha512-brave",
        resolvedAt: "2026-05-01T00:00:00.000Z",
      },
    });

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    await repairMissingConfiguredPluginInstalls({
      cfg: {
        tools: {
          web: {
            search: {
              provider: "brave",
            },
          },
        },
      },
      env: {},
    });

    expect(fs.existsSync(installDir)).toBe(true);
    expect(mocks.installPluginFromNpmSpec).toHaveBeenCalled();
  });

  it("keeps a broken official install record when replacement install fails", async () => {
    const extensionsDir = path.join(makeTempDir(), "extensions");
    const installDir = path.join(extensionsDir, "brave");
    mocks.resolveDefaultPluginExtensionsDir.mockReturnValue(extensionsDir);
    fs.mkdirSync(installDir, { recursive: true });
    fs.writeFileSync(path.join(installDir, "package.json"), JSON.stringify({ name: "brave" }));
    const records = {
      brave: {
        source: "clawhub",
        spec: "clawhub:@mo/brave-plugin@2026.5.1-beta.1",
        installPath: installDir,
        clawhubPackage: "@mo/brave-plugin",
        clawhubChannel: "official",
        clawhubUrl: "https://clawhub.ai",
      },
    };
    mocks.loadInstalledPluginIndexInstallRecords.mockResolvedValue(records);
    mocks.loadPluginMetadataSnapshot.mockReturnValue({
      plugins: [],
      diagnostics: [
        {
          level: "error",
          pluginId: "brave",
          message:
            "installed plugin package requires compiled runtime output for TypeScript entry index.ts: expected ./dist/index.js.",
        },
      ],
    });
    mocks.listOfficialExternalPluginCatalogEntries.mockReturnValue([
      {
        id: "brave",
        label: "Brave",
        install: {
          npmSpec: "@mo/brave-plugin",
          defaultChoice: "npm",
        },
        mo: {
          plugin: { id: "brave", label: "Brave" },
          webSearchProviders: [
            {
              id: "brave",
              label: "Brave Search",
              hint: "Brave Search",
              envVars: ["BRAVE_API_KEY"],
              placeholder: "BSA...",
              signupUrl: "https://example.test/brave",
            },
          ],
        },
      },
    ]);
    mocks.installPluginFromNpmSpec.mockResolvedValueOnce({
      ok: false,
      error: "network unavailable",
    });

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        tools: {
          web: {
            search: {
              provider: "brave",
            },
          },
        },
      },
      env: {},
    });

    expect(fs.existsSync(installDir)).toBe(true);
    expect(mocks.writePersistedInstalledPluginIndexInstallRecords).not.toHaveBeenCalled();
    expect(result).toEqual({
      changes: [],
      warnings: [
        `Failed to install missing configured plugin "brave" from ${expectedNpmInstallSpec("@mo/brave-plugin")}: network unavailable`,
      ],
      failedPluginIds: ["brave"],
      records,
    });
  });

  it("does not replace a non-official install that collides with an official plugin id", async () => {
    const extensionsDir = path.join(makeTempDir(), "extensions");
    const installDir = path.join(extensionsDir, "brave");
    mocks.resolveDefaultPluginExtensionsDir.mockReturnValue(extensionsDir);
    fs.mkdirSync(installDir, { recursive: true });
    fs.writeFileSync(path.join(installDir, "package.json"), JSON.stringify({ name: "brave" }));
    const records = {
      brave: {
        source: "path",
        sourcePath: installDir,
        installPath: installDir,
      },
    };
    mocks.loadInstalledPluginIndexInstallRecords.mockResolvedValue(records);
    mocks.loadPluginMetadataSnapshot.mockReturnValue({
      plugins: [],
      diagnostics: [
        {
          level: "error",
          pluginId: "brave",
          message:
            "installed plugin package requires compiled runtime output for TypeScript entry index.ts: expected ./dist/index.js.",
        },
      ],
    });
    mocks.listOfficialExternalPluginCatalogEntries.mockReturnValue([
      {
        id: "brave",
        label: "Brave",
        install: {
          npmSpec: "@mo/brave-plugin",
          defaultChoice: "npm",
        },
        mo: {
          plugin: { id: "brave", label: "Brave" },
          webSearchProviders: [
            {
              id: "brave",
              label: "Brave Search",
              hint: "Brave Search",
              envVars: ["BRAVE_API_KEY"],
              placeholder: "BSA...",
              signupUrl: "https://example.test/brave",
            },
          ],
        },
      },
    ]);

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        tools: {
          web: {
            search: {
              provider: "brave",
            },
          },
        },
      },
      env: {},
    });

    expect(fs.existsSync(installDir)).toBe(true);
    expect(mocks.installPluginFromNpmSpec).not.toHaveBeenCalled();
    expect(mocks.updateNpmInstalledPlugins).not.toHaveBeenCalled();
    expect(result).toEqual({
      changes: [],
      warnings: [],
      records,
    });
  });

  it("installs a configured external web search plugin from provider-only config", async () => {
    mocks.listOfficialExternalPluginCatalogEntries.mockReturnValue([
      {
        id: "brave",
        label: "Brave",
        install: {
          npmSpec: "@mo/brave-plugin",
          defaultChoice: "npm",
        },
        mo: {
          plugin: { id: "brave", label: "Brave" },
          webSearchProviders: [
            {
              id: "brave",
              label: "Brave Search",
              hint: "Brave Search",
              envVars: ["BRAVE_API_KEY"],
              placeholder: "BSA...",
              signupUrl: "https://example.test/brave",
              credentialPath: "plugins.entries.brave.config.webSearch.apiKey",
            },
          ],
          install: {
            npmSpec: "@mo/brave-plugin",
            defaultChoice: "npm",
          },
        },
      },
    ]);
    mocks.resolveOfficialExternalPluginId.mockImplementation(
      (entry: { id?: string; mo?: { plugin?: { id?: string } } }) =>
        entry.mo?.plugin?.id ?? entry.id,
    );
    mocks.resolveOfficialExternalPluginInstall.mockImplementation(
      (entry: { install?: unknown; mo?: { install?: unknown } }) =>
        entry.mo?.install ?? entry.install ?? null,
    );
    mocks.resolveOfficialExternalPluginLabel.mockImplementation(
      (entry: { label?: string; mo?: { plugin?: { label?: string } } }) =>
        entry.mo?.plugin?.label ?? entry.label ?? "plugin",
    );
    mocks.installPluginFromNpmSpec.mockResolvedValueOnce({
      ok: true,
      pluginId: "brave",
      targetDir: "/tmp/mo-plugins/brave",
      version: "2026.5.2",
      npmResolution: {
        name: "@mo/brave-plugin",
        version: "2026.5.2",
        resolvedSpec: "@mo/brave-plugin@2026.5.2",
      },
    });

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        tools: {
          web: {
            search: {
              provider: "brave",
            },
          },
        },
      },
      env: {},
    });

    expectRecordFields(mockCallArg(mocks.installPluginFromNpmSpec), {
      spec: expectedNpmInstallSpec("@mo/brave-plugin"),
      expectedPluginId: "brave",
      trustedSourceLinkedOfficialInstall: true,
    });
    expect(result.changes).toEqual([
      `Installed missing configured plugin "brave" from ${expectedNpmInstallSpec("@mo/brave-plugin")}.`,
    ]);
  });

  it("installs configured external speech and web-fetch plugins from selected providers", async () => {
    const packages = [
      ["firecrawl", "@mo/firecrawl-plugin"],
      ["gradium", "@mo/gradium-speech"],
      ["inworld", "@mo/inworld-speech"],
    ] as const;
    mocks.listOfficialExternalPluginCatalogEntries.mockReturnValue(
      packages.map(([id, npmSpec]) => ({
        id,
        label: id,
        install: {
          npmSpec,
          defaultChoice: "npm",
        },
      })),
    );
    mocks.resolveOfficialExternalProviderContractPluginIds.mockImplementation(
      ({ contract }: { contract: string }) => {
        if (contract === "webFetchProviders") {
          return ["firecrawl"];
        }
        if (contract === "speechProviders") {
          return ["gradium", "inworld"];
        }
        return [];
      },
    );
    for (const [pluginId, npmSpec] of packages) {
      mocks.installPluginFromNpmSpec.mockResolvedValueOnce({
        ok: true,
        pluginId,
        targetDir: `/tmp/mo-plugins/${pluginId}`,
        version: "2026.6.8",
        npmResolution: {
          name: npmSpec,
          version: "2026.6.8",
          resolvedSpec: `${npmSpec}@2026.6.8`,
        },
      });
    }

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        messages: {
          tts: {
            provider: "gradium",
            providers: {
              inworld: {},
            },
          },
        },
        tools: {
          web: {
            fetch: {
              provider: "firecrawl",
            },
          },
        },
      },
      env: {},
    });

    expect(
      mocks.installPluginFromNpmSpec.mock.calls.map(
        ([params]) => (params as { expectedPluginId?: string }).expectedPluginId,
      ),
    ).toEqual(["firecrawl", "gradium", "inworld"]);
    expect(result.changes).toEqual(
      packages.map(
        ([pluginId, npmSpec]) =>
          `Installed missing configured plugin "${pluginId}" from ${expectedNpmInstallSpec(npmSpec)}.`,
      ),
    );
  });

  it("installs a configured external model provider without an auth choice", async () => {
    mocks.listOfficialExternalPluginCatalogEntries.mockReturnValue([
      {
        id: "groq",
        label: "Groq",
        install: {
          npmSpec: "@mo/groq-provider",
          defaultChoice: "npm",
        },
        mo: {
          plugin: { id: "groq", label: "Groq" },
          providers: [{ id: "groq" }],
        },
      },
    ]);
    mocks.installPluginFromNpmSpec.mockResolvedValueOnce({
      ok: true,
      pluginId: "groq",
      targetDir: "/tmp/mo-plugins/groq",
      version: "2026.6.8",
      npmResolution: {
        name: "@mo/groq-provider",
        version: "2026.6.8",
        resolvedSpec: "@mo/groq-provider@2026.6.8",
      },
    });

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        agents: {
          defaults: {
            model: "groq/llama-3.3-70b-versatile",
          },
        },
      },
      env: {},
    });

    expectRecordFields(mockCallArg(mocks.installPluginFromNpmSpec), {
      spec: expectedNpmInstallSpec("@mo/groq-provider"),
      expectedPluginId: "groq",
      trustedSourceLinkedOfficialInstall: true,
    });
    expect(result.changes).toEqual([
      `Installed missing configured plugin "groq" from ${expectedNpmInstallSpec("@mo/groq-provider")}.`,
    ]);
  });

  it("installs an external media-understanding provider selected only by media config", async () => {
    mocks.listOfficialExternalPluginCatalogEntries.mockReturnValue([
      {
        id: "groq",
        label: "Groq",
        install: {
          npmSpec: "@mo/groq-provider",
          defaultChoice: "npm",
        },
        mo: {
          plugin: { id: "groq", label: "Groq" },
          contracts: { mediaUnderstandingProviders: ["groq"] },
        },
      },
    ]);
    mocks.installPluginFromNpmSpec.mockResolvedValueOnce({
      ok: true,
      pluginId: "groq",
      targetDir: "/tmp/mo-plugins/groq",
      version: "2026.6.8",
      npmResolution: {
        name: "@mo/groq-provider",
        version: "2026.6.8",
        resolvedSpec: "@mo/groq-provider@2026.6.8",
      },
    });

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        tools: {
          media: {
            audio: {
              models: [{ provider: "groq", model: "whisper-large-v3-turbo" }],
            },
          },
        },
      },
      env: {},
    });

    expectRecordFields(mockCallArg(mocks.installPluginFromNpmSpec), {
      spec: expectedNpmInstallSpec("@mo/groq-provider"),
      expectedPluginId: "groq",
      trustedSourceLinkedOfficialInstall: true,
    });
    expect(result.changes).toEqual([
      `Installed missing configured plugin "groq" from ${expectedNpmInstallSpec("@mo/groq-provider")}.`,
    ]);
  });

  it("installs an external speech provider selected only by voiceModel", async () => {
    mocks.listOfficialExternalPluginCatalogEntries.mockReturnValue([
      {
        id: "gradium",
        label: "Gradium",
        install: {
          npmSpec: "@mo/gradium-speech",
          defaultChoice: "npm",
        },
        mo: {
          plugin: { id: "gradium", label: "Gradium" },
          contracts: { speechProviders: ["gradium"] },
        },
      },
    ]);
    mocks.installPluginFromNpmSpec.mockResolvedValueOnce({
      ok: true,
      pluginId: "gradium",
      targetDir: "/tmp/mo-plugins/gradium",
      version: "2026.6.8",
      npmResolution: {
        name: "@mo/gradium-speech",
        version: "2026.6.8",
        resolvedSpec: "@mo/gradium-speech@2026.6.8",
      },
    });

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        agents: {
          defaults: {
            voiceModel: { primary: "gradium/tts-default" },
          },
        },
      },
      env: {},
    });

    expectRecordFields(mockCallArg(mocks.installPluginFromNpmSpec), {
      spec: expectedNpmInstallSpec("@mo/gradium-speech"),
      expectedPluginId: "gradium",
      trustedSourceLinkedOfficialInstall: true,
    });
    expect(result.changes).toEqual([
      `Installed missing configured plugin "gradium" from ${expectedNpmInstallSpec("@mo/gradium-speech")}.`,
    ]);
  });

  it("installs env-only web provider plugins before auto-detection", async () => {
    const packages = [
      ["exa", "@mo/exa-plugin", "EXA_API_KEY"],
      ["firecrawl", "@mo/firecrawl-plugin", "FIRECRAWL_API_KEY"],
    ] as const;
    mocks.listOfficialExternalPluginCatalogEntries.mockReturnValue(
      packages.map(([id, npmSpec, envVar]) => ({
        id,
        label: id,
        install: {
          npmSpec,
          defaultChoice: "npm",
        },
        mo: {
          plugin: { id, label: id },
          webSearchProviders: [
            {
              id,
              label: id,
              hint: `${id} search`,
              envVars: [envVar],
              placeholder: `${id}-key`,
              signupUrl: `https://example.com/${id}`,
            },
          ],
        },
      })),
    );
    for (const [pluginId, npmSpec] of packages) {
      mocks.installPluginFromNpmSpec.mockResolvedValueOnce({
        ok: true,
        pluginId,
        targetDir: `/tmp/mo-plugins/${pluginId}`,
        version: "2026.6.8",
        npmResolution: {
          name: npmSpec,
          version: "2026.6.8",
          resolvedSpec: `${npmSpec}@2026.6.8`,
        },
      });
    }

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {},
      env: {
        EXA_API_KEY: "exa-key",
        FIRECRAWL_API_KEY: "firecrawl-key",
      },
    });

    expect(
      mocks.installPluginFromNpmSpec.mock.calls.map(
        ([params]) => (params as { expectedPluginId?: string }).expectedPluginId,
      ),
    ).toEqual(["exa", "firecrawl"]);
    expect(result.changes).toEqual(
      packages.map(
        ([pluginId, npmSpec]) =>
          `Installed missing configured plugin "${pluginId}" from ${expectedNpmInstallSpec(npmSpec)}.`,
      ),
    );
  });

  it("installs env-only provider plugins before model discovery", async () => {
    mocks.resolveOfficialExternalProviderPluginIdsForEnv.mockReturnValue(["groq"]);
    mocks.listOfficialExternalPluginCatalogEntries.mockReturnValue([
      {
        id: "groq",
        label: "Groq",
        install: {
          npmSpec: "@mo/groq-provider",
          defaultChoice: "npm",
        },
        mo: {
          plugin: { id: "groq", label: "Groq" },
        },
      },
    ]);
    mocks.installPluginFromNpmSpec.mockResolvedValueOnce({
      ok: true,
      pluginId: "groq",
      targetDir: "/tmp/mo-plugins/groq",
      version: "2026.6.8",
      npmResolution: {
        name: "@mo/groq-provider",
        version: "2026.6.8",
        resolvedSpec: "@mo/groq-provider@2026.6.8",
      },
    });

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const env = { GROQ_API_KEY: "groq-key" };
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {},
      env,
    });

    expect(mocks.resolveOfficialExternalProviderPluginIdsForEnv).toHaveBeenCalledWith(env);
    expectRecordFields(mockCallArg(mocks.installPluginFromNpmSpec), {
      spec: expectedNpmInstallSpec("@mo/groq-provider"),
      expectedPluginId: "groq",
      trustedSourceLinkedOfficialInstall: true,
    });
    expect(result.changes).toEqual([
      `Installed missing configured plugin "groq" from ${expectedNpmInstallSpec("@mo/groq-provider")}.`,
    ]);
  });

  it("installs configured external web search plugins from beta on the beta channel", async () => {
    mocks.listOfficialExternalPluginCatalogEntries.mockReturnValue([
      {
        id: "brave",
        label: "Brave",
        install: {
          npmSpec: "@mo/brave-plugin",
          defaultChoice: "npm",
        },
        mo: {
          plugin: { id: "brave", label: "Brave" },
          webSearchProviders: [
            {
              id: "brave",
              label: "Brave Search",
              hint: "Brave Search",
              envVars: ["BRAVE_API_KEY"],
              placeholder: "BSA...",
              signupUrl: "https://example.test/brave",
              credentialPath: "plugins.entries.brave.config.webSearch.apiKey",
            },
          ],
          install: {
            npmSpec: "@mo/brave-plugin",
            defaultChoice: "npm",
          },
        },
      },
    ]);
    mocks.resolveOfficialExternalPluginId.mockImplementation(
      (entry: { id?: string; mo?: { plugin?: { id?: string } } }) =>
        entry.mo?.plugin?.id ?? entry.id,
    );
    mocks.resolveOfficialExternalPluginInstall.mockImplementation(
      (entry: { install?: unknown; mo?: { install?: unknown } }) =>
        entry.mo?.install ?? entry.install ?? null,
    );
    mocks.resolveOfficialExternalPluginLabel.mockImplementation(
      (entry: { label?: string; mo?: { plugin?: { label?: string } } }) =>
        entry.mo?.plugin?.label ?? entry.label ?? "plugin",
    );
    mocks.installPluginFromNpmSpec.mockResolvedValueOnce({
      ok: true,
      pluginId: "brave",
      targetDir: "/tmp/mo-plugins/brave",
      version: "2026.5.4-beta.1",
      npmResolution: {
        name: "@mo/brave-plugin",
        version: "2026.5.4-beta.1",
        resolvedSpec: "@mo/brave-plugin@2026.5.4-beta.1",
      },
    });

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        update: { channel: "beta" },
        tools: {
          web: {
            search: {
              provider: "brave",
            },
          },
        },
      },
      env: {},
    });

    expectRecordFields(mockCallArg(mocks.installPluginFromNpmSpec), {
      spec: "@mo/brave-plugin@beta",
      expectedPluginId: "brave",
      trustedSourceLinkedOfficialInstall: true,
    });
    const persistedRecords = mockCallArg(
      mocks.writePersistedInstalledPluginIndexInstallRecords,
    ) as Record<string, unknown>;
    expectRecordFields(persistedRecords.brave, {
      spec: "@mo/brave-plugin@2026.5.4-beta.1",
    });
    expect(mockCallArg(mocks.writePersistedInstalledPluginIndexInstallRecords, 0, 1)).toEqual({
      env: {},
    });
    expect(result.changes).toEqual([
      'Installed missing configured plugin "brave" from @mo/brave-plugin@beta.',
    ]);
  });

  it("repairs a configured plugin from a legacy npm declaration stub", async () => {
    const root = makeTempDir();
    const pluginDir = path.join(root, "extensions", "guardrail-bridge");
    writeLegacyNpmDeclarationStub({
      pluginDir,
      pluginId: "guardrail-bridge",
      npmSpec: "@guardrail-bridge/guardrail-bridge@1.0.0",
    });
    mocks.installPluginFromNpmSpec.mockResolvedValueOnce({
      ok: true,
      pluginId: "guardrail-bridge",
      targetDir: "/tmp/mo-plugins/guardrail-bridge",
      version: "1.0.0",
      npmResolution: {
        name: "@guardrail-bridge/guardrail-bridge",
        version: "1.0.0",
        resolvedSpec: "@guardrail-bridge/guardrail-bridge@1.0.0",
        integrity: "sha512-guardrail",
        resolvedAt: "2026-05-01T00:00:00.000Z",
      },
    });

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        plugins: {
          load: {
            paths: [pluginDir],
          },
          entries: {
            "guardrail-bridge": { enabled: true },
          },
        },
      },
      env: {},
    });

    expectRecordFields(mockCallArg(mocks.installPluginFromNpmSpec), {
      spec: "@guardrail-bridge/guardrail-bridge@1.0.0",
      expectedPluginId: "guardrail-bridge",
      extensionsDir: "/tmp/mo-plugins",
    });
    expect(mockCallArg(mocks.installPluginFromNpmSpec).trustedSourceLinkedOfficialInstall).toBe(
      undefined,
    );
    const records = mockCallArg(mocks.writePersistedInstalledPluginIndexInstallRecords);
    expectRecordFields((records as Record<string, unknown>)["guardrail-bridge"], {
      source: "npm",
      spec: "@guardrail-bridge/guardrail-bridge@1.0.0",
      installPath: "/tmp/mo-plugins/guardrail-bridge",
      version: "1.0.0",
      resolvedName: "@guardrail-bridge/guardrail-bridge",
    });
    expect(result.changes).toEqual([
      'Installed missing configured plugin "guardrail-bridge" from @guardrail-bridge/guardrail-bridge@1.0.0.',
    ]);
    expect(result.warnings).toStrictEqual([]);
  });

  it("installs Firecrawl for env-only web fetch when search is disabled", async () => {
    mocks.resolveOfficialExternalWebProviderContractPluginIdsForEnv.mockReturnValue(["firecrawl"]);
    mocks.listOfficialExternalPluginCatalogEntries.mockReturnValue([
      {
        id: "firecrawl",
        label: "Firecrawl",
        install: {
          npmSpec: "@mo/firecrawl-plugin",
          defaultChoice: "npm",
        },
        mo: {
          plugin: { id: "firecrawl", label: "Firecrawl" },
        },
      },
    ]);
    mocks.installPluginFromNpmSpec.mockResolvedValueOnce({
      ok: true,
      pluginId: "firecrawl",
      targetDir: "/tmp/mo-plugins/firecrawl",
      version: "2026.6.8",
      npmResolution: {
        name: "@mo/firecrawl-plugin",
        version: "2026.6.8",
        resolvedSpec: "@mo/firecrawl-plugin@2026.6.8",
      },
    });

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const env = { FIRECRAWL_API_KEY: "firecrawl-key" };
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        tools: {
          web: {
            search: {
              enabled: false,
            },
          },
        },
      },
      env,
    });

    expect(mocks.resolveOfficialExternalWebProviderContractPluginIdsForEnv).toHaveBeenCalledWith({
      contract: "webFetchProviders",
      env,
    });
    expectRecordFields(mockCallArg(mocks.installPluginFromNpmSpec), {
      spec: expectedNpmInstallSpec("@mo/firecrawl-plugin"),
      expectedPluginId: "firecrawl",
      trustedSourceLinkedOfficialInstall: true,
    });
    expect(result.changes).toEqual([
      `Installed missing configured plugin "firecrawl" from ${expectedNpmInstallSpec("@mo/firecrawl-plugin")}.`,
    ]);
  });

  it("does not install a configured external web search plugin when search is disabled", async () => {
    mocks.listOfficialExternalPluginCatalogEntries.mockReturnValue([
      {
        id: "brave",
        label: "Brave",
        install: {
          npmSpec: "@mo/brave-plugin",
          defaultChoice: "npm",
        },
        mo: {
          plugin: { id: "brave", label: "Brave" },
          webSearchProviders: [
            {
              id: "brave",
              label: "Brave Search",
              hint: "Brave Search",
              envVars: ["BRAVE_API_KEY"],
              placeholder: "BSA...",
              signupUrl: "https://example.test/brave",
              credentialPath: "plugins.entries.brave.config.webSearch.apiKey",
            },
          ],
          install: {
            npmSpec: "@mo/brave-plugin",
            defaultChoice: "npm",
          },
        },
      },
    ]);
    mocks.resolveOfficialExternalPluginId.mockImplementation(
      (entry: { id?: string; mo?: { plugin?: { id?: string } } }) =>
        entry.mo?.plugin?.id ?? entry.id,
    );
    mocks.resolveOfficialExternalPluginInstall.mockImplementation(
      (entry: { install?: unknown; mo?: { install?: unknown } }) =>
        entry.mo?.install ?? entry.install ?? null,
    );
    mocks.resolveOfficialExternalPluginLabel.mockImplementation(
      (entry: { label?: string; mo?: { plugin?: { label?: string } } }) =>
        entry.mo?.plugin?.label ?? entry.label ?? "plugin",
    );

    const { repairMissingConfiguredPluginInstalls } =
      await import("./missing-configured-plugin-install.js");
    const result = await repairMissingConfiguredPluginInstalls({
      cfg: {
        tools: {
          web: {
            search: {
              enabled: false,
              provider: "brave",
            },
          },
        },
      },
      env: {
        BRAVE_API_KEY: "brave-key",
      },
    });

    expect(mocks.installPluginFromClawHub).not.toHaveBeenCalled();
    expect(mocks.installPluginFromNpmSpec).not.toHaveBeenCalled();
    expect(mocks.writePersistedInstalledPluginIndexInstallRecords).not.toHaveBeenCalled();
    expect(result).toEqual({ changes: [], warnings: [], records: {} });
  });
});
