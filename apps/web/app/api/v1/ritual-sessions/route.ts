import type { ReflectionRitualResourceV1, RitualSessionResourceV2 } from "@rituvia/domain";
import type { NextRequest } from "next/server";

import { createWebRitualSession } from "../../../../server/reflection-loop";
import { startWebRitualSession } from "../../../../server/ritual-journal";
import { handleReflectionCreate } from "../intentions/_http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const ritualSessionApiPath = "/api/v1/ritual-sessions";

export const POST = (request: NextRequest) =>
  handleReflectionCreate<ReflectionRitualResourceV1 | RitualSessionResourceV2>(request, {
    create: (body, ...rest) =>
      typeof body === "object" &&
      body !== null &&
      !Array.isArray(body) &&
      (body as Record<string, unknown>).schemaVersion === "ritual-session.v2"
        ? startWebRitualSession(body, ...rest)
        : createWebRitualSession(body, ...rest),
    csrfRequired: true,
    kind: "ritual",
    path: ritualSessionApiPath,
  });
