import type { Metadata } from "next";

import { publicPageInventoryRecord } from "./public-page-inventory";
import { publicRouteRegistry, type PublicRouteId } from "./public-routes";

export const createLocalizedPublicAlternates = (
  canonicalOrigin: string,
  locale: string,
  routeId: PublicRouteId,
): NonNullable<Metadata["alternates"]> | null => {
  const route = publicRouteRegistry.route(routeId, locale);
  const defaultRoute = publicRouteRegistry.route(routeId, publicRouteRegistry.defaultLocale);
  if (
    route === null ||
    defaultRoute === null ||
    publicPageInventoryRecord(routeId, locale) === null ||
    publicPageInventoryRecord(routeId, publicRouteRegistry.defaultLocale) === null
  ) {
    return null;
  }
  const languages = Object.fromEntries(
    Object.entries(publicRouteRegistry.alternates(routeId)).map(([alternateLocale, alternate]) => [
      alternateLocale,
      new URL(alternate.pathname, canonicalOrigin).toString(),
    ]),
  );
  languages["x-default"] = new URL(defaultRoute.pathname, canonicalOrigin).toString();
  return {
    canonical: new URL(route.pathname, canonicalOrigin).toString(),
    languages,
  };
};
