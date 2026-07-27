import { NextResponse } from "next/server";

import { loadWebProductCatalogApplicationService } from "../../../../server/product-catalog";
import { commercePublicHeaders } from "../_commerce-http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = async (): Promise<NextResponse> => {
  try {
    return NextResponse.json(await loadWebProductCatalogApplicationService().readActive(), {
      headers: commercePublicHeaders,
      status: 200,
    });
  } catch {
    return NextResponse.json(
      {
        code: "CATALOG_UNAVAILABLE",
        schemaVersion: "catalog-error.v1",
      },
      {
        headers: { ...commercePublicHeaders, "cache-control": "no-store" },
        status: 503,
      },
    );
  }
};
