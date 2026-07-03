import type { ModelProviderConfig } from "mo/plugin-sdk/provider-model-shared";
import { buildCohereCatalogModels, COHERE_BASE_URL } from "./models.js";

export function buildCohereProvider(): ModelProviderConfig {
  return {
    baseUrl: COHERE_BASE_URL,
    api: "openai-completions",
    models: buildCohereCatalogModels(),
  };
}
