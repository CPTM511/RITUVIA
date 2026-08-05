import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  isOnline: true,
  isPending: false,
  pathname: "/en",
  transitionCalls: 0,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => harness.pathname,
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useEffect: (effect: () => void) => effect(),
    useTransition: () =>
      [
        harness.isPending,
        (callback: () => void) => {
          harness.transitionCalls += 1;
          callback();
        },
      ] as const,
  };
});

vi.mock("../app/_components/connection-state", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../app/_components/connection-state")>();
  return {
    ...actual,
    useConnectionAnnouncement: (
      isOnline: boolean,
      offlineAnnouncement: string,
      onlineAnnouncement: string,
    ) => (isOnline ? onlineAnnouncement : offlineAnnouncement),
    useConnectionStatus: () => harness.isOnline,
  };
});

import LocaleError from "../app/[locale]/error";

type StateElementProps = Readonly<{
  kind: "error" | "offline";
  live: "off";
  primaryAction: Readonly<{
    loading?: boolean;
    loadingLabel?: string;
    onPress: () => void;
  }>;
}>;

const findStateElement = (tree: ReactNode): ReactElement<StateElementProps> => {
  if (!isValidElement(tree)) throw new TypeError("Locale error did not return an element.");
  const children = Children.toArray((tree.props as Readonly<{ children?: ReactNode }>).children);
  const state = children.find(
    (child): child is ReactElement<StateElementProps> =>
      isValidElement<StateElementProps>(child) && "kind" in child.props,
  );
  if (state === undefined) throw new TypeError("Locale error did not render a state pattern.");
  return state;
};

describe("locale error runtime contract", () => {
  beforeEach(() => {
    harness.isOnline = true;
    harness.isPending = false;
    harness.pathname = "/en";
    harness.transitionCalls = 0;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("focuses the whole-page title and activates one bounded reset", () => {
    const focus = vi.fn();
    const getElementById = vi.fn(() => ({ focus }));
    vi.stubGlobal("document", { getElementById });
    const reset = vi.fn();

    const tree = LocaleError({ error: new Error("private canary"), reset });
    const state = findStateElement(tree);

    expect(getElementById).toHaveBeenCalledWith("route-error-title");
    expect(focus).toHaveBeenCalledOnce();
    expect(state.props.kind).toBe("error");
    expect(state.props.live).toBe("off");
    state.props.primaryAction.onPress();
    expect(harness.transitionCalls).toBe(1);
    expect(reset).toHaveBeenCalledOnce();

    const html = renderToStaticMarkup(tree);
    expect(html).toContain('id="route-error-title" tabindex="-1"');
    expect(html).not.toContain("private canary");
    expect(html).not.toContain('role="alert"');
  });

  it("suppresses the pending retry and renders the offline variant quietly", () => {
    vi.stubGlobal("document", { getElementById: () => ({ focus: vi.fn() }) });
    harness.isPending = true;
    const pendingTree = LocaleError({ error: new Error("private canary"), reset: vi.fn() });
    const pendingState = findStateElement(pendingTree);
    const pendingHtml = renderToStaticMarkup(pendingTree);

    expect(pendingState.props.primaryAction.loading).toBe(true);
    expect(pendingState.props.primaryAction.loadingLabel).toBe("Trying again");
    expect(pendingHtml).toContain("disabled");
    expect(pendingHtml).toContain("Trying again");

    harness.isOnline = false;
    harness.isPending = false;
    const offlineTree = LocaleError({ error: new Error("private canary"), reset: vi.fn() });
    const offlineState = findStateElement(offlineTree);
    const offlineHtml = renderToStaticMarkup(offlineTree);
    expect(offlineState.props.kind).toBe("offline");
    expect(offlineState.props.live).toBe("off");
    expect(offlineHtml).toContain("appears to be offline");
    expect(offlineHtml).not.toContain("private canary");
  });

  it("keeps the protected Simplified Chinese shell in locale during recovery", () => {
    vi.stubGlobal("document", { getElementById: () => ({ focus: vi.fn() }) });
    harness.pathname = "/zh-Hans";

    const tree = LocaleError({ error: new Error("private canary"), reset: vi.fn() });
    const html = renderToStaticMarkup(tree);

    expect(html).toContain("暂时无法打开这个页面");
    expect(html).toContain('href="/zh-Hans"');
    expect(html).not.toContain("private canary");
  });
});
