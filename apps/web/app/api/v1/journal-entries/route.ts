import type { PrivateJournalResourceV2, ReflectionJournalResourceV1 } from "@rituvia/domain";
import type { NextRequest } from "next/server";

import { createWebJournalEntry } from "../../../../server/reflection-loop";
import { createWebJournalEntryV2 } from "../../../../server/ritual-journal";
import { handleReflectionCreate } from "../intentions/_http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const journalEntryApiPath = "/api/v1/journal-entries";

export const POST = (request: NextRequest) =>
  handleReflectionCreate<PrivateJournalResourceV2 | ReflectionJournalResourceV1>(request, {
    create: (body, ...rest) =>
      typeof body === "object" &&
      body !== null &&
      !Array.isArray(body) &&
      (body as Record<string, unknown>).schemaVersion === "private-journal.v2"
        ? createWebJournalEntryV2(body, ...rest)
        : createWebJournalEntry(body, ...rest),
    csrfRequired: true,
    kind: "journal",
    path: journalEntryApiPath,
  });
