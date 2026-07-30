export type LocaleFormattingContext = Readonly<{
  locale: string;
  timeZone: string;
}>;

export type TextDirection = "ltr" | "rtl";

export type LocaleFormatter = Readonly<{
  currency: (
    value: number | bigint,
    currency: string,
    options?: Omit<Intl.NumberFormatOptions, "currency" | "style">,
  ) => string;
  date: (value: Date | number, options?: Intl.DateTimeFormatOptions) => string;
  displayName: (code: string, type: Intl.DisplayNamesOptions["type"]) => string;
  list: (values: readonly string[], options?: Intl.ListFormatOptions) => string;
  number: (value: number | bigint, options?: Intl.NumberFormatOptions) => string;
  percent: (value: number | bigint, options?: Omit<Intl.NumberFormatOptions, "style">) => string;
  relativeTime: (
    value: number,
    unit: Intl.RelativeTimeFormatUnit,
    options?: Intl.RelativeTimeFormatOptions,
  ) => string;
  time: (value: Date | number, options?: Intl.DateTimeFormatOptions) => string;
  unit: (
    value: number | bigint,
    unit: string,
    options?: Omit<Intl.NumberFormatOptions, "style" | "unit">,
  ) => string;
}>;

const localePattern = /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/u;
const currencyPattern = /^[A-Z]{3}$/u;

export const canonicalizeLocale = (value: string): string => {
  if (
    typeof value !== "string" ||
    value.length < 2 ||
    value.length > 64 ||
    !localePattern.test(value)
  ) {
    throw new TypeError("The locale must be a bounded BCP 47 language tag.");
  }
  try {
    const locales = Intl.getCanonicalLocales(value);
    if (locales.length !== 1 || locales.at(0) === undefined) {
      throw new TypeError("The locale must resolve to one canonical language tag.");
    }
    return locales.at(0) as string;
  } catch {
    throw new TypeError("The locale must be a valid BCP 47 language tag.");
  }
};

export const canonicalizeTimeZone = (value: string): string => {
  if (typeof value !== "string" || value.length < 1 || value.length > 80) {
    throw new TypeError("The time zone must be a bounded IANA identifier.");
  }
  try {
    return new Intl.DateTimeFormat("en", { timeZone: value }).resolvedOptions().timeZone;
  } catch {
    throw new TypeError("The time zone must be a valid IANA identifier.");
  }
};

export const getTextDirection = (locale: string): TextDirection => {
  const localeWithTextInfo = new Intl.Locale(canonicalizeLocale(locale)) as unknown as {
    getTextInfo: () => Readonly<{ direction: TextDirection }>;
  };
  return localeWithTextInfo.getTextInfo().direction;
};

export const resolveLocaleFallbackChain = (
  requestedLocale: string,
  sourceLocale: string,
  configuredFallbacks: Readonly<Record<string, readonly string[]>>,
): readonly string[] => {
  const requested = canonicalizeLocale(requestedLocale);
  const source = canonicalizeLocale(sourceLocale);
  const chain: string[] = [];
  const queued = [requested, ...(configuredFallbacks[requested] ?? []), source];
  for (const value of queued) {
    const locale = canonicalizeLocale(value);
    if (!chain.includes(locale)) chain.push(locale);
    if (chain.length > 8) {
      throw new TypeError("The explicit locale fallback chain exceeds the bounded limit.");
    }
  }
  return Object.freeze(chain);
};

export const createLocaleFormatter = ({
  locale: localeInput,
  timeZone: timeZoneInput,
}: LocaleFormattingContext): LocaleFormatter => {
  const locale = canonicalizeLocale(localeInput);
  const timeZone = canonicalizeTimeZone(timeZoneInput);
  return Object.freeze({
    currency: (value, currency, options = {}) => {
      if (!currencyPattern.test(currency)) {
        throw new TypeError("Currency formatting requires an explicit ISO 4217 code.");
      }
      return new Intl.NumberFormat(locale, {
        ...options,
        currency,
        style: "currency",
      }).format(value);
    },
    date: (value, options = {}) => {
      const configuredOptions =
        Object.keys(options).length === 0 ? { dateStyle: "medium" as const } : options;
      return new Intl.DateTimeFormat(locale, {
        ...configuredOptions,
        timeZone,
      }).format(value);
    },
    displayName: (code, type) => {
      const displayName = new Intl.DisplayNames(locale, { fallback: "none", type }).of(code);
      if (displayName === undefined) {
        throw new TypeError("The requested display name is unavailable.");
      }
      return displayName;
    },
    list: (values, options = {}) => new Intl.ListFormat(locale, options).format(values),
    number: (value, options = {}) => new Intl.NumberFormat(locale, options).format(value),
    percent: (value, options = {}) =>
      new Intl.NumberFormat(locale, { ...options, style: "percent" }).format(value),
    relativeTime: (value, unit, options = {}) =>
      new Intl.RelativeTimeFormat(locale, options).format(value, unit),
    time: (value, options = {}) => {
      const configuredOptions =
        Object.keys(options).length === 0 ? { timeStyle: "short" as const } : options;
      return new Intl.DateTimeFormat(locale, {
        ...configuredOptions,
        timeZone,
      }).format(value);
    },
    unit: (value, unit, options = {}) =>
      new Intl.NumberFormat(locale, {
        ...options,
        style: "unit",
        unit,
      }).format(value),
  });
};
