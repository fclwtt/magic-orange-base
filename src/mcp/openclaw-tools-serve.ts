/**
 * Standalone MCP server for selected built-in OpenClaw tools.
 *
 * Run via: node --import tsx src/mcp/mo-tools-serve.ts
 * Or: bun src/mcp/mo-tools-serve.ts
 */
import { pathToFileURL } from "node:url";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { AnyAgentTool } from "../agents/tools/common.js";
import { createCronTool } from "../agents/tools/cron-tool.js";
import { formatErrorMessage } from "../infra/errors.js";
import { connectToolsMcpServerToStdio, createToolsMcpServer } from "./tools-stdio-server.js";

export const MO_TOOLS_MCP_AGENT_SESSION_KEY_ENV = "MO_TOOLS_MCP_AGENT_SESSION_KEY";

export function resolveOpenClawToolsMcpAgentSessionKey(
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  return env[MO_TOOLS_MCP_AGENT_SESSION_KEY_ENV]?.trim() || undefined;
}

export function resolveOpenClawToolsForMcp(
  params: {
    agentSessionKey?: string;
  } = {},
): AnyAgentTool[] {
  const agentSessionKey = (
    params.agentSessionKey ?? resolveOpenClawToolsMcpAgentSessionKey()
  )?.trim();
  if (!agentSessionKey) {
    throw new Error(`${MO_TOOLS_MCP_AGENT_SESSION_KEY_ENV} is required`);
  }
  return [createCronTool({ agentSessionKey, creatorToolAllowlist: [{ name: "cron" }] })];
}

function createOpenClawToolsMcpServer(
  params: {
    tools?: AnyAgentTool[];
  } = {},
): Server {
  const tools = params.tools ?? resolveOpenClawToolsForMcp();
  return createToolsMcpServer({ name: "mo-tools", tools });
}

async function serveOpenClawToolsMcp(): Promise<void> {
  const server = createOpenClawToolsMcpServer();
  await connectToolsMcpServerToStdio(server);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  serveOpenClawToolsMcp().catch((err: unknown) => {
    process.stderr.write(`mo-tools-serve: ${formatErrorMessage(err)}\n`);
    process.exit(1);
  });
}
