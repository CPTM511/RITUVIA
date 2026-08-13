import { parseQuestionIntakeThemeCode, type QuestionIntakeThemeCode } from "@rituvia/domain";

export type QuestionIntakeThemeHandoffStorage = Pick<Storage, "getItem" | "removeItem" | "setItem">;

export const questionIntakeThemeHandoffStorageKey = "rituvia.question-intake-theme.v1";

export const storeQuestionIntakeThemeHandoff = (
  storage: QuestionIntakeThemeHandoffStorage,
  themeCode: string,
): boolean => {
  let parsed: QuestionIntakeThemeCode;
  try {
    parsed = parseQuestionIntakeThemeCode(themeCode);
  } catch {
    return false;
  }
  try {
    storage.setItem(questionIntakeThemeHandoffStorageKey, parsed);
    return true;
  } catch {
    return false;
  }
};

export const takeQuestionIntakeThemeHandoff = (
  storage: QuestionIntakeThemeHandoffStorage,
  options: Readonly<{ openerPresent: boolean }>,
): QuestionIntakeThemeCode | null => {
  try {
    const candidate = storage.getItem(questionIntakeThemeHandoffStorageKey);
    storage.removeItem(questionIntakeThemeHandoffStorageKey);
    if (candidate === null || options.openerPresent) return null;
    return parseQuestionIntakeThemeCode(candidate);
  } catch {
    return null;
  }
};

export const clearQuestionIntakeThemeHandoff = (storage: Pick<Storage, "removeItem">): void => {
  try {
    storage.removeItem(questionIntakeThemeHandoffStorageKey);
  } catch {
    return;
  }
};
