import type { RevisitResourceV1 } from "@rituvia/domain";
import type { NextRequest } from "next/server";

import { listWebRevisits, scheduleWebRevisit } from "../../../../server/revisit";
import { handleReflectionCreate, handleReflectionList } from "../intentions/_http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revisitApiPath = "/api/v1/revisits";

export const GET = (request: NextRequest) =>
  handleReflectionList<RevisitResourceV1>(request, {
    kind: "revisit",
    list: listWebRevisits,
    path: revisitApiPath,
  });

export const POST = (request: NextRequest) =>
  handleReflectionCreate<RevisitResourceV1>(request, {
    create: scheduleWebRevisit,
    csrfRequired: true,
    kind: "revisit",
    path: revisitApiPath,
  });
