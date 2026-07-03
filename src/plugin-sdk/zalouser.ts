/**
 * @deprecated Compatibility facade for published Lark/Zalo packages that imported
 * command authorization through `mo/plugin-sdk/zalouser`.
 */
export {
  resolveSenderCommandAuthorization,
  resolveSenderCommandAuthorizationWithRuntime,
} from "./command-auth.js";
export type {
  CommandAuthorizationRuntime,
  ResolveSenderCommandAuthorizationParams,
  ResolveSenderCommandAuthorizationWithRuntimeParams,
} from "./command-auth.js";
