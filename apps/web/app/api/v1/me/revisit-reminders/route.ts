import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { accountSessionCookieName } from "../../../../../server/account-auth";
import {
  listWebRevisitReminders,
  WebRevisitReminderError,
} from "../../../../../server/revisit-reminder";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const privateHeaders = Object.freeze({
  "cache-control": "private, no-store, max-age=0",
  "x-robots-tag": "noindex, nofollow, noarchive",
});

export const GET = async (request: NextRequest): Promise<NextResponse> => {
  try {
    const reminders = await listWebRevisitReminders(
      request.cookies.get(accountSessionCookieName)?.value,
    );
    return NextResponse.json(
      { accountAvailable: true, reminders, schemaVersion: 1 },
      { headers: privateHeaders, status: 200 },
    );
  } catch (error) {
    const unauthorized =
      error instanceof WebRevisitReminderError && error.code === "session_unavailable";
    if (unauthorized) {
      return NextResponse.json(
        { accountAvailable: false, reminders: [], schemaVersion: 1 },
        { headers: privateHeaders, status: 200 },
      );
    }
    return NextResponse.json(
      {
        code: "REVISIT_REMINDER_UNAVAILABLE",
        status: 503,
      },
      { headers: privateHeaders, status: 503 },
    );
  }
};
