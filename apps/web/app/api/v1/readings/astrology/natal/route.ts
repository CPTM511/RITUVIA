import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { createAstrologyNatalViewResponse } from "../../../../../_contracts/astrology-natal-response";
import { accountSessionCookieName } from "../../../../../../server/account-auth";
import { loadWebAstrologyCalculationService } from "../../../../../../server/astrology-runtime";
import { accountAuthPrivateHeaders, hasNoAuthRequestBody } from "../../../auth/_http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const json = (body: unknown, status: number): NextResponse =>
  NextResponse.json(body, { headers: accountAuthPrivateHeaders, status });

const errorCode = (error: unknown): string | null =>
  typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
    ? error.code
    : null;

export const GET = async (request: NextRequest): Promise<NextResponse> => {
  if (request.nextUrl.search !== "" || !(await hasNoAuthRequestBody(request))) {
    return json({ code: "ASTROLOGY_NATAL_VIEW_INPUT_INVALID", status: 400 }, 400);
  }
  const sessionToken = request.cookies.get(accountSessionCookieName)?.value;
  if (sessionToken === undefined) {
    return json({ code: "ACCOUNT_SESSION_UNAVAILABLE", status: 401 }, 401);
  }
  try {
    const [latest] = await loadWebAstrologyCalculationService().list({
      limit: 1,
      sessionToken,
    });
    return json(createAstrologyNatalViewResponse(latest ?? null), 200);
  } catch (error) {
    const status = errorCode(error) === "ASTROLOGY_CALCULATION_SESSION_UNAVAILABLE" ? 401 : 503;
    return json(
      {
        code: status === 401 ? "ACCOUNT_SESSION_UNAVAILABLE" : "ASTROLOGY_NATAL_VIEW_UNAVAILABLE",
        status,
      },
      status,
    );
  }
};
