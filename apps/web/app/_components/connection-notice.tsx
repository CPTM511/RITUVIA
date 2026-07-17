"use client";

import { createUiControlId } from "@rituvia/ui";

import { getStateMessages } from "../_i18n/state-messages";
import type { Locale } from "../_i18n/routing";
import {
  ConnectionAnnouncement,
  useConnectionAnnouncement,
  useConnectionStatus,
} from "./connection-state";
import { ResilientState } from "./resilient-state";

const offlineTitleId = createUiControlId("connection-notice-title");

export function ConnectionNotice({ locale }: Readonly<{ locale: Locale }>) {
  const messages = getStateMessages(locale);
  const isOnline = useConnectionStatus();
  const announcement = useConnectionAnnouncement(
    isOnline,
    messages.connection.offlineAnnouncement,
    messages.connection.onlineAnnouncement,
  );
  const content = messages.offline;

  return (
    <>
      <ConnectionAnnouncement announcement={announcement} />
      {isOnline ? null : (
        <div className="shell connection-notice" data-connection-state="offline">
          <ResilientState
            kind="offline"
            live="off"
            message={content.message}
            title={content.title}
            titleAs="p"
            titleId={offlineTitleId}
          />
        </div>
      )}
    </>
  );
}
