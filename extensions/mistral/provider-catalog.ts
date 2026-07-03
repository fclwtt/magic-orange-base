// Mistral provider module implements model/runtime integration.
import { buildManifestModelProviderConfig } from "mo/plugin-sdk/provider-catalog-shared";
import type { ModelProviderConfig } from "mo/plugin-sdk/provider-model-shared";
import manifest from "./mo.plugin.json" with { type: "json" };

export function buildMistralProvider(): ModelProviderConfig {
  return buildManifestModelProviderConfig({
    providerId: "mistral",
    catalog: manifest.modelCatalog.providers.mistral,
  });
}
