import "server-only";

import type { TarotCatalogV1, TarotDrawFactsV1 } from "@rituvia/divination";
import type { QuestionIntakeThemeCode } from "@rituvia/domain";

import {
  tarotReadingPresentationSchemaVersion,
  type TarotReadingPresentationCardV1,
  type TarotReadingPresentationV1,
} from "../app/_contracts/tarot-reading-response";

const unavailable = (): never => {
  throw new TypeError("The tarot reading presentation is unavailable.");
};

const sameReference = (
  left: Readonly<{ id: string; version: string }>,
  right: Readonly<{ id: string; version: string }>,
): boolean => left.id === right.id && left.version === right.version;

export const projectTarotReadingPresentationV1 = (
  catalog: TarotCatalogV1,
  facts: TarotDrawFactsV1,
  themeCode: QuestionIntakeThemeCode,
): TarotReadingPresentationV1 => {
  if (
    catalog.catalogId !== facts.catalog.id ||
    catalog.version !== facts.catalog.version ||
    !catalog.supportedThemeCodes.includes(themeCode)
  ) {
    return unavailable();
  }
  const deck = catalog.decks.find(
    (candidate) => candidate.deckId === facts.deck.id && candidate.version === facts.deck.version,
  );
  const spread = catalog.spreads.find(
    (candidate) =>
      candidate.spreadId === facts.spread.id && candidate.version === facts.spread.version,
  );
  if (
    deck === undefined ||
    spread === undefined ||
    spread.positions.length !== facts.positions.length
  ) {
    return unavailable();
  }

  const cards = facts.positions.map((position): TarotReadingPresentationCardV1 => {
    const positionContent = spread.positions.find(
      (candidate) =>
        candidate.positionId === position.positionId && candidate.order === position.order,
    );
    const card = deck.cards.find((candidate) => candidate.cardId === position.cardId);
    const content = catalog.cardContents.find(
      (candidate) =>
        sameReference(candidate.deck, facts.deck) &&
        candidate.cardId === position.cardId &&
        candidate.orientation === position.orientation,
    );
    const invitation = content?.themeReadings.find(
      (candidate) => candidate.themeCode === themeCode,
    )?.text;
    const constructivePossibility = content?.constructivePossibilities[0];
    const tension = content?.tensions[0];
    const reflectionQuestion = content?.reflectionQuestions[0];
    const smallAction = content?.smallActions[0];
    if (
      positionContent === undefined ||
      card === undefined ||
      content === undefined ||
      invitation === undefined ||
      constructivePossibility === undefined ||
      tension === undefined ||
      reflectionQuestion === undefined ||
      smallAction === undefined ||
      content.coreThemes.length === 0
    ) {
      return unavailable();
    }
    return Object.freeze({
      cannotDetermine: content.cannotDetermine,
      cardId: card.cardId,
      cardTitle: card.title,
      constructivePossibility,
      coreThemes: Object.freeze([...content.coreThemes]),
      invitation,
      order: position.order,
      orientation: position.orientation,
      positionId: position.positionId,
      positionTitle: positionContent.title,
      reflectionQuestion,
      smallAction,
      tension,
    });
  });
  if (new Set(cards.map(({ cardId }) => cardId)).size !== cards.length) return unavailable();
  return Object.freeze({
    cards: Object.freeze(cards),
    schemaVersion: tarotReadingPresentationSchemaVersion,
  });
};
