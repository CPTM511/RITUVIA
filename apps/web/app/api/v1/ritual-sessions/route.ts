import type { NextRequest } from "next/server";

import { createWebRitualSession } from "../../../../server/reflection-loop";
import { handleReflectionCreate } from "../intentions/_http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const ritualSessionApiPath = "/api/v1/ritual-sessions";

export const POST = (request: NextRequest) =>
  handleReflectionCreate(request, {
    create: createWebRitualSession,
    kind: "ritual",
    path: ritualSessionApiPath,
  });
