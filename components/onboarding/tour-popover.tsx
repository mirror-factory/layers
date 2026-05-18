"use client";

/**
 * TourPopover — anchored coachmark for the walkthrough.
 *
 * Locates its anchor via `[data-onboarding-anchor="<id>"]` and positions
 * itself below/above based on available viewport space. Adds a soft mint
 * glow ring directly on the anchor while active (set via inline style on
 * the anchor element so we don't need a global CSS hook).
 *
 * Why hand-rolled instead of @radix-ui/react-popover? Same rationale as
 * WelcomeModal — disk-tight and we need exactly one anchored popover
 * pattern. The component is intentionally small and easy to swap for a
 * Radix version later.
 *
 * Accessibility: role="dialog" + aria-modal="false" since the rest of the
 * page remains operable. Focus moves to the primary action, ESC and
 * outside-click both fire `onSkip` (the conservative outcome — we do not
 * advance a step the user didn't explicitly confirm).
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { onboardingCopy, ONBOARDING_ANCHOR_ATTR } from "@/lib/onboarding/copy";
import type { TourStepId } from "@/lib/onboarding/copy";

export interface TourPopoverProps {
  step: TourStepId;
  anchorKey: string;
  isLast: boolean;
  onAdvance: () => void;
  onSkip: () => void;
}

interface AnchorBox {
  top: number;
  left: number;
  width: number;
  height: number;
}

function readCssPixelVar(name: string): number {
  if (typeof window === "undefined") return 0;
  const value = window
    .getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function measureAnchor(anchor: Element | null): AnchorBox | null {
  if (!anchor) return null;
  const rect = anchor.getBoundingClientRect();
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
}

const ANCHOR_GLOW_CLASS = "is-onboarding-active";

export function TourPopover({
  step,
  anchorKey,
  isLast,
  onAdvance,
  onSkip,
}: TourPopoverProps) {
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const primaryRef = useRef<HTMLButtonElement | null>(null);
  const [anchorBox, setAnchorBox] = useState<AnchorBox | null>(null);
  const [placement, setPlacement] = useState<"below" | "above">("below");

  const stepCopy =
    step === "record"
      ? onboardingCopy.tour.record
      : step === "calendar"
        ? onboardingCopy.tour.calendar
        : onboardingCopy.tour.mcp;

  const findAnchor = useCallback((): Element | null => {
    if (typeof document === "undefined") return null;
    return document.querySelector(
      `[${ONBOARDING_ANCHOR_ATTR}="${anchorKey}"]`,
    );
  }, [anchorKey]);

  // Position + glow lifecycle. We re-measure on resize and on scroll so the
  // popover stays glued to its anchor.
  useLayoutEffect(() => {
    const anchor = findAnchor();
    setAnchorBox(measureAnchor(anchor));

    if (anchor) {
      anchor.classList.add(ANCHOR_GLOW_CLASS);
    }

    function update() {
      setAnchorBox(measureAnchor(findAnchor()));
    }
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      anchor?.classList.remove(ANCHOR_GLOW_CLASS);
    };
  }, [findAnchor]);

  // Decide above-or-below once we know the popover height.
  useLayoutEffect(() => {
    if (!anchorBox || !popoverRef.current) return;
    const popoverHeight = popoverRef.current.offsetHeight;
    const spaceBelow = window.innerHeight - (anchorBox.top + anchorBox.height);
    setPlacement(spaceBelow < popoverHeight + 16 ? "above" : "below");
  }, [anchorBox]);

  // Move focus to the primary action when the popover appears.
  useEffect(() => {
    const frame = requestAnimationFrame(() => primaryRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [step]);

  // ESC dismisses the tour entirely (matches AC: "dismisses cleanly via ESC").
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onSkip();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onSkip]);

  // Outside click dismisses the tour. We mark presses that started inside
  // the popover so the user can drag-select inside without dismissing.
  useEffect(() => {
    let mouseDownInside = false;
    function onMouseDown(event: MouseEvent) {
      mouseDownInside =
        popoverRef.current?.contains(event.target as Node) ?? false;
    }
    function onMouseUp(event: MouseEvent) {
      if (mouseDownInside) return;
      if (!popoverRef.current) return;
      const target = event.target as Node;
      const inAnchor = findAnchor()?.contains(target) ?? false;
      if (!popoverRef.current.contains(target) && !inAnchor) {
        onSkip();
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [findAnchor, onSkip]);

  if (!anchorBox) return null;

  const safeTop = readCssPixelVar("--safe-top");
  const safeBottom = readCssPixelVar("--safe-bottom");
  const safeLeft = readCssPixelVar("--safe-left");
  const safeRight = readCssPixelVar("--safe-right");
  const margin = 12;
  const viewport = window.visualViewport;
  const viewportWidth =
    typeof window !== "undefined" ? (viewport?.width ?? window.innerWidth) : 1024;
  const viewportHeight =
    typeof window !== "undefined"
      ? (viewport?.height ?? window.innerHeight)
      : 768;
  const popoverWidth = Math.min(
    320,
    Math.max(260, viewportWidth - safeLeft - safeRight - margin * 2),
  );
  const popoverHeight = popoverRef.current?.offsetHeight ?? 172;
  // Center horizontally on the anchor, but clamp to viewport.
  const rawLeft = anchorBox.left + anchorBox.width / 2 - popoverWidth / 2;
  const left = Math.max(
    safeLeft + margin,
    Math.min(rawLeft, viewportWidth - safeRight - popoverWidth - margin),
  );
  const rawTop =
    placement === "below"
      ? anchorBox.top + anchorBox.height + margin
      : anchorBox.top - popoverHeight - margin;
  const top = Math.max(
    safeTop + margin,
    Math.min(rawTop, viewportHeight - safeBottom - popoverHeight - margin),
  );

  const titleId = `onboarding-tour-${step}-title`;
  const descId = `onboarding-tour-${step}-body`;

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      aria-describedby={descId}
      className="onboarding-tour-popover"
      style={{
        position: "fixed",
        top: `${top}px`,
        left: `${left}px`,
        width: `${popoverWidth}px`,
        zIndex: 60,
      }}
    >
      <h3 id={titleId} className="onboarding-tour-title">
        {stepCopy.title}
      </h3>
      <p id={descId} className="onboarding-tour-body">
        {stepCopy.body}
      </p>
      <div className="onboarding-tour-actions">
        <button
          type="button"
          className="onboarding-tour-skip"
          onClick={onSkip}
        >
          {onboardingCopy.tour.skip}
        </button>
        <button
          ref={primaryRef}
          type="button"
          className="onboarding-tour-next"
          onClick={onAdvance}
        >
          {isLast ? onboardingCopy.tour.mcp.next : stepCopy.next}
        </button>
      </div>

      <style jsx>{`
        .onboarding-tour-popover {
          background: var(--bg-surface, oklch(0.997 0.004 168));
          border: 1px solid var(--border-default);
          border-radius: 14px;
          padding: 16px 18px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          box-shadow: 0 12px 32px -16px
            color-mix(in oklch, var(--layers-ink) 40%, transparent);
          animation: onboardingTourIn 200ms cubic-bezier(0.22, 1, 0.36, 1);
        }
        .onboarding-tour-title {
          margin: 0;
          font-family: var(--font-brand-sans);
          font-size: 1rem;
          font-weight: 580;
          color: var(--layers-ink);
        }
        .onboarding-tour-body {
          margin: 0;
          font-size: 0.86rem;
          line-height: 1.5;
          color: var(--fg-muted);
        }
        .onboarding-tour-actions {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-top: 4px;
        }
        .onboarding-tour-skip {
          appearance: none;
          background: transparent;
          border: 0;
          color: var(--fg-faint);
          font-family: var(--font-brand-sans);
          font-size: 0.82rem;
          cursor: pointer;
          padding: 6px 4px;
        }
        .onboarding-tour-skip:hover {
          color: var(--fg-muted);
        }
        .onboarding-tour-skip:focus-visible {
          outline: 2px solid var(--layers-mint);
          outline-offset: 3px;
          border-radius: 4px;
        }
        .onboarding-tour-next {
          appearance: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 36px;
          padding: 8px 16px;
          border-radius: 999px;
          border: 1px solid
            color-mix(in oklch, var(--layers-ink) 88%, transparent);
          background: var(--layers-ink);
          color: var(--bg-surface, #fff);
          font-family: var(--font-brand-sans);
          font-size: 0.85rem;
          font-weight: 560;
          cursor: pointer;
          transition:
            background var(--duration-fast, 140ms) var(--ease-out, ease),
            transform var(--duration-fast, 140ms) var(--ease-out, ease);
        }
        .onboarding-tour-next:hover {
          background: color-mix(
            in oklch,
            var(--layers-ink) 92%,
            var(--layers-mint)
          );
        }
        .onboarding-tour-next:active {
          transform: translateY(1px);
        }
        .onboarding-tour-next:focus-visible {
          outline: 2px solid var(--layers-mint);
          outline-offset: 3px;
        }
        @keyframes onboardingTourIn {
          from {
            opacity: 0;
            transform: translateY(${placement === "above" ? "-4px" : "4px"});
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .onboarding-tour-popover {
            animation: none;
          }
          .onboarding-tour-next:active {
            transform: none;
          }
        }
      `}</style>
    </div>
  );
}
