import { formatIcuMessage, type IcuMessageValues } from "@rituvia/i18n/messages";

import type { Locale } from "./routing";

export const coreMessageKeys = Object.freeze([
  "account.savedReflections",
  "practice.availableMode",
  "ritual.stepProgress",
  "shell.navigation.homeLabel",
  "tarot.report.targetPosition",
  "tarot.retryAfter",
  "tarot.share.altText",
] as const);

export type CoreMessageKey = (typeof coreMessageKeys)[number];

const runtimeMessages = Object.freeze({
  "account.savedReflections":
    "{count, plural, =0 {No saved reflections} one {# saved reflection} other {# saved reflections}}",
  "practice.availableMode":
    "{mode, select, free {Free practice available} owned {Owned presentation available} other {Practice availability unknown}}",
  "ritual.stepProgress": "Step {current, number} of {total, number}",
  "shell.navigation.homeLabel": "{brand} home",
  "tarot.report.targetPosition": "Position: {position}",
  "tarot.retryAfter":
    "{value, plural, one {# {unit, select, second {second} minute {minute} hour {hour} other {unit}}} other {# {unit, select, second {seconds} minute {minutes} hour {hours} other {units}}}}",
  "tarot.share.altText":
    "{cardTitle}, {orientation}. {themeVisibility, select, included {Reflection theme: {theme}.} hidden {Reflection theme hidden.} other {Reflection theme hidden.}} Privacy-safe {brand} share card. Symbolic reflection, not a prediction.",
} satisfies Readonly<Record<CoreMessageKey, string>>);

export const coreMessageCatalog = Object.freeze({
  messages: Object.freeze({
    "account.savedReflections": Object.freeze({
      message: runtimeMessages["account.savedReflections"],
    }),
    "practice.availableMode": Object.freeze({
      message: runtimeMessages["practice.availableMode"],
    }),
    "ritual.stepProgress": Object.freeze({
      message: runtimeMessages["ritual.stepProgress"],
    }),
    "shell.navigation.homeLabel": Object.freeze({
      message: runtimeMessages["shell.navigation.homeLabel"],
    }),
    "tarot.report.targetPosition": Object.freeze({
      message: runtimeMessages["tarot.report.targetPosition"],
    }),
    "tarot.retryAfter": Object.freeze({
      message: runtimeMessages["tarot.retryAfter"],
    }),
    "tarot.share.altText": Object.freeze({
      message: runtimeMessages["tarot.share.altText"],
    }),
  } satisfies Readonly<Record<CoreMessageKey, Readonly<{ message: string }>>>),
});

export const getCoreSourceMessage = (key: CoreMessageKey): string => {
  switch (key) {
    case "account.savedReflections":
      return runtimeMessages["account.savedReflections"];
    case "practice.availableMode":
      return runtimeMessages["practice.availableMode"];
    case "ritual.stepProgress":
      return runtimeMessages["ritual.stepProgress"];
    case "shell.navigation.homeLabel":
      return runtimeMessages["shell.navigation.homeLabel"];
    case "tarot.report.targetPosition":
      return runtimeMessages["tarot.report.targetPosition"];
    case "tarot.retryAfter":
      return runtimeMessages["tarot.retryAfter"];
    case "tarot.share.altText":
      return runtimeMessages["tarot.share.altText"];
  }
};

export const formatCoreMessage = (
  locale: Locale,
  key: CoreMessageKey,
  values: IcuMessageValues,
): string => formatIcuMessage(locale, getCoreSourceMessage(key), values);
