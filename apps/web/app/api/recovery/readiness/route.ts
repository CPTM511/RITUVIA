import { NextResponse } from "next/server";

import { inspectRecoveryStagingRuntime } from "../../../../server/recovery-staging";

export const dynamic = "force-dynamic";

export const GET = () => {
  const status = inspectRecoveryStagingRuntime();
  return NextResponse.json(
    {
      baselineSha: status.baselineSha,
      controls: {
        database: status.database,
        indexing: status.indexing,
        objectStorage: status.objectStorage,
        productionProviders: status.productionProviders,
        tarotCatalog: status.tarotCatalog,
      },
      environment: status.environment,
      recoveryItem: status.recoveryItem,
      sourceSha: status.sourceSha,
      status: status.ready ? "ready" : "not-ready",
    },
    {
      headers: {
        "cache-control": "private, no-store, max-age=0",
        "x-rituvia-environment": status.environment,
        "x-rituvia-source-sha": status.sourceSha,
      },
      status: status.ready ? 200 : 503,
    },
  );
};

export const HEAD = GET;
