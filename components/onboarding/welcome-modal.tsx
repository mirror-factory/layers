"use client";

/**
 * WelcomeModal — first surface a new user sees on /record.
 *
 * Why a hand-rolled dialog instead of installing @radix-ui/react-dialog?
 * The codebase has zero Radix overlay primitives today and disk space is
 * tight in CI. The keyboard/aria contract here is narrow enough (one
 * focus loop, ESC + outside click to dismiss) that we can ship it
 * accessibly without taking on a new dependency. If we add more modals,
 * extracting `components/ui/dialog.tsx` is the next refactor.
 *
 * Accessibility:
 *   - role="dialog", aria-modal, aria-labelledby + aria-describedby
 *   - Initial focus moves to the primary CTA (highest-affordance action)
 *   - Focus is trapped within the dialog while open
 *   - ESC closes via the "explore" outcome (least destructive)
 *   - Outside click closes via the "explore" outcome
 *   - prefers-reduced-motion: animations are skipped (CSS handled via
 *     `@media (prefers-reduced-motion: reduce)` in the JSX style block)
 */

import { useCallback, useEffect, useRef } from "react";
import { onboardingCopy } from "@/lib/onboarding/copy";

export interface WelcomeModalProps {
  open: boolean;
  onDismiss: (outcome: "primary" | "skip" | "explore") => void;
}

