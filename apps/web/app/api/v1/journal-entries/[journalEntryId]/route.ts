import type { NextRequest } from "next/server";

import { getWebJournalEntry } from "../../../../../server/reflection-loop";
import { getWebJournalEntryV2, mutateWebJournalEntry } from "../../../../../server/ritual-journal";
import {
  handleReflectionDelete,
  handleReflectionGet,
  handleReflectionMutation,
} from "../../intentions/_http";
import { privateJournalMutationSchemaVersion } from "@rituvia/domain";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = Readonly<{ params: Promise<Readonly<{ journalEntryId: string }>> }>;

export const GET = async (request: NextRequest, context: Context) => {
  const { journalEntryId } = await context.params;
  const path = `/api/v1/journal-entries/${journalEntryId}`;
  return handleReflectionGet(request, {
    get: async (...input) => (await getWebJournalEntry(...input)) ?? getWebJournalEntryV2(...input),
    id: journalEntryId,
    kind: "journal",
    path,
  });
};

export const PATCH = async (request: NextRequest, context: Context) => {
  const { journalEntryId } = await context.params;
  const path = `/api/v1/journal-entries/${journalEntryId}`;
  return handleReflectionMutation(request, {
    id: journalEntryId,
    kind: "journal",
    mutate: mutateWebJournalEntry,
    path,
  });
};

export const DELETE = async (request: NextRequest, context: Context) => {
  const { journalEntryId } = await context.params;
  const path = `/api/v1/journal-entries/${journalEntryId}`;
  return handleReflectionDelete(request, {
    id: journalEntryId,
    kind: "journal",
    mutate: mutateWebJournalEntry,
    path,
    schemaVersion: privateJournalMutationSchemaVersion,
  });
};
