/**
 * Claude CLI argument helpers for OpenClaw-managed bundle MCP config.
 */
import fs from "node:fs/promises";
import { isRecord } from "@mo/normalization-core/record-coerce";
import { normalizeOptionalString } from "@mo/normalization-core/string-coerce";

/** Find an existing Claude `--mcp-config` argument value. */
export function findClaudeMcpConfigPath(args?: string[]): string | undefined {
  if (!args?.length) {
    return undefined;
  }
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i] ?? "";
    if (arg === "--mcp-config") {
      return normalizeOptionalString(args[i + 1]);
    }
    if (arg.startsWith("--mcp-config=")) {
      return normalizeOptionalString(arg.slice("--mcp-config=".length));
    }
  }
  return undefined;
}

/** Return Claude args with OpenClaw's strict MCP config path injected. */
export function injectClaudeMcpConfigArgs(
  args: string[] | undefined,
  mcpConfigPath: string,
): string[] {
  const next: string[] = [];
  for (let i = 0; i < (args?.length ?? 0); i += 1) {
    const arg = args?.[i] ?? "";
    if (arg === "--strict-mcp-config") {
      continue;
    }
    if (arg === "--mcp-config") {
      i += 1;
      continue;
    }
    if (arg.startsWith("--mcp-config=")) {
      continue;
    }
    next.push(arg);
  }
  next.push("--strict-mcp-config", "--mcp-config", mcpConfigPath);
  return next;
}

/** Writes the active per-attempt capture token into OpenClaw's generated Claude MCP config. */
export async function writeClaudeMcpCaptureConfig(params: {
  mcpConfigPath: string;
  captureKey: string;
}): Promise<void> {
  const raw = JSON.parse(await fs.readFile(params.mcpConfigPath, "utf-8")) as unknown;
  if (!isRecord(raw)) {
    throw new Error("Claude MCP capture requires an object config");
  }
  const mcpServers = isRecord(raw.mcpServers) ? raw.mcpServers : {};
  const mo = isRecord(mcpServers.mo) ? mcpServers.mo : undefined;
  if (!mo) {
    throw new Error("Claude MCP capture requires an mo server config");
  }
  const headers = isRecord(mo.headers) ? mo.headers : {};
  await fs.writeFile(
    params.mcpConfigPath,
    `${JSON.stringify(
      {
        ...raw,
        mcpServers: {
          ...mcpServers,
          mo: {
            ...mo,
            headers: {
              ...headers,
              "x-mo-cli-capture-key": params.captureKey,
            },
          },
        },
      },
      null,
      2,
    )}\n`,
    "utf-8",
  );
}
