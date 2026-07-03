// ACPX tests cover process lease plugin behavior.
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  createPluginStateKeyedStoreForTests,
  resetPluginStateStoreForTests,
} from "mo/plugin-sdk/plugin-state-test-runtime";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createAcpxProcessLeaseStore,
  openAcpxProcessLeaseStateStore,
  MO_ACPX_LEASE_ID_ARG,
  MO_ACPX_LEASE_ID_ENV,
  MO_GATEWAY_INSTANCE_ID_ARG,
  MO_GATEWAY_INSTANCE_ID_ENV,
  withAcpxLeaseEnvironment,
  type AcpxProcessLease,
} from "./process-lease.js";

function makeLease(index: number): AcpxProcessLease {
  return {
    leaseId: `lease-${index}`,
    gatewayInstanceId: "gateway-test",
    sessionKey: `agent:codex:acp:${index}`,
    wrapperRoot: "/tmp/mo/acpx",
    wrapperPath: "/tmp/mo/acpx/codex-acp-wrapper.mjs",
    rootPid: 1000 + index,
    commandHash: `hash-${index}`,
    startedAt: index,
    state: "open",
  };
}

describe("createAcpxProcessLeaseStore", () => {
  let stateDir = "";
  let env: NodeJS.ProcessEnv;

  beforeEach(async () => {
    resetPluginStateStoreForTests();
    stateDir = await mkdtemp(path.join(tmpdir(), "mo-acpx-leases-"));
    env = { ...process.env, MO_STATE_DIR: stateDir };
  });

  afterEach(async () => {
    await rm(stateDir, { recursive: true, force: true });
  });

  function createStore() {
    return createAcpxProcessLeaseStore({
      store: openAcpxProcessLeaseStateStore((options) =>
        createPluginStateKeyedStoreForTests("acpx", { ...options, env }),
      ),
    });
  }

  it("serializes concurrent lease saves without dropping records", async () => {
    const store = createStore();
    await Promise.all(Array.from({ length: 25 }, (_, index) => store.save(makeLease(index))));

    const leases = await store.listOpen("gateway-test");
    expect(leases.map((lease) => lease.leaseId).toSorted()).toEqual(
      Array.from({ length: 25 }, (_, index) => `lease-${index}`).toSorted(),
    );
  });

  it("removes terminal leases from the live lease namespace", async () => {
    const store = createStore();
    const openLease = makeLease(1);
    const closedLease = makeLease(2);
    await store.save(openLease);
    await store.save(closedLease);

    await store.markState(closedLease.leaseId, "closed");

    await expect(store.load(closedLease.leaseId)).resolves.toBeUndefined();
    await expect(store.listOpen("gateway-test")).resolves.toEqual([openLease]);
  });
});

describe("withAcpxLeaseEnvironment", () => {
  it("adds lease environment and wrapper args on POSIX", () => {
    const command = withAcpxLeaseEnvironment({
      command: "node /tmp/mo/acpx/codex-acp-wrapper.mjs",
      leaseId: "lease-test",
      gatewayInstanceId: "gateway-test",
      platform: "darwin",
    });

    expect(command).toBe(
      [
        "env",
        `${MO_ACPX_LEASE_ID_ENV}=lease-test`,
        `${MO_GATEWAY_INSTANCE_ID_ENV}=gateway-test`,
        "node /tmp/mo/acpx/codex-acp-wrapper.mjs",
        MO_ACPX_LEASE_ID_ARG,
        "lease-test",
        MO_GATEWAY_INSTANCE_ID_ARG,
        "gateway-test",
      ].join(" "),
    );
  });

  it("keeps Windows logs keyed by lease id with wrapper args", () => {
    const command = withAcpxLeaseEnvironment({
      command: "node C:/mo/acpx/codex-acp-wrapper.mjs",
      leaseId: "lease-test",
      gatewayInstanceId: "gateway-test",
      platform: "win32",
    });

    expect(command).toBe(
      [
        "node C:/mo/acpx/codex-acp-wrapper.mjs",
        MO_ACPX_LEASE_ID_ARG,
        "lease-test",
        MO_GATEWAY_INSTANCE_ID_ARG,
        "gateway-test",
      ].join(" "),
    );
    expect(command).not.toContain(`${MO_ACPX_LEASE_ID_ENV}=`);
    expect(command).not.toContain(`${MO_GATEWAY_INSTANCE_ID_ENV}=`);
  });
});
