import { describe, expect, it } from "vitest";

import { createWorkerRuntime } from "../src/runtime.js";

describe("worker runtime", () => {
  it("runs until its abort signal requests a safe shutdown", async () => {
    const controller = new AbortController();
    const runtime = createWorkerRuntime();

    const completion = runtime.start(controller.signal);
    expect(runtime.state).toBe("running");

    controller.abort();
    await completion;

    expect(runtime.state).toBe("stopped");
  });

  it("supports an explicit stop without leaving a pending run", async () => {
    const runtime = createWorkerRuntime();
    const completion = runtime.start(new AbortController().signal);

    runtime.stop();
    await completion;

    expect(runtime.state).toBe("stopped");
  });

  it("does not start work after cancellation was already requested", async () => {
    const controller = new AbortController();
    const runtime = createWorkerRuntime();
    controller.abort();

    await runtime.start(controller.signal);

    expect(runtime.state).toBe("stopped");
  });

  it("rejects duplicate starts", () => {
    const runtime = createWorkerRuntime();
    void runtime.start(new AbortController().signal);

    expect(() => runtime.start(new AbortController().signal)).toThrow(
      "Worker cannot start from the running state.",
    );

    runtime.stop();
  });
});
