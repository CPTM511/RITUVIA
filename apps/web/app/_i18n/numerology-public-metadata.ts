import type { Metadata } from "next";

import { createLocalizedPublicAlternates } from "./public-route-metadata";
import type { NumerologyPublicRouteId } from "./numerology-public-routes";
import type { DeploymentEnvironment } from "./seo";

type NumerologyPublicMetadataInput = Readonly<{
  brandName: string;
  canonicalOrigin: string;
  deploymentEnvironment: DeploymentEnvironment;
  description: string;
  locale: "en";
  routeId: NumerologyPublicRouteId;
  title: string;
  type: "article" | "website";
}>;

export const createNumerologyPublicMetadata = ({
  brandName,
  canonicalOrigin,
  deploymentEnvironment,
  description,
  locale,
  routeId,
  title,
  type,
}: NumerologyPublicMetadataInput): Metadata => {
  const alternates = createLocalizedPublicAlternates(canonicalOrigin, locale, routeId);
  const canonical = alternates?.canonical as string | undefined;
  const indexable = deploymentEnvironment === "production" && alternates !== null;
  const fullTitle = `${title} — ${brandName}`;
  return {
    ...(alternates === null ? {} : { alternates }),
    description,
    openGraph: {
      description,
      siteName: brandName,
      title: fullTitle,
      type,
      ...(canonical === undefined ? {} : { url: canonical }),
    },
    robots: {
      follow: indexable,
      index: indexable,
    },
    title: fullTitle,
  };
};
