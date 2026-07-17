"use client";

import type { TarotThreeCardMessages } from "../_i18n/tarot-three-card-messages";
import { TarotReadingFlow } from "./tarot-one-card-flow";
import type { LocalActionHref } from "@rituvia/ui";

type TarotThreeCardFlowProps = Readonly<{
  messages: TarotThreeCardMessages;
  methodologyHref: LocalActionHref;
}>;

export function TarotThreeCardFlow(props: TarotThreeCardFlowProps) {
  return <TarotReadingFlow {...props} readingType="three_card" />;
}
