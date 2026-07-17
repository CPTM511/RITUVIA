import type { ReactElement, ReactNode } from "react";
import { isValidElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, expectTypeOf, it, vi } from "vitest";

import {
  EmptyState,
  ErrorState,
  OfflineState,
  ProviderUnavailableState,
  StatePattern,
  createLocalActionHref,
  createUiControlId,
  type StatePatternAction,
  type StatePatternComponentProps,
  type StatePatternProps,
} from "../src/index.js";

const titleId = createUiControlId("state-title");
const baseProps = {
  message: "A calm, bounded description.",
  title: "A reviewed state title",
  titleId,
} as const;

const findHostElement = (
  node: ReactNode,
  type: string,
): ReactElement<Record<string, unknown>> | null => {
  if (Array.isArray(node)) {
    for (const child of node) {
      const match = findHostElement(child, type);
      if (match !== null) return match;
    }
    return null;
  }
  if (!isValidElement(node)) return null;
  if (typeof node.type === "function") {
    const Component = node.type as (props: Record<string, unknown>) => ReactNode;
    return findHostElement(Component(node.props as Record<string, unknown>), type);
  }
  if (node.type === type) return node as ReactElement<Record<string, unknown>>;
  return findHostElement((node.props as Readonly<{ children?: ReactNode }>).children, type);
};

describe("page-level state patterns", () => {
  it("keeps invalid announcement and action shapes outside the public type contract", () => {
    expectTypeOf<
      typeof baseProps & Readonly<{ live: "assertive" }>
    >().not.toMatchTypeOf<StatePatternProps>();
    expectTypeOf<
      typeof baseProps & Readonly<{ kind: "offline"; live: "assertive" }>
    >().not.toMatchTypeOf<StatePatternComponentProps>();
    expectTypeOf<
      typeof baseProps &
        Readonly<{
          secondaryAction: StatePatternAction;
        }>
    >().not.toMatchTypeOf<StatePatternProps>();
    expectTypeOf<
      Readonly<{
        kind: "button";
        label: string;
        loading: true;
        onPress: () => void;
      }>
    >().not.toMatchTypeOf<StatePatternAction>();
  });

  it("uses one stable component and host boundary across reviewed kind transitions", () => {
    const errorElement = <StatePattern {...baseProps} kind="error" live="off" />;
    const offlineElement = <StatePattern {...baseProps} kind="offline" live="off" />;
    expect(errorElement.type).toBe(StatePattern);
    expect(offlineElement.type).toBe(StatePattern);

    const errorHost = StatePattern(errorElement.props);
    const offlineHost = StatePattern(offlineElement.props);
    expect(isValidElement(errorHost) && errorHost.type).toBe("section");
    expect(isValidElement(offlineHost) && offlineHost.type).toBe("section");
  });

  it("renders the four closed variants with visible, non-color-only state markers", () => {
    const variants = [
      [EmptyState, "empty", "info"],
      [ErrorState, "error", "error"],
      [OfflineState, "offline", "warning"],
      [ProviderUnavailableState, "provider-unavailable", "warning"],
    ] as const;

    for (const [Component, kind, icon] of variants) {
      const html = renderToStaticMarkup(<Component {...baseProps} />);
      expect(html).toContain(`data-kind="${kind}"`);
      expect(html).toContain('aria-labelledby="state-title"');
      expect(html).toContain(`rvt-icon--${icon}`);
      expect(html).toContain('aria-hidden="true"');
      expect(html).toContain(
        '<h2 class="rvt-state-pattern__title" id="state-title" tabindex="-1">',
      );
      expect(html).toContain(baseProps.title);
      expect(html).toContain(baseProps.message);
      expect(html).not.toContain("aria-live=");
      expect(html).not.toContain(" role=");
    }
  });

  it("announces only newly inserted text while keeping actions outside the live region", () => {
    const html = renderToStaticMarkup(
      <ErrorState
        {...baseProps}
        live="assertive"
        primaryAction={{
          href: createLocalActionHref("/en"),
          kind: "link",
          label: "Return home",
        }}
      />,
    );

    expect(html).toContain('aria-atomic="true" aria-live="assertive"');
    expect(html).toContain('role="alert"');
    expect(html).toMatch(/role="alert">[\s\S]*?<\/div><div class="rvt-state-pattern__actions">/u);
    const liveRegionEnd = html.indexOf('</div><div class="rvt-state-pattern__actions">');
    expect(liveRegionEnd).toBeGreaterThan(0);
    expect(html.indexOf("Return home")).toBeGreaterThan(liveRegionEnd);

    const offline = renderToStaticMarkup(<OfflineState {...baseProps} live="polite" titleAs="p" />);
    expect(offline).toContain('aria-live="polite"');
    expect(offline).toContain('role="status"');
    expect(offline).toContain('<p class="rvt-state-pattern__title"');
  });

  it("keeps state actions local, ordered, and loading-safe", () => {
    const onPress = vi.fn();
    const ready = ErrorState({
      ...baseProps,
      primaryAction: { kind: "button", label: "Try again", onPress },
      secondaryAction: {
        href: createLocalActionHref("/en"),
        kind: "link",
        label: "Return home",
      },
    });
    const button = findHostElement(ready, "button");
    expect(button).not.toBeNull();
    const readyClick = button?.props.onClick as
      ((event: Readonly<{ preventDefault: () => void }>) => void) | undefined;
    readyClick?.({ preventDefault: vi.fn() });
    expect(onPress).toHaveBeenCalledOnce();

    const loading = ErrorState({
      ...baseProps,
      primaryAction: {
        kind: "button",
        label: "Try again",
        loading: true,
        loadingLabel: "Trying again",
        onPress,
      },
    });
    const loadingButton = findHostElement(loading, "button");
    const preventDefault = vi.fn();
    const loadingClick = loadingButton?.props.onClick as
      ((event: Readonly<{ preventDefault: () => void }>) => void) | undefined;
    loadingClick?.({ preventDefault });
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(onPress).toHaveBeenCalledOnce();
    expect(loadingButton?.props.disabled).toBe(true);
  });

  it("rejects unreviewed semantics, copy, action shapes, and unsafe local targets at runtime", () => {
    const invalidProps = [
      { ...baseProps, live: "assertive" },
      { ...baseProps, titleAs: "script" },
      { ...baseProps, title: "\u0000" },
      { ...baseProps, message: " " },
      {
        ...baseProps,
        primaryAction: {
          href: "https://tracker.invalid/private-canary",
          kind: "link",
          label: "Leave",
        },
      },
      {
        ...baseProps,
        primaryAction: { kind: "button", label: "Try again", onPress: "not-a-function" },
      },
      {
        ...baseProps,
        secondaryAction: {
          href: createLocalActionHref("/en"),
          kind: "link",
          label: "Return home",
        },
      },
    ] as unknown as StatePatternProps[];

    for (const props of invalidProps) {
      expect(() => renderToStaticMarkup(<OfflineState {...props} />)).toThrow(TypeError);
    }
  });

  it("does not forward unreviewed host props or private canaries", () => {
    const forged = {
      ...baseProps,
      as: "iframe",
      dangerouslySetInnerHTML: { __html: "private-html-canary" },
      onClick: "private-handler-canary",
      style: { background: "url(https://tracker.invalid)" },
    } as unknown as StatePatternProps;
    const html = renderToStaticMarkup(<EmptyState {...forged} />);

    for (const canary of [
      "iframe",
      "private-html-canary",
      "private-handler-canary",
      "tracker.invalid",
      "style=",
    ]) {
      expect(html).not.toContain(canary);
    }
  });
});
