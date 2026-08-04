import { NextResponse } from "next/server";

import { inspectRecoveryStagingRuntime } from "../../../../server/recovery-staging";

export const dynamic = "force-dynamic";

export const GET = () => {
  const status = inspectRecoveryStagingRuntime();
  return NextResponse.json(
    {
      environment: status.environment,
      recoveryItem: status.recoveryItem,
      sourceSha: status.sourceSha,
      status: "alive",
    },
    {
      headers: {
        "cache-control": "private, no-store, max-age=0",
        "x-rituvia-environment": status.environment,
        "x-rituvia-source-sha": status.sourceSha,
      },
    },
  );
};

export const HEAD = GET;
