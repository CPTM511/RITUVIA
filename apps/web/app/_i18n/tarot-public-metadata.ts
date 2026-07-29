import type { Metadata } from "next";

import { createLocalizedPublicAlternates } from "./public-route-metadata";
import type { TarotPublicRouteId } from "./tarot-public-routes";
import type { DeploymentEnvironment } from "./seo";

type TarotPublicMetadataInput = Readonly<{
  brandName: string;
  canonicalOrigin: string;
  deploymentEnvironment: DeploymentEnvironment;
  description: string;
  locale: "en";
  publicationApproved: true;
  routeId: TarotPublicRouteId;
  title: string;
  type: "article" | "website";
}>;

export const createTarotPublicMetadata = ({
  brandName,
  canonicalOrigin,
  deploymentEnvironment,
  description,
  locale,
  publicationApproved,
  routeId,
  title,
  type,
}: TarotPublicMetadataInput): Metadata => {
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
