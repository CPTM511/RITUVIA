"use client";

import { Button, InlineAlert } from "@rituvia/ui";
import { formatIcuMessage } from "@rituvia/i18n/messages";
import { useEffect, useId, useRef, useState } from "react";

import type {
  SanctuaryFreeRitualItem,
  SanctuaryRitualExperienceMessages,
} from "../_i18n/sanctuary-messages";
import type { Locale } from "../_i18n/routing";

export type RitualCompletionResult = "error" | "offline" | "success";
export type RitualExperienceMode = "linear" | "visual";
export type RitualExperienceDestination = "journal" | "return";

type SanctuaryRitualExperienceProps = Readonly<{
  currentStepCode: SanctuaryFreeRitualItem["steps"][number]["code"];
  elapsedSeconds: number;
  initialMode: RitualExperienceMode;
  intentionLabel: string;
  item: SanctuaryFreeRitualItem;
  locale: Locale;
  messages: SanctuaryRitualExperienceMessages;
  onDismiss: (destination: RitualExperienceDestination) => void;
  onMutate: (
    action: "complete" | "pause" | "resume",
    currentStepCode: SanctuaryFreeRitualItem["steps"][number]["code"],
    elapsedSeconds: number,
  ) => Promise<RitualCompletionResult>;
  status: "active" | "completed" | "paused";
}>;

