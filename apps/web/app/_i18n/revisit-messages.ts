import type { Locale } from "./routing";

export type RevisitMessages = Readonly<{
  archive: string;
  archived: string;
  backToSanctuary: string;
  cancel: string;
  complete: string;
  completed: string;
  completing: string;
  confirmArchive: string;
  confirmDelete: string;
  customDate: string;
  customDateDescription: string;
  delete: string;
  deleted: string;
  description: string;
  due: string;
  early: string;
  emptyDescription: string;
  emptyTitle: string;
  errorDescription: string;
  errorTitle: string;
  eyebrow: string;
  intentionLabel: string;
  loading: string;
  nextDay: string;
  noReminder: string;
  outcomeLegend: string;
  outcomeTags: Readonly<{
    action_taken: string;
    changed_direction: string;
    not_yet: string;
    partial_progress: string;
    released: string;
  }>;
  privacy: string;
  quietHoursDescription: string;
  quietHoursEnd: string;
  quietHoursLabel: string;
  quietHoursStart: string;
  rateLimited: string;
  rateLimitTitle: string;
  reflectionDescription: string;
  reflectionLabel: string;
  reflectionPlaceholder: string;
  reminderBoundary: string;
  reminderDelivered: string;
  reminderDescription: string;
  reminderDisabled: string;
  reminderEnabled: string;
  reminderError: string;
  reminderFailed: string;
  reminderOptIn: string;
  reminderRetrying: string;
  reminderSaving: string;
  reminderSignIn: string;
  reminderUnavailable: string;
  required: string;
  reschedule: string;
  retry: string;
  saveSchedule: string;
  scheduled: string;
  scheduling: string;
  sevenDays: string;
  smallActionLabel: string;
  title: string;
  timeZone: string;
  timeZoneDescription: string;
}>;

const englishMessages = {
  archive: "Archive",
  archived: "Archived",
  backToSanctuary: "Return to Sanctuary",
  cancel: "Cancel",
  complete: "Complete this Revisit",
  completed: "Completed",
  completing: "Saving your reflection",
  confirmArchive: "Archive this Revisit? It will remain readable but cannot be completed.",
  confirmDelete: "Delete this Revisit? It will disappear immediately.",
  customDate: "Choose a date",
  customDateDescription: "Choose a future local calendar date.",
  delete: "Delete",
  deleted: "The private Revisit was deleted.",
  description:
    "Return to your original words, notice what you did or learned, and choose what comes next.",
  due: "Ready to revisit",
  early: "Scheduled for later; you may still reflect now.",
  emptyDescription:
    "Save an intention in Sanctuary, then bring its private ID here to schedule a return.",
  emptyTitle: "No Revisit is scheduled yet.",
  errorDescription: "Your private Revisit could not be loaded or saved. Retry when you are ready.",
  errorTitle: "Revisit is temporarily unavailable",
  eyebrow: "Private reflection",
  intentionLabel: "Your original intention",
  loading: "Loading private Revisits",
  nextDay: "Tomorrow",
  noReminder: "No reminder is active. Saving this schedule sends no message.",
  outcomeLegend: "What best describes the outcome? Choose up to three.",
  outcomeTags: {
    action_taken: "I took the action",
    changed_direction: "I changed direction",
    not_yet: "Not yet",
    partial_progress: "I made partial progress",
    released: "I released this intention",
  },
  privacy:
    "Your intention, action, and reflection stay private and are excluded from analytics, URLs, and public metadata.",
  quietHoursDescription:
    "Optional preference for a future reminder feature. Overnight ranges are allowed; no delivery is active now.",
  quietHoursEnd: "Quiet hours end",
  quietHoursLabel: "Store quiet hours",
  quietHoursStart: "Quiet hours start",
  rateLimited:
    "Private changes are temporarily limited. Nothing will retry automatically, and write actions stay paused on this page. Return later and reload when you are ready.",
  rateLimitTitle: "Pause before another private change",
  reflectionDescription:
    "Describe actions, changes, or new understanding. This is not evidence that a prediction came true.",
  reflectionLabel: "What happened, and what do you understand now?",
  reflectionPlaceholder: "For example: I took the small action and noticed…",
  reminderBoundary:
    "This does not prove a prediction; it helps you notice action, change, and new understanding.",
  reminderDelivered: "Your one-time reminder has already been delivered.",
  reminderDescription:
    "One lock-screen-safe email on or after this local date. It contains no intention, question, ritual, journal, or relationship detail. Turn it off here at any time before delivery.",
  reminderDisabled: "The one-time email reminder is off.",
  reminderEnabled: "The one-time email reminder is on.",
  reminderError: "The reminder preference could not be saved. Retry when you are ready.",
  reminderFailed:
    "Delivery could not be completed after bounded retries. The reminder remains stopped.",
  reminderOptIn: "Email me once when this Revisit date arrives",
  reminderRetrying: "Delivery is waiting for a bounded retry.",
  reminderSaving: "Saving reminder preference",
  reminderSignIn: "Sign in to turn on an account-owned email reminder.",
  reminderUnavailable:
    "Reminder settings are temporarily unavailable. Your private Revisit still works without them.",
  required: "required",
  reschedule: "Save new date",
  retry: "Retry",
  saveSchedule: "Schedule this Revisit",
  scheduled: "Scheduled",
  scheduling: "Saving your schedule",
  sevenDays: "In seven days",
  smallActionLabel: "The small action you chose",
  title: "Revisit what you intended, without turning it into prophecy.",
  timeZone: "Time zone",
  timeZoneDescription:
    "The date stays on this local calendar even across daylight-saving changes. You can edit the IANA time zone.",
} as const satisfies RevisitMessages;

export const getRevisitMessages = (locale: Locale): RevisitMessages => {
  switch (locale) {
    case "en":
      return englishMessages;
  }
};
