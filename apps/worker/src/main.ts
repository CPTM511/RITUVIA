import { createWorkerRuntime } from "./runtime.js";

const controller = new AbortController();
const runtime = createWorkerRuntime();

const requestShutdown = () => {
  controller.abort();
};

process.once("SIGINT", requestShutdown);
process.once("SIGTERM", requestShutdown);

try {
  await runtime.start(controller.signal);
} finally {
  process.off("SIGINT", requestShutdown);
  process.off("SIGTERM", requestShutdown);
}
