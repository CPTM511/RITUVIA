import * as z from "zod";

import { ConfigurationError, type ConfigurationScope } from "./errors.js";

export const parseConfiguration = <Output>(
  scope: ConfigurationScope,
  schema: z.ZodType<Output>,
  input: unknown,
): Output => {
  const result = schema.safeParse(input);

  if (result.success) {
    return result.data;
  }

  const issues = result.error.issues.map((issue) => ({
    code: "invalid" as const,
    key: issue.path.length === 0 ? "configuration" : issue.path.join("."),
  }));

  throw new ConfigurationError(scope, issues);
};
