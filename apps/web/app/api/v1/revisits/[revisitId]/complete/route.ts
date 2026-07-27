import type { NextRequest } from "next/server";

import { mutateWebRevisit } from "../../../../../../server/revisit";
import { handleReflectionMutation } from "../../../intentions/_http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = Readonly<{ params: Promise<Readonly<{ revisitId: string }>> }>;

export const POST = async (request: NextRequest, context: Context) => {
  const { revisitId } = await context.params;
  const path = `/api/v1/revisits/${revisitId}/complete`;
  return handleReflectionMutation(request, {
    id: revisitId,
    kind: "revisit",
    mutate: mutateWebRevisit,
    path,
  });
};
