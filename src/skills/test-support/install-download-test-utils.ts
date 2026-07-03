// Install download test utilities provide isolated state and workspace paths.
import {
  createOpenClawTestState,
  type OpenClawTestState,
} from "../../test-utils/mo-test-state.js";

/** Creates isolated OpenClaw state for install download tests. */
export async function createInstallDownloadTestState(): Promise<OpenClawTestState> {
  return await createOpenClawTestState({
    layout: "state-only",
    prefix: "mo-skills-install-",
  });
}
