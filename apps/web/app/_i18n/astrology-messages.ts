import type {
  AstrologyNatalViewBody,
  AstrologyNatalViewMajorAspect,
  AstrologyNatalViewZodiacSign,
} from "../_contracts/astrology-natal-response";

import type { Locale } from "./routing";

export type AstrologyConfidenceMessageCode =
  | "APPROXIMATE_TIME_ANGLES_AND_HOUSES_SUPPRESSED"
  | "ENGINE_OUTPUT_REJECTED_NO_PLACEMENTS"
  | "ENGINE_UNAVAILABLE_NO_PLACEMENTS"
  | "EXACT_TIME_FULL_FACTS"
  | "UNKNOWN_TIME_NO_PLACEMENTS";

export type AstrologyMessages = Readonly<{
  metadata: Readonly<{
    description: string;
    title: string;
  }>;
  page: Readonly<{
    boundary: string;
    eyebrow: string;
    introduction: string;
    privacy: string;
    title: string;
  }>;
  states: Readonly<{
    empty: Readonly<{ message: string; title: string }>;
    error: Readonly<{ message: string; retry: string; title: string }>;
    loading: Readonly<{ message: string; title: string }>;
    offline: Readonly<{ message: string; retry: string; title: string }>;
    unauthorized: Readonly<{ action: string; message: string; title: string }>;
    unavailable: Readonly<{ message: string; retry: string; title: string }>;
  }>;
  result: Readonly<{
    angleLabels: Readonly<Record<"armc" | "ascendant" | "midheaven" | "vertex", string>>;
    anglesCaption: string;
    anglesTitle: string;
    approximationWindow: string;
    aspectLabels: Readonly<Record<AstrologyNatalViewMajorAspect, string>>;
    aspectsCaption: string;
    aspectsTitle: string;
    bodyLabels: Readonly<Record<AstrologyNatalViewBody, string>>;
    chartDescription: string;
    chartTitle: string;
    columns: Readonly<{
      angle: string;
      aspect: string;
      body: string;
      bodyA: string;
      bodyB: string;
      cusp: string;
      distance: string;
      exactAngle: string;
      flags: string;
      house: string;
      latitude: string;
      longitude: string;
      longitudeSpeed: string;
      name: string;
      orb: string;
      separation: string;
      sign: string;
      signDegrees: string;
      value: string;
    }>;
    confidenceLabels: Readonly<Record<AstrologyConfidenceMessageCode, string>>;
    confidenceMessages: Readonly<Record<AstrologyConfidenceMessageCode, string>>;
    engine: string;
    housesCaption: string;
    housesTitle: string;
    julianDay: string;
    method: string;
    methodDetails: string;
    methodNote: string;
    placementsCaption: string;
    placementsTitle: string;
    profileRevision: string;
    requestedFlags: string;
    savedAt: string;
    signLabels: Readonly<Record<AstrologyNatalViewZodiacSign, string>>;
    source: string;
    title: string;
  }>;
}>;

