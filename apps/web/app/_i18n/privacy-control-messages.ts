import type { Locale } from "./routing";

export type PrivacyControlMessages = Readonly<{
  accountDeleteAction: string;
  accountDeleteConfirm: string;
  accountDeleteDescription: string;
  accountDeleteSuccess: string;
  backToAccount: string;
  deletionError: string;
  deletionTitle: string;
  description: string;
  downloadAction: string;
  downloadDescription: string;
  downloadError: string;
  downloadSuccess: string;
  downloadTitle: string;
  eyebrow: string;
  loading: string;
  privateDeleteAction: string;
  privateDeleteConfirm: string;
  privateDeleteDescription: string;
  privateDeleteSuccess: string;
  retry: string;
  signInAction: string;
  signedOut: string;
  title: string;
}>;

const english = Object.freeze({
  accountDeleteAction: "Delete account and data",
  accountDeleteConfirm:
    "Delete this sandbox account, revoke every session and make its private content unavailable? This cannot be undone.",
  accountDeleteDescription:
    "This revokes every account and wallet-authenticated session. Minimum pseudonymous integrity evidence remains; no production Provider is contacted.",
  accountDeleteSuccess: "The sandbox account was deleted and every session was revoked.",
  backToAccount: "Back to account",
  deletionError: "The deletion could not be completed. Existing data and access remain unchanged.",
  deletionTitle: "Delete & leave",
  description:
    "Manage an encrypted data download and the two separate deletion scopes available in protected staging.",
  downloadAction: "Download my data",
  downloadDescription:
    "Includes retained account, reflection, consent and commerce records owned by this sandbox account. Session bearers and internal authority hashes are excluded.",
  downloadError: "The encrypted export could not be prepared or downloaded. Try again.",
  downloadSuccess: "Your encrypted export was authorized and downloaded to this device.",
  downloadTitle: "Download a copy",
  eyebrow: "You are in control",
  loading: "Loading private data controls",
  privateDeleteAction: "Delete all private content",
  privateDeleteConfirm:
    "Delete readings, intentions, rituals, journals, revisits and birth data for this sandbox account?",
  privateDeleteDescription:
    "Private-content deletion preserves the account and minimum integrity evidence, but removes access to retained private prose and encrypted exports.",
  privateDeleteSuccess: "Private content is unavailable. The account remains active for new data.",
  retry: "Retry private controls",
  signInAction: "Sign in",
  signedOut: "Sign in again to use private export or deletion controls.",
  title: "Your data, yours to keep, take, or delete",
} as const satisfies PrivacyControlMessages);

export const getPrivacyControlMessages = (locale: Locale): PrivacyControlMessages => {
  switch (locale) {
    case "en":
      return english;
  }
};
