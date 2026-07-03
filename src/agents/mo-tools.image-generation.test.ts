// Verifies image-generation tool registration through the shared generation harness.
import { describeOpenClawGenerationToolRegistration } from "./mo-tools.generation.test-support.js";

describeOpenClawGenerationToolRegistration({
  suiteName: "mo tools image generation registration",
  toolName: "image_generate",
  toolLabel: "an image-generation tool",
});
