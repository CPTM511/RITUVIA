import * as z from "zod";

import { parseClientBrandConfiguration, type ClientBrandConfig } from "./client-brand.js";
import { parseConfiguration } from "./parsing.js";

export type ClientConfiguration = Readonly<{
  brand: ClientBrandConfig;
}>;

const clientConfigurationShapeSchema = z
  .object({
    brand: z.unknown(),
  })
  .strict();

export const parseClientConfiguration = (input: unknown): ClientConfiguration => {
  const parsed = parseConfiguration("client", clientConfigurationShapeSchema, input);

  return Object.freeze({
    brand: parseClientBrandConfiguration(parsed.brand),
  });
};
