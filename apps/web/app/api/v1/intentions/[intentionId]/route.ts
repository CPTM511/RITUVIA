import { reflectionIntentionMutationSchemaVersion } from "@rituvia/domain";
import type { NextRequest } from "next/server";

import { getWebIntention, mutateWebIntention } from "../../../../../server/reflection-loop";
import { handleReflectionDelete, handleReflectionGet, handleReflectionMutation } from "../_http";

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

export const PATCH = async (request: NextRequest, context: Context) => {
  const { intentionId } = await context.params;
  const path = `/api/v1/intentions/${intentionId}`;
  return handleReflectionMutation(request, {
    id: intentionId,
    kind: "intention",
    mutate: mutateWebIntention,
    path,
  });
};

export const DELETE = async (request: NextRequest, context: Context) => {
  const { intentionId } = await context.params;
  const path = `/api/v1/intentions/${intentionId}`;
  return handleReflectionDelete(request, {
    id: intentionId,
    kind: "intention",
    mutate: mutateWebIntention,
    path,
    schemaVersion: reflectionIntentionMutationSchemaVersion,
  });
};
