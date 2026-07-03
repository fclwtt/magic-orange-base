// Parses gateway process command lines for process discovery.
import { normalizeLowercaseStringOrEmpty } from "@mo/normalization-core/string-coerce";
import { normalizeStringEntries } from "@mo/normalization-core/string-normalization";

function normalizeProcArg(arg: string): string {
  return normalizeLowercaseStringOrEmpty(arg.replaceAll("\\", "/"));
}

export function parseProcCmdline(raw: string): string[] {
  return normalizeStringEntries(raw.split("\0"));
}

export function isGatewayArgv(args: string[], opts?: { allowGatewayBinary?: boolean }): boolean {
  const normalized = args.map(normalizeProcArg);
  if (!normalized.includes("gateway")) {
    return false;
  }

  const entryCandidates = [
    "dist/index.js",
    "dist/entry.js",
    "mo.mjs",
    "scripts/run-node.mjs",
    "src/entry.ts",
    "src/index.ts",
  ];
  if (normalized.some((arg) => entryCandidates.some((entry) => arg.endsWith(entry)))) {
    return true;
  }

  const exe = (normalized[0] ?? "").replace(/\.(bat|cmd|exe)$/i, "");
  return (
    exe.endsWith("/mo") ||
    exe === "mo" ||
    (opts?.allowGatewayBinary === true && exe.endsWith("/mo-gateway"))
  );
}
