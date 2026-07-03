// Matrix plugin module implements monitor route test support behavior.
export {
  registerSessionBindingAdapter,
  testing,
} from "mo/plugin-sdk/session-binding-runtime";
export { resolveAgentRoute } from "mo/plugin-sdk/routing";
export {
  createTestRegistry,
  setActivePluginRegistry,
} from "mo/plugin-sdk/plugin-test-runtime";
export type { OpenClawConfig } from "mo/plugin-sdk/config-contracts";
