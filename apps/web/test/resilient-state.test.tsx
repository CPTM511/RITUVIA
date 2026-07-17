import { StatePattern, createLocalActionHref, createUiControlId } from "@rituvia/ui";
import { isValidElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ResilientState } from "../app/_components/resilient-state";
import { getStateMessages } from "../app/_i18n/state-messages";

const titleId = createUiControlId("app-state-title");

describe("localized Web state consumption", () => {
  it("keeps one reviewed component identity across error and offline transitions", () => {
    const stateMessages = getStateMessages("en");
    const error = ResilientState({
      kind: "error",
      live: "off",
      message: stateMessages.error.message,
      title: stateMessages.error.title,
      titleAs: "h1",
      titleId,
    });
    const offline = ResilientState({
      kind: "offline",
      live: "off",
      message: stateMessages.offline.message,
      title: stateMessages.offline.title,
      titleAs: "h1",
      titleId,
    });

    expect(isValidElement(error) && error.type).toBe(StatePattern);
    expect(isValidElement(offline) && offline.type).toBe(StatePattern);
  });

  it("renders all four app-level variants through the shared UI contract", () => {
    const stateMessages = getStateMessages("en");
    const fixtures = [
      {
        kind: "empty" as const,
        message: "The reviewed collection contains no items.",
        title: "Nothing here yet",
      },
      { kind: "error" as const, ...stateMessages.error },
      { kind: "offline" as const, ...stateMessages.offline },
      {
        kind: "provider-unavailable" as const,
        ...stateMessages.providerUnavailable,
      },
    ];

    for (const fixture of fixtures) {
      const html = renderToStaticMarkup(
        fixture.kind === "error" ? (
          <ResilientState
            kind="error"
            live="assertive"
            message={fixture.message}
            primaryAction={{
              href: createLocalActionHref("/en"),
              kind: "link",
              label: "Return home",
            }}
            title={fixture.title}
            titleAs="h1"
            titleId={titleId}
          />
        ) : (
          <ResilientState
            kind={fixture.kind}
            message={fixture.message}
            title={fixture.title}
            titleId={titleId}
          />
        ),
      );
      expect(html).toContain(`data-kind="${fixture.kind}"`);
      expect(html).toContain(fixture.title);
      expect(html).toContain(fixture.message);
    }
  });

  it("keeps state copy calm, bounded, and free of capability claims", () => {
    const copy = JSON.stringify(getStateMessages("en"));

    expect(copy).toContain("appears to be offline");
    expect(copy).toContain("supporting service");
    expect(copy).not.toMatch(
      /\b(?:cached|saved locally|will sync|automatic retry|AI provider|payment provider|guaranteed)\b/iu,
    );
  });
});