export function WelcomeModal({ open, onDismiss }: WelcomeModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const primaryRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const handleDismiss = useCallback(
    (outcome: "primary" | "skip" | "explore") => {
      onDismiss(outcome);
    },
    [onDismiss],
  );

  // Manage open lifecycle: remember the previously focused element,
  // move focus into the dialog, lock body scroll, and restore on close.
  useEffect(() => {
    if (!open) return;
    previouslyFocusedRef.current =
      typeof document !== "undefined"
        ? (document.activeElement as HTMLElement | null)
        : null;
    const previousOverflow =
      typeof document !== "undefined" ? document.body.style.overflow : "";
    if (typeof document !== "undefined") {
      document.body.style.overflow = "hidden";
    }
    // Defer focus by one frame so the dialog is mounted and visible to
    // screen readers before focus moves into it.
    const focusFrame = requestAnimationFrame(() => {
      primaryRef.current?.focus();
    });
    return () => {
      cancelAnimationFrame(focusFrame);
      if (typeof document !== "undefined") {
        document.body.style.overflow = previousOverflow;
      }
      previouslyFocusedRef.current?.focus?.();
    };
  }, [open]);

  // Keyboard handling: ESC to dismiss, Tab to trap focus inside.
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        handleDismiss("explore");
        return;
      }
      if (event.key !== "Tab") return;
      const root = dialogRef.current;
      if (!root) return;
      const focusable = root.querySelectorAll<HTMLElement>(
        'button, [href], [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, handleDismiss]);

  if (!open) return null;

  const titleId = "onboarding-welcome-title";
  const descId = "onboarding-welcome-body";

  return (
    <div
      className="onboarding-welcome-scrim"
      onMouseDown={(event) => {
        // Only dismiss when the click started on the scrim itself, not on
        // a child element that bubbled the event up.
        if (event.target === event.currentTarget) {
          handleDismiss("explore");
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="onboarding-welcome-card"
      >
        <p className="onboarding-welcome-eyebrow">
          <span className="onboarding-welcome-dot" aria-hidden="true" />
          {onboardingCopy.welcome.eyebrow}
        </p>
        <h2 id={titleId} className="onboarding-welcome-title">
          {onboardingCopy.welcome.title}
        </h2>
        <p id={descId} className="onboarding-welcome-body">
          {onboardingCopy.welcome.body}
        </p>

        <div className="onboarding-welcome-actions">
          <button
            ref={primaryRef}
            type="button"
            className="onboarding-welcome-primary"
            onClick={() => handleDismiss("primary")}
          >
            {onboardingCopy.welcome.primary}
          </button>
          <button
            type="button"
            className="onboarding-welcome-secondary"
            onClick={() => handleDismiss("skip")}
          >
            {onboardingCopy.welcome.secondary}
          </button>
        </div>

        <button
          type="button"
          className="onboarding-welcome-tertiary"
          onClick={() => handleDismiss("explore")}
        >
          {onboardingCopy.welcome.tertiary}
        </button>
      </div>

      <style jsx>{`
        .onboarding-welcome-scrim {
          position: fixed;
          inset: 0;
          z-index: 60;
          display: grid;
          place-items: center;
          padding: clamp(16px, 4vw, 32px);
          background: color-mix(
            in oklch,
            var(--layers-ink) 32%,
            transparent
          );
          backdrop-filter: blur(2px);
          animation: onboardingScrimIn 180ms ease-out;
        }
        .onboarding-welcome-card {
          width: min(100%, 480px);
          background: var(--bg-surface, oklch(0.997 0.004 168));
          border: 1px solid var(--border-default);
          border-radius: 20px;
          padding: clamp(24px, 4vw, 32px);
          display: flex;
          flex-direction: column;
          gap: 14px;
          animation: onboardingCardIn 220ms cubic-bezier(0.22, 1, 0.36, 1);
        }
        .onboarding-welcome-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin: 0;
          font-size: 0.7rem;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--fg-muted);
          font-weight: 540;
        }
        .onboarding-welcome-dot {
          width: 7px;
          height: 7px;
          border-radius: 9999px;
          background: var(--layers-mint);
        }
        .onboarding-welcome-title {
          margin: 0;
          font-family: var(--font-brand-sans);
          font-size: clamp(1.4rem, 2.6vw, 1.7rem);
          line-height: 1.15;
          letter-spacing: -0.02em;
          color: var(--layers-ink);
          font-weight: 600;
        }
        .onboarding-welcome-body {
          margin: 0;
          font-size: 0.95rem;
          line-height: 1.55;
          color: var(--fg-muted);
          max-width: 40ch;
        }
        .onboarding-welcome-actions {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 12px;
          margin-top: 4px;
        }
        .onboarding-welcome-primary {
          appearance: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 44px;
          padding: 10px 18px;
          border-radius: 12px;
          border: 1px solid
            color-mix(in oklch, var(--layers-mint) 60%, var(--layers-ink) 20%);
          background: var(--layers-mint);
          color: var(--layers-ink);
          font-family: var(--font-brand-sans);
          font-size: 0.92rem;
          font-weight: 580;
          cursor: pointer;
          transition:
            background var(--duration-fast, 140ms) var(--ease-out, ease),
            transform var(--duration-fast, 140ms) var(--ease-out, ease);
        }
        .onboarding-welcome-primary:hover {
          background: color-mix(
            in oklch,
            var(--layers-mint) 88%,
            var(--layers-ink)
          );
        }
        .onboarding-welcome-primary:active {
          transform: translateY(1px);
        }
        .onboarding-welcome-primary:focus-visible {
          outline: 2px solid var(--layers-mint);
          outline-offset: 3px;
        }
        .onboarding-welcome-secondary {
          appearance: none;
          background: transparent;
          border: 0;
          color: var(--fg-muted);
          font-family: var(--font-brand-sans);
          font-size: 0.88rem;
          padding: 8px 4px;
          cursor: pointer;
          text-decoration: underline;
          text-underline-offset: 3px;
          text-decoration-color: color-mix(
            in oklch,
            var(--fg-muted) 40%,
            transparent
          );
          transition:
            color var(--duration-fast, 140ms) var(--ease-out, ease),
            text-decoration-color var(--duration-fast, 140ms)
              var(--ease-out, ease);
        }
        .onboarding-welcome-secondary:hover {
          color: var(--layers-ink);
          text-decoration-color: var(--layers-ink);
        }
        .onboarding-welcome-secondary:focus-visible {
          outline: 2px solid var(--layers-mint);
          outline-offset: 3px;
          border-radius: 6px;
        }
        .onboarding-welcome-tertiary {
          align-self: flex-start;
          appearance: none;
          background: transparent;
          border: 0;
          color: var(--fg-faint);
          font-family: var(--font-brand-sans);
          font-size: 0.82rem;
          padding: 6px 0 0;
          cursor: pointer;
        }
        .onboarding-welcome-tertiary:hover {
          color: var(--fg-muted);
        }
        .onboarding-welcome-tertiary:focus-visible {
          outline: 2px solid var(--layers-mint);
          outline-offset: 3px;
          border-radius: 4px;
        }
        @keyframes onboardingScrimIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes onboardingCardIn {
          from {
            opacity: 0;
            transform: translateY(8px) scale(0.985);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .onboarding-welcome-scrim,
          .onboarding-welcome-card {
            animation: none;
          }
          .onboarding-welcome-primary:active {
            transform: none;
          }
        }
      `}</style>
    </div>
  );
}
