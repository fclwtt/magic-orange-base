// Focused runtime contract for memory CLI/UI helpers.

export { formatErrorMessage, withManager } from "./host/mo-runtime-cli.js";
export { formatHelpExamples } from "./host/mo-runtime-cli.js";
export { resolveCommandSecretRefsViaGateway } from "./host/mo-runtime-cli.js";
export { withProgress, withProgressTotals } from "./host/mo-runtime-cli.js";
export { defaultRuntime } from "./host/mo-runtime-cli.js";
export { formatDocsLink } from "./host/mo-runtime-cli.js";
export { colorize, isRich, theme } from "./host/mo-runtime-cli.js";
export { isVerbose, setVerbose } from "./host/mo-runtime-cli.js";
export { shortenHomeInString, shortenHomePath } from "./host/mo-runtime-cli.js";
