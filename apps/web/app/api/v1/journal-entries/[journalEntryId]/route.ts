import type { NextRequest } from "next/server";

import { getWebJournalEntry } from "../../../../../server/reflection-loop";
import { handleReflectionGet } from "../../intentions/_http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = Readonly<{ params: Promise<Readonly<{ journalEntryId: string }>> }>;

export const GET = async (request: NextRequest, context: Context) => {
  const { journalEntryId } = await context.params;
  const path = `/api/v1/journal-entries/${journalEntryId}`;
  return handleReflectionGet(request, {
    get: getWebJournalEntry,
    id: journalEntryId,
    kind: "journal",
    path,
  });
};
