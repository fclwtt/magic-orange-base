// Proxy capture env helpers build proxy-related env vars for child processes.
import { randomUUID } from "node:crypto";
import type { Agent } from "node:http";
import process from "node:process";
import { createAmbientNodeProxyAgent } from "@mo/proxyline";
import {
  resolveDebugProxyBlobDir,
  resolveDebugProxyCertDir,
  resolveDebugProxyDbPath,
} from "./paths.js";

// Environment contract for debug proxy capture. These vars are passed to child
// processes and provider transports so capture sessions share one store/proxy.
export const MO_DEBUG_PROXY_ENABLED = "MO_DEBUG_PROXY_ENABLED";
export const MO_DEBUG_PROXY_URL = "MO_DEBUG_PROXY_URL";
/** @deprecated Capture storage now lives in the shared state database. */
export const MO_DEBUG_PROXY_DB_PATH = "MO_DEBUG_PROXY_DB_PATH";
/** @deprecated Capture payloads now live in the shared state database. */
export const MO_DEBUG_PROXY_BLOB_DIR = "MO_DEBUG_PROXY_BLOB_DIR";
export const MO_DEBUG_PROXY_CERT_DIR = "MO_DEBUG_PROXY_CERT_DIR";
export const MO_DEBUG_PROXY_SESSION_ID = "MO_DEBUG_PROXY_SESSION_ID";
export const MO_DEBUG_PROXY_REQUIRE = "MO_DEBUG_PROXY_REQUIRE";

export type DebugProxySettings = {
  enabled: boolean;
  required: boolean;
  proxyUrl?: string;
  /** @deprecated Capture storage now lives in the shared state database. */
  dbPath: string;
  /** @deprecated Capture payloads now live in the shared state database. */
  blobDir: string;
  certDir: string;
  sessionId: string;
  sourceProcess: string;
};

let cachedImplicitSessionId: string | undefined;

function isTruthy(value: string | undefined): boolean {
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

export function resolveDebugProxySettings(
  env: NodeJS.ProcessEnv = process.env,
): DebugProxySettings {
  const enabled = isTruthy(env[MO_DEBUG_PROXY_ENABLED]);
  const explicitSessionId = env[MO_DEBUG_PROXY_SESSION_ID]?.trim() || undefined;
  // Local implicit sessions stay stable within one process so repeated callers
  // write to the same capture session until an explicit id overrides it.
  const sessionId = explicitSessionId ?? (cachedImplicitSessionId ??= randomUUID());
  return {
    enabled,
    required: isTruthy(env[MO_DEBUG_PROXY_REQUIRE]),
    proxyUrl: env[MO_DEBUG_PROXY_URL]?.trim() || undefined,
    dbPath: env[MO_DEBUG_PROXY_DB_PATH]?.trim() || resolveDebugProxyDbPath(env),
    blobDir: env[MO_DEBUG_PROXY_BLOB_DIR]?.trim() || resolveDebugProxyBlobDir(env),
    certDir: env[MO_DEBUG_PROXY_CERT_DIR]?.trim() || resolveDebugProxyCertDir(env),
    sessionId,
    sourceProcess: "mo",
  };
}

export function applyDebugProxyEnv(
  env: NodeJS.ProcessEnv,
  params: {
    proxyUrl: string;
    sessionId: string;
    certDir?: string;
  },
): NodeJS.ProcessEnv {
  // Child process env forces proxy capture and standard proxy variables while
  // preserving unrelated environment values.
  const baseEnv = { ...env };
  delete baseEnv.MO_DEBUG_PROXY_DB_PATH;
  delete baseEnv.MO_DEBUG_PROXY_BLOB_DIR;
  return {
    ...baseEnv,
    [MO_DEBUG_PROXY_ENABLED]: "1",
    [MO_DEBUG_PROXY_REQUIRE]: "1",
    [MO_DEBUG_PROXY_URL]: params.proxyUrl,
    [MO_DEBUG_PROXY_CERT_DIR]: params.certDir ?? resolveDebugProxyCertDir(env),
    [MO_DEBUG_PROXY_SESSION_ID]: params.sessionId,
    HTTP_PROXY: params.proxyUrl,
    HTTPS_PROXY: params.proxyUrl,
    ALL_PROXY: params.proxyUrl,
  };
}

export function createDebugProxyWebSocketAgent(settings: DebugProxySettings): Agent | undefined {
  if (!settings.enabled || !settings.proxyUrl) {
    return undefined;
  }
  return createAmbientNodeProxyAgent({
    protocol: "https",
    env: {
      HTTP_PROXY: settings.proxyUrl,
      HTTPS_PROXY: settings.proxyUrl,
      ALL_PROXY: undefined,
      NO_PROXY: undefined,
      http_proxy: undefined,
      https_proxy: undefined,
      all_proxy: undefined,
      no_proxy: undefined,
    },
  }) as Agent | undefined;
}

// Configured URLs win over ambient capture settings; callers use this when a
// channel/provider already exposes an explicit proxy option.
export function resolveEffectiveDebugProxyUrl(configuredProxyUrl?: string): string | undefined {
  const explicit = configuredProxyUrl?.trim();
  if (explicit) {
    return explicit;
  }
  const settings = resolveDebugProxySettings();
  return settings.enabled ? settings.proxyUrl : undefined;
}
