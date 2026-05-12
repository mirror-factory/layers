// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

// No JSX is used in this file so vitest can transform it without a React
// plugin (see vitest.config.ts). All elements are constructed via
// `React.createElement` and `h()` instead.
import React, { useEffect, useRef, act } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CITATION_FLASH_DURATION_MS,
  SessionIntelligenceCanvas,
  type SessionTranscriptRow,
} from "../../../components/session-workspace";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const h = React.createElement;

const ROWS: SessionTranscriptRow[] = [
  { id: "row-1", timestamp: "0:04", text: "Opening segment about scope." },
  { id: "row-2", timestamp: "0:18", text: "Calendar context next." },
  { id: "row-3", timestamp: "0:35", text: "Action items and owners." },
];

beforeEach(() => {
  vi.useFakeTimers();
  // jsdom doesn't implement scrollIntoView / scrollTo; stub so calls don't
  // throw. `scrollTo` is touched by useStickToBottom inside the transcript
  // list as it mounts.
  Element.prototype.scrollIntoView = vi.fn() as unknown as (
    arg?: boolean | ScrollIntoViewOptions,
  ) => void;
  Element.prototype.scrollTo = vi.fn() as unknown as (
    arg?: number | ScrollToOptions,
    y?: number,
  ) => void;
  // Bridge `requestAnimationFrame` onto setTimeout so it flows through
  // vitest fake timers. The component double-rAF-defers DOM lookups so the
  // tab swap can mount the transcript list first. With fake timers we
  // advance time explicitly in each test.
  vi.stubGlobal(
    "requestAnimationFrame",
    (cb: FrameRequestCallback) =>
      setTimeout(() => cb(performance.now()), 16) as unknown as number,
  );
  vi.stubGlobal("cancelAnimationFrame", (id: number) =>
    clearTimeout(id as unknown as ReturnType<typeof setTimeout>),
  );
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/**
 * Helper render-prop ask panel that publishes the `onCitationClick` callback
 * up via a ref so tests can drive citation clicks directly without depending
 * on the full chat surface.
 */
function makeAskPanel(
  ref: { current: ((n: number) => void) | null },
) {
  return function AskPanel({
    onCitationClick,
  }: {
    onCitationClick: (n: number) => void;
  }) {
    const stableRef = useRef(onCitationClick);
    stableRef.current = onCitationClick;
    useEffect(() => {
      ref.current = (n: number) => stableRef.current?.(n);
    }, []);
    return h("div", { "data-testid": "ask-panel" });
  };
}

function renderCanvas(
  askPanel?: ReturnType<typeof makeAskPanel>,
) {
  return render(
    h(SessionIntelligenceCanvas, {
      mode: "summary",
      summaryText: "x",
      updatedLabel: "now",
      transcriptRows: ROWS,
      keyPoints: [],
      actions: [],
      askPanel,
    }),
  );
}

describe("SessionIntelligenceCanvas citation seek+highlight (PROD-464)", () => {
  it("tags each transcript row with a 1-indexed data-segment attribute", () => {
    renderCanvas();

    // Switch to transcript tab so rows are mounted.
    fireEvent.click(screen.getByRole("tab", { name: /transcript/i }));

    const rows = document.querySelectorAll(
      ".session-transcript-row[data-segment]",
    );
    expect(rows.length).toBe(ROWS.length);
    expect(rows[0].getAttribute("data-segment")).toBe("1");
    expect(rows[1].getAttribute("data-segment")).toBe("2");
    expect(rows[2].getAttribute("data-segment")).toBe("3");
  });

  it("scrolls to the cited segment and applies a citation-flash highlight", () => {
    const handlerRef: { current: ((n: number) => void) | null } = {
      current: null,
    };
    renderCanvas(makeAskPanel(handlerRef));

    // Mount the ask panel so the handler ref is populated.
    fireEvent.click(screen.getByRole("tab", { name: /ask/i }));
    expect(typeof handlerRef.current).toBe("function");

    // Trigger a citation click for segment 2.
    act(() => {
      handlerRef.current?.(2);
    });
    // Flush the double rAF defer so the seek+flash actually runs.
    act(() => {
      vi.advanceTimersByTime(64);
    });

    // Handler should have switched back to the transcript tab so the target
    // row is mounted before we try to scroll to it.
    const transcriptTab = screen.getByRole("tab", { name: /transcript/i });
    expect(transcriptTab.getAttribute("aria-selected")).toBe("true");

    const target = document.querySelector(
      '[data-segment="2"]',
    ) as HTMLElement | null;
    expect(target).not.toBeNull();
    expect(target?.scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "center",
    });
    expect(target?.classList.contains("citation-flash")).toBe(true);

    // Flash class is removed after the documented duration.
    act(() => {
      vi.advanceTimersByTime(CITATION_FLASH_DURATION_MS + 10);
    });
    expect(target?.classList.contains("citation-flash")).toBe(false);
  });

  it("re-triggers the flash when the same segment is clicked twice", () => {
    const handlerRef: { current: ((n: number) => void) | null } = {
      current: null,
    };
    renderCanvas(makeAskPanel(handlerRef));

    fireEvent.click(screen.getByRole("tab", { name: /ask/i }));

    act(() => {
      handlerRef.current?.(1);
    });
    act(() => {
      vi.advanceTimersByTime(64);
    });
    const target = document.querySelector(
      '[data-segment="1"]',
    ) as HTMLElement | null;
    expect(target?.classList.contains("citation-flash")).toBe(true);

    // Second click while the first flash is still active should keep the
    // class on and reset the removal timer.
    act(() => {
      vi.advanceTimersByTime(500);
      handlerRef.current?.(1);
    });
    act(() => {
      vi.advanceTimersByTime(64);
    });
    expect(target?.classList.contains("citation-flash")).toBe(true);

    // Only after a full duration since the SECOND click should it clear.
    act(() => {
      vi.advanceTimersByTime(CITATION_FLASH_DURATION_MS + 10);
    });
    expect(target?.classList.contains("citation-flash")).toBe(false);
  });

  it("ignores clicks targeting segments that do not exist", () => {
    const handlerRef: { current: ((n: number) => void) | null } = {
      current: null,
    };
    renderCanvas(makeAskPanel(handlerRef));

    fireEvent.click(screen.getByRole("tab", { name: /ask/i }));

    expect(() => {
      act(() => {
        handlerRef.current?.(999);
      });
      act(() => {
        vi.advanceTimersByTime(64);
      });
    }).not.toThrow();
  });
});
