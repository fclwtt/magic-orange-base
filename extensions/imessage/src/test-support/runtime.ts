// Imessage plugin module implements runtime behavior.
import fs from "node:fs";
import path from "node:path";
import type {
  OpenKeyedStoreOptions,
  PluginStateSyncKeyedStore,
} from "mo/plugin-sdk/plugin-state-runtime";
import {
  createPluginStateKeyedStoreForTests,
  createPluginStateSyncKeyedStoreForTests,
  resetPluginStateStoreForTests,
} from "mo/plugin-sdk/plugin-state-test-runtime";
import type { PluginRuntime } from "mo/plugin-sdk/runtime-store";
import { resolvePreferredOpenClawTmpDir } from "mo/plugin-sdk/temp-path";
import { setIMessageRuntime } from "../runtime.js";

function createIMessageTestEnv(): NodeJS.ProcessEnv {
  const stateDir = fs.mkdtempSync(
    path.join(resolvePreferredOpenClawTmpDir(), "mo-imessage-state-"),
  );
  return { ...process.env, MO_STATE_DIR: stateDir };
}

let imessageTestEnv = createIMessageTestEnv();

export function createIMessagePluginStateSyncStoreForTest<T>(
  options: OpenKeyedStoreOptions,
): PluginStateSyncKeyedStore<T> {
  return createPluginStateSyncKeyedStoreForTests<T>("imessage", {
    ...options,
    env: imessageTestEnv,
  });
}

export function installIMessageStateRuntimeForTest(): void {
  imessageTestEnv = createIMessageTestEnv();
  resetPluginStateStoreForTests();
  setIMessageRuntime({
    state: {
      openKeyedStore: ((options) =>
        createPluginStateKeyedStoreForTests("imessage", {
          ...options,
          env: imessageTestEnv,
        })) as PluginRuntime["state"]["openKeyedStore"],
      openSyncKeyedStore: ((options) =>
        createIMessagePluginStateSyncStoreForTest(
          options,
        )) as PluginRuntime["state"]["openSyncKeyedStore"],
    },
    channel: {},
  } as PluginRuntime);
}

export function installIMessageFailingStateRuntimeForTest(): void {
  setIMessageRuntime({
    state: {
      openKeyedStore: (() => {
        throw new Error("test plugin-state failure");
      }) as PluginRuntime["state"]["openKeyedStore"],
      openSyncKeyedStore: (() => {
        throw new Error("test plugin-state failure");
      }) as PluginRuntime["state"]["openSyncKeyedStore"],
    },
    channel: {},
  } as PluginRuntime);
}
