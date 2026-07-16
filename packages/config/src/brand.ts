import * as z from "zod";

import {
  brandAssetManifestSchema,
  brandCanonicalOriginSchema,
  brandNameSchema,
  brandShortNameSchema,
  brandSocialHandlesSchema,
  brandTaglineSchema,
  parseClientBrandConfiguration,
  type ClientBrandConfig,
} from "./client-brand.js";
import { parseConfiguration } from "./parsing.js";
import { workingBrandConfiguration } from "./working-brand.js";

export { parseClientBrandConfiguration, type ClientBrandConfig } from "./client-brand.js";

export type BrandConfig = Readonly<{
  name: string;
  shortName: string;
  legalEntity: string;
  tagline: string;
  canonicalOrigin: string;
  supportEmail: string;
  transactionalSender: string;
  socialHandles: Readonly<Record<string, string>>;
  assetManifest: string;
}>;

export type BrandConfigOverrides = Partial<{
  [Key in keyof BrandConfig]: BrandConfig[Key] | undefined;
}>;

const optionalEmailSchema = z.union([z.literal(""), z.email()]);
const emailSenderSchema = z.union([
  z.email(),
  z
    .string()
    .regex(/^[^<>\r\n]{1,200}\s<[^<>\s]+@[^<>\s]+>$/)
    .max(320),
]);
const optionalEmailSenderSchema = z.union([z.literal(""), emailSenderSchema]);
const brandConfigSchema = z
  .object({
    name: brandNameSchema,
    shortName: brandShortNameSchema,
    legalEntity: z.string().trim().max(200),
    tagline: brandTaglineSchema,
    canonicalOrigin: brandCanonicalOriginSchema,
    supportEmail: optionalEmailSchema,
    transactionalSender: optionalEmailSenderSchema,
    socialHandles: brandSocialHandlesSchema,
    assetManifest: brandAssetManifestSchema,
  })
  .strict();

const freezeBrandConfiguration = (configuration: BrandConfig): BrandConfig =>
  Object.freeze({
    ...configuration,
    socialHandles: Object.freeze({ ...configuration.socialHandles }),
  });

export const createBrandConfiguration = (overrides: BrandConfigOverrides = {}): BrandConfig => {
  const definedOverrides = Object.fromEntries(
    Object.entries(overrides).filter(([, value]) => value !== undefined),
  ) as BrandConfigOverrides;

  return freezeBrandConfiguration(
    parseConfiguration("brand", brandConfigSchema, {
      ...workingBrandConfiguration,
      ...definedOverrides,
    }),
  );
};

export const projectClientBrandConfiguration = (configuration: BrandConfig): ClientBrandConfig =>
  parseClientBrandConfiguration({
    name: configuration.name,
    shortName: configuration.shortName,
    tagline: configuration.tagline,
    canonicalOrigin: configuration.canonicalOrigin,
    socialHandles: configuration.socialHandles,
    assetManifest: configuration.assetManifest,
  });
