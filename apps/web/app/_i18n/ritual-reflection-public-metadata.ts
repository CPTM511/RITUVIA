import type { Metadata } from "next";

import { createLocalizedPublicAlternates } from "./public-route-metadata";
import type { RitualReflectionPublicRouteId } from "./ritual-reflection-public-routes";
import type { DeploymentEnvironment } from "./seo";

type RitualReflectionPublicMetadataInput = Readonly<{
  brandName: string;
  canonicalOrigin: string;
  deploymentEnvironment: DeploymentEnvironment;
  description: string;
  locale: "en";
  publicationApproved: true;
  routeId: RitualReflectionPublicRouteId;
  title: string;
  type: "article" | "website";
}>;

export const createRitualReflectionPublicMetadata = ({
  brandName,
  canonicalOrigin,
  deploymentEnvironment,
  description,
  locale,
  publicationApproved,
  routeId,
  title,
  type,
}: RitualReflectionPublicMetadataInput): Metadata => {
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
