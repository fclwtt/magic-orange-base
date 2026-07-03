// Verifies video-generation tool registration through the shared generation harness.
import { describeOpenClawGenerationToolRegistration } from "./mo-tools.generation.test-support.js";

describeOpenClawGenerationToolRegistration({
  suiteName: "mo tools video generation registration",
  toolName: "video_generate",
  toolLabel: "a video-generation tool",
});
