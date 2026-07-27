import { rituviaCatalog20260723LocalData } from "@rituvia/domain";

import { parseCatalogVersionV1, type CatalogVersionV1 } from "./versioned-catalog.js";

export const rituviaCatalog20260723Local: CatalogVersionV1 = parseCatalogVersionV1(
  rituviaCatalog20260723LocalData,
);
