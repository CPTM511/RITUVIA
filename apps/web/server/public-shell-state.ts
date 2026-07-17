import { loadWebFeatureFlagEvaluator } from "./feature-flags";

import type { PublicShellState } from "../app/_i18n/seo";

export const loadPublicShellState = async (): Promise<PublicShellState> => {
  try {
    const evaluator = await loadWebFeatureFlagEvaluator();
    return evaluator.evaluate("experience.public_shell", { locale: "en" }).enabled
      ? "enabled"
      : "disabled";
  } catch {
    return "unavailable";
  }
};
