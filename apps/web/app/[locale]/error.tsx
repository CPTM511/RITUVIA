"use client";

import { createUiControlId, type ErrorStateProps, type StatePatternAction } from "@rituvia/ui";
import { usePathname } from "next/navigation";
import { useEffect, useTransition } from "react";

import {
  ConnectionAnnouncement,
  useConnectionAnnouncement,
  useConnectionStatus,
} from "../_components/connection-state";
import { ResilientState } from "../_components/resilient-state";
import { getGoldenShellMessages, goldenShellHomePath } from "../_i18n/golden-shell-messages";

type LocaleErrorProps = Readonly<{
  error: Error & Readonly<{ digest?: string }>;
  reset: () => void;
}>;

const errorTitleId = createUiControlId("route-error-title");

export default function LocaleError({ reset }: LocaleErrorProps) {
  const pathname = usePathname();
  const locale = pathname === "/zh-Hans" || pathname.startsWith("/zh-Hans/") ? "zh-Hans" : "en";
  const messages = getGoldenShellMessages(locale).state;
  const isOnline = useConnectionStatus();
  const announcement = useConnectionAnnouncement(
    isOnline,
    messages.connection.offlineAnnouncement,
    messages.connection.onlineAnnouncement,
  );
  const [isPending, startTransition] = useTransition();
  const content = isOnline ? messages.error : messages.offline;

  useEffect(() => {
    document.getElementById(errorTitleId)?.focus();
  }, []);

  const retry = (): void => {
    startTransition(() => reset());
  };
  const primaryAction: StatePatternAction = isPending
    ? {
        kind: "button",
        label: content.retryAction,
        loading: true,
        loadingLabel: content.retryingAction,
        onPress: retry,
      }
    : { kind: "button", label: content.retryAction, onPress: retry };
  const stateProps = {
    message: content.message,
    primaryAction,
    secondaryAction: {
      href: goldenShellHomePath(locale),
      kind: "link",
      label: content.returnAction,
    },
    title: content.title,
    titleAs: "h1",
    titleId: errorTitleId,
  } as const satisfies Omit<ErrorStateProps, "live">;

  return (
    <main className="route-state-main" id="main-content">
      <ConnectionAnnouncement announcement={announcement} />
      {isOnline ? (
        <ResilientState kind="error" live="off" {...stateProps} />
      ) : (
        <ResilientState kind="offline" live="off" {...stateProps} />
      )}
    </main>
  );
}
