import type { NextRequest } from "next/server";

import { createWebIntention } from "../../../../server/reflection-loop";
import { handleReflectionCreate } from "./_http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const intentionApiPath = "/api/v1/intentions";

export const POST = (request: NextRequest) =>
  handleReflectionCreate(request, {
    create: createWebIntention,
    csrfRequired: true,
    kind: "intention",
    path: intentionApiPath,
  });
