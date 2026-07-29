import { getTextDirection } from "@rituvia/i18n/locale";

import { parseLocale, type Locale } from "../_i18n/routing";

export const tarotShareCardSchemaVersion = "tarot-share-card.v1" as const;

export type TarotShareCardProjection = Readonly<{
  altText: string;
  boundary: string;
  brandName: string;
  canonicalLabel: string;
  canonicalUrl: string;
  cardTitle: string;
  direction: "ltr" | "rtl";
  genericReflection: string;
  locale: Locale;
  orientationLabel: string;
  schemaVersion: typeof tarotShareCardSchemaVersion;
  theme: Readonly<{ label: string; value: string }> | null;
}>;

export type TarotShareCardProjectionInput = Readonly<{
  altText: string;
  boundary: string;
  brandName: string;
  canonicalUrl: string;
  cardTitle: string;
  genericReflection: string;
  includeTheme: boolean;
  locale: Locale;
  orientationLabel: string;
  themeFieldLabel: string;
  themeLabel: string;
}>;

const hiddenCharacters =
  /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060\u2066-\u2069\ufeff]/u;

const reviewedText = (value: string, minimum: number, maximum: number): boolean =>
  typeof value === "string" &&
  value.length >= minimum &&
  value.length <= maximum &&
  value.trim() === value &&
  value.normalize("NFC") === value &&
  !hiddenCharacters.test(value);

