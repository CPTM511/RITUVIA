import { revisitMutationSchemaVersion } from "@rituvia/domain";
import type { NextRequest } from "next/server";

import { getWebRevisit, mutateWebRevisit } from "../../../../../server/revisit";
import {
  handleReflectionDelete,
  handleReflectionGet,
  handleReflectionMutation,
} from "../../intentions/_http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = Readonly<{ params: Promise<Readonly<{ revisitId: string }>> }>;

export const GET = async (request: NextRequest, context: Context) => {
  const { revisitId } = await context.params;
  const path = `/api/v1/revisits/${revisitId}`;
  return handleReflectionGet(request, {
    get: getWebRevisit,
    id: revisitId,
    kind: "revisit",
    path,
  });
};

export const PATCH = async (request: NextRequest, context: Context) => {
  const { revisitId } = await context.params;
  const path = `/api/v1/revisits/${revisitId}`;
  return handleReflectionMutation(request, {
    id: revisitId,
    kind: "revisit",
    mutate: mutateWebRevisit,
    path,
  });
};

export const DELETE = async (request: NextRequest, context: Context) => {
  const { revisitId } = await context.params;
  const path = `/api/v1/revisits/${revisitId}`;
  return handleReflectionDelete(request, {
    id: revisitId,
    kind: "revisit",
    mutate: mutateWebRevisit,
    path,
    schemaVersion: revisitMutationSchemaVersion,
  });
};
