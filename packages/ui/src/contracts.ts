declare const localActionHrefBrand: unique symbol;
declare const uiControlIdBrand: unique symbol;
declare const uiControlNameBrand: unique symbol;
declare const uiControlValueBrand: unique symbol;

export type LocalActionHref = string & { readonly [localActionHrefBrand]: true };
export type UiControlId = string & { readonly [uiControlIdBrand]: true };
export type UiControlName = string & { readonly [uiControlNameBrand]: true };
export type UiControlValue = string & { readonly [uiControlValueBrand]: true };
export type ThemeMode = "dark" | "light" | "system";

const controlIdentifierPattern = /^[a-z][a-z0-9-]{0,63}$/u;
const controlNamePattern = /^[a-z][a-z0-9_.-]{0,63}$/u;
const controlValuePattern = /^[a-z0-9][a-z0-9._~-]{0,63}$/u;
const localPathPattern =
  /^\/(?:[A-Za-z0-9._~-]+(?:\/[A-Za-z0-9._~-]+)*)?(?:#[A-Za-z][A-Za-z0-9._:-]*)?$/u;
const localFragmentPattern = /^#[A-Za-z][A-Za-z0-9._:-]*$/u;

const requireNonEmptyLabel = (value: string, label: string): string => {
  if (typeof value !== "string" || value.trim() === "" || /[\u0000-\u001f\u007f]/u.test(value)) {
    throw new TypeError(`${label} must be non-empty and free of control characters.`);
  }
  return value;
};

export const createLocalActionHref = (value: string): LocalActionHref => {
  if (typeof value !== "string") {
    throw new TypeError("Local action targets must be strings.");
  }
  const pathWithoutFragment = value.split("#", 1)[0] ?? "";
  const hasTraversalSegment = pathWithoutFragment
    .split("/")
    .some((segment) => segment === "." || segment === "..");
  if (
    value.includes("\\") ||
    value.includes("&") ||
    value.includes("?") ||
    value.includes("%") ||
    hasTraversalSegment ||
    /[\u0000-\u0020\u007f]/u.test(value) ||
    (!localPathPattern.test(value) && !localFragmentPattern.test(value))
  ) {
    throw new TypeError("Local action targets must be canonical root-relative paths or fragments.");
  }
  return value as LocalActionHref;
};

export const createUiControlId = (value: string): UiControlId => {
  if (typeof value !== "string" || !controlIdentifierPattern.test(value)) {
    throw new TypeError("UI control IDs must be bounded public kebab-case identifiers.");
  }
  return value as UiControlId;
};

export const createUiControlName = (value: string): UiControlName => {
  if (typeof value !== "string" || !controlNamePattern.test(value)) {
    throw new TypeError("UI control names must be bounded public schema identifiers.");
  }
  return value as UiControlName;
};

export const createUiControlValue = (value: string): UiControlValue => {
  if (typeof value !== "string" || !controlValuePattern.test(value)) {
    throw new TypeError("UI control values must be bounded public option identifiers.");
  }
  return value as UiControlValue;
};

export const resolveThemeMode = (value: unknown): ThemeMode =>
  value === "dark" || value === "light" || value === "system" ? value : "system";

export const assertAccessibleLabel = (value: string, label = "Accessible label"): string =>
  requireNonEmptyLabel(value, label);
