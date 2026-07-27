import type { NextRequest } from "next/server";

import { mutateWebRitualSession } from "../../../../../../server/ritual-journal";
import { handleReflectionMutation } from "../../../intentions/_http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = Readonly<{ params: Promise<Readonly<{ ritualSessionId: string }>> }>;

export const POST = async (request: NextRequest, context: Context) => {
  const { ritualSessionId } = await context.params;
  const path = `/api/v1/ritual-sessions/${ritualSessionId}/complete`;
  return handleReflectionMutation(request, {
    id: ritualSessionId,
    kind: "ritual",
    mutate: mutateWebRitualSession,
    path,
  });
};
