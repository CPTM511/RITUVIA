import { NextResponse } from "next/server";

import { getWebCommerceCatalog } from "../../../../server/commerce";
import { commercePublicHeaders } from "../_commerce-http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = (): NextResponse =>
  NextResponse.json(
    {
      items: getWebCommerceCatalog().map((item) => ({
        exactContents: item.exactContents,
        name: item.name,
        price: {
          amountMinor: item.amountMinor,
          currencyCode: item.currencyCode,
        },
        productCode: item.productCode,
      })),
      schemaVersion: 1,
    },
    { headers: commercePublicHeaders, status: 200 },
  );
