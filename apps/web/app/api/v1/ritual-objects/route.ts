import { NextResponse } from "next/server";

import { getWebRitualCatalog } from "../../../../server/ritual-catalog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const ritualObjectCatalogApiPath = "/api/v1/ritual-objects";

const ritualCatalogPublicHeaders = Object.freeze({
  "cache-control": "public, max-age=300, stale-while-revalidate=3600",
  "content-security-policy": "default-src 'none'; base-uri 'none'; frame-ancestors 'none'",
  "x-content-type-options": "nosniff",
});

export const GET = (): NextResponse =>
  NextResponse.json(getWebRitualCatalog(), {
    headers: ritualCatalogPublicHeaders,
    status: 200,
  });
