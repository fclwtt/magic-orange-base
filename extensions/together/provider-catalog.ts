// Together provider module implements model/runtime integration.
import { buildManifestModelProviderConfig } from "mo/plugin-sdk/provider-catalog-shared";
import type { ModelProviderConfig } from "mo/plugin-sdk/provider-model-shared";
import manifest from "./mo.plugin.json" with { type: "json" };

export function buildTogetherProvider(): ModelProviderConfig {
  return buildManifestModelProviderConfig({
    providerId: "together",
    catalog: manifest.modelCatalog.providers.together,
  });
}
