import type { Metadata } from "next";

import type { DeploymentEnvironment } from "./seo";

type NumerologyPublicMetadataInput = Readonly<{
  brandName: string;
  canonicalOrigin: string;
  deploymentEnvironment: DeploymentEnvironment;
  description: string;
  pathname: string;
  title: string;
  type: "article" | "website";
}>;

export const createNumerologyPublicMetadata = ({
  brandName,
  canonicalOrigin,
  deploymentEnvironment,
  description,
  pathname,
  title,
  type,
}: NumerologyPublicMetadataInput): Metadata => {
  const canonical = new URL(pathname, canonicalOrigin).toString();
  const indexable = deploymentEnvironment === "production";
  const fullTitle = `${title} — ${brandName}`;
  return {
    alternates: {
      canonical,
      languages: {
        en: canonical,
        "x-default": canonical,
      },
    },
    description,
    openGraph: {
      description,
      siteName: brandName,
      title: fullTitle,
      type,
      url: canonical,
    },
    robots: {
      follow: indexable,
      index: indexable,
    },
    title: fullTitle,
  };
};
