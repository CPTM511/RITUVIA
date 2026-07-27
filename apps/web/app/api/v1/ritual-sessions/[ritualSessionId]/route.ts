import type { NextRequest } from "next/server";

import { getWebRitualSession } from "../../../../../server/reflection-loop";
import {
  getWebRitualSessionV2,
  mutateWebRitualSession,
} from "../../../../../server/ritual-journal";
import { handleReflectionGet, handleReflectionMutation } from "../../intentions/_http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = Readonly<{ params: Promise<Readonly<{ ritualSessionId: string }>> }>;

export const GET = async (request: NextRequest, context: Context) => {
  const { ritualSessionId } = await context.params;
  const path = `/api/v1/ritual-sessions/${ritualSessionId}`;
  return handleReflectionGet(request, {
    get: async (...input) =>
      (await getWebRitualSession(...input)) ?? getWebRitualSessionV2(...input),
    id: ritualSessionId,
    kind: "ritual",
    path,
  });
};

export const PATCH = async (request: NextRequest, context: Context) => {
  const { ritualSessionId } = await context.params;
  const path = `/api/v1/ritual-sessions/${ritualSessionId}`;
  return handleReflectionMutation(request, {
    id: ritualSessionId,
    kind: "ritual",
    mutate: mutateWebRitualSession,
    path,
  });
};
