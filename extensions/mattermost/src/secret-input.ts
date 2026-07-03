// Mattermost plugin module implements secret input behavior.
export type { SecretInput } from "mo/plugin-sdk/secret-input";
export {
  buildSecretInputSchema,
  hasConfiguredSecretInput,
  normalizeResolvedSecretInputString,
  normalizeSecretInputString,
} from "mo/plugin-sdk/secret-input";
