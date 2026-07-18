import type { NextRequest } from "next/server";

import { getWebIntention } from "../../../../../server/reflection-loop";
import { handleReflectionGet } from "../_http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = Readonly<{ params: Promise<Readonly<{ intentionId: string }>> }>;

export const GET = async (request: NextRequest, context: Context) => {
  const { intentionId } = await context.params;
  const path = `/api/v1/intentions/${intentionId}`;
  return handleReflectionGet(request, {
    get: getWebIntention,
    id: intentionId,
    kind: "intention",
    path,
  });
};
