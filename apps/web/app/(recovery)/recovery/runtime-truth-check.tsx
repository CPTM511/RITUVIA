"use client";

import { useState } from "react";

import { recoveryStagingMessages as messages } from "../../_i18n/recovery-staging-messages";

type ProbeDefinition = Readonly<{
  expectedStatus: number;
  label: string;
  method: "GET" | "POST";
  pathname: string;
}>;

type ProbeResult = ProbeDefinition &
  Readonly<{
    environment: string;
    matched: boolean;
    requestId: string;
    sourceSha: string;
    status: number | "unavailable";
  }>;

type RuntimeCheckState = Readonly<{
  phase: "failed" | "idle" | "passed" | "running";
  results: readonly ProbeResult[];
  serviceWorkerControlled: boolean;
}>;

const requestIdPattern = /^req_[0-9a-f]{32}$/u;

const probes: readonly ProbeDefinition[] = Object.freeze([
  {
    expectedStatus: 200,
    label: messages.runtimeHealthLabel,
    method: "GET",
    pathname: "/api/recovery/health",
  },
  {
    expectedStatus: 200,
    label: messages.runtimeReadinessLabel,
    method: "GET",
    pathname: "/api/recovery/readiness",
  },
  {
    expectedStatus: 200,
    label: messages.runtimeNumerologyLabel,
    method: "GET",
    pathname: "/en/readings/numerology",
  },
  {
    expectedStatus: 200,
    label: messages.runtimeAstrologyLabel,
    method: "GET",
    pathname: "/en/readings/astrology",
  },
]);

const requestProbe = async (
  probe: ProbeDefinition,
  expectedSourceSha: string,
): Promise<ProbeResult> => {
  try {
    const request: RequestInit = {
      cache: "no-store",
      credentials: "same-origin",
      method: probe.method,
    };
    if (probe.method === "POST") {
      request.body = JSON.stringify({});
      request.headers = { "content-type": "application/json" };
    }
    const response = await fetch(probe.pathname, request);
    const environment = response.headers.get("x-rituvia-environment") ?? "unavailable";
    const requestId = response.headers.get("x-request-id") ?? "unavailable";
    const sourceSha = response.headers.get("x-rituvia-source-sha") ?? "unavailable";
    const responseUrl = new URL(response.url);

    return Object.freeze({
      ...probe,
      environment,
      matched:
        response.status === probe.expectedStatus &&
        responseUrl.pathname === probe.pathname &&
        responseUrl.search === "" &&
        environment === "staging" &&
        sourceSha === expectedSourceSha &&
        requestIdPattern.test(requestId),
      requestId,
      sourceSha,
      status: response.status,
    });
  } catch {
    return Object.freeze({
      ...probe,
      environment: "unavailable",
      matched: false,
      requestId: "unavailable",
      sourceSha: "unavailable",
      status: "unavailable",
    });
  }
};

export function RuntimeTruthCheck({ expectedSourceSha }: Readonly<{ expectedSourceSha: string }>) {
  const [state, setState] = useState<RuntimeCheckState>({
    phase: "idle",
    results: [],
    serviceWorkerControlled: false,
  });

  const run = async () => {
    const serviceWorkerControlled = navigator.serviceWorker.controller !== null;
    setState({ phase: "running", results: [], serviceWorkerControlled });
    const results: ProbeResult[] = [];

    for (const probe of probes) {
      results.push(await requestProbe(probe, expectedSourceSha));
    }

    setState({
      phase:
        !serviceWorkerControlled && results.every(({ matched }) => matched) ? "passed" : "failed",
      results: Object.freeze(results),
      serviceWorkerControlled,
    });
  };

  const buttonLabel =
    state.phase === "running"
      ? messages.runtimeRunningButton
      : state.phase === "idle"
        ? messages.runtimeRunButton
        : messages.runtimeRetryButton;

  return (
    <section aria-labelledby="runtime-truth-title" className="runtime-truth">
      <p className="eyebrow">{messages.runtimeEyebrow}</p>
      <h2 id="runtime-truth-title">{messages.runtimeTitle}</h2>
      <p>{messages.runtimeIntro}</p>

      <dl className="runtime-assertions">
        <div>
          <dt>{messages.runtimeMockLabel}</dt>
          <dd>{messages.runtimeMockValue}</dd>
        </div>
        <div>
          <dt>{messages.runtimeServiceWorkerLabel}</dt>
          <dd>
            {state.serviceWorkerControlled
              ? messages.runtimeServiceWorkerControlled
              : messages.runtimeServiceWorkerClear}
          </dd>
        </div>
      </dl>

      <button disabled={state.phase === "running"} onClick={run} type="button">
        {buttonLabel}
      </button>

      <div aria-live="polite" className="runtime-state" data-runtime-state={state.phase}>
        {state.phase === "idle" ? <p>{messages.runtimeIdle}</p> : null}
        {state.phase === "running" ? <p role="status">{messages.runtimeRunning}</p> : null}
        {state.phase === "passed" ? (
          <p className="runtime-passed" role="status">
            {messages.runtimePassed}
          </p>
        ) : null}
        {state.phase === "failed" ? (
          <p className="runtime-failed" role="alert">
            {messages.runtimeFailed}
          </p>
        ) : null}

        {state.results.length > 0 ? (
          <ul className="runtime-results">
            {state.results.map((result) => (
              <li
                data-runtime-environment={result.environment}
                data-runtime-expected-status={result.expectedStatus}
                data-runtime-method={result.method}
                data-runtime-path={result.pathname}
                data-runtime-request-id={result.requestId}
                data-runtime-result
                data-runtime-source-sha={result.sourceSha}
                data-runtime-status={result.status}
                key={`${result.method}:${result.pathname}`}
              >
                <h3>{result.label}</h3>
                <dl>
                  <div>
                    <dt>{messages.runtimeRequestLabel}</dt>
                    <dd>
                      <code>{`${result.method} ${result.pathname}`}</code>
                    </dd>
                  </div>
                  <div>
                    <dt>{messages.runtimeStatusLabel}</dt>
                    <dd>
                      <code>{`${result.status} / ${result.expectedStatus}`}</code>
                    </dd>
                  </div>
                  <div>
                    <dt>{messages.runtimeRequestIdLabel}</dt>
                    <dd>
                      <code>{result.requestId}</code>
                    </dd>
                  </div>
                </dl>
                <p className={result.matched ? "runtime-passed" : "runtime-failed"}>
                  {result.matched ? messages.runtimeProbePassed : messages.runtimeProbeFailed}
                </p>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
