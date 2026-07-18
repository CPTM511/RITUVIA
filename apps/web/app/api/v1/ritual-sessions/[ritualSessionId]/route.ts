import type { NextRequest } from "next/server";

import { getWebRitualSession } from "../../../../../server/reflection-loop";
import { handleReflectionGet } from "../../intentions/_http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = Readonly<{ params: Promise<Readonly<{ ritualSessionId: string }>> }>;

export const GET = async (request: NextRequest, context: Context) => {
  const { ritualSessionId } = await context.params;
  const path = `/api/v1/ritual-sessions/${ritualSessionId}`;
  return handleReflectionGet(request, {
    get: getWebRitualSession,
    id: ritualSessionId,
    kind: "ritual",
    path,
  });
};
