import type { Metadata } from "next";

import type { AstrologyPublicRouteId } from "./astrology-public-routes";
import { createLocalizedPublicAlternates } from "./public-route-metadata";
import type { DeploymentEnvironment } from "./seo";

type AstrologyPublicMetadataInput = Readonly<{
  brandName: string;
  canonicalOrigin: string;
  deploymentEnvironment: DeploymentEnvironment;
  description: string;
  locale: "en";
  publicationApproved: boolean;
  routeId: AstrologyPublicRouteId;
  title: string;
  type: "article" | "website";
}>;

export const createAstrologyPublicMetadata = ({
  brandName,
  canonicalOrigin,
  deploymentEnvironment,
  description,
  locale,
  publicationApproved,
  routeId,
  title,
  type,
}: AstrologyPublicMetadataInput): Metadata => {
  const alternates = createLocalizedPublicAlternates(canonicalOrigin, locale, routeId);
  const canonical = alternates?.canonical as string | undefined;
  const indexable =
    deploymentEnvironment === "production" && publicationApproved && alternates !== null;
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
