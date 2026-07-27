import type { NumerologyCalculationCode } from "../_contracts/numerology-calculation-response";
import type { Locale } from "./routing";

export type NumerologyMessages = Readonly<{
  metadata: Readonly<{
    description: string;
    title: string;
  }>;
  page: Readonly<{
    boundary: string;
    eyebrow: string;
    introduction: string;
    libraryAction: string;
    privacy: string;
    title: string;
  }>;
  form: Readonly<{
    birthDateDescription: string;
    birthDateError: string;
    birthDateLabel: string;
    loading: string;
    noScript: string;
    required: string;
    reset: string;
    submit: string;
    targetYearDescription: string;
    targetYearError: string;
    targetYearLabel: string;
    targetYearPlaceholder: string;
  }>;
  states: Readonly<{
    empty: Readonly<{ message: string; title: string }>;
    error: Readonly<{ message: string; retry: string; title: string }>;
    invalid: Readonly<{ message: string; title: string }>;
    offline: Readonly<{ message: string; retry: string; title: string }>;
    unavailable: Readonly<{ message: string; retry: string; title: string }>;
  }>;
  result: Readonly<{
    calculationLabels: Readonly<Record<NumerologyCalculationCode, string>>;
    digitSource: string;
    engineVersion: string;
    formulaLabels: Readonly<Record<NumerologyCalculationCode, string>>;
    initialValue: string;
    masterPreserved: string;
    methodDetails: string;
    methodNote: string;
    reduction: string;
    result: string;
    ruleVersion: string;
    targetYear: string;
    title: string;
  }>;
}>;

const englishNumerologyMessages = {
  metadata: {
    description:
      "Calculate Life Path, Birthday Number, and Personal Year through RITUVIA's transparent date method.",
    title: "Numerology calculator",
  },
  page: {
    boundary:
      "Use these numbers as one symbolic way to reflect, not as a fixed identity, prediction, diagnosis, or instruction.",
    eyebrow: "Every step, clearly shown",
    introduction:
      "Enter a birth date and the four-digit year you want to explore. The same approved rules calculate Life Path, Birthday Number, and Personal Year.",
    libraryAction: "Learn the public method before calculating",
    privacy:
      "Your birth date is sent only in a private same-origin request for this calculation. It is not placed in the URL, stored, logged, or included in analytics.",
    title: "Read the rhythm in your numbers",
  },
  form: {
    birthDateDescription:
      "Use the Gregorian date shown on your birth record. Localized calendars and localized digits are not converted silently.",
    birthDateError: "Enter a valid Gregorian date in YYYY-MM-DD form.",
    birthDateLabel: "Birth date",
    loading: "Calculating your numbers",
    noScript:
      "JavaScript is required for this private calculation. The disabled form prevents birth data from being submitted through an unreviewed navigation.",
    required: "required",
    reset: "Clear birth data and start again",
    submit: "Calculate my numbers",
    targetYearDescription:
      "Enter the exact four-digit year for the Personal Year calculation. RITUVIA never guesses the current year.",
    targetYearError: "Enter a four-digit year from 1000 through 9999.",
    targetYearLabel: "Target year",
    targetYearPlaceholder: "YYYY",
  },
  states: {
    empty: {
      message:
        "Enter both fields to see the source digits, initial total, and every reduction step for all three numbers.",
      title: "Your calculation will unfold here",
    },
    error: {
      message:
        "The calculation response could not be verified. Your inputs remain only in this page and nothing will retry automatically.",
      retry: "Try again",
      title: "The calculation could not be completed",
    },
    invalid: {
      message:
        "The server rejected the calculation input. Review the date and target year before trying again.",
      title: "Review the calculation fields",
    },
    offline: {
      message:
        "Reconnect before calculating. Your inputs remain only in this page and will not be sent automatically.",
      retry: "Check connection and try again",
      title: "You appear to be offline",
    },
    unavailable: {
      message:
        "The approved calculation service is temporarily unavailable. Your inputs remain only in this page and nothing will retry automatically.",
      retry: "Try again",
      title: "The calculator is unavailable",
    },
  },
  result: {
    calculationLabels: {
      birthday_number: "Birthday Number",
      life_path: "Life Path",
      personal_year: "Personal Year",
    },
    digitSource: "Source digits",
    engineVersion: "Engine",
    formulaLabels: {
      birthday_number: "Validated day of month",
      life_path: "All birth-date digits",
      personal_year: "Birth month, birth day, and target-year digits",
    },
    initialValue: "Initial value",
    masterPreserved: "Master number preserved by the approved 11, 22, and 33 rule.",
    methodDetails: "Calculation method and versions",
    methodNote:
      "RITUVIA V1 uses one reviewed product convention for symbolic reflection. Other methods may calculate differently.",
    reduction: "Reduction steps",
    result: "Result",
    ruleVersion: "Rule",
    targetYear: "Personal Year target",
    title: "Your number pattern",
  },
} as const satisfies NumerologyMessages;

export const getNumerologyMessages = (locale: Locale): NumerologyMessages => {
  switch (locale) {
    case "en":
      return englishNumerologyMessages;
  }
};
