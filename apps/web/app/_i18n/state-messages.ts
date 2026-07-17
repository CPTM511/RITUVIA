import type { Locale } from "./routing";

type RecoverableStateMessage = Readonly<{
  message: string;
  retryAction: string;
  retryingAction: string;
  returnAction: string;
  title: string;
}>;

export type StateMessages = Readonly<{
  connection: Readonly<{
    offlineAnnouncement: string;
    onlineAnnouncement: string;
  }>;
  error: RecoverableStateMessage;
  offline: RecoverableStateMessage;
  providerUnavailable: RecoverableStateMessage;
}>;

const englishStateMessages = {
  connection: {
    offlineAnnouncement:
      "Your device appears to be offline. This page remains readable, but links or new content may need a connection.",
    onlineAnnouncement: "Your device appears to be back online.",
  },
  error: {
    title: "We couldn’t open this page.",
    message: "Something interrupted this page. Try again, or return to the public foundation.",
    retryAction: "Try again",
    retryingAction: "Trying again",
    returnAction: "Return home",
  },
  offline: {
    title: "Your device appears to be offline.",
    message: "This page remains readable, but links or new content may need a connection.",
    retryAction: "Try again",
    retryingAction: "Trying again",
    returnAction: "Return home",
  },
  providerUnavailable: {
    title: "This part is temporarily unavailable.",
    message:
      "A supporting service did not respond. You can try again, or return to this experience later.",
    retryAction: "Try again",
    retryingAction: "Trying again",
    returnAction: "Return home",
  },
} as const satisfies StateMessages;

export const getStateMessages = (locale: Locale): StateMessages => {
  switch (locale) {
    case "en":
      return englishStateMessages;
  }
};
