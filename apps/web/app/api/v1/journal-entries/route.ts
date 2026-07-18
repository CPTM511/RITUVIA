import type { NextRequest } from "next/server";

import { createWebJournalEntry } from "../../../../server/reflection-loop";
import { handleReflectionCreate } from "../intentions/_http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const journalEntryApiPath = "/api/v1/journal-entries";

export const POST = (request: NextRequest) =>
  handleReflectionCreate(request, {
    create: createWebJournalEntry,
    kind: "journal",
    path: journalEntryApiPath,
  });
