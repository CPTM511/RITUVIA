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

          <section aria-labelledby="acceptance-manifest-title" className="acceptance-manifest">
            <p className="eyebrow">{messages.badge}</p>
            <h2 id="acceptance-manifest-title">{messages.manifestTitle}</h2>
            <dl>
              <div>
                <dt>{messages.manifestJourneysLabel}</dt>
                <dd>{status.recoveryManifest.mandatoryJourneys.join(", ")}</dd>
              </div>
              <div>
                <dt>{messages.manifestExcludedLabel}</dt>
                <dd>{status.recoveryManifest.excludedJourneys.join(", ")}</dd>
              </div>
              <div>
                <dt>{messages.manifestDecisionLabel}</dt>
                <dd>{status.recoveryManifest.decisionReference}</dd>
              </div>
              <div>
                <dt>{messages.manifestLicenseLabel}</dt>
                <dd>{status.recoveryManifest.license}</dd>
              </div>
              <div>
                <dt>{messages.manifestProductionLabel}</dt>
                <dd>{status.recoveryManifest.productionDecision}</dd>
              </div>
              <div>
                <dt>{messages.manifestRollbackLabel}</dt>
                <dd>
                  <code>{status.recoveryManifest.rollbackSourceSha}</code>
                </dd>
              </div>
              <div>
                <dt>{messages.manifestBeforeStateLabel}</dt>
                <dd>
                  <code>{status.recoveryManifest.beforeStateManifestSha256}</code>
                </dd>
              </div>
              <div>
                <dt>{messages.manifestChecksumLabel}</dt>
                <dd>
                  <code data-recovery-manifest-sha256={status.recoveryManifestSha256}>
                    {status.recoveryManifestSha256}
                  </code>
                </dd>
              </div>
            </dl>
            <a
              href={`https://github.com/CPTM511/RITUVIA/tree/${status.sourceSha}`}
              rel="noreferrer"
            >
              {messages.manifestSourceLink}
            </a>
          </section>

          <fieldset className="signoff">
            <legend>{messages.signoffTitle}</legend>
            {messages.signoffChecks.map((label) => (
              <label key={label}>
                <input type="checkbox" />
                <span>{label}</span>
              </label>
            ))}
            <p>{messages.signoffLocalOnly}</p>
          </fieldset>

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
            <Link href="/en/readings/numerology">{messages.numerologyLink}</Link>
            <Link href="/en/readings/astrology">{messages.astrologyLink}</Link>
            <Link href="/en/sign-in">{messages.identityLink}</Link>
            <Link href="/en/account/privacy">{messages.privacyLink}</Link>
            <Link href="/en/plans">{messages.plansLink}</Link>
            <Link href="/en/account/billing">{messages.billingLink}</Link>
            <Link href="/en/account/orders">{messages.ordersLink}</Link>
            <a href={recoveryHealthPathname}>{messages.healthLink}</a>
            <a href={recoveryReadinessPathname}>{messages.readinessLink}</a>
          </nav>
        </section>
      </main>
    </>
  );
}
