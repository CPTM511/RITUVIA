import { describe, expect, it, vi } from "vitest";

import type { CommercialDisputeSupportPersistence } from "@rituvia/db";

import {
  runCommercialDisputeSupportProjectionLoop,
  runOneCommercialDisputeSupportProjection,
} from "../src/payment-dispute-support.js";

const store = (
  projectNextDisputeSupportCase: CommercialDisputeSupportPersistence["projectNextDisputeSupportCase"],
): CommercialDisputeSupportPersistence => ({ projectNextDisputeSupportCase });

describe("commercial dispute support projection worker", () => {
  it("projects one eligible fulfilled dispute case", async () => {
    const projectNextDisputeSupportCase = vi.fn().mockResolvedValue("projected");
    await expect(
      runOneCommercialDisputeSupportProjection({
        store: store(projectNextDisputeSupportCase),
      }),
    ).resolves.toBe("projected");
    expect(projectNextDisputeSupportCase).toHaveBeenCalledTimes(1);
  });

  it("stays idle without an eligible current dispute", async () => {
    await expect(
      runOneCommercialDisputeSupportProjection({
        store: store(vi.fn().mockResolvedValue(null)),
      }),
    ).resolves.toBe("idle");
  });

  it("contains persistence failure without blocking payment fulfillment", async () => {
    const controller = new AbortController();
    const dispositions: string[] = [];
    const projectNextDisputeSupportCase = vi
      .fn<CommercialDisputeSupportPersistence["projectNextDisputeSupportCase"]>()
      .mockRejectedValueOnce(new Error("private database details"))
      .mockImplementationOnce(async () => {
        controller.abort();
        return null;
      });
    await runCommercialDisputeSupportProjectionLoop({
      failureDelayMilliseconds: 1,
      idleDelayMilliseconds: 1,
      observe: ({ disposition }) => dispositions.push(disposition),
      signal: controller.signal,
      store: store(projectNextDisputeSupportCase),
    });
    expect(dispositions).toEqual(["persistence_unavailable", "idle"]);
    expect(projectNextDisputeSupportCase).toHaveBeenCalledTimes(2);
  });
});
