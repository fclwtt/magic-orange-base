// Verifies bundled capability runtime registration from plugin metadata.
import { describe, expect, it } from "vitest";
import { buildVitestCapabilityShimAliasMap } from "./bundled-capability-runtime.js";

describe("buildVitestCapabilityShimAliasMap", () => {
  it("keeps scoped and unscoped capability shim aliases aligned", () => {
    const aliasMap = buildVitestCapabilityShimAliasMap();

    expect(aliasMap["mo/plugin-sdk/config-runtime"]).toBe(
      aliasMap["@mo/plugin-sdk/config-runtime"],
    );
    expect(aliasMap["mo/plugin-sdk/media-runtime"]).toBe(
      aliasMap["@mo/plugin-sdk/media-runtime"],
    );
    expect(aliasMap["mo/plugin-sdk/provider-onboard"]).toBe(
      aliasMap["@mo/plugin-sdk/provider-onboard"],
    );
    expect(aliasMap["mo/plugin-sdk/speech-core"]).toBe(
      aliasMap["@mo/plugin-sdk/speech-core"],
    );
  });
});