const englishAstrologyMessages = {
  metadata: {
    description:
      "Review the confidence, placements, houses, angles, and aspects in your latest private saved natal calculation.",
    title: "Your saved natal chart",
  },
  page: {
    boundary:
      "These are deterministic astronomical facts under one reviewed Western astrology method. They are not a personality verdict, prediction, diagnosis, or professional advice.",
    eyebrow: "Private saved calculation",
    introduction:
      "Review the latest natal calculation already saved to your account. The tables are the complete authoritative view; the wheel is a visual aid.",
    privacy:
      "This page does not collect or display your birth date, birth time, birthplace, or coordinates. The private response is never cached or indexed.",
    title: "A careful view of your natal facts",
  },
  states: {
    empty: {
      message:
        "No saved natal calculation is available for this account. This viewer does not create one or request birth information.",
      title: "There is no saved chart yet",
    },
    error: {
      message:
        "The saved response could not be verified. Nothing will retry automatically, and no unverified chart will be shown.",
      retry: "Try loading again",
      title: "The chart could not be verified",
    },
    loading: {
      message: "Loading the latest owner-scoped saved calculation.",
      title: "Loading your saved chart",
    },
    offline: {
      message:
        "Reconnect before loading this private result. Nothing will be sent or retried automatically.",
      retry: "Check connection and try again",
      title: "You appear to be offline",
    },
    unauthorized: {
      action: "Sign in to view saved charts",
      message:
        "Saved natal calculations are private to an authenticated account. Sign in before trying again.",
      title: "Sign in is required",
    },
    unavailable: {
      message:
        "The private saved-calculation service is temporarily unavailable. No fallback chart will be invented.",
      retry: "Try loading again",
      title: "The saved chart is unavailable",
    },
  },
  result: {
    angleLabels: {
      armc: "ARMC",
      ascendant: "Ascendant",
      midheaven: "Midheaven",
      vertex: "Vertex",
    },
    anglesCaption: "Exact-time calculated angles in ecliptic degrees.",
    anglesTitle: "Angles",
    approximationWindow: "Approximation window",
    aspectLabels: {
      conjunction: "Conjunction",
      opposition: "Opposition",
      sextile: "Sextile",
      square: "Square",
      trine: "Trine",
    },
    aspectsCaption:
      "Approved major aspects, with measured separation, exact angle, and orb in degrees.",
    aspectsTitle: "Major aspects",
    bodyLabels: {
      jupiter: "Jupiter",
      mars: "Mars",
      mercury: "Mercury",
      moon: "Moon",
      neptune: "Neptune",
      pluto: "Pluto",
      saturn: "Saturn",
      sun: "Sun",
      true_node: "True Node",
      uranus: "Uranus",
      venus: "Venus",
    },
    chartDescription:
      "A presentation-only circular plot of the exact longitudes returned by the saved calculation. Tables following the chart provide the complete facts.",
    chartTitle: "Natal fact wheel",
    columns: {
      angle: "Exact angle",
      aspect: "Aspect",
      body: "Body",
      bodyA: "First body",
      bodyB: "Second body",
      cusp: "Cusp longitude",
      distance: "Distance in AU",
      exactAngle: "Exact angle",
      flags: "Returned flags",
      house: "House",
      latitude: "Ecliptic latitude",
      longitude: "Ecliptic longitude",
      longitudeSpeed: "Longitude speed per day",
      name: "Name",
      orb: "Orb",
      separation: "Separation",
      sign: "Sign",
      signDegrees: "Degrees within sign",
      value: "Value",
    },
    confidenceLabels: {
      APPROXIMATE_TIME_ANGLES_AND_HOUSES_SUPPRESSED: "Approximate-time facts",
      ENGINE_OUTPUT_REJECTED_NO_PLACEMENTS: "Engine output rejected",
      ENGINE_UNAVAILABLE_NO_PLACEMENTS: "Calculation unavailable",
      EXACT_TIME_FULL_FACTS: "Exact-time facts",
      UNKNOWN_TIME_NO_PLACEMENTS: "Unknown-time boundary",
    },
    confidenceMessages: {
      APPROXIMATE_TIME_ANGLES_AND_HOUSES_SUPPRESSED:
        "Planetary placements use the supplied center instant. Houses, angles, and aspects are intentionally suppressed.",
      ENGINE_OUTPUT_REJECTED_NO_PLACEMENTS:
        "The saved engine output did not pass the trusted contract, so no partial placements are shown.",
      ENGINE_UNAVAILABLE_NO_PLACEMENTS:
        "The approved engine was unavailable, so no fallback or partial placements are shown.",
      EXACT_TIME_FULL_FACTS:
        "The saved calculation used an exact birth time and includes the approved placements, Placidus houses, angles, and aspects.",
      UNKNOWN_TIME_NO_PLACEMENTS:
        "No birth time was supplied. RITUVIA did not invent a noon chart or calculate placements.",
    },
    engine: "Engine",
    housesCaption: "Twelve Placidus house cusps in ecliptic degrees.",
    housesTitle: "House cusps",
    julianDay: "Julian day UT",
    method: "Method",
    methodDetails: "Method and source provenance",
    methodNote:
      "RITUVIA uses one versioned tropical, True Node, Placidus convention. Other astrology methods may calculate or present facts differently.",
    placementsCaption:
      "All approved planetary and True Node facts returned by the saved calculation.",
    placementsTitle: "Placements",
    profileRevision: "Birth profile revision",
    requestedFlags: "Requested ephemeris flags",
    savedAt: "Saved",
    signLabels: {
      aquarius: "Aquarius",
      aries: "Aries",
      cancer: "Cancer",
      capricorn: "Capricorn",
      gemini: "Gemini",
      leo: "Leo",
      libra: "Libra",
      pisces: "Pisces",
      sagittarius: "Sagittarius",
      scorpio: "Scorpio",
      taurus: "Taurus",
      virgo: "Virgo",
    },
    source: "Source snapshot",
    title: "Your latest saved natal facts",
  },
} as const satisfies AstrologyMessages;

export const getAstrologyMessages = (locale: Locale): AstrologyMessages => {
  switch (locale) {
    case "en":
      return englishAstrologyMessages;
  }
};
