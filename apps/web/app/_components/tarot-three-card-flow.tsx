"use client";

import type { TarotThreeCardMessages } from "../_i18n/tarot-three-card-messages";
import type { Locale } from "../_i18n/routing";
import { TarotReadingFlow } from "./tarot-one-card-flow";
import type { LocalActionHref } from "@rituvia/ui";

type TarotThreeCardFlowProps = Readonly<{
  locale: Locale;
  messages: TarotThreeCardMessages;
  methodologyHref: LocalActionHref;
  sanctuaryHref: LocalActionHref;
}>;

export function TarotThreeCardFlow(props: TarotThreeCardFlowProps) {
  return <TarotReadingFlow {...props} readingType="three_card" />;
}
