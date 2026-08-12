import { getAstrologyMessages, type AstrologyMessages } from "./astrology-messages";

export type RecoveryAstrologyMessages = Readonly<{
  astrology: AstrologyMessages;
  form: Readonly<{
    approximate: string;
    approximationWindow: string;
    birthDate: string;
    birthTime: string;
    calculate: string;
    clear: string;
    disambiguation: string;
    disambiguationAutomatic: string;
    disambiguationEarlier: string;
    disambiguationLater: string;
    exact: string;
    invalidDate: string;
    invalidTime: string;
    location: string;
    required: string;
    timeCertainty: string;
    unknown: string;
  }>;
  privacy: Readonly<{
    boundary: string;
    title: string;
  }>;
  source: Readonly<{
    body: string;
    engine: string;
    geonames: string;
    license: string;
    runtime: string;
    sourceCode: string;
    title: string;
  }>;
  states: Readonly<{
    ambiguous: Readonly<{ message: string; title: string }>;
    calculating: Readonly<{ message: string; title: string }>;
    error: Readonly<{ message: string; title: string }>;
    invalid: Readonly<{ message: string; title: string }>;
    nonexistent: Readonly<{ message: string; title: string }>;
    offline: Readonly<{ message: string; title: string }>;
    unavailable: Readonly<{ message: string; title: string }>;
  }>;
}>;

const base = getAstrologyMessages("en");

export const recoveryAstrologyMessages: RecoveryAstrologyMessages = Object.freeze({
  astrology: Object.freeze({
    ...base,
    metadata: Object.freeze({
      description:
        "Calculate deterministic natal facts with synthetic protected-staging inputs and explicit time uncertainty.",
      title: "Protected staging natal calculator",
    }),
    page: Object.freeze({
      boundary:
        "This bounded staging calculator presents deterministic astronomical facts under the reviewed RITUVIA method. It is not a personality verdict, prediction, diagnosis, or professional advice.",
      eyebrow: "Founder Acceptance Recovery · Item 8",
      introduction:
        "Use synthetic birth details to verify exact, approximate, and unknown-time behavior against the real Swiss Ephemeris engine.",
      privacy:
        "The form is anonymous and does not persist birth data in the browser or database. Clear removes the current synthetic inputs and result.",
      title: "Verify natal calculation truth",
    }),
    result: Object.freeze({
      ...base.result,
      chartDescription:
        "A presentation-only circular plot of the exact longitudes returned by this calculation. Tables following the chart provide the complete facts.",
      confidenceMessages: Object.freeze({
        ...base.result.confidenceMessages,
        EXACT_TIME_FULL_FACTS:
          "This calculation used the supplied exact birth time and includes approved placements, Placidus houses, angles, and aspects.",
      }),
      methodNote:
        "This request uses one versioned tropical, True Node, Placidus convention. Other astrology methods may calculate or present facts differently.",
      placementsCaption: "All approved planetary and True Node facts returned by this calculation.",
      savedAt: "Calculated",
      title: "Calculated natal facts",
    }),
  }),
  form: Object.freeze({
    approximate: "Approximate time",
    approximationWindow: "Uncertainty window",
    birthDate: "Synthetic birth date",
    birthTime: "Synthetic local birth time",
    calculate: "Calculate natal facts",
    clear: "Clear synthetic birth data",
    disambiguation: "Daylight-saving overlap choice",
    disambiguationAutomatic: "Automatic — ask if ambiguous",
    disambiguationEarlier: "Earlier matching instant",
    disambiguationLater: "Later matching instant",
    exact: "Exact time",
    invalidDate: "Enter a valid date from 1800 through 2199.",
    invalidTime: "Enter a 24-hour time in HH:MM format.",
    location: "Synthetic location fixture",
    required: "Required",
    timeCertainty: "Birth-time certainty",
    unknown: "Unknown time",
  }),
  privacy: Object.freeze({
    boundary:
      "No browser storage, account profile, analytics event, model request, or database birth record is created by this staging calculator.",
    title: "Synthetic data only",
  }),
  source: Object.freeze({
    body: "The displayed numbers come from deterministic engines; no Provider AI produces or changes them.",
    engine:
      "Astrology: Swiss Ephemeris 2.10.03 at reviewed source commit af9823fe7b06ffefe3d3968fdc5680be8b5eec5f.",
    geonames:
      "Locations: checksummed three-place GeoNames recovery fixture, attributed under CC-BY-4.0.",
    license: "Repository and Swiss Ephemeris integration remain AGPL-3.0-only.",
    runtime: "Civil-time resolution: Node 24.18.0, ICU 78.3, tzdata 2026b.",
    sourceCode: "Review this deployed source revision",
    title: "Method, source, and license",
  }),
  states: Object.freeze({
    ambiguous: Object.freeze({
      message:
        "This local time occurs twice. Select the earlier or later matching instant, then calculate again.",
      title: "Choose a daylight-saving overlap",
    }),
    calculating: Object.freeze({
      message: "Resolving civil time and calculating with the reviewed native engine.",
      title: "Calculating natal facts",
    }),
    error: Object.freeze({
      message: "The response could not be verified. No partial or invented chart is shown.",
      title: "The calculation could not be verified",
    }),
    invalid: Object.freeze({
      message: "Correct the highlighted synthetic input before calculating again.",
      title: "Check the form",
    }),
    nonexistent: Object.freeze({
      message:
        "This local time did not exist because the clock moved forward. Enter another local time.",
      title: "The local time does not exist",
    }),
    offline: Object.freeze({
      message: "Reconnect before calculating. Nothing will retry automatically.",
      title: "You appear to be offline",
    }),
    unavailable: Object.freeze({
      message:
        "The approved native engine or protected session is unavailable. No fallback chart is invented.",
      title: "The calculator is unavailable",
    }),
  }),
});
