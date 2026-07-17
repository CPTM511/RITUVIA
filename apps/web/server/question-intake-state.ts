import "server-only";

import { getWebRuntimeConfiguration } from "../config/server";

export type QuestionIntakeAvailability = "disabled" | "enabled";

export const loadQuestionIntakeAvailability = (): QuestionIntakeAvailability =>
  getWebRuntimeConfiguration().questionIntakeActivationReference === undefined
    ? "disabled"
    : "enabled";
