import type { NextRequest } from "next/server";

export const hasNoAuthRequestBody = async (request: NextRequest): Promise<boolean> => {
  if (
    request.headers.get("content-type") !== null ||
    request.headers.get("content-encoding") !== null ||
    request.headers.get("transfer-encoding") !== null ||
    (request.headers.get("content-length") !== null &&
      request.headers.get("content-length") !== "0")
  ) {
    return false;
  }
  if (request.body === null) return true;

  const reader = request.body.getReader();
  try {
    for (let emptyChunkCount = 0; emptyChunkCount < 8; emptyChunkCount += 1) {
      const result = await reader.read();
      if (result.done) return true;
      if (result.value.byteLength !== 0) {
        await reader.cancel().catch(() => undefined);
        return false;
      }
    }
    await reader.cancel().catch(() => undefined);
    return false;
  } catch {
    return false;
  } finally {
    reader.releaseLock();
  }
};