const reviewedCanonical = (value: string, locale: Locale): URL | null => {
  try {
    const parsed = new URL(value);
    return (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      parsed.username === "" &&
      parsed.password === "" &&
      parsed.pathname === `/${locale}/tarot` &&
      parsed.search === "" &&
      parsed.hash === ""
      ? parsed
      : null;
  } catch {
    return null;
  }
};

export const createTarotShareCardProjection = (
  input: TarotShareCardProjectionInput,
): TarotShareCardProjection | null => {
  const locale = parseLocale(input.locale);
  const canonical = locale === null ? null : reviewedCanonical(input.canonicalUrl, locale);
  if (
    locale === null ||
    canonical === null ||
    !reviewedText(input.altText, 20, 800) ||
    !reviewedText(input.boundary, 20, 240) ||
    !reviewedText(input.brandName, 2, 100) ||
    !reviewedText(input.cardTitle, 1, 160) ||
    !reviewedText(input.genericReflection, 20, 240) ||
    !reviewedText(input.orientationLabel, 1, 80) ||
    !reviewedText(input.themeFieldLabel, 2, 80) ||
    !reviewedText(input.themeLabel, 1, 100)
  ) {
    return null;
  }
  return Object.freeze({
    altText: input.altText,
    boundary: input.boundary,
    brandName: input.brandName,
    canonicalLabel: `${canonical.host}${canonical.pathname}`,
    canonicalUrl: canonical.toString(),
    cardTitle: input.cardTitle,
    direction: getTextDirection(locale),
    genericReflection: input.genericReflection,
    locale,
    orientationLabel: input.orientationLabel,
    schemaVersion: tarotShareCardSchemaVersion,
    theme: input.includeTheme
      ? Object.freeze({ label: input.themeFieldLabel, value: input.themeLabel })
      : null,
  });
};

const escapeXml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const graphemes = (value: string, locale: Locale): readonly string[] =>
  Object.freeze(
    [...new Intl.Segmenter(locale, { granularity: "grapheme" }).segment(value)].map(
      ({ segment }) => segment,
    ),
  );

const wrappedLines = (
  value: string,
  locale: Locale,
  maximumGraphemes: number,
  maximumLines: number,
): readonly string[] | null => {
  const segments = [...new Intl.Segmenter(locale, { granularity: "word" }).segment(value)].map(
    ({ segment }) => segment,
  );
  const lines: string[] = [];
  let current = "";
  for (const segment of segments) {
    const candidate = `${current}${segment}`;
    if (graphemes(candidate, locale).length <= maximumGraphemes) {
      current = candidate;
      continue;
    }
    if (current.trim() !== "") lines.push(current.trim());
    const trimmedSegment = segment.trim();
    if (trimmedSegment === "") {
      current = "";
      continue;
    }
    const segmentGraphemes = graphemes(trimmedSegment, locale);
    if (segmentGraphemes.length <= maximumGraphemes) {
      current = trimmedSegment;
    } else {
      const chunks: string[] = [];
      for (let index = 0; index < segmentGraphemes.length; index += maximumGraphemes) {
        chunks.push(segmentGraphemes.slice(index, index + maximumGraphemes).join(""));
      }
      lines.push(...chunks.slice(0, -1));
      current = chunks.at(-1) ?? "";
    }
    if (lines.length >= maximumLines) return null;
  }
  if (current.trim() !== "") lines.push(current.trim());
  return lines.length > 0 && lines.length <= maximumLines ? Object.freeze(lines) : null;
};

const textLines = (lines: readonly string[], x: number, y: number, lineHeight: number): string =>
  lines
    .map(
      (line, index) => `<tspan x="${x}" y="${y + index * lineHeight}">${escapeXml(line)}</tspan>`,
    )
    .join("");

export const serializeTarotShareCardSvg = (projection: TarotShareCardProjection): string | null => {
  const titleLines = wrappedLines(projection.cardTitle, projection.locale, 26, 3);
  const reflectionLines = wrappedLines(projection.genericReflection, projection.locale, 52, 2);
  if (titleLines === null || reflectionLines === null) return null;
  const anchor = projection.direction === "rtl" ? "end" : "start";
  const x = projection.direction === "rtl" ? 1080 : 120;
  const theme = projection.theme;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" lang="${escapeXml(projection.locale)}" xml:lang="${escapeXml(projection.locale)}" direction="${projection.direction}">`,
    `<title>${escapeXml(projection.altText)}</title>`,
    `<desc>${escapeXml(projection.boundary)}</desc>`,
    '<rect width="1200" height="630" fill="#080a10"/>',
    '<circle cx="1020" cy="120" r="210" fill="#9e91e8" opacity="0.13"/>',
    '<circle cx="170" cy="560" r="260" fill="#e3c27a" opacity="0.10"/>',
    '<rect x="54" y="44" width="1092" height="542" rx="38" fill="#121621" stroke="#e3c27a" stroke-width="2"/>',
    `<g fill="#f6f1e7" font-family="Inter, system-ui, sans-serif" text-anchor="${anchor}" style="unicode-bidi:plaintext">`,
    `<text x="${x}" y="108" fill="#e3c27a" font-size="30" font-weight="700" letter-spacing="3">${escapeXml(projection.brandName)}</text>`,
    `<text font-family="Georgia, 'Times New Roman', serif" font-size="58" font-weight="700">${textLines(titleLines, x, 190, 62)}</text>`,
    `<text x="${x}" y="370" fill="#ffe3a4" font-size="30">${escapeXml(projection.orientationLabel)}</text>`,
    theme === null
      ? ""
      : `<text x="${x}" y="410" fill="#a9adba" font-size="24">${escapeXml(`${theme.label}: ${theme.value}`)}</text>`,
    `<text fill="#f6f1e7" font-size="26">${textLines(reflectionLines, x, theme === null ? 420 : 456, 34)}</text>`,
    `<text x="${x}" y="535" fill="#a9adba" font-size="20">${escapeXml(projection.boundary)}</text>`,
    `<text x="${x}" y="563" fill="#79c8c2" font-size="20">${escapeXml(projection.canonicalLabel)}</text>`,
    "</g>",
    "</svg>",
  ].join("");
};

export const createTarotShareCardText = (projection: TarotShareCardProjection): string =>
  `${projection.altText}\n${projection.canonicalUrl}`;
