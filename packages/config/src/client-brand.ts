import * as z from "zod";

import { parseConfiguration } from "./parsing.js";

export type ClientBrandConfig = Readonly<{
  name: string;
  shortName: string;
  tagline: string;
  canonicalOrigin: string;
  socialHandles: Readonly<Record<string, string>>;
  assetManifest: string;
}>;

export const brandNameSchema = z.string().trim().min(1).max(120);
export const brandShortNameSchema = z.string().trim().min(1).max(60);
export const brandTaglineSchema = z.string().trim().max(240);
export const brandCanonicalOriginSchema = z
  .string()
  .max(2_048)
  .refine((value) => {
    try {
      const url = new URL(value);
      return (
        (url.protocol === "http:" || url.protocol === "https:") &&
        url.username === "" &&
        url.password === "" &&
        url.search === "" &&
        url.hash === "" &&
        url.pathname === "/" &&
        value === url.origin
      );
    } catch {
      return false;
    }
  });
export const brandSocialHandlesSchema = z.record(
  z.string().regex(/^[a-z0-9][a-z0-9_-]{0,31}$/i),
  z.string().trim().min(1).max(200),
);
export const brandAssetManifestSchema = z.string().refine((value) => {
  if (value === "") {
    return true;
  }

  if (value.startsWith("/")) {
    const url = new URL(value, "https://local.invalid");
    return (
      !value.startsWith("//") &&
      !value.includes("\\") &&
      url.pathname === value &&
      url.search === "" &&
      url.hash === ""
    );
  }

  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.username === "" &&
      url.password === "" &&
      url.search === "" &&
      url.hash === ""
    );
  } catch {
    return false;
  }
});

const clientBrandConfigSchema = z
  .object({
    name: brandNameSchema,
    shortName: brandShortNameSchema,
    tagline: brandTaglineSchema,
    canonicalOrigin: brandCanonicalOriginSchema,
    socialHandles: brandSocialHandlesSchema,
    assetManifest: brandAssetManifestSchema,
  })
  .strict();

const freezeClientBrandConfiguration = (configuration: ClientBrandConfig): ClientBrandConfig =>
  Object.freeze({
    ...configuration,
    socialHandles: Object.freeze({ ...configuration.socialHandles }),
  });

export const parseClientBrandConfiguration = (input: unknown): ClientBrandConfig =>
  freezeClientBrandConfiguration(parseConfiguration("client", clientBrandConfigSchema, input));