export function SanctuaryRitualExperience({
  currentStepCode,
  elapsedSeconds,
  initialMode,
  intentionLabel,
  item,
  locale,
  messages,
  onDismiss,
  onMutate,
  status,
}: SanctuaryRitualExperienceProps) {
  const dismissHandler = useRef(onDismiss);
  const exitHandler = useRef<() => Promise<void>>(async () => undefined);
  const heading = useRef<HTMLHeadingElement | null>(null);
  const sessionStartedAt = useRef<number | null>(null);
  const [completionPhase, setCompletionPhase] = useState<
    "active" | "error" | "loading" | "offline" | "success"
  >("active");
  const [mode, setMode] = useState<RitualExperienceMode>(initialMode);
  const [paused, setPaused] = useState(status === "paused");
  const [stepIndex, setStepIndex] = useState(() => {
    const index = item.steps.findIndex((step) => step.code === currentStepCode);
    return index < 0 ? 0 : index;
  });
  const titleId = useId();
  const descriptionId = useId();
  const currentStep =
    item.steps.find((_, candidateIndex) => candidateIndex === stepIndex) ?? item.steps[0];
  const finalStep = stepIndex === item.steps.length - 1;

  useEffect(() => {
    dismissHandler.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    sessionStartedAt.current = Date.now() - elapsedSeconds * 1_000;
  }, [elapsedSeconds]);

  useEffect(() => {
    heading.current?.focus();
  }, []);

  useEffect(() => {
    if (completionPhase === "success") heading.current?.focus();
  }, [completionPhase]);

  const dismiss = (destination: RitualExperienceDestination): void => {
    onDismiss(destination);
  };

  const elapsed = (): number =>
    sessionStartedAt.current === null
      ? elapsedSeconds
      : Math.min(
          86_400,
          Math.max(elapsedSeconds, Math.floor((Date.now() - sessionStartedAt.current) / 1_000)),
        );

  const complete = async (): Promise<void> => {
    if (completionPhase === "loading" || completionPhase === "success") return;
    setCompletionPhase("loading");
    const result = await onMutate("complete", "complete", elapsed());
    setCompletionPhase(result);
  };

  const togglePause = async (): Promise<void> => {
    if (completionPhase === "loading" || completionPhase === "success") return;
    setCompletionPhase("loading");
    const action = paused ? "resume" : "pause";
    const result = await onMutate(action, currentStep.code, elapsed());
    if (result === "success") {
      setPaused(!paused);
      setCompletionPhase("active");
      return;
    }
    setCompletionPhase(result);
  };

  const exit = async (): Promise<void> => {
    if (completionPhase === "loading" || completionPhase === "success") return;
    if (!paused) {
      setCompletionPhase("loading");
      const result = await onMutate("pause", currentStep.code, elapsed());
      if (result !== "success") {
        setCompletionPhase(result);
        return;
      }
      setPaused(true);
    }
    dismissHandler.current("return");
  };

  useEffect(() => {
    exitHandler.current = exit;
  });

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      void exitHandler.current();
    };
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <section
      aria-describedby={descriptionId}
      aria-labelledby={titleId}
      className="ritual-experience"
      data-mode={mode}
      data-paused={paused || undefined}
    >
      <div className="ritual-experience-shell">
        {completionPhase === "success" ? null : (
          <header className="ritual-experience-header">
            <div>
              <p className="eyebrow">{messages.eyebrow}</p>
              <h2 id={titleId} ref={heading} tabIndex={-1}>
                {item.name}
              </h2>
            </div>
            <div className="ritual-experience-header-actions">
              <Button label={messages.exit} onPress={() => void exit()} tone="quiet" />
              <Button
                label={paused ? messages.resume : messages.pause}
                onPress={() => void togglePause()}
                tone="secondary"
              />
              <Button
                label={messages.completeNow}
                onPress={() => void complete()}
                tone="secondary"
              />
            </div>
          </header>
        )}

        {completionPhase === "success" ? (
          <section aria-live="polite" className="ritual-experience-completion">
            <p className="ritual-experience-completion-mark" aria-hidden="true">
              ✦
            </p>
            <p className="eyebrow">{messages.completionEyebrow}</p>
            <h3 id={titleId} ref={heading} tabIndex={-1}>
              {messages.completionTitle}
            </h3>
            <p id={descriptionId}>{messages.completionDescription}</p>
            <div className="ritual-experience-actions">
              <Button label={messages.continueToJournal} onPress={() => dismiss("journal")} />
              <Button
                label={messages.returnToSanctuary}
                onPress={() => dismiss("return")}
                tone="secondary"
              />
            </div>
          </section>
        ) : (
          <>
            <div className="ritual-experience-meta" id={descriptionId}>
              <p>{messages.symbolicBoundary}</p>
              <dl>
                <div>
                  <dt>{messages.modeLabel}</dt>
                  <dd>{mode === "visual" ? messages.visualMode : messages.linearMode}</dd>
                </div>
                <div>
                  <dt>{messages.audioLabel}</dt>
                  <dd>{messages.audioOff}</dd>
                </div>
              </dl>
            </div>

            <div className="ritual-experience-mode-actions">
              <Button
                disabled={paused}
                label={mode === "visual" ? messages.useLinearMode : messages.useVisualMode}
                onPress={() => setMode((current) => (current === "visual" ? "linear" : "visual"))}
                tone="secondary"
              />
              <p>{messages.modeHelp}</p>
            </div>

            <div className="ritual-experience-body">
              <div
                aria-label={item.visualAlternative}
                className={`ritual-visual ritual-visual--${item.code}`}
                role="img"
              >
                <div aria-hidden="true" className="ritual-visual-surface">
                  {item.code === "free_candle" ? (
                    <span className="ritual-candle">
                      <span className="ritual-candle-flame" />
                      <span className="ritual-candle-body" />
                    </span>
                  ) : (
                    <span className="ritual-incense">
                      <span className="ritual-incense-smoke ritual-incense-smoke--one" />
                      <span className="ritual-incense-smoke ritual-incense-smoke--two" />
                      <span className="ritual-incense-stick" />
                    </span>
                  )}
                </div>
                <p>{item.visualAlternative}</p>
              </div>

              <section aria-live="polite" className="ritual-step" key={currentStep.code}>
                <p className="ritual-step-progress">
                  {formatIcuMessage(locale, messages.stepProgress, {
                    current: stepIndex + 1,
                    total: item.steps.length,
                  })}
                </p>
                <h3>{currentStep.title}</h3>
                <p>{currentStep.instruction}</p>
                <p className="sanctuary-private-note">
                  {messages.intentionLabel}: <bdi dir="auto">{intentionLabel}</bdi>
                </p>
                <div className="ritual-experience-actions">
                  {finalStep ? (
                    <Button
                      disabled={paused}
                      label={messages.complete}
                      {...(completionPhase === "loading"
                        ? { loading: true, loadingLabel: messages.completing }
                        : {})}
                      onPress={() => void complete()}
                    />
                  ) : (
                    <Button
                      disabled={paused}
                      label={messages.continue}
                      onPress={() => setStepIndex((current) => current + 1)}
                    />
                  )}
                  {stepIndex === 0 ? null : (
                    <Button
                      disabled={paused}
                      label={messages.previous}
                      onPress={() => setStepIndex((current) => current - 1)}
                      tone="secondary"
                    />
                  )}
                </div>
              </section>
            </div>

            {completionPhase === "offline" ? (
              <InlineAlert
                live="assertive"
                message={messages.offline}
                title={messages.errorTitle}
                tone="warning"
              />
            ) : null}
            {completionPhase === "error" ? (
              <InlineAlert
                live="assertive"
                message={messages.error}
                title={messages.errorTitle}
                tone="error"
              />
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
