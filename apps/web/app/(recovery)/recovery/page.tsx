import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { recoveryStagingMessages as messages } from "../../_i18n/recovery-staging-messages";
import {
  inspectRecoveryStagingRuntime,
  recoveryHealthPathname,
  recoveryReadinessPathname,
} from "../../../server/recovery-staging";

import { ConnectivityStatus } from "./connectivity-status";
import { RuntimeTruthCheck } from "./runtime-truth-check";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
    nocache: true,
  },
  title: "Protected Staging | RITUVIA",
};

export default function RecoveryStagingPage() {
  const status = inspectRecoveryStagingRuntime();
  if (status.environment !== "staging") notFound();

  return (
    <>
      <a className="skip-link" href="#staging-identity">
        {messages.skip}
      </a>
      <main>
        <section aria-labelledby="recovery-title" className="shell">
          <p className="badge">{messages.badge}</p>
          <h1 id="recovery-title">{messages.title}</h1>
          <p className="intro">{messages.intro}</p>

          <dl className="identity" id="staging-identity" tabIndex={-1}>
            <div>
              <dt>{messages.environmentLabel}</dt>
              <dd>{status.environment}</dd>
            </div>
            <div>
              <dt>{messages.itemLabel}</dt>
              <dd>{status.recoveryItem}</dd>
            </div>
            <div>
              <dt>{messages.sourceLabel}</dt>
              <dd>
                <code>{status.sourceSha}</code>
              </dd>
            </div>
            <div>
              <dt>{messages.baselineLabel}</dt>
              <dd>
                <code>{status.baselineSha}</code>
              </dd>
            </div>
          </dl>

          <p className={status.ready ? "readiness ready" : "readiness stopped"} role="status">
            {status.ready ? messages.readinessPassed : messages.readinessFailed}
          </p>
          <ConnectivityStatus />

          <RuntimeTruthCheck expectedSourceSha={status.sourceSha} />

          <ul className="boundaries">
            {messages.boundaries.map((boundary) => (
              <li key={boundary}>{boundary}</li>
            ))}
          </ul>

          <nav aria-label="Recovery diagnostics" className="diagnostics">
            <Link href="/en">{messages.englishShellLink}</Link>
            <Link href="/zh-Hans">{messages.chineseShellLink}</Link>
            <Link href="/en/intake">{messages.coreLoopLink}</Link>
            <Link href="/en/tarot/one-card">{messages.oneCardLink}</Link>
            <Link href="/en/tarot/three-card">{messages.threeCardLink}</Link>
            <a href={recoveryHealthPathname}>{messages.healthLink}</a>
            <a href={recoveryReadinessPathname}>{messages.readinessLink}</a>
          </nav>
        </section>
      </main>
    </>
  );
}
